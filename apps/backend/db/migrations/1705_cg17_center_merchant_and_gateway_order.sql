-- CG-17 US-003: real center-owned merchant onboarding and original Razorpay
-- order attempts. No Foundation account or CG14 settlement bank reuse.
-- Secret values are never written here; the scoped env/vault reference points
-- to a separately provisioned and independently checked center credential.
CREATE TABLE center_merchant_binding(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 provider text NOT NULL CHECK(provider='RAZORPAY'),
 provider_merchant_ref varchar(80) NOT NULL,
 protected_credential_ref varchar(128) NOT NULL,
 public_key_id varchar(80) NOT NULL,
 verification_state text NOT NULL DEFAULT 'PENDING_VERIFICATION'
  CHECK(verification_state IN('PENDING_VERIFICATION','VERIFIED','REVOKED')),
 proposed_by uuid NOT NULL,
 verified_by uuid,
 verified_at timestamptz,
 revoked_by uuid,
 revoked_at timestamptz,
 original_proof_ref varchar(128),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,id,center_ref),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(revoked_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((verification_state='PENDING_VERIFICATION' AND verified_by IS NULL
  AND verified_at IS NULL AND revoked_at IS NULL) OR
  (verification_state='VERIFIED' AND verified_by IS NOT NULL
   AND verified_by<>proposed_by AND verified_at IS NOT NULL
   AND revoked_at IS NULL AND original_proof_ref IS NOT NULL) OR
  (verification_state='REVOKED' AND revoked_by IS NOT NULL
   AND revoked_at IS NOT NULL)),
 CHECK(verified_at IS NULL OR verified_at>=created_at),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE UNIQUE INDEX ux_cg17_active_center_merchant
 ON center_merchant_binding(root_realm_id,center_ref)
 WHERE verification_state IN('PENDING_VERIFICATION','VERIFIED');
-- A merchant key must never be reused for a different center or Foundation
-- realm. This blocks an accidentally provisioned Foundation-wide key.
CREATE UNIQUE INDEX ux_cg17_one_center_per_provider_key
 ON center_merchant_binding(provider,public_key_id)
 WHERE verification_state IN('PENDING_VERIFICATION','VERIFIED');
CREATE INDEX ix_cg17_merchant_review
 ON center_merchant_binding(root_realm_id,verification_state,created_at DESC,id);
CREATE FUNCTION cg17_merchant_binding_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Merchant binding history cannot be deleted';
 END IF;
 IF (to_jsonb(NEW)-'verification_state'-'verified_by'-'verified_at'
    -'revoked_by'-'revoked_at'-'original_proof_ref'-'revision') IS DISTINCT FROM
    (to_jsonb(OLD)-'verification_state'-'verified_by'-'verified_at'
    -'revoked_by'-'revoked_at'-'original_proof_ref'-'revision') THEN
  RAISE EXCEPTION 'Merchant source, operator and credentials are immutable';
 END IF;
 IF NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Merchant transition revision must advance exactly once';
 END IF;
 IF NOT ((OLD.verification_state='PENDING_VERIFICATION' AND
    NEW.verification_state IN('VERIFIED','REVOKED')) OR
   (OLD.verification_state='VERIFIED' AND NEW.verification_state='REVOKED'))
 THEN
  RAISE EXCEPTION 'Merchant transition invalid';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_merchant_binding_immutable
 BEFORE UPDATE OR DELETE ON center_merchant_binding
 FOR EACH ROW EXECUTE FUNCTION cg17_merchant_binding_guard();

CREATE TABLE center_payment_attempt(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 charge_ref uuid NOT NULL,
 binding_ref uuid NOT NULL,
 provider text NOT NULL DEFAULT 'RAZORPAY' CHECK(provider='RAZORPAY'),
 order_receipt varchar(40) NOT NULL,
 external_order_ref varchar(64),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'INITIALIZING' CHECK(status IN
  ('INITIALIZING','PENDING','UNKNOWN','FAILED','CONFIRMED')),
 provider_payment_ref varchar(128),
 accepted_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,id,charge_ref),
 UNIQUE(root_realm_id,accepted_by_account,request_key),
 UNIQUE(root_realm_id,binding_ref,order_receipt),
 FOREIGN KEY(root_realm_id,charge_ref,center_ref)
  REFERENCES patient_charge(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,binding_ref,center_ref)
  REFERENCES center_merchant_binding(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(accepted_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='INITIALIZING' AND external_order_ref IS NULL) OR
   (status<>'INITIALIZING')),
 CHECK(status<>'PENDING' OR external_order_ref IS NOT NULL),
 CHECK(status<>'CONFIRMED' OR
  (external_order_ref IS NOT NULL AND provider_payment_ref IS NOT NULL))
);
CREATE UNIQUE INDEX ux_cg17_merchant_order
 ON center_payment_attempt(root_realm_id,binding_ref,external_order_ref)
 WHERE external_order_ref IS NOT NULL;
CREATE UNIQUE INDEX ux_cg17_merchant_paid_payment
 ON center_payment_attempt(root_realm_id,binding_ref,provider_payment_ref)
 WHERE provider_payment_ref IS NOT NULL;
CREATE UNIQUE INDEX ux_cg17_only_one_pending_order
 ON center_payment_attempt(root_realm_id,charge_ref)
 WHERE status IN('INITIALIZING','PENDING','UNKNOWN');
CREATE INDEX ix_cg17_payment_attempt_scope
 ON center_payment_attempt(root_realm_id,center_ref,charge_ref,created_at DESC,id);
ALTER TABLE center_collection ADD CONSTRAINT fk_cg17_center_verified_payment_attempt
 FOREIGN KEY(root_realm_id,attempt_ref,charge_ref)
 REFERENCES center_payment_attempt(root_realm_id,id,charge_ref)
 ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg17_verified_collection_attempt
 ON center_collection(root_realm_id,attempt_ref)
 WHERE verification_state='VERIFIED_PROVIDER';
CREATE TABLE cg17_merchant_event(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 binding_ref uuid NOT NULL,
 attempt_ref uuid,
 provider_event_ref varchar(128) NOT NULL,
 event_kind varchar(64) NOT NULL,
 event_digest char(64) NOT NULL CHECK(event_digest ~ '^[a-f0-9]{64}$'),
 result text NOT NULL CHECK(result IN('VERIFIED_CAPTURE','IGNORED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,binding_ref,provider_event_ref),
 FOREIGN KEY(root_realm_id,binding_ref)
  REFERENCES center_merchant_binding(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attempt_ref)
  REFERENCES center_payment_attempt(root_realm_id,id) ON DELETE RESTRICT
);
-- Refund events are genuine provider reconciliations, not cash-attested
-- corrections. Keep the existing single center_collection_adjustment owner.
ALTER TABLE center_collection_adjustment
 ADD COLUMN provider_refund_ref varchar(128),
 ADD COLUMN provider_verified_at timestamptz;
ALTER TABLE center_collection_adjustment
 ALTER COLUMN cash_refund_receipt DROP NOT NULL,
 ALTER COLUMN verified_by_account DROP NOT NULL;
ALTER TABLE center_collection_adjustment
 DROP CONSTRAINT center_collection_adjustment_kind_check;
ALTER TABLE center_collection_adjustment ADD CONSTRAINT
 cg17_adjustment_kind CHECK(kind IN(
  'CASH_REFUND','CASH_CORRECTION','PROVIDER_REFUND'));
ALTER TABLE center_collection_adjustment ADD CONSTRAINT
 cg17_adjustment_evidence_provenance CHECK(
  (kind IN('CASH_REFUND','CASH_CORRECTION') AND
   cash_refund_receipt IS NOT NULL AND verified_by_account IS NOT NULL
   AND provider_refund_ref IS NULL AND provider_verified_at IS NULL)
  OR
  (kind='PROVIDER_REFUND' AND cash_refund_receipt IS NULL
   AND verified_by_account IS NULL AND provider_refund_ref IS NOT NULL
   AND provider_verified_at IS NOT NULL));
CREATE UNIQUE INDEX ux_cg17_provider_refund_exact
 ON center_collection_adjustment(root_realm_id,provider_refund_ref)
 WHERE provider_refund_ref IS NOT NULL;
CREATE FUNCTION cg17_payment_event_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg17$
BEGIN
 RAISE EXCEPTION 'Original provider payment evidence cannot be modified or deleted';
END $cg17$;
CREATE TRIGGER cg17_merchant_event_immutable BEFORE UPDATE OR DELETE
 ON cg17_merchant_event FOR EACH ROW EXECUTE FUNCTION cg17_payment_event_frozen();
