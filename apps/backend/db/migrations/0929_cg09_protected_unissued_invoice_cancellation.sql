-- CG-09 US-004: narrowly authorized cancellation of a POSTED but never
-- ISSUED/collected Foundation invoice. Original invoice and journal remain
-- immutable. This is NOT a legal credit note for issued or paid invoices.
-- Their rules/document templates require a separate approved delivery scope.
CREATE TABLE finance_invoice_posted_cancellation(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 invoice_id uuid NOT NULL,
 invoice_version integer NOT NULL CHECK(invoice_version>0),
 original_journal_id uuid NOT NULL,
 reversal_journal_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 300),
 password_verified_at timestamptz NOT NULL,
 cancelled_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,invoice_id),UNIQUE(root_realm_id,reversal_journal_id),
 UNIQUE(root_realm_id,original_journal_id),
 UNIQUE(root_realm_id,reviewer_id,request_key),
 FOREIGN KEY(invoice_id,root_realm_id)
  REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(original_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_unissued_invoice_cancel_immutable
 BEFORE UPDATE OR DELETE ON finance_invoice_posted_cancellation FOR EACH ROW
 EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_guard_posted_invoice_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv record; original record; reversing record; mismatch integer;
BEGIN
 SELECT status,version,created_by INTO inv
 FROM finance_invoice WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 SELECT p.journal_id,j.posting_kind,j.status,j.financial_year_id,
  j.immutable_payload_digest INTO original
 FROM finance_invoice_posting p JOIN journal j
  ON j.id=p.journal_id AND j.root_realm_id=p.root_realm_id
 WHERE p.invoice_id=NEW.invoice_id AND p.root_realm_id=NEW.root_realm_id
 FOR SHARE OF p,j;
 SELECT reversal_of_id,source_ref,posting_kind,status,created_by INTO reversing
 FROM journal WHERE id=NEW.reversal_journal_id AND root_realm_id=NEW.root_realm_id
 FOR SHARE;
 IF inv.status IS DISTINCT FROM 'POSTED' OR inv.version<>NEW.invoice_version
  OR inv.created_by=NEW.reviewer_id
  OR original.journal_id IS DISTINCT FROM NEW.original_journal_id
  OR original.posting_kind<>'INVOICE' OR original.status<>'POSTED'
  OR reversing.reversal_of_id IS DISTINCT FROM original.journal_id
  OR reversing.source_ref IS DISTINCT FROM NEW.invoice_id
  OR reversing.posting_kind<>'REVERSAL' OR reversing.status<>'POSTED'
  OR reversing.created_by<>NEW.reviewer_id
  OR NEW.password_verified_at>NEW.cancelled_at+interval '1 minute'
  OR NEW.password_verified_at<NEW.cancelled_at-interval '5 minutes' THEN
  RAISE EXCEPTION 'Independent protected reversal of an original posted invoice is required'
   USING ERRCODE='P0930';
 END IF;
 -- No issue request (including provider UNKNOWN) and no bank collection.
 -- A partially paid, issued or undetermined invoice cannot be silently voided.
 PERFORM 1 FROM cg19_finance_invoice_document d
  WHERE d.root_realm_id=NEW.root_realm_id AND d.invoice_id=NEW.invoice_id FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'Original invoice issue process already exists' USING ERRCODE='P0930';
 END IF;
 PERFORM 1 FROM journal j WHERE j.root_realm_id=NEW.root_realm_id
  AND j.source_ref=NEW.invoice_id AND j.posting_kind='GENERAL' AND j.status='POSTED'
  FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'Original invoice bank collection already recorded' USING ERRCODE='P0930';
 END IF;
 PERFORM 1 FROM finance_invoice_receipt r
  WHERE r.root_realm_id=NEW.root_realm_id AND r.invoice_id=NEW.invoice_id FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'Original paid receipts cannot be cancelled as an unissued invoice'
   USING ERRCODE='P0930';
 END IF;
 WITH prior AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS dr,SUM(credit_minor) AS cr
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id AND journal_id=NEW.original_journal_id
  GROUP BY account_id,branch_id
 ), after AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS dr,SUM(credit_minor) AS cr
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id AND journal_id=NEW.reversal_journal_id
  GROUP BY account_id,branch_id
 )
 SELECT COUNT(*) INTO mismatch FROM prior p FULL OUTER JOIN after a
  ON a.account_id=p.account_id
  AND a.branch_id IS NOT DISTINCT FROM p.branch_id
 WHERE p.account_id IS NULL OR a.account_id IS NULL OR p.n<>a.n
  OR p.dr<>a.cr OR p.cr<>a.dr;
 IF mismatch<>0 THEN
  RAISE EXCEPTION 'Cancellation must offset every original invoice accounting line'
   USING ERRCODE='P0930';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_validate_unissued_invoice_cancel BEFORE INSERT
 ON finance_invoice_posted_cancellation FOR EACH ROW
 EXECUTE FUNCTION cg09_guard_posted_invoice_cancel();

-- The 0928 deferred journal guard is extended, never bypassed. An arbitrary
-- REVERSAL cannot commit unless backed by exactly one protected original
-- manual-journal correction OR an approved unissued-invoice cancellation.
CREATE OR REPLACE FUNCTION cg09_require_manual_reversal_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posting_kind<>'REVERSAL' THEN RETURN NULL; END IF;
 PERFORM 1 FROM finance_manual_journal_reversal d
  WHERE d.root_realm_id=NEW.root_realm_id
   AND d.reversal_journal_id=NEW.id AND d.original_journal_id=NEW.reversal_of_id
  FOR SHARE;
 IF FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM finance_invoice_posted_cancellation d
  WHERE d.root_realm_id=NEW.root_realm_id
   AND d.reversal_journal_id=NEW.id AND d.original_journal_id=NEW.reversal_of_id
  FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Protected journal reversal provenance is required'
   USING ERRCODE='P0930';
 END IF;
 RETURN NULL;
END; $$;

-- Serialize any new CG-19 issue document with the original posted invoice.
-- Once a cancellation exists, even a pending PDF must never be fabricated.
CREATE FUNCTION cg19_refuse_cancelled_invoice_issue() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM finance_invoice
  WHERE id=NEW.invoice_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 PERFORM 1 FROM finance_invoice_posted_cancellation c
  WHERE c.root_realm_id=NEW.root_realm_id AND c.invoice_id=NEW.invoice_id FOR SHARE;
 IF FOUND THEN
  RAISE EXCEPTION 'This posted invoice was cancelled before private issue'
   USING ERRCODE='P0930';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_no_pdf_for_cancelled_invoice BEFORE INSERT
 ON cg19_finance_invoice_document FOR EACH ROW
 EXECUTE FUNCTION cg19_refuse_cancelled_invoice_issue();
CREATE INDEX ix_cg09_invoice_cancel_audit
 ON finance_invoice_posted_cancellation(root_realm_id,cancelled_at DESC,id DESC);
