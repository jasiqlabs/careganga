-- CG07 US002 cash collection uses a genuine CG09 journal, NOT a second ledger.
CREATE SEQUENCE cg07_donation_public_sequence;
ALTER TABLE donation ADD COLUMN donation_number text NOT NULL
 DEFAULT ('CG-DON-'||lpad(nextval('cg07_donation_public_sequence')::text,8,'0'));
ALTER TABLE donation ADD CONSTRAINT uq_cg07_donation_public_number UNIQUE(root_realm_id,donation_number);
CREATE TABLE donation_manual_evidence(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 request_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 voucher_reference text NOT NULL CHECK(length(btrim(voucher_reference)) BETWEEN 4 AND 100),
 method text NOT NULL CHECK(method='CASH'),
 cash_account_ref uuid NOT NULL,
 income_account_ref uuid NOT NULL CHECK(income_account_ref<>cash_account_ref),
 financial_year_ref uuid NOT NULL,
 posting_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN('PENDING_REVIEW','POSTED')),
 recorded_by uuid NOT NULL,
 reviewed_by uuid,
 review_request_key uuid,
 review_digest char(64),
 journal_ref uuid,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,donation_id),
 UNIQUE(root_realm_id,recorded_by,request_key),
 UNIQUE(root_realm_id,voucher_reference),
 UNIQUE(root_realm_id,review_request_key),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attempt_id,donation_id)
  REFERENCES donation_payment_attempt(root_realm_id,id,donation_id) ON DELETE RESTRICT,
 FOREIGN KEY(cash_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(income_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(financial_year_ref,root_realm_id) REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_ref,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((status='PENDING_REVIEW' AND reviewed_by IS NULL AND journal_ref IS NULL
   AND review_request_key IS NULL AND review_digest IS NULL AND reviewed_at IS NULL)
  OR (status='POSTED' AND reviewed_by IS NOT NULL AND reviewed_by<>recorded_by
   AND journal_ref IS NOT NULL AND review_request_key IS NOT NULL AND review_digest IS NOT NULL
   AND reviewed_at IS NOT NULL))
);
CREATE INDEX ix_cg07_manual_review ON donation_manual_evidence(root_realm_id,status,recorded_at DESC,id DESC);
CREATE FUNCTION cg07_manual_evidence_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted donation proof is immutable'; END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.id IS DISTINCT FROM OLD.id OR NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
    NEW.attempt_id IS DISTINCT FROM OLD.attempt_id OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
    NEW.voucher_reference IS DISTINCT FROM OLD.voucher_reference OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
    NEW.recorded_by IS DISTINCT FROM OLD.recorded_by OR
    NEW.cash_account_ref IS DISTINCT FROM OLD.cash_account_ref OR
    NEW.income_account_ref IS DISTINCT FROM OLD.income_account_ref OR
    NEW.financial_year_ref IS DISTINCT FROM OLD.financial_year_ref OR
    NEW.posting_date IS DISTINCT FROM OLD.posting_date OR
    NEW.recorded_at IS DISTINCT FROM OLD.recorded_at THEN
  RAISE EXCEPTION 'Original cash proof cannot be rewritten'; END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg07_manual_proof_immutable BEFORE UPDATE ON donation_manual_evidence
 FOR EACH ROW EXECUTE FUNCTION cg07_manual_evidence_lifecycle_guard();
CREATE TRIGGER cg07_manual_proof_no_delete BEFORE DELETE ON donation_manual_evidence
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_event_immutable();
