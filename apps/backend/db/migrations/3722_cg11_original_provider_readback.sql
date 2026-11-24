-- Optional external status read-back on the ORIGINAL attempt. No dispatch,
-- second payment ledger, or automatic paid journal from a provider ACK.
ALTER TABLE payroll_payout_attempt
 ADD COLUMN provider_connection_ref uuid REFERENCES integration_connection(id),
 ADD COLUMN provider_credential_revision integer,
 ADD COLUMN provider_state text NOT NULL DEFAULT 'NOT_ENABLED' CHECK(provider_state IN('NOT_ENABLED','AWAITING_BANK','PROCESSING','UNKNOWN_WRITE_STATUS','PROCESSED_AWAITING_PROOF','FAILED_AWAITING_PROOF','REVIEW_REQUIRED','EXHAUSTED')),
 ADD COLUMN provider_due_at timestamptz,
 ADD COLUMN provider_claim uuid,
 ADD COLUMN provider_claim_until timestamptz,
 ADD COLUMN provider_checks integer NOT NULL DEFAULT 0 CHECK(provider_checks BETWEEN 0 AND 8),
 ADD COLUMN provider_checked_at timestamptz,
 ADD COLUMN provider_ref text CHECK(provider_ref IS NULL OR provider_ref~'^pout_[A-Za-z0-9]{8,40}$'),
 ADD CONSTRAINT cg11_provider_config_shape CHECK(num_nonnulls(provider_connection_ref,provider_credential_revision) IN(0,2) AND (provider_state='NOT_ENABLED')=(provider_connection_ref IS NULL)),
 ADD CONSTRAINT cg11_provider_lease_shape CHECK((provider_claim IS NULL)=(provider_claim_until IS NULL) AND (provider_due_at IS NOT NULL)=(provider_state IN('AWAITING_BANK','PROCESSING','UNKNOWN_WRITE_STATUS')) AND (provider_claim IS NULL OR provider_due_at IS NOT NULL));
CREATE INDEX ix_cg11_provider_due ON payroll_payout_attempt(provider_due_at,id) WHERE provider_due_at IS NOT NULL;
CREATE UNIQUE INDEX ux_cg11_provider_ref ON payroll_payout_attempt(provider_connection_ref,provider_ref) WHERE provider_ref IS NOT NULL;
DROP TRIGGER cg11_attempt_immutable ON payroll_payout_attempt;
CREATE FUNCTION cg11_provider_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original payout attempt retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['provider_connection_ref','provider_credential_revision','provider_state','provider_due_at','provider_claim','provider_claim_until','provider_checks','provider_checked_at','provider_ref'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['provider_connection_ref','provider_credential_revision','provider_state','provider_due_at','provider_claim','provider_claim_until','provider_checks','provider_checked_at','provider_ref'])
 OR NEW.provider_checks<OLD.provider_checks OR NEW.provider_checks>OLD.provider_checks+1
 OR (OLD.provider_connection_ref IS NOT NULL AND (NEW.provider_connection_ref,NEW.provider_credential_revision) IS DISTINCT FROM (OLD.provider_connection_ref,OLD.provider_credential_revision))
 OR (OLD.provider_ref IS NOT NULL AND NEW.provider_ref IS DISTINCT FROM OLD.provider_ref)
 OR (OLD.provider_state IN('PROCESSED_AWAITING_PROOF','FAILED_AWAITING_PROOF','REVIEW_REQUIRED','EXHAUSTED'))
 THEN RAISE EXCEPTION 'Original payout identity or terminal readback immutable'; END IF;
 IF OLD.provider_state='NOT_ENABLED' THEN
  IF NEW.provider_state<>'AWAITING_BANK' OR NEW.provider_checks<>0 OR NEW.provider_ref IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM integration_connection c JOIN finance_voucher v ON v.root_realm_id=c.foundation_realm_id
   JOIN payroll_batch_item i ON i.root_realm_id=v.root_realm_id AND i.id=NEW.item_ref
   JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref
   WHERE c.id=NEW.provider_connection_ref AND c.foundation_realm_id=NEW.root_realm_id AND c.provider='razorpayx' AND c.purpose='payroll'
   AND c.credential_revision=NEW.provider_credential_revision AND c.verification_status='VERIFIED' AND b.method='BANK' AND v.id=NEW.voucher_ref AND v.status='PAYMENT_REQUESTED')
  THEN RAISE EXCEPTION 'Original configured bank payment request required'; END IF;
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_attempt_immutable BEFORE UPDATE OR DELETE ON payroll_payout_attempt FOR EACH ROW EXECUTE FUNCTION cg11_provider_attempt_guard();
