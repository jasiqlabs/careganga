-- CG17 US004: original center-owned patient money, NOT Foundation finance.
-- Patient can remain DUE independently of actual CG17 approved Foundation
-- liability. US003 future gateway uses the SAME center_collection owner.
ALTER TABLE patient_charge ADD CONSTRAINT uq_cg17_charge_center_scope
 UNIQUE(root_realm_id,id,center_ref);
CREATE TABLE center_collection(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 charge_ref uuid NOT NULL,
 method text NOT NULL CHECK(method IN('CASH','UPI','CARD','BANK')),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 verification_state text NOT NULL CHECK(verification_state IN
  ('VERIFIED_CASH','PENDING_EXTERNAL','VERIFIED_PROVIDER','REJECTED')),
 cash_receipt_number varchar(60),
 payer_reference varchar(100),
 evidence_ref uuid,
 attempt_ref uuid,
 external_payment_ref varchar(128),
 cash_attested_at timestamptz,
 accepted_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,accepted_by_account,request_key),
 UNIQUE(root_realm_id,id,charge_ref),
 FOREIGN KEY(root_realm_id,charge_ref,center_ref)
  REFERENCES patient_charge(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(accepted_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((method='CASH' AND verification_state='VERIFIED_CASH' AND
  cash_receipt_number IS NOT NULL AND cash_attested_at IS NOT NULL AND
  attempt_ref IS NULL AND external_payment_ref IS NULL AND evidence_ref IS NULL)
  OR (method<>'CASH' AND verification_state IN('PENDING_EXTERNAL',
   'VERIFIED_PROVIDER','REJECTED') AND cash_receipt_number IS NULL AND
   cash_attested_at IS NULL)),
 CHECK(verification_state<>'VERIFIED_PROVIDER' OR
  (attempt_ref IS NOT NULL AND external_payment_ref IS NOT NULL))
);
CREATE UNIQUE INDEX ux_cg17_original_cash_receipt
 ON center_collection(root_realm_id,center_ref,cash_receipt_number)
 WHERE method='CASH';
CREATE UNIQUE INDEX ux_cg17_external_payment
 ON center_collection(root_realm_id,center_ref,external_payment_ref)
 WHERE external_payment_ref IS NOT NULL;
CREATE INDEX ix_cg17_charge_collections
 ON center_collection(root_realm_id,charge_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg17_center_collections
 ON center_collection(root_realm_id,center_ref,created_at DESC,id DESC);

CREATE TABLE center_collection_adjustment(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 collection_ref uuid NOT NULL,
 charge_ref uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('CASH_REFUND','CASH_CORRECTION')),
 refund_minor bigint NOT NULL CHECK(refund_minor BETWEEN 1 AND 10000000000),
 cash_refund_receipt varchar(60) NOT NULL,
 reason varchar(400) NOT NULL CHECK(length(btrim(reason))>=8),
 verified_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,verified_by_account,request_key),
 UNIQUE(root_realm_id,collection_ref,cash_refund_receipt),
 FOREIGN KEY(root_realm_id,collection_ref,charge_ref)
  REFERENCES center_collection(root_realm_id,id,charge_ref) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg17_adjustment_collection
 ON center_collection_adjustment(root_realm_id,collection_ref,created_at,id);
CREATE FUNCTION cg17_center_money_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 RAISE EXCEPTION 'Original center payment evidence is immutable; use a linked adjustment';
END $cg17$;
CREATE TRIGGER cg17_center_collection_frozen
 BEFORE UPDATE OR DELETE ON center_collection
 FOR EACH ROW EXECUTE FUNCTION cg17_center_money_immutable();
CREATE TRIGGER cg17_center_refund_frozen
 BEFORE UPDATE OR DELETE ON center_collection_adjustment
 FOR EACH ROW EXECUTE FUNCTION cg17_center_money_immutable();
-- No Foundation financial journal, provider settlement, or legal patient
-- receipt is implied by a pending electronic assertion.
