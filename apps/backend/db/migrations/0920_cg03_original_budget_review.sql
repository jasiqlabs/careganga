-- CG-09 US-005 budget review uses original CG03 process, case and decisions.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
    'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET'));
CREATE TABLE cg03_budget_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE cg03_case ADD COLUMN finance_budget_id uuid,
 ADD COLUMN finance_budget_revision integer,
 ADD COLUMN finance_budget_digest char(64);
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
  'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET'));
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_finance_source_disjoint;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_finance_source_disjoint CHECK(
 (case_kind='CG01_ROLE'
   AND finance_budget_id IS NULL AND finance_budget_revision IS NULL
   AND finance_budget_digest IS NULL
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
   AND finance_budget_id IS NULL AND finance_budget_revision IS NULL
   AND finance_budget_digest IS NULL
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
   AND finance_budget_id IS NULL AND finance_budget_revision IS NULL
   AND finance_budget_digest IS NULL
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
   AND finance_budget_id IS NULL AND finance_budget_revision IS NULL
   AND finance_budget_digest IS NULL
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
   AND finance_budget_id IS NULL AND finance_budget_revision IS NULL
   AND finance_budget_digest IS NULL
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
 OR
 (case_kind='FINANCE_BUDGET' AND
   branch_source_ref IS NULL AND branch_source_revision IS NULL
   AND branch_source_digest IS NULL
   AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
   AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
   AND finance_proof_revision IS NULL
   AND finance_claim_id IS NULL AND finance_claim_revision IS NULL
   AND finance_claim_digest IS NULL AND finance_claim_bill_id IS NULL
   AND finance_claim_bill_version IS NULL
   AND finance_invoice_id IS NULL AND finance_invoice_revision IS NULL
   AND finance_invoice_digest IS NULL
   AND finance_budget_id IS NOT NULL AND finance_budget_revision>0
   AND finance_budget_digest ~ '^[0-9a-f]{64}$'
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL)
);


ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_original_budget
 FOREIGN KEY(finance_budget_id,realm_id)
 REFERENCES finance_budget(id,root_realm_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_budget_version ON cg03_case
 (realm_id,finance_budget_id,finance_budget_revision)
 WHERE case_kind='FINANCE_BUDGET';
CREATE INDEX ix_cg03_budget_review ON cg03_case
 (realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='FINANCE_BUDGET';
ALTER TABLE finance_budget ADD CONSTRAINT fk_cg09_budget_approval
 FOREIGN KEY(approval_case_id,root_realm_id)
 REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT;
CREATE FUNCTION cg03_budget_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.finance_budget_id IS DISTINCT FROM OLD.finance_budget_id OR
    NEW.finance_budget_revision IS DISTINCT FROM OLD.finance_budget_revision OR
    NEW.finance_budget_digest IS DISTINCT FROM OLD.finance_budget_digest THEN
  RAISE EXCEPTION 'Original approved budget case cannot be retargeted' USING ERRCODE='P0925';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_budget_source_immutable BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_budget_source_frozen();

CREATE FUNCTION cg09_budget_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_status record; grant_row record;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original budget cannot be deleted' USING ERRCODE='P0925';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'Budget starts as a draft' USING ERRCODE='P0925';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.budget_number IS DISTINCT FROM OLD.budget_number OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Original budget identity cannot be changed' USING ERRCODE='P0925';
 END IF;
 IF OLD.status IN('DRAFT','RETURNED') AND NEW.status='DRAFT' THEN
  IF NEW.version<>OLD.version+1 OR NEW.approval_case_id IS NOT NULL OR
     NEW.current_digest IS NOT DISTINCT FROM OLD.current_digest THEN
   RAISE EXCEPTION 'Budget correction needs new immutable revision' USING ERRCODE='P0925';
  END IF;
  IF OLD.status='RETURNED' THEN
   PERFORM 1 FROM cg03_case c JOIN cg03_case_decision d
    ON d.case_id=c.id AND d.realm_id=c.realm_id
    WHERE c.id=OLD.approval_case_id AND c.realm_id=OLD.root_realm_id
     AND c.case_kind='FINANCE_BUDGET' AND c.finance_budget_id=OLD.id
     AND c.finance_budget_revision=OLD.version AND c.status='RETURNED'
     AND d.action='RETURN' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF c,d;
   IF NOT FOUND THEN RAISE EXCEPTION 'An actual returned budget decision is required'
    USING ERRCODE='P0925'; END IF;
  END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF (to_jsonb(NEW)-'status'-'approval_case_id'-'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD)-'status'-'approval_case_id'-'updated_at') THEN
   RAISE EXCEPTION 'Submitted budget fields cannot change' USING ERRCODE='P0925';
  END IF;
  SELECT c.status,c.finance_budget_digest INTO case_status
   FROM cg03_case c WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.case_kind='FINANCE_BUDGET' AND c.finance_budget_id=NEW.id
    AND c.finance_budget_revision=NEW.version
    AND c.finance_budget_digest=NEW.current_digest
    AND c.status IN('SUBMITTED','IN_REVIEW') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original budget reviewer case is missing'
    USING ERRCODE='P0925'; END IF;
  PERFORM 1 FROM financial_year fy WHERE fy.id=NEW.financial_year_id
    AND fy.root_realm_id=NEW.root_realm_id AND fy.status='OPEN'
    AND NEW.period_start BETWEEN fy.start_on AND fy.end_on
    AND NEW.period_end BETWEEN fy.start_on AND fy.end_on FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Budget period is outside current year' USING ERRCODE='P0925'; END IF;
  IF NEW.branch_id IS NOT NULL THEN
   PERFORM 1 FROM branch WHERE id=NEW.branch_id AND root_realm_id=NEW.root_realm_id
    AND status='ACTIVE' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Budget branch is unavailable' USING ERRCODE='P0925'; END IF;
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD)-'status'-'updated_at') THEN
   RAISE EXCEPTION 'Protected submitted budget cannot be changed' USING ERRCODE='P0925';
  END IF;
  SELECT c.status INTO case_status FROM cg03_case c
   WHERE c.id=OLD.approval_case_id AND c.realm_id=OLD.root_realm_id
    AND c.case_kind='FINANCE_BUDGET' AND c.finance_budget_id=OLD.id
    AND c.finance_budget_revision=OLD.version FOR SHARE;
  IF NOT FOUND OR
     (NEW.status='RETURNED' AND case_status.status<>'RETURNED') OR
     (NEW.status='REJECTED' AND case_status.status<>'REJECTED') OR
     (NEW.status='APPROVED' AND case_status.status NOT IN('PENDING_OWNER','OWNER_COMPLETED')) THEN
   RAISE EXCEPTION 'Protected budget decision is not confirmed' USING ERRCODE='P0925';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect e JOIN cg03_case_decision d
    ON d.id=e.final_decision_id AND d.case_id=e.case_id
    WHERE e.case_id=OLD.approval_case_id AND e.realm_id=OLD.root_realm_id
     AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF e,d;
   IF NOT FOUND THEN RAISE EXCEPTION 'Protected budget approval missing' USING ERRCODE='P0925'; END IF;
  END IF;
 ELSIF OLD.status='APPROVED' AND NEW.status='ARCHIVED' THEN
  IF (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM
    (to_jsonb(OLD)-'status'-'updated_at') THEN
   RAISE EXCEPTION 'Archived budget cannot edit original approved ceiling' USING ERRCODE='P0925';
  END IF;
 ELSE
  RAISE EXCEPTION 'Budget workflow transition is not allowed' USING ERRCODE='P0925';
 END IF;
 PERFORM 1 FROM finance_budget_revision r
 WHERE r.root_realm_id=NEW.root_realm_id AND r.budget_id=NEW.id
   AND r.version=NEW.version AND r.source_digest=NEW.current_digest
   AND r.name=NEW.budget_name AND r.category_label=NEW.category_label
   AND r.financial_year_id=NEW.financial_year_id
   AND r.branch_id IS NOT DISTINCT FROM NEW.branch_id
   AND r.period_start=NEW.period_start AND r.period_end=NEW.period_end
   AND r.funding_note=NEW.funding_note
   AND r.approved_ceiling_minor=NEW.approved_ceiling_minor
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Budget immutable source revision does not match' USING ERRCODE='P0925';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_budget_state_guard BEFORE INSERT OR UPDATE OR DELETE
 ON finance_budget FOR EACH ROW EXECUTE FUNCTION cg09_budget_state_guard();

CREATE FUNCTION cg09_budget_revision_exists() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM finance_budget_revision r
  WHERE r.root_realm_id=NEW.root_realm_id AND r.budget_id=NEW.id
    AND r.version=NEW.version AND r.source_digest=NEW.current_digest;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Original budget revision missing' USING ERRCODE='P0925';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_budget_requires_revision
 AFTER INSERT OR UPDATE ON finance_budget DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_budget_revision_exists();
