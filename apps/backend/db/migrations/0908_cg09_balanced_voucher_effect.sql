-- CG-09 / US-002: original submitted voucher freezes real accounting sides.
-- A reviewer approves the complete account allocation and total; neither side
-- is selected after the fact or inferred from a payee name.
ALTER TABLE finance_voucher
 ADD COLUMN debit_account_id uuid NOT NULL,
 ADD COLUMN credit_account_id uuid NOT NULL,
 ADD CONSTRAINT cg09_voucher_distinct_accounts CHECK(debit_account_id<>credit_account_id),
 ADD CONSTRAINT fk_cg09_voucher_debit FOREIGN KEY(debit_account_id,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg09_voucher_credit FOREIGN KEY(credit_account_id,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT;
-- No old-client compatibility needed: CareGanga is greenfield and unreleased.
ALTER TABLE finance_voucher DROP CONSTRAINT cg09_voucher_workflow_status;
ALTER TABLE finance_voucher ADD CONSTRAINT cg09_voucher_workflow_status
 CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED',
  'POSTED','PAYMENT_REQUESTED','PAID_VERIFIED'));

CREATE FUNCTION cg09_voucher_accounting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; b record;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IN
  ('SUBMITTED','APPROVED','REJECTED','POSTED','PAYMENT_REQUESTED','PAID_VERIFIED')
  AND (NEW.debit_account_id IS DISTINCT FROM OLD.debit_account_id
    OR NEW.credit_account_id IS DISTINCT FROM OLD.credit_account_id) THEN
   RAISE EXCEPTION 'Approved voucher accounts cannot change' USING ERRCODE='P0907';
 END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  SELECT fa.status,fa.account_kind,fa.branch_id,g.category INTO a
  FROM finance_account fa JOIN account_group g ON g.id=fa.group_id
    AND g.root_realm_id=fa.root_realm_id
  WHERE fa.id=NEW.debit_account_id AND fa.root_realm_id=NEW.root_realm_id FOR SHARE OF fa,g;
  IF NOT FOUND OR a.status<>'ACTIVE' OR
     (a.branch_id IS NOT NULL AND a.branch_id IS DISTINCT FROM NEW.branch_id) THEN
   RAISE EXCEPTION 'Selected debit account is not available' USING ERRCODE='P0916';
  END IF;
  SELECT fb.status,fb.account_kind,fb.branch_id,g.category INTO b
  FROM finance_account fb JOIN account_group g ON g.id=fb.group_id
    AND g.root_realm_id=fb.root_realm_id
  WHERE fb.id=NEW.credit_account_id AND fb.root_realm_id=NEW.root_realm_id FOR SHARE OF fb,g;
  IF NOT FOUND OR b.status<>'ACTIVE' OR
     (b.branch_id IS NOT NULL AND b.branch_id IS DISTINCT FROM NEW.branch_id) THEN
   RAISE EXCEPTION 'Selected credit account is not available' USING ERRCODE='P0916';
  END IF;
  IF NEW.voucher_type='PAYMENT' AND
     (NEW.credit_account_id IS DISTINCT FROM NEW.payment_account_id OR
      a.category NOT IN('EXPENSE','LIABILITY','ASSET')) THEN
   RAISE EXCEPTION 'Payment voucher must debit an expense, payable or asset and credit its selected cash or bank'
    USING ERRCODE='P0916';
  END IF;
  IF NEW.voucher_type='CONTRA' AND
     (NEW.credit_account_id IS DISTINCT FROM NEW.payment_account_id OR
      a.account_kind NOT IN('CASH','BANK') OR b.account_kind NOT IN('CASH','BANK')) THEN
   RAISE EXCEPTION 'Contra voucher must transfer between different cash or bank accounts'
    USING ERRCODE='P0916';
  END IF;
  IF NEW.voucher_type='EXPENSE' AND (a.category<>'EXPENSE' OR b.category<>'LIABILITY') THEN
   RAISE EXCEPTION 'Unpaid expense must debit an expense account and credit a payable account'
    USING ERRCODE='P0916';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_voucher_accounts_guard BEFORE INSERT OR UPDATE ON finance_voucher
 FOR EACH ROW EXECUTE FUNCTION cg09_voucher_accounting_guard();

CREATE FUNCTION cg09_verify_voucher_accounting_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header jsonb;
BEGIN
 SELECT header_snapshot INTO header
 FROM finance_voucher_draft_revision
 WHERE voucher_id=NEW.id AND root_realm_id=NEW.root_realm_id AND version=NEW.version;
 IF NOT FOUND OR header->>'debitAccountRef' IS DISTINCT FROM NEW.debit_account_id::text
    OR header->>'creditAccountRef' IS DISTINCT FROM NEW.credit_account_id::text THEN
  RAISE EXCEPTION 'Frozen financial account sides do not match the voucher source'
   USING ERRCODE='P0913';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_voucher_accounting_snapshot
 AFTER INSERT OR UPDATE ON finance_voucher DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_verify_voucher_accounting_snapshot();

-- Exactly one immutable balanced journal can represent a voucher. This source
-- table is a linkage into the existing journal owner, NOT a second ledger.
CREATE TABLE finance_voucher_posting(
 voucher_id uuid PRIMARY KEY,
 root_realm_id uuid NOT NULL,
 voucher_revision integer NOT NULL CHECK(voucher_revision>0),
 approval_case_id uuid NOT NULL,
 journal_id uuid NOT NULL UNIQUE,
 original_digest char(64) NOT NULL CHECK(original_digest ~ '^[0-9a-f]{64}$'),
 posted_by uuid NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(voucher_id,root_realm_id),
 FOREIGN KEY(voucher_id,root_realm_id)
   REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_case_id,root_realm_id)
   REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_id,root_realm_id)
   REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(posted_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_voucher_posting_immutable
 BEFORE UPDATE OR DELETE ON finance_voucher_posting FOR EACH ROW
 EXECUTE FUNCTION cg09_immutable_record();
CREATE INDEX ix_cg09_voucher_posted_root_recent
 ON finance_voucher_posting(root_realm_id,posted_at DESC,journal_id DESC);

-- Extend original finance_voucher state machine without replacing ownership.
CREATE OR REPLACE FUNCTION cg09_guard_voucher_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y record;case_state text;
BEGIN
 SELECT fy.start_on,fy.end_on,fy.status INTO y FROM financial_year fy
 WHERE fy.id=NEW.financial_year_id AND fy.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Financial year is not available' USING ERRCODE='P0901';
 END IF;
 IF NEW.posting_date<y.start_on OR NEW.posting_date>y.end_on THEN
  RAISE EXCEPTION 'Voucher date is outside financial year' USING ERRCODE='P0911';
 END IF;
 IF NEW.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch
   WHERE id=NEW.branch_id AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND AND NEW.status IN('DRAFT','SUBMITTED','APPROVED','PAYMENT_REQUESTED') THEN
   RAISE EXCEPTION 'Voucher branch is not active' USING ERRCODE='P0904';
  END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR y.status<>'OPEN' THEN
   RAISE EXCEPTION 'New voucher must be a draft in an open year' USING ERRCODE='P0901';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.voucher_number IS DISTINCT FROM OLD.voucher_number OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Voucher source identity is immutable' USING ERRCODE='P0907';
 END IF;
 IF (OLD.status='DRAFT' OR OLD.status='RETURNED') AND NEW.status='DRAFT' THEN
  IF y.status<>'OPEN' OR NEW.version<>OLD.version+1 OR
    NEW.approval_case_id IS NOT NULL OR NEW.proof_file_id IS NOT NULL OR
    NEW.proof_file_revision IS NOT NULL THEN
   RAISE EXCEPTION 'Draft revision or correction is not current' USING ERRCODE='P0907';
  END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF y.status<>'OPEN' OR NEW.version<>OLD.version OR
   NEW.approval_case_id IS NULL OR NEW.proof_file_id IS NULL OR
   NEW.proof_file_revision IS NULL THEN
   RAISE EXCEPTION 'Submitted voucher needs real approval and evidence' USING ERRCODE='P0913';
  END IF;
  PERFORM 1 FROM cg03_case c
   JOIN cg19_stored_file f ON f.id=NEW.proof_file_id AND f.realm_id=NEW.root_realm_id
    AND f.voucher_id=NEW.id AND f.voucher_version=NEW.version
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.case_kind='FINANCE_VOUCHER' AND c.finance_voucher_id=NEW.id
    AND c.finance_voucher_revision=NEW.version AND
    c.finance_proof_file_id=f.id AND c.finance_proof_revision=f.revision
    AND c.status IN('SUBMITTED','IN_REVIEW') AND f.revision=NEW.proof_file_revision
    AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
    AND i.status='VALIDATED' FOR SHARE OF c,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Original review case or clean proof is missing' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF NEW.version<>OLD.version THEN
   RAISE EXCEPTION 'Submitted voucher version is immutable' USING ERRCODE='P0907';
  END IF;
  SELECT status INTO case_state FROM cg03_case
   WHERE id=NEW.approval_case_id AND realm_id=NEW.root_realm_id
    AND finance_voucher_id=NEW.id AND finance_voucher_revision=NEW.version
    AND case_kind='FINANCE_VOUCHER' FOR SHARE;
  IF NOT FOUND OR
    (NEW.status='RETURNED' AND case_state<>'RETURNED') OR
    (NEW.status='REJECTED' AND case_state<>'REJECTED') OR
    (NEW.status='APPROVED' AND case_state NOT IN('PENDING_OWNER','OWNER_COMPLETED')) THEN
   RAISE EXCEPTION 'Committed reviewer outcome is required' USING ERRCODE='P0913';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect effect
     JOIN cg03_case_decision d ON d.id=effect.final_decision_id
   WHERE effect.case_id=NEW.approval_case_id
    AND effect.realm_id=NEW.root_realm_id
    AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF effect,d;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'Protected reviewer proof is unavailable' USING ERRCODE='P0913';
   END IF;
  END IF;
 ELSIF OLD.status='APPROVED' AND NEW.status='PAYMENT_REQUESTED' THEN
  IF NEW.voucher_type NOT IN('PAYMENT','CONTRA') OR y.status<>'OPEN' THEN
   RAISE EXCEPTION 'Payment request is not allowed' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status='PAYMENT_REQUESTED' AND NEW.status='PAID_VERIFIED' THEN
  PERFORM 1 FROM finance_voucher_payment_verification p
   WHERE p.voucher_id=NEW.id AND p.root_realm_id=NEW.root_realm_id
    AND p.voucher_revision=NEW.version AND p.status='VERIFIED' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Independent verified money source is required' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status IN('APPROVED','PAID_VERIFIED') AND NEW.status='POSTED' THEN
  IF (OLD.status='APPROVED' AND NEW.voucher_type IN('PAYMENT','CONTRA')) OR
     (OLD.status='PAID_VERIFIED' AND NEW.voucher_type NOT IN('PAYMENT','CONTRA')) OR
     y.status<>'OPEN' THEN
   RAISE EXCEPTION 'Voucher posting requires open year and correct payment stage'
     USING ERRCODE='P0901';
  END IF;
  PERFORM 1 FROM finance_voucher_posting p JOIN journal j
     ON j.id=p.journal_id AND j.root_realm_id=p.root_realm_id
   WHERE p.voucher_id=NEW.id AND p.root_realm_id=NEW.root_realm_id
    AND p.voucher_revision=NEW.version AND p.approval_case_id=NEW.approval_case_id
    AND j.posting_kind='VOUCHER' AND j.status='POSTED'
    AND j.source_ref=NEW.id AND j.immutable_payload_digest=p.original_digest
    AND j.financial_year_id=NEW.financial_year_id AND j.posting_date=NEW.posting_date
    AND (
     SELECT count(*)=2 AND COALESCE(sum(l.debit_minor),0)=NEW.total_minor
      AND COALESCE(sum(l.credit_minor),0)=NEW.total_minor
      AND count(*) FILTER (WHERE l.account_id=NEW.debit_account_id
       AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
       AND l.debit_minor=NEW.total_minor AND l.credit_minor=0)=1
      AND count(*) FILTER (WHERE l.account_id=NEW.credit_account_id
       AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
       AND l.credit_minor=NEW.total_minor AND l.debit_minor=0)=1
     FROM journal_line l WHERE l.journal_id=j.id AND l.root_realm_id=NEW.root_realm_id
    )
   FOR SHARE OF p,j;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Balanced original journal posting is required' USING ERRCODE='P0913';
  END IF;
 ELSE
  RAISE EXCEPTION 'Voucher workflow transition not permitted' USING ERRCODE='P0907';
 END IF;
 -- Once a draft is submitted, all financial facts and source refs are immutable.
 IF OLD.status NOT IN('DRAFT','RETURNED') AND
    (NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id OR
     NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
     NEW.voucher_type IS DISTINCT FROM OLD.voucher_type OR
     NEW.posting_date IS DISTINCT FROM OLD.posting_date OR
     NEW.payee_name IS DISTINCT FROM OLD.payee_name OR
     NEW.purpose IS DISTINCT FROM OLD.purpose OR
     NEW.gross_minor IS DISTINCT FROM OLD.gross_minor OR
     NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR
     NEW.charges_minor IS DISTINCT FROM OLD.charges_minor OR
     NEW.total_minor IS DISTINCT FROM OLD.total_minor OR
     NEW.debit_account_id IS DISTINCT FROM OLD.debit_account_id OR
     NEW.credit_account_id IS DISTINCT FROM OLD.credit_account_id OR
     NEW.payment_account_id IS DISTINCT FROM OLD.payment_account_id OR
     NEW.approval_case_id IS DISTINCT FROM OLD.approval_case_id OR
     NEW.proof_file_id IS DISTINCT FROM OLD.proof_file_id OR
     NEW.proof_file_revision IS DISTINCT FROM OLD.proof_file_revision OR
     NEW.version<>OLD.version) THEN
  IF NOT(OLD.status='DRAFT' AND NEW.status='SUBMITTED' AND
    NEW.financial_year_id IS NOT DISTINCT FROM OLD.financial_year_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.voucher_type IS NOT DISTINCT FROM OLD.voucher_type AND
    NEW.posting_date IS NOT DISTINCT FROM OLD.posting_date AND
    NEW.payee_name IS NOT DISTINCT FROM OLD.payee_name AND
    NEW.purpose IS NOT DISTINCT FROM OLD.purpose AND
    NEW.gross_minor IS NOT DISTINCT FROM OLD.gross_minor AND
    NEW.tax_minor IS NOT DISTINCT FROM OLD.tax_minor AND
    NEW.charges_minor IS NOT DISTINCT FROM OLD.charges_minor AND
    NEW.total_minor IS NOT DISTINCT FROM OLD.total_minor AND
    NEW.debit_account_id IS NOT DISTINCT FROM OLD.debit_account_id AND
    NEW.credit_account_id IS NOT DISTINCT FROM OLD.credit_account_id AND
    NEW.payment_account_id IS NOT DISTINCT FROM OLD.payment_account_id AND
    NEW.version=OLD.version) THEN
   RAISE EXCEPTION 'Frozen submitted voucher facts cannot change' USING ERRCODE='P0907';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
