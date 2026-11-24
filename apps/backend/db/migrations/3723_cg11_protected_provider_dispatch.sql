-- The only automatic bank dispatch is an explicit, protected request on the
-- original Finance voucher. Durable authorization precedes any network call.
ALTER TABLE payroll_payout_attempt
 ADD COLUMN dispatch_actor_ref uuid,
 ADD COLUMN dispatch_authorized_at timestamptz,
 ADD COLUMN provider_utr_digest char(64) CHECK(provider_utr_digest IS NULL OR provider_utr_digest~'^[a-f0-9]{64}$'),
 ADD FOREIGN KEY(dispatch_actor_ref,root_realm_id) REFERENCES account(id,realm_id),
 ADD CONSTRAINT cg11_dispatch_auth_shape CHECK(num_nonnulls(dispatch_actor_ref,dispatch_authorized_at) IN(0,2) AND (dispatch_actor_ref IS NULL OR provider_connection_ref IS NOT NULL));
CREATE OR REPLACE FUNCTION cg11_provider_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original payout attempt retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['provider_connection_ref','provider_credential_revision','provider_state','provider_due_at','provider_claim','provider_claim_until','provider_checks','provider_checked_at','provider_ref','provider_utr_digest','dispatch_actor_ref','dispatch_authorized_at'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['provider_connection_ref','provider_credential_revision','provider_state','provider_due_at','provider_claim','provider_claim_until','provider_checks','provider_checked_at','provider_ref','provider_utr_digest','dispatch_actor_ref','dispatch_authorized_at'])
 OR NEW.provider_checks<OLD.provider_checks OR NEW.provider_checks>OLD.provider_checks+1
 OR (OLD.provider_connection_ref IS NOT NULL AND (NEW.provider_connection_ref,NEW.provider_credential_revision) IS DISTINCT FROM (OLD.provider_connection_ref,OLD.provider_credential_revision))
 OR (OLD.provider_ref IS NOT NULL AND NEW.provider_ref IS DISTINCT FROM OLD.provider_ref)
 OR (OLD.provider_utr_digest IS NOT NULL AND NEW.provider_utr_digest IS DISTINCT FROM OLD.provider_utr_digest)
 OR (OLD.provider_state<>'NOT_ENABLED' AND (NEW.dispatch_actor_ref,NEW.dispatch_authorized_at) IS DISTINCT FROM (OLD.dispatch_actor_ref,OLD.dispatch_authorized_at))
 OR (OLD.provider_state IN('PROCESSED_AWAITING_PROOF','FAILED_AWAITING_PROOF','REVIEW_REQUIRED','EXHAUSTED'))
 THEN RAISE EXCEPTION 'Original payout identity or terminal readback immutable'; END IF;
 IF OLD.provider_state='NOT_ENABLED' THEN
  IF NEW.dispatch_actor_ref IS NOT NULL AND (NEW.provider_state<>'UNKNOWN_WRITE_STATUS' OR NOT EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.realm_id=a.realm_id AND ar.account_id=a.id AND ar.revoked_at IS NULL JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected WHERE a.realm_id=NEW.root_realm_id AND a.id=NEW.dispatch_actor_ref AND a.status='ACTIVE') OR NEW.dispatch_authorized_at<now()-interval '1 minute' OR NEW.dispatch_authorized_at>now()+interval '1 minute') THEN RAISE EXCEPTION 'Current protected dispatch authorization required'; END IF;
  IF NEW.provider_state NOT IN('AWAITING_BANK','UNKNOWN_WRITE_STATUS') OR NEW.provider_checks<>0 OR NEW.provider_ref IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM integration_connection c JOIN finance_voucher v ON v.root_realm_id=c.foundation_realm_id
   JOIN payroll_batch_item i ON i.root_realm_id=v.root_realm_id AND i.id=NEW.item_ref
   JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref
   WHERE c.id=NEW.provider_connection_ref AND c.foundation_realm_id=NEW.root_realm_id AND c.provider='razorpayx' AND c.purpose='payroll'
   AND c.credential_revision=NEW.provider_credential_revision AND c.verification_status='VERIFIED' AND b.method='BANK' AND v.id=NEW.voucher_ref AND v.status='PAYMENT_REQUESTED')
  THEN RAISE EXCEPTION 'Original configured bank payment request required'; END IF;
 END IF;
 RETURN NEW;
END; $fn$;

CREATE FUNCTION cg11_guard_provider_proof() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE t payroll_payout_attempt%ROWTYPE;
BEGIN
 IF TG_OP<>'UPDATE' OR (NEW.status<>'VERIFIED' AND NOT NEW.payroll_failure_verified) THEN RETURN NEW; END IF;
 SELECT * INTO t FROM payroll_payout_attempt WHERE root_realm_id=NEW.root_realm_id AND voucher_ref=NEW.voucher_id FOR SHARE;
 IF NOT FOUND OR t.provider_state='NOT_ENABLED' THEN RETURN NEW; END IF;
 IF (NEW.status='VERIFIED' AND (t.provider_state<>'PROCESSED_AWAITING_PROOF' OR t.provider_utr_digest IS NULL OR t.provider_utr_digest<>encode(digest(t.id::text||':'||upper(btrim(NEW.bank_reference)),'sha256'),'hex')))
 OR (NEW.payroll_failure_verified AND t.provider_state<>'FAILED_AWAITING_PROOF')
 THEN RAISE EXCEPTION 'Original provider status and independent bank proof must agree' USING ERRCODE='P0940'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_provider_proof_guard BEFORE UPDATE ON finance_voucher_payment_verification FOR EACH ROW EXECUTE FUNCTION cg11_guard_provider_proof();
