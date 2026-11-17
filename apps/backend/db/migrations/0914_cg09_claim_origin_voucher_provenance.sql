-- CG-09 US-003: claim-origin provenance belongs to the original voucher.
-- Never attach an arbitrary unrelated posted expense/payment, even for same amount.
CREATE SEQUENCE cg09_claim_number_sequence;
ALTER TABLE expense_claim
 ADD COLUMN claim_number text NOT NULL DEFAULT
 ('CG-CL-'||lpad(nextval('cg09_claim_number_sequence')::text,10,'0')),
 ADD CONSTRAINT ux_cg09_claim_public_number UNIQUE(root_realm_id,claim_number);
ALTER TABLE finance_voucher
 ADD COLUMN expense_claim_id uuid,
 ADD COLUMN expense_claim_version integer,
 ADD CONSTRAINT cg09_voucher_claim_pair CHECK(
  (expense_claim_id IS NULL AND expense_claim_version IS NULL) OR
  (expense_claim_id IS NOT NULL AND expense_claim_version>0)),
 ADD CONSTRAINT fk_cg09_voucher_claim FOREIGN KEY(expense_claim_id,root_realm_id)
   REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg09_original_claim_vouchers
 ON finance_voucher(root_realm_id,expense_claim_id,created_at DESC,id DESC)
 WHERE expense_claim_id IS NOT NULL;
CREATE FUNCTION cg09_voucher_claim_origin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligible record;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.expense_claim_id IS DISTINCT FROM OLD.expense_claim_id
   OR NEW.expense_claim_version IS DISTINCT FROM OLD.expense_claim_version) THEN
  RAISE EXCEPTION 'Claim source cannot change after voucher creation' USING ERRCODE='P0920';
 END IF;
 IF NEW.expense_claim_id IS NOT NULL THEN
  IF NEW.voucher_type NOT IN('EXPENSE','PAYMENT') THEN
   RAISE EXCEPTION 'Unsupported claim voucher type' USING ERRCODE='P0920';
  END IF;
  SELECT status,version,amount_minor INTO eligible
   FROM expense_claim WHERE id=NEW.expense_claim_id
    AND root_realm_id=NEW.root_realm_id FOR SHARE;
  IF NOT FOUND OR eligible.status<>'APPROVED' OR
     eligible.version<>NEW.expense_claim_version OR
     eligible.amount_minor<>NEW.total_minor THEN
   RAISE EXCEPTION 'An approved original claim with equal amount is required'
    USING ERRCODE='P0920';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_voucher_claim_origin_guard
 BEFORE INSERT OR UPDATE ON finance_voucher FOR EACH ROW
 EXECUTE FUNCTION cg09_voucher_claim_origin_guard();

CREATE OR REPLACE FUNCTION cg09_claim_voucher_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original record; voucher_row record; payable record; debit_category text; credit_category text;
BEGIN
 SELECT status,amount_minor,version INTO original FROM expense_claim
 WHERE id=NEW.claim_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR original.status<>'APPROVED' THEN
  RAISE EXCEPTION 'Only approved claims may link vouchers' USING ERRCODE='P0920';
 END IF;
 SELECT v.id,v.status,v.voucher_type,v.total_minor,v.debit_account_id,
   v.credit_account_id,v.expense_claim_id,v.expense_claim_version,p.journal_id
   INTO voucher_row FROM finance_voucher v JOIN finance_voucher_posting p
   ON p.voucher_id=v.id AND p.root_realm_id=v.root_realm_id
 WHERE v.id=NEW.voucher_id AND v.root_realm_id=NEW.root_realm_id
 FOR SHARE OF v,p;
 IF NOT FOUND OR voucher_row.status<>'POSTED' OR
    voucher_row.expense_claim_id IS DISTINCT FROM NEW.claim_id OR
    voucher_row.expense_claim_version<>original.version OR
    voucher_row.total_minor<>original.amount_minor OR
    voucher_row.journal_id IS DISTINCT FROM NEW.ledger_journal_id THEN
   RAISE EXCEPTION 'The original verified claim voucher is not eligible' USING ERRCODE='P0920';
 END IF;
 IF NEW.link_kind='PAYABLE' THEN
  SELECT g.category INTO debit_category FROM finance_account a
   JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE a.id=voucher_row.debit_account_id AND a.root_realm_id=NEW.root_realm_id;
  SELECT g.category INTO credit_category FROM finance_account a
   JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE a.id=voucher_row.credit_account_id AND a.root_realm_id=NEW.root_realm_id;
  IF voucher_row.voucher_type<>'EXPENSE' OR
     debit_category<>'EXPENSE' OR credit_category<>'LIABILITY' THEN
   RAISE EXCEPTION 'Payable must be one posted expense to liability' USING ERRCODE='P0920';
  END IF;
 ELSE
  SELECT v.credit_account_id INTO payable FROM expense_claim_voucher_link l
   JOIN finance_voucher v ON v.id=l.voucher_id AND v.root_realm_id=l.root_realm_id
   WHERE l.claim_id=NEW.claim_id AND l.root_realm_id=NEW.root_realm_id
     AND l.link_kind='PAYABLE' FOR SHARE OF l,v;
  IF NOT FOUND OR voucher_row.voucher_type<>'PAYMENT'
    OR voucher_row.debit_account_id IS DISTINCT FROM payable.credit_account_id THEN
   RAISE EXCEPTION 'Payout must clear the original posted claim liability' USING ERRCODE='P0920';
  END IF;
  PERFORM 1 FROM finance_voucher_payment_verification
   WHERE root_realm_id=NEW.root_realm_id AND voucher_id=NEW.voucher_id
    AND status='VERIFIED' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Payout requires separately verified real money' USING ERRCODE='P0920';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
