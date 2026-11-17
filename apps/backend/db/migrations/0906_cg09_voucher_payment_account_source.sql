-- CG-09 US-002: genuine masked cash/bank selector, without broad ledger read.
-- Source stays Finance-owned, original voucher revision is immutable after review.
ALTER TABLE finance_voucher
 ADD COLUMN payment_account_id uuid,
 ADD CONSTRAINT cg09_voucher_payment_account_fk FOREIGN KEY(root_realm_id,payment_account_id)
  REFERENCES cash_bank_account(root_realm_id,account_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg09_voucher_bank_scope
 ON finance_voucher(root_realm_id,payment_account_id,created_at DESC)
 WHERE payment_account_id IS NOT NULL;

CREATE FUNCTION cg09_guard_voucher_payment_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record;
BEGIN
 IF NEW.voucher_type IN ('PAYMENT','CONTRA') AND NEW.payment_account_id IS NULL THEN
  RAISE EXCEPTION 'Choose an active cash or bank account for this voucher'
   USING ERRCODE='P0914';
 END IF;
 IF TG_OP='UPDATE' AND OLD.status IN('SUBMITTED','APPROVED','REJECTED') AND
   NEW.payment_account_id IS DISTINCT FROM OLD.payment_account_id THEN
  RAISE EXCEPTION 'Submitted account selection is immutable'
   USING ERRCODE='P0907';
 END IF;
 IF NEW.payment_account_id IS NOT NULL THEN
  SELECT a.status,a.branch_id,a.scope_kind,c.status AS cash_status
    INTO a FROM finance_account a
   JOIN cash_bank_account c ON c.account_id=a.id
    AND c.root_realm_id=a.root_realm_id
   WHERE a.id=NEW.payment_account_id AND a.root_realm_id=NEW.root_realm_id
    AND a.account_kind IN('CASH','BANK') FOR SHARE OF a,c;
  IF NOT FOUND OR a.status<>'ACTIVE' OR a.cash_status<>'ACTIVE'
    OR (a.scope_kind='BRANCH' AND a.branch_id IS DISTINCT FROM NEW.branch_id) THEN
   RAISE EXCEPTION 'Selected cash or bank account is not available in this branch'
    USING ERRCODE='P0914';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_voucher_payment_source_guard
 BEFORE INSERT OR UPDATE ON finance_voucher FOR EACH ROW
 EXECUTE FUNCTION cg09_guard_voucher_payment_source();

CREATE FUNCTION cg09_voucher_payment_snapshot_matches() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h jsonb;
BEGIN
 SELECT header_snapshot INTO h FROM finance_voucher_draft_revision
  WHERE voucher_id=NEW.id AND root_realm_id=NEW.root_realm_id
    AND version=NEW.version;
 IF NOT FOUND OR h->>'paymentAccountRef' IS DISTINCT FROM NEW.payment_account_id::text THEN
  RAISE EXCEPTION 'Frozen cash or bank selection does not match this voucher'
   USING ERRCODE='P0913';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_voucher_payment_revision
 AFTER INSERT OR UPDATE ON finance_voucher DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_voucher_payment_snapshot_matches();
