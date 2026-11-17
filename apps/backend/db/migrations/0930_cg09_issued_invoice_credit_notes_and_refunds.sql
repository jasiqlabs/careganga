-- CG-09 V1: one full-value correction of a genuinely ISSUED original invoice,
-- plus a separately approved outbound refund for the amount actually collected.
-- Original invoice, receipts, bank matches and journals remain immutable.
-- Issued invoice corrections are credit notes, never silent draft edits.
ALTER TABLE journal DROP CONSTRAINT journal_posting_kind_check;
ALTER TABLE journal ADD CONSTRAINT journal_posting_kind_check CHECK(
 posting_kind IN('OPENING','GENERAL','VOUCHER','REVERSAL','INVOICE','CREDIT_NOTE','REFUND'));
CREATE SEQUENCE cg09_credit_note_number_seq;
CREATE TABLE finance_invoice_credit_note(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 credit_note_number text NOT NULL DEFAULT
  ('CG-CN-'||lpad(nextval('cg09_credit_note_number_seq')::text,10,'0')),
 invoice_id uuid NOT NULL,invoice_version integer NOT NULL CHECK(invoice_version>0),
 original_journal_id uuid NOT NULL,adjustment_journal_id uuid NOT NULL,
 total_minor bigint NOT NULL CHECK(total_minor>0),
 collected_minor bigint NOT NULL CHECK(collected_minor>=0 AND collected_minor<=total_minor),
 refund_liability_account_id uuid,
 approved_by uuid NOT NULL,request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 8 AND 300),
 password_verified_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,invoice_id),
 UNIQUE(root_realm_id,adjustment_journal_id),
 UNIQUE(root_realm_id,credit_note_number),
 UNIQUE(root_realm_id,approved_by,request_key),
 CHECK((collected_minor=0 AND refund_liability_account_id IS NULL) OR
  (collected_minor>0 AND refund_liability_account_id IS NOT NULL)),
 FOREIGN KEY(invoice_id,root_realm_id)
  REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(original_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(adjustment_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(refund_liability_account_id,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_credit_note_immutable BEFORE UPDATE OR DELETE
 ON finance_invoice_credit_note FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE INDEX ix_cg09_credit_notes_date
 ON finance_invoice_credit_note(root_realm_id,created_at DESC,id DESC);

CREATE FUNCTION cg09_validate_issued_credit_note() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv record; orig record; correction record; paid bigint; collected bigint;
 actual record; liability record;
BEGIN
 SELECT status,version,created_by,total_minor,gross_minor,tax_minor,charges_minor,
  branch_id,receivable_account_id,income_account_id,tax_account_id
 INTO inv FROM finance_invoice
 WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR UPDATE;
 IF NOT FOUND OR inv.status<>'ISSUED' OR inv.version<>NEW.invoice_version
   OR inv.created_by=NEW.approved_by OR NEW.total_minor<>inv.total_minor
   OR NEW.password_verified_at>NEW.created_at+interval '1 minute'
   OR NEW.password_verified_at<NEW.created_at-interval '5 minutes' THEN
  RAISE EXCEPTION 'Genuine issued invoice and independent protected reviewer required'
   USING ERRCODE='P0931';
 END IF;
 PERFORM 1 FROM finance_invoice_posted_cancellation
  WHERE root_realm_id=NEW.root_realm_id AND invoice_id=NEW.invoice_id FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'Already cancelled invoice cannot be credited' USING ERRCODE='P0931';
 END IF;
 SELECT p.journal_id,j.status,j.posting_kind INTO orig
 FROM finance_invoice_posting p JOIN journal j ON j.id=p.journal_id
   AND j.root_realm_id=p.root_realm_id
 WHERE p.root_realm_id=NEW.root_realm_id AND p.invoice_id=NEW.invoice_id FOR SHARE OF p,j;
 SELECT posting_kind,status,source_ref,reversal_of_id,created_by INTO correction
 FROM journal WHERE id=NEW.adjustment_journal_id
  AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF orig.journal_id IS DISTINCT FROM NEW.original_journal_id
   OR orig.status<>'POSTED' OR orig.posting_kind<>'INVOICE'
   OR correction.posting_kind<>'CREDIT_NOTE' OR correction.status<>'POSTED'
   OR correction.source_ref IS DISTINCT FROM NEW.invoice_id
   OR correction.reversal_of_id IS DISTINCT FROM NEW.original_journal_id
   OR correction.created_by IS DISTINCT FROM NEW.approved_by THEN
  RAISE EXCEPTION 'Credit note must offset the actual original invoice' USING ERRCODE='P0931';
 END IF;
 SELECT COALESCE(SUM(amount_minor),0)::bigint INTO paid
 FROM finance_invoice_receipt WHERE root_realm_id=NEW.root_realm_id
  AND invoice_id=NEW.invoice_id;
 -- Pending or unmatched collections are not silently treated as verified.
 SELECT COALESCE(SUM(l.debit_minor),0)::bigint INTO collected
 FROM journal j JOIN journal_line l
  ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id
 JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id
 WHERE j.root_realm_id=NEW.root_realm_id AND j.source_ref=NEW.invoice_id
  AND j.posting_kind='GENERAL' AND a.account_kind='BANK';
 IF paid IS DISTINCT FROM NEW.collected_minor OR paid<>collected THEN
  RAISE EXCEPTION 'Resolve pending bank collections before issuing a credit note'
   USING ERRCODE='P0931';
 END IF;
 IF paid>0 THEN
  SELECT a.account_kind,g.category,a.branch_id INTO liability
  FROM finance_account a JOIN account_group g
   ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
  WHERE a.id=NEW.refund_liability_account_id AND a.root_realm_id=NEW.root_realm_id
   AND a.status='ACTIVE' FOR SHARE OF a,g;
  IF NOT FOUND OR liability.category<>'LIABILITY' OR
   liability.account_kind<>'GENERAL' OR
   (liability.branch_id IS NOT NULL AND liability.branch_id IS DISTINCT FROM inv.branch_id) OR
   NEW.refund_liability_account_id=inv.tax_account_id THEN
   RAISE EXCEPTION 'Select an eligible separate refund payable account' USING ERRCODE='P0931';
  END IF;
 END IF;
 SELECT COUNT(*)::integer AS n,
  COALESCE(SUM(debit_minor),0)::bigint AS dr,
  COALESCE(SUM(credit_minor),0)::bigint AS cr,
  COUNT(*) FILTER(WHERE account_id=inv.income_account_id
    AND branch_id IS NOT DISTINCT FROM inv.branch_id
    AND debit_minor=inv.gross_minor+inv.charges_minor AND credit_minor=0) AS income_leg,
  COUNT(*) FILTER(WHERE account_id=inv.tax_account_id
    AND branch_id IS NOT DISTINCT FROM inv.branch_id
    AND debit_minor=inv.tax_minor AND credit_minor=0) AS tax_leg,
  COUNT(*) FILTER(WHERE account_id=inv.receivable_account_id
    AND branch_id IS NOT DISTINCT FROM inv.branch_id
    AND credit_minor=inv.total_minor-paid AND debit_minor=0) AS receivable_leg,
  COUNT(*) FILTER(WHERE account_id=NEW.refund_liability_account_id
    AND branch_id IS NOT DISTINCT FROM inv.branch_id
    AND credit_minor=paid AND debit_minor=0) AS payable_leg
 INTO actual FROM journal_line
 WHERE root_realm_id=NEW.root_realm_id AND journal_id=NEW.adjustment_journal_id;
 IF actual.dr<>inv.total_minor OR actual.cr<>inv.total_minor OR
   actual.n<>(1+CASE WHEN inv.tax_minor>0 THEN 1 ELSE 0 END+
      CASE WHEN inv.total_minor>paid THEN 1 ELSE 0 END+
      CASE WHEN paid>0 THEN 1 ELSE 0 END)
   OR actual.income_leg<>1
   OR (inv.tax_minor>0 AND actual.tax_leg<>1)
   OR (inv.total_minor>paid AND actual.receivable_leg<>1)
   OR (paid>0 AND actual.payable_leg<>1) THEN
  RAISE EXCEPTION 'Credit note monetary lines do not match the original invoice'
   USING ERRCODE='P0931';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_credit_note_guard BEFORE INSERT ON finance_invoice_credit_note
 FOR EACH ROW EXECUTE FUNCTION cg09_validate_issued_credit_note();

CREATE TABLE finance_invoice_refund(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 credit_note_id uuid NOT NULL,invoice_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 bank_account_id uuid NOT NULL,financial_year_id uuid NOT NULL,
 posting_date date NOT NULL,
 requested_by uuid NOT NULL,request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','BANK_POSTED')),
 approved_by uuid,approved_at timestamptz,password_verified_at timestamptz,
 approval_key uuid,approval_journal_id uuid,
 transfer_reference text CHECK(transfer_reference IS NULL OR
  (char_length(btrim(transfer_reference)) BETWEEN 4 AND 100 AND
   transfer_reference ~ '^[A-Za-z0-9._/: -]+$')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,credit_note_id),
 UNIQUE(root_realm_id,requested_by,request_key),
 UNIQUE(root_realm_id,approved_by,approval_key),
 UNIQUE(root_realm_id,approval_journal_id),
 FOREIGN KEY(credit_note_id,root_realm_id)
  REFERENCES finance_invoice_credit_note(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(invoice_id,root_realm_id)
  REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(bank_account_id,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(financial_year_id,root_realm_id)
  REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((status='REQUESTED' AND approved_by IS NULL AND approved_at IS NULL
    AND password_verified_at IS NULL AND approval_key IS NULL AND approval_journal_id IS NULL
    AND transfer_reference IS NULL)
  OR (status='BANK_POSTED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
    AND password_verified_at IS NOT NULL AND approval_key IS NOT NULL
    AND approval_journal_id IS NOT NULL AND approved_by<>requested_by
    AND transfer_reference IS NOT NULL))
);
CREATE INDEX ix_cg09_refund_worklist ON finance_invoice_refund
 (root_realm_id,status,created_at DESC,id DESC);

CREATE FUNCTION cg09_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; inv record; bank record; j record; lines record;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original refunds are immutable' USING ERRCODE='P0932';
 END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-
    'status'-'approved_by'-'approved_at'-'password_verified_at'-
    'approval_key'-'approval_journal_id'-'transfer_reference')
   IS DISTINCT FROM (to_jsonb(OLD)-
    'status'-'approved_by'-'approved_at'-'password_verified_at'-
    'approval_key'-'approval_journal_id'-'transfer_reference') THEN
  RAISE EXCEPTION 'Only the protected reviewer can post a refund' USING ERRCODE='P0932';
 END IF;
 SELECT invoice_id,collected_minor,refund_liability_account_id INTO c
 FROM finance_invoice_credit_note WHERE id=NEW.credit_note_id
  AND root_realm_id=NEW.root_realm_id FOR SHARE;
 SELECT branch_id INTO inv FROM finance_invoice
  WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 SELECT a.account_kind,a.status,a.branch_id INTO bank FROM finance_account a
  WHERE a.id=NEW.bank_account_id AND a.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR c.invoice_id IS DISTINCT FROM NEW.invoice_id OR
  NEW.amount_minor<>c.collected_minor OR bank.account_kind<>'BANK'
  OR bank.status<>'ACTIVE' OR
  (bank.branch_id IS NOT NULL AND bank.branch_id IS DISTINCT FROM inv.branch_id) THEN
  RAISE EXCEPTION 'Refund must use the original verified collected amount and bank'
   USING ERRCODE='P0932';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'REQUESTED' OR NEW.status<>'BANK_POSTED' OR
     NEW.transfer_reference IS NULL OR
     NEW.approved_by=NEW.requested_by OR NEW.approved_at IS NULL OR
     NEW.password_verified_at<NEW.approved_at-interval '5 minutes' OR
     NEW.password_verified_at>NEW.approved_at+interval '1 minute' THEN
   RAISE EXCEPTION 'Independent protected refund approval required' USING ERRCODE='P0932';
  END IF;
  SELECT posting_kind,status,source_ref,created_by,financial_year_id,posting_date
  INTO j FROM journal WHERE id=NEW.approval_journal_id
   AND root_realm_id=NEW.root_realm_id FOR SHARE;
  IF j.posting_kind<>'REFUND' OR j.status<>'POSTED' OR
    j.source_ref IS DISTINCT FROM NEW.id OR
    j.created_by IS DISTINCT FROM NEW.approved_by OR
    j.financial_year_id IS DISTINCT FROM NEW.financial_year_id OR
    j.posting_date IS DISTINCT FROM NEW.posting_date THEN
    RAISE EXCEPTION 'Original reviewer refund journal required' USING ERRCODE='P0932';
  END IF;
  SELECT COUNT(*)::integer AS n,
   COUNT(*) FILTER(WHERE account_id=c.refund_liability_account_id
     AND branch_id IS NOT DISTINCT FROM inv.branch_id AND debit_minor=NEW.amount_minor
     AND credit_minor=0) AS dr,
   COUNT(*) FILTER(WHERE account_id=NEW.bank_account_id
     AND branch_id IS NOT DISTINCT FROM inv.branch_id AND credit_minor=NEW.amount_minor
     AND debit_minor=0) AS cr
  INTO lines FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.approval_journal_id;
  IF lines.n<>2 OR lines.dr<>1 OR lines.cr<>1 THEN
   RAISE EXCEPTION 'Refund posting is not the approved refund payable offset'
    USING ERRCODE='P0932';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_guard_refund BEFORE INSERT OR UPDATE OR DELETE ON finance_invoice_refund
 FOR EACH ROW EXECUTE FUNCTION cg09_refund_guard();

-- A credit or refund journal cannot be inserted directly and committed without
-- the immutable source-linked protected event in this same transaction.
CREATE FUNCTION cg09_require_invoice_adjustment_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posting_kind='CREDIT_NOTE' THEN
  PERFORM 1 FROM finance_invoice_credit_note c
   WHERE c.root_realm_id=NEW.root_realm_id
    AND c.adjustment_journal_id=NEW.id AND c.original_journal_id=NEW.reversal_of_id
   FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Source-bound credit note proof required' USING ERRCODE='P0931';
  END IF;
 ELSIF NEW.posting_kind='REFUND' THEN
  PERFORM 1 FROM finance_invoice_refund r
   WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.source_ref
     AND r.approval_journal_id=NEW.id AND r.status='BANK_POSTED'
   FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Independently reviewed refund proof required' USING ERRCODE='P0932';
  END IF;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_invoice_adjustment_requires_proof
 AFTER INSERT ON journal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION cg09_require_invoice_adjustment_proof();

-- The first issued credit note closes the original invoice for new money.
-- Serialize a concurrent deposit with the credit issuance on invoice row.
-- Refund bank reconciliation is acceptable only against the exact original
-- transfer reference and negative bank movement, never a convenient deposit.
CREATE FUNCTION cg09_guard_refund_statement_match() RETURNS trigger LANGUAGE plpgsql AS $
DECLARE bank journal%ROWTYPE; requested record;
BEGIN
 SELECT * INTO bank FROM journal
  WHERE id=NEW.journal_id AND root_realm_id=NEW.root_realm_id;
 IF NOT FOUND OR bank.posting_kind<>'REFUND' THEN RETURN NEW; END IF;
 SELECT r.bank_account_id,r.amount_minor,r.transfer_reference,r.status
  INTO requested FROM finance_invoice_refund r
  WHERE r.id=bank.source_ref AND r.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR requested.status<>'BANK_POSTED' OR
    NEW.bank_account_id IS DISTINCT FROM requested.bank_account_id OR
    NEW.bank_item_ref IS DISTINCT FROM requested.transfer_reference OR
    NEW.statement_amount_minor IS DISTINCT FROM -requested.amount_minor OR
    NEW.posted_amount_minor IS DISTINCT FROM -requested.amount_minor THEN
  RAISE EXCEPTION 'Use the actual matching outbound refund transfer reference'
   USING ERRCODE='P0932';
 END IF;
 RETURN NEW;
END; $;
CREATE TRIGGER cg09_refund_statement_source_guard
 BEFORE INSERT ON finance_bank_reconciliation
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_refund_statement_match();

CREATE FUNCTION cg09_stop_invoice_collection_after_credit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posting_kind<>'GENERAL' THEN RETURN NEW; END IF;
 PERFORM 1 FROM finance_invoice i
  WHERE i.id=NEW.source_ref AND i.root_realm_id=NEW.root_realm_id FOR UPDATE;
 IF FOUND THEN
  PERFORM 1 FROM finance_invoice_credit_note c
   WHERE c.root_realm_id=NEW.root_realm_id AND c.invoice_id=NEW.source_ref FOR SHARE;
  IF FOUND THEN
   RAISE EXCEPTION 'This issued invoice was credited; do not collect again'
    USING ERRCODE='P0931';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_no_new_collection_after_credit BEFORE INSERT ON journal
 FOR EACH ROW EXECUTE FUNCTION cg09_stop_invoice_collection_after_credit();
CREATE FUNCTION cg09_stop_invoice_receipt_after_credit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM finance_invoice
  WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR UPDATE;
 PERFORM 1 FROM finance_invoice_credit_note
  WHERE invoice_id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'This original invoice has an issued credit note'
   USING ERRCODE='P0931';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_no_new_receipt_after_credit BEFORE INSERT
 ON finance_invoice_receipt FOR EACH ROW
 EXECUTE FUNCTION cg09_stop_invoice_receipt_after_credit();
