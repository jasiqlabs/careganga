-- CG-09 US-004 completed real receipt: one independently reconciled original
-- bank deposit journal settles one original posted invoice, without second GL.
CREATE SEQUENCE cg09_receipt_number_sequence;
CREATE TABLE finance_invoice_receipt(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 receipt_number text NOT NULL DEFAULT ('CG-RCPT-'||lpad(nextval('cg09_receipt_number_sequence')::text,10,'0')),
 invoice_id uuid NOT NULL,
 source_invoice_version integer NOT NULL CHECK(source_invoice_version>0),
 journal_id uuid NOT NULL,
 reconciliation_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'PAID_VERIFIED' CHECK(status='PAID_VERIFIED'),
 receipt_date date NOT NULL,
 recorded_by uuid NOT NULL,
 request_key uuid NOT NULL,
 immutable_digest char(64) NOT NULL CHECK(immutable_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,receipt_number),
 UNIQUE(root_realm_id,journal_id),UNIQUE(root_realm_id,reconciliation_id),
 UNIQUE(root_realm_id,recorded_by,request_key),UNIQUE(id,root_realm_id),
 FOREIGN KEY(invoice_id,root_realm_id)
  REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reconciliation_id,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_receipt_invoice ON finance_invoice_receipt
 (root_realm_id,invoice_id,created_at DESC,id DESC);
CREATE TRIGGER cg09_receipt_immutable BEFORE UPDATE OR DELETE ON finance_invoice_receipt
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_receipt_verified_posting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv record; r record; posted record; journal_date date; already_paid numeric;
BEGIN
 SELECT status,version,total_minor,receivable_account_id,branch_id INTO inv
 FROM finance_invoice WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id
 FOR UPDATE;
 IF NOT FOUND OR inv.status<>'ISSUED' OR inv.version<>NEW.source_invoice_version OR
    NEW.amount_minor>inv.total_minor THEN
  RAISE EXCEPTION 'Valid issued original invoice and receipt required' USING ERRCODE='P0927';
 END IF;
 SELECT COALESCE(SUM(amount_minor),0) INTO already_paid
 FROM finance_invoice_receipt WHERE invoice_id=NEW.invoice_id
  AND root_realm_id=NEW.root_realm_id;
 IF already_paid+NEW.amount_minor>inv.total_minor THEN
  RAISE EXCEPTION 'Receipt exceeds original invoice outstanding amount' USING ERRCODE='P0927';
 END IF;
 SELECT bank_account_id,journal_id,statement_date,statement_amount_minor,
  posted_amount_minor,variance_minor,status INTO r
 FROM finance_bank_reconciliation
 WHERE id=NEW.reconciliation_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR r.status<>'VERIFIED' OR r.variance_minor<>0 OR
    r.statement_amount_minor<>NEW.amount_minor OR r.posted_amount_minor<>NEW.amount_minor
    OR r.journal_id<>NEW.journal_id OR r.statement_date<>NEW.receipt_date THEN
  RAISE EXCEPTION 'Independently verified real bank receipt is required' USING ERRCODE='P0927';
 END IF;
 SELECT j.posting_date INTO journal_date FROM journal j
 WHERE j.id=NEW.journal_id AND j.root_realm_id=NEW.root_realm_id
  AND j.status='POSTED' AND j.posting_kind='GENERAL' AND j.source_ref=NEW.invoice_id FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'An existing posted balanced receipt journal is required' USING ERRCODE='P0927';
 END IF;
 SELECT COUNT(*)::int AS line_count,
  COALESCE(SUM(l.debit_minor),0) AS debit_total,
  COALESCE(SUM(l.credit_minor),0) AS credit_total,
  COUNT(*) FILTER (WHERE l.account_id=r.bank_account_id
    AND l.branch_id IS NOT DISTINCT FROM inv.branch_id
    AND l.debit_minor=NEW.amount_minor AND l.credit_minor=0) AS bank_line_count,
  COUNT(*) FILTER (WHERE l.account_id=inv.receivable_account_id
    AND l.branch_id IS NOT DISTINCT FROM inv.branch_id
    AND l.credit_minor=NEW.amount_minor AND l.debit_minor=0) AS receivable_line_count
 INTO posted FROM journal_line l WHERE l.journal_id=NEW.journal_id
   AND l.root_realm_id=NEW.root_realm_id;
 IF posted.line_count<>2 OR posted.debit_total<>NEW.amount_minor OR
  posted.credit_total<>NEW.amount_minor OR posted.bank_line_count<>1 OR
  posted.receivable_line_count<>1 THEN
  RAISE EXCEPTION 'Real receipt must be a bank debit against this original invoice receivable'
   USING ERRCODE='P0927';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_verified_receipt_guard
 BEFORE INSERT ON finance_invoice_receipt FOR EACH ROW
 EXECUTE FUNCTION cg09_receipt_verified_posting_guard();

ALTER TABLE finance_invoice_command DROP CONSTRAINT finance_invoice_command_action_check;
ALTER TABLE finance_invoice_command ADD CONSTRAINT finance_invoice_command_action_check
 CHECK(action IN('DRAFT_SAVE','SUBMIT','RECONCILE','ACCRUAL_POST','ISSUE','COLLECTION_POST','RECEIPT_LINK'));
