-- CG-09 US-004: genuine CG-03 FINANCE_INVOICE protected process and frozen case.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
                 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE'));
CREATE TABLE cg03_invoice_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE cg03_case ADD COLUMN finance_invoice_id uuid,
 ADD COLUMN finance_invoice_revision integer,
 ADD COLUMN finance_invoice_digest char(64);
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
              'FINANCE_REIMBURSEMENT','FINANCE_INVOICE'));
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_finance_source_disjoint;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_finance_source_disjoint CHECK(
 (case_kind='CG01_ROLE'
   AND finance_invoice_id IS NULL AND finance_invoice_revision IS NULL
   AND finance_invoice_digest IS NULL
   AND branch_source_ref IS NULL AND branch_source_revision IS NULL
   AND branch_source_digest IS NULL
   AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
   AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
   AND finance_proof_revision IS NULL
   AND finance_claim_id IS NULL AND finance_claim_revision IS NULL
   AND finance_claim_digest IS NULL AND finance_claim_bill_id IS NULL
   AND finance_claim_bill_version IS NULL
   AND target_account_id IS NOT NULL AND target_role_id IS NOT NULL
   AND expected_access_version IS NOT NULL AND expected_role_revision IS NOT NULL)
 OR
 (case_kind='BRANCH_REGISTRATION'
   AND finance_invoice_id IS NULL AND finance_invoice_revision IS NULL
   AND finance_invoice_digest IS NULL
   AND branch_source_ref IS NOT NULL AND branch_source_revision>0
   AND branch_source_digest ~ '^[0-9a-f]{64}$'
   AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
   AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
   AND finance_proof_revision IS NULL
   AND finance_claim_id IS NULL AND finance_claim_revision IS NULL
   AND finance_claim_digest IS NULL AND finance_claim_bill_id IS NULL
   AND finance_claim_bill_version IS NULL
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL)
 OR
 (case_kind='FINANCE_VOUCHER'
   AND finance_invoice_id IS NULL AND finance_invoice_revision IS NULL
   AND finance_invoice_digest IS NULL
   AND branch_source_ref IS NULL AND branch_source_revision IS NULL
   AND branch_source_digest IS NULL
   AND finance_voucher_id IS NOT NULL AND finance_voucher_revision>0
   AND finance_voucher_digest ~ '^[0-9a-f]{64}$'
   AND finance_proof_file_id IS NOT NULL AND finance_proof_revision>0
   AND finance_claim_id IS NULL AND finance_claim_revision IS NULL
   AND finance_claim_digest IS NULL AND finance_claim_bill_id IS NULL
   AND finance_claim_bill_version IS NULL
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL)
 OR
 (case_kind='FINANCE_REIMBURSEMENT'
   AND finance_invoice_id IS NULL AND finance_invoice_revision IS NULL
   AND finance_invoice_digest IS NULL
   AND branch_source_ref IS NULL AND branch_source_revision IS NULL
   AND branch_source_digest IS NULL
   AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
   AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
   AND finance_proof_revision IS NULL
   AND finance_claim_id IS NOT NULL AND finance_claim_revision>0
   AND finance_claim_digest ~ '^[0-9a-f]{64}$'
   AND finance_claim_bill_id IS NOT NULL AND finance_claim_bill_version>0
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL)
 OR
 (case_kind='FINANCE_INVOICE'
   AND branch_source_ref IS NULL AND branch_source_revision IS NULL
   AND branch_source_digest IS NULL
   AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
   AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
   AND finance_proof_revision IS NULL
   AND finance_claim_id IS NULL AND finance_claim_revision IS NULL
   AND finance_claim_digest IS NULL AND finance_claim_bill_id IS NULL
   AND finance_claim_bill_version IS NULL
   AND finance_invoice_id IS NOT NULL AND finance_invoice_revision>0
   AND finance_invoice_digest ~ '^[0-9a-f]{64}$'
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL)
);

ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_original_invoice
 FOREIGN KEY(finance_invoice_id,realm_id)
 REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_original_invoice_revision ON cg03_case
 (realm_id,finance_invoice_id,finance_invoice_revision)
 WHERE case_kind='FINANCE_INVOICE';
CREATE INDEX ix_cg03_invoice_review ON cg03_case
 (realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='FINANCE_INVOICE';
CREATE FUNCTION cg03_invoice_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.finance_invoice_id IS DISTINCT FROM OLD.finance_invoice_id OR
    NEW.finance_invoice_revision IS DISTINCT FROM OLD.finance_invoice_revision OR
    NEW.finance_invoice_digest IS DISTINCT FROM OLD.finance_invoice_digest THEN
  RAISE EXCEPTION 'Original reviewed invoice cannot change' USING ERRCODE='P0922';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_invoice_source_frozen BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_invoice_source_immutable();

ALTER TABLE finance_invoice DROP CONSTRAINT finance_invoice_status_check;
ALTER TABLE finance_invoice ADD COLUMN approval_case_id uuid,
 ADD CONSTRAINT cg09_invoice_status CHECK(status IN
  ('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','POSTED','ISSUED')),
 ADD CONSTRAINT fk_cg09_invoice_approval FOREIGN KEY(approval_case_id,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT;
ALTER TABLE finance_invoice ADD CONSTRAINT cg09_invoice_approved_required CHECK(
 (status='DRAFT' AND approval_case_id IS NULL)
 OR (status<>'DRAFT' AND approval_case_id IS NOT NULL));

-- Same authoritative journal owner, and one immutable invoice-accrual link.
ALTER TABLE journal DROP CONSTRAINT journal_posting_kind_check;
ALTER TABLE journal ADD CONSTRAINT journal_posting_kind_check CHECK(
 posting_kind IN('OPENING','GENERAL','VOUCHER','REVERSAL','INVOICE'));
CREATE TABLE finance_invoice_posting(
 invoice_id uuid PRIMARY KEY,
 root_realm_id uuid NOT NULL,
 invoice_version integer NOT NULL CHECK(invoice_version>0),
 approval_case_id uuid NOT NULL,
 journal_id uuid NOT NULL UNIQUE,
 original_digest char(64) NOT NULL CHECK(original_digest~'^[0-9a-f]{64}$'),
 posted_by uuid NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id,root_realm_id),
 FOREIGN KEY(invoice_id,root_realm_id) REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_case_id,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(posted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_invoice_posting_immutable BEFORE UPDATE OR DELETE
 ON finance_invoice_posting FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE INDEX ix_cg09_invoice_posted ON finance_invoice_posting
 (root_realm_id,posted_at DESC,journal_id DESC);

CREATE OR REPLACE FUNCTION cg09_invoice_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y record; a record; i record; t record; line jsonb; gross bigint:=0;
 rate bigint; qty integer; n integer;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original invoice cannot be deleted' USING ERRCODE='P0922';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'An original invoice starts in draft' USING ERRCODE='P0922';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
   OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
   OR NEW.created_by IS DISTINCT FROM OLD.created_by
   OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Invoice source identity is immutable' USING ERRCODE='P0922';
 END IF;
 IF OLD.status IN('DRAFT','RETURNED') AND NEW.status='DRAFT' THEN
  IF NEW.version<>OLD.version+1 OR NEW.approval_case_id IS NOT NULL OR
    NEW.financial_year_id IS NOT NULL OR NEW.branch_id IS NOT NULL OR
    NEW.invoice_date IS NOT NULL OR NEW.due_date IS NOT NULL OR
    NEW.category_label IS NOT NULL OR NEW.purpose IS NOT NULL OR
    NEW.counterparty_name IS NOT NULL OR NEW.counterparty_address IS NOT NULL OR
    NEW.gross_minor IS NOT NULL OR NEW.tax_minor IS NOT NULL OR
    NEW.charges_minor IS NOT NULL OR NEW.total_minor IS NOT NULL OR
    NEW.receivable_account_id IS NOT NULL OR NEW.income_account_id IS NOT NULL OR
    NEW.tax_account_id IS NOT NULL THEN
   RAISE EXCEPTION 'Only a new invoice draft revision can be saved' USING ERRCODE='P0922';
  END IF;
  IF OLD.status='RETURNED' THEN
   PERFORM 1 FROM cg03_case c JOIN cg03_case_decision d
    ON d.case_id=c.id AND d.realm_id=c.realm_id
    WHERE c.id=OLD.approval_case_id AND c.realm_id=OLD.root_realm_id
     AND c.case_kind='FINANCE_INVOICE' AND c.finance_invoice_id=OLD.id
     AND c.finance_invoice_revision=OLD.version AND c.status='RETURNED'
     AND d.action='RETURN' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF c,d;
   IF NOT FOUND THEN RAISE EXCEPTION 'Actual RETURN reviewer case required' USING ERRCODE='P0922'; END IF;
  END IF;
  RETURN NEW;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF NEW.version<>OLD.version OR NEW.current_digest<>OLD.current_digest OR
    NEW.draft_payload<>OLD.draft_payload OR NEW.approval_case_id IS NULL OR
    NEW.financial_year_id IS NULL OR NEW.invoice_date IS NULL OR
    NEW.due_date IS NULL OR NEW.category_label IS NULL OR
    NEW.purpose IS NULL OR NEW.counterparty_name IS NULL OR
    NEW.gross_minor IS NULL OR NEW.tax_minor IS NULL OR
    NEW.charges_minor IS NULL OR NEW.total_minor IS NULL OR
    NEW.receivable_account_id IS NULL OR NEW.income_account_id IS NULL OR
    (NEW.tax_minor>0 AND NEW.tax_account_id IS NULL) THEN
   RAISE EXCEPTION 'Complete frozen invoice required before submission' USING ERRCODE='P0922';
  END IF;
  SELECT start_on,end_on,status INTO y FROM financial_year
   WHERE id=NEW.financial_year_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
  IF NOT FOUND OR y.status<>'OPEN' OR NEW.invoice_date<y.start_on OR
     NEW.invoice_date>y.end_on OR NEW.due_date<NEW.invoice_date THEN
   RAISE EXCEPTION 'Invoice financial period is unavailable' USING ERRCODE='P0922';
  END IF;
  IF NEW.branch_id IS NOT NULL THEN
   PERFORM 1 FROM branch WHERE id=NEW.branch_id
      AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Inactive invoice branch' USING ERRCODE='P0922'; END IF;
  END IF;
  SELECT status,account_kind,branch_id,g.category INTO a FROM finance_account f
   JOIN account_group g ON g.id=f.group_id AND g.root_realm_id=f.root_realm_id
   WHERE f.id=NEW.receivable_account_id AND f.root_realm_id=NEW.root_realm_id
   FOR SHARE OF f,g;
  IF NOT FOUND OR a.status<>'ACTIVE' OR a.category<>'ASSET' OR a.account_kind<>'GENERAL' OR
     (a.branch_id IS NOT NULL AND a.branch_id IS DISTINCT FROM NEW.branch_id) THEN
   RAISE EXCEPTION 'Original receivable account not eligible' USING ERRCODE='P0922';
  END IF;
  SELECT status,branch_id,g.category INTO i FROM finance_account f
   JOIN account_group g ON g.id=f.group_id AND g.root_realm_id=f.root_realm_id
   WHERE f.id=NEW.income_account_id AND f.root_realm_id=NEW.root_realm_id
   FOR SHARE OF f,g;
  IF NOT FOUND OR i.status<>'ACTIVE' OR i.category<>'INCOME' OR
    (i.branch_id IS NOT NULL AND i.branch_id IS DISTINCT FROM NEW.branch_id) THEN
   RAISE EXCEPTION 'Original income account not eligible' USING ERRCODE='P0922';
  END IF;
  IF NEW.tax_minor>0 THEN
   SELECT status,branch_id,g.category INTO t FROM finance_account f
    JOIN account_group g ON g.id=f.group_id AND g.root_realm_id=f.root_realm_id
    WHERE f.id=NEW.tax_account_id AND f.root_realm_id=NEW.root_realm_id
    FOR SHARE OF f,g;
   IF NOT FOUND OR t.status<>'ACTIVE' OR t.category<>'LIABILITY' OR
     (t.branch_id IS NOT NULL AND t.branch_id IS DISTINCT FROM NEW.branch_id) THEN
    RAISE EXCEPTION 'Original tax liability account not eligible' USING ERRCODE='P0922';
   END IF;
  END IF;
  SELECT c.status INTO y FROM cg03_case c
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
     AND c.case_kind='FINANCE_INVOICE' AND c.finance_invoice_id=NEW.id
     AND c.finance_invoice_revision=NEW.version
     AND c.finance_invoice_digest=NEW.current_digest
     AND c.status IN('SUBMITTED','IN_REVIEW') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actual invoice reviewer case not found' USING ERRCODE='P0922'; END IF;
  -- The only submitted financial facts are those already frozen in the
  -- original trusted CG-09 draft revision; arbitrary SQL writes cannot retarget.
  IF NEW.financial_year_id::text IS DISTINCT FROM NEW.draft_payload#>>'{info,financialYearRef}' OR
     NEW.branch_id::text IS DISTINCT FROM NULLIF(NEW.draft_payload#>>'{info,branchRef}','') OR
     NEW.invoice_date::text IS DISTINCT FROM NEW.draft_payload#>>'{info,invoiceDate}' OR
     NEW.due_date::text IS DISTINCT FROM NEW.draft_payload#>>'{info,dueDate}' OR
     NEW.category_label IS DISTINCT FROM NEW.draft_payload#>>'{info,category}' OR
     NEW.purpose IS DISTINCT FROM NEW.draft_payload#>>'{info,purpose}' OR
     NEW.counterparty_name IS DISTINCT FROM NEW.draft_payload#>>'{info,counterpartyName}' OR
     NEW.counterparty_address IS DISTINCT FROM NEW.draft_payload#>>'{info,counterpartyAddress}' OR
     NEW.receivable_account_id::text IS DISTINCT FROM NEW.draft_payload#>>'{payment,receivableAccountRef}' OR
     NEW.income_account_id::text IS DISTINCT FROM NEW.draft_payload#>>'{payment,incomeAccountRef}' OR
     NEW.tax_account_id::text IS DISTINCT FROM NULLIF(NEW.draft_payload#>>'{payment,taxAccountRef}','') OR
     NEW.gross_minor::text IS DISTINCT FROM NEW.draft_payload#>>'{items,grossMinor}' OR
     NEW.tax_minor::text IS DISTINCT FROM NEW.draft_payload#>>'{items,taxMinor}' OR
     NEW.charges_minor::text IS DISTINCT FROM NEW.draft_payload#>>'{items,chargesMinor}' OR
     NEW.total_minor::text IS DISTINCT FROM NEW.draft_payload#>>'{items,totalMinor}' THEN
   RAISE EXCEPTION 'Frozen original invoice does not match submitted facts' USING ERRCODE='P0922';
  END IF;
  IF jsonb_typeof(NEW.draft_payload->'items'->'rows')<>'array' THEN
   RAISE EXCEPTION 'Original invoice items missing' USING ERRCODE='P0922';
  END IF;
  n=jsonb_array_length(NEW.draft_payload->'items'->'rows');
  IF n<1 OR n>40 THEN
   RAISE EXCEPTION 'Original invoice item count invalid' USING ERRCODE='P0922';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(NEW.draft_payload->'items'->'rows') LOOP
   IF jsonb_typeof(line)<>'object' OR
     COALESCE(line->>'unitRateMinor','') !~ '^[1-9][0-9]{0,13}$' OR
     COALESCE(line->>'lineTotalMinor','') !~ '^[1-9][0-9]{0,13}$' OR
     COALESCE(line->>'quantity','') !~ '^[1-9][0-9]{0,6}$' OR
     char_length(btrim(COALESCE(line->>'description',''))) NOT BETWEEN 2 AND 180 THEN
    RAISE EXCEPTION 'Invalid immutable original invoice item' USING ERRCODE='P0922';
   END IF;
   rate=(line->>'unitRateMinor')::bigint;qty=(line->>'quantity')::integer;
   IF qty>1000000 OR rate>99999999999999/qty OR rate*qty<1 OR
      rate*qty<>(line->>'lineTotalMinor')::bigint THEN
    RAISE EXCEPTION 'Original invoice line does not balance' USING ERRCODE='P0922';
   END IF;
   gross=gross+rate*qty;
  END LOOP;
  IF gross<>NEW.gross_minor OR NEW.total_minor<>NEW.gross_minor+NEW.tax_minor+NEW.charges_minor THEN
   RAISE EXCEPTION 'Invoice arithmetic does not balance' USING ERRCODE='P0922';
  END IF;
  RETURN NEW;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Submitted invoice snapshot is immutable' USING ERRCODE='P0922';
  END IF;
  SELECT status INTO y FROM cg03_case c WHERE c.id=OLD.approval_case_id
    AND c.realm_id=OLD.root_realm_id AND c.case_kind='FINANCE_INVOICE'
    AND c.finance_invoice_id=OLD.id AND c.finance_invoice_revision=OLD.version FOR SHARE;
  IF NOT FOUND OR
    (NEW.status='RETURNED' AND y.status<>'RETURNED') OR
    (NEW.status='REJECTED' AND y.status<>'REJECTED') OR
    (NEW.status='APPROVED' AND y.status NOT IN('PENDING_OWNER','OWNER_COMPLETED')) THEN
   RAISE EXCEPTION 'Genuine invoice review outcome required' USING ERRCODE='P0922';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect ef
     JOIN cg03_case_decision d ON d.id=ef.final_decision_id
    WHERE ef.case_id=NEW.approval_case_id AND ef.realm_id=NEW.root_realm_id
     AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF ef,d;
   IF NOT FOUND THEN RAISE EXCEPTION 'Protected invoice approval not confirmed' USING ERRCODE='P0922'; END IF;
  END IF;
  RETURN NEW;
 ELSIF OLD.status='APPROVED' AND NEW.status='POSTED' THEN
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Posted invoice cannot edit approved facts' USING ERRCODE='P0922';
  END IF;
  PERFORM 1 FROM finance_invoice_posting p JOIN journal j
   ON j.id=p.journal_id AND j.root_realm_id=p.root_realm_id
   WHERE p.invoice_id=NEW.id AND p.root_realm_id=NEW.root_realm_id
    AND p.invoice_version=NEW.version AND p.approval_case_id=NEW.approval_case_id
    AND j.source_ref=NEW.id AND j.posting_kind='INVOICE' AND j.status='POSTED'
    AND j.financial_year_id=NEW.financial_year_id
    AND j.posting_date=NEW.invoice_date
    AND j.immutable_payload_digest=p.original_digest
    AND (SELECT COALESCE(SUM(l.debit_minor),0)=NEW.total_minor
        AND COALESCE(SUM(l.credit_minor),0)=NEW.total_minor
        AND COUNT(*)=CASE WHEN NEW.tax_minor>0 THEN 3 ELSE 2 END
        AND COUNT(*) FILTER (WHERE l.account_id=NEW.receivable_account_id
          AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
          AND l.debit_minor=NEW.total_minor AND l.credit_minor=0)=1
        AND COUNT(*) FILTER (WHERE l.account_id=NEW.income_account_id
          AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
          AND l.credit_minor=NEW.gross_minor+NEW.charges_minor AND l.debit_minor=0)=1
        AND (NEW.tax_minor=0 OR COUNT(*) FILTER
          (WHERE l.account_id=NEW.tax_account_id
           AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id AND l.credit_minor=NEW.tax_minor
           AND l.debit_minor=0)=1)
      FROM journal_line l WHERE l.journal_id=j.id AND l.root_realm_id=NEW.root_realm_id)
   FOR SHARE OF p,j;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only balanced posted original invoice may proceed' USING ERRCODE='P0922'; END IF;
  RETURN NEW;
 ELSIF OLD.status='POSTED' AND NEW.status='ISSUED' THEN
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Issued invoice cannot edit financial facts' USING ERRCODE='P0922';
  END IF;
  PERFORM 1 FROM cg19_finance_invoice_document d
   WHERE d.root_realm_id=NEW.root_realm_id AND d.invoice_id=NEW.id
     AND d.source_version=NEW.version AND d.status='ISSUED'
     AND d.object_version IS NOT NULL AND d.content_sha256 IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actual protected PDF must be issued first' USING ERRCODE='P0922'; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Invoice workflow transition not permitted' USING ERRCODE='P0922';
END; $$;

CREATE INDEX ix_cg09_invoice_review_pending ON finance_invoice
 (root_realm_id,status,updated_at DESC,id DESC);
