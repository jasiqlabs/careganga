-- CG-09 US-003 introduces CG-03's genuine FINANCE_REIMBURSEMENT process.
-- One CG-03 case per immutable original claim revision. Original role/branch/voucher
-- approval cases remain authoritative and unchanged.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER','FINANCE_REIMBURSEMENT'));
CREATE TABLE cg03_claim_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE cg03_case
 ADD COLUMN finance_claim_id uuid,
 ADD COLUMN finance_claim_revision integer,
 ADD COLUMN finance_claim_digest char(64),
 ADD COLUMN finance_claim_bill_id uuid,
 ADD COLUMN finance_claim_bill_version integer;
ALTER TABLE cg03_case
 DROP CONSTRAINT cg03_case_kind_finance,
 DROP CONSTRAINT cg03_case_finance_source_disjoint;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER','FINANCE_REIMBURSEMENT'));
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_finance_source_disjoint CHECK(
 (case_kind='CG01_ROLE'
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
);
ALTER TABLE cg03_case
 ADD CONSTRAINT fk_cg03_claim_original FOREIGN KEY(finance_claim_id,realm_id)
  REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg03_claim_bill_original
  FOREIGN KEY(finance_claim_bill_id,realm_id,finance_claim_id,finance_claim_revision)
  REFERENCES cg19_stored_file(id,realm_id,claim_id,claim_version) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_claim_revision
 ON cg03_case(realm_id,finance_claim_id,finance_claim_revision)
 WHERE case_kind='FINANCE_REIMBURSEMENT';
CREATE INDEX ix_cg03_claim_review
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='FINANCE_REIMBURSEMENT';

CREATE FUNCTION cg03_claim_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.finance_claim_id IS DISTINCT FROM OLD.finance_claim_id OR
    NEW.finance_claim_revision IS DISTINCT FROM OLD.finance_claim_revision OR
    NEW.finance_claim_digest IS DISTINCT FROM OLD.finance_claim_digest OR
    NEW.finance_claim_bill_id IS DISTINCT FROM OLD.finance_claim_bill_id OR
    NEW.finance_claim_bill_version IS DISTINCT FROM OLD.finance_claim_bill_version
 THEN RAISE EXCEPTION 'Original approved claim cannot be retargeted' USING ERRCODE='P0919'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_claim_source_immutable BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_claim_source_frozen();

ALTER TABLE expense_claim
 ADD CONSTRAINT fk_cg09_claim_approval FOREIGN KEY(approval_case_id,root_realm_id)
 REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT;
-- Protect final financial approval even against a direct SQL writer. Freeze the
-- claimed original scanned bill + case digest, and current separate reviewer proof.
CREATE OR REPLACE FUNCTION cg09_claim_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_result record;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original claim history cannot be deleted' USING ERRCODE='P0919';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
    NEW.category_label IS DISTINCT FROM OLD.category_label OR
    NEW.purpose IS DISTINCT FROM OLD.purpose OR
    NEW.expense_date IS DISTINCT FROM OLD.expense_date OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
    NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.version<>OLD.version OR
    NEW.create_request_key IS DISTINCT FROM OLD.create_request_key OR
    NEW.create_digest IS DISTINCT FROM OLD.create_digest OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.bill_file_id IS DISTINCT FROM OLD.bill_file_id AND OLD.status<>'DRAFT' OR
    NEW.bill_file_version IS DISTINCT FROM OLD.bill_file_version AND OLD.status<>'DRAFT' OR
    NEW.approval_case_id IS DISTINCT FROM OLD.approval_case_id AND OLD.status<>'DRAFT'
 THEN RAISE EXCEPTION 'Original claim revision cannot change' USING ERRCODE='P0919'; END IF;
 IF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  SELECT ac.status,ac.finance_claim_digest,ac.finance_claim_bill_id,ac.finance_claim_bill_version
   INTO case_result FROM cg03_case ac
   JOIN cg19_stored_file f ON f.id=c.finance_claim_bill_id
       AND f.realm_id=c.realm_id AND f.claim_id=c.finance_claim_id
       AND f.claim_version=c.finance_claim_revision
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE ac.id=NEW.approval_case_id AND ac.realm_id=NEW.root_realm_id
    AND ac.case_kind='FINANCE_REIMBURSEMENT' AND ac.finance_claim_id=NEW.id
    AND ac.finance_claim_revision=NEW.version AND
    ac.finance_claim_digest=NEW.create_digest AND
    ac.finance_claim_bill_id=NEW.bill_file_id AND
    ac.finance_claim_bill_version=NEW.bill_file_version
    AND ac.status IN('SUBMITTED','IN_REVIEW') AND f.revoked_at IS NULL
    AND f.revision=NEW.bill_file_version AND f.scan_status='CLEAN_VERIFIED'
    AND i.status='VALIDATED' FOR SHARE OF ac,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'A verified original claim bill and case are required' USING ERRCODE='P0919';
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  SELECT ac.status INTO case_result FROM cg03_case ac
   WHERE ac.id=OLD.approval_case_id AND ac.realm_id=OLD.root_realm_id
    AND ac.finance_claim_id=OLD.id AND ac.finance_claim_revision=OLD.version
    AND ac.case_kind='FINANCE_REIMBURSEMENT' FOR SHARE;
  IF NOT FOUND OR
    (NEW.status='RETURNED' AND case_result.status<>'RETURNED') OR
    (NEW.status='REJECTED' AND case_result.status<>'REJECTED') OR
    (NEW.status='APPROVED' AND case_result.status NOT IN('PENDING_OWNER','OWNER_COMPLETED'))
   THEN RAISE EXCEPTION 'Protected original reimbursement decision is required' USING ERRCODE='P0919';
  END IF;
  IF NEW.status='APPROVED' THEN
    PERFORM 1 FROM cg03_finance_owner_effect e
    JOIN cg03_case_decision d ON d.id=e.final_decision_id AND d.case_id=e.case_id
    WHERE e.case_id=OLD.approval_case_id AND e.realm_id=OLD.root_realm_id
     AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF e,d;
    IF NOT FOUND THEN
     RAISE EXCEPTION 'Reviewer consent cannot be confirmed' USING ERRCODE='P0919';
    END IF;
  END IF;
 ELSE RAISE EXCEPTION 'Original claim cannot change this state' USING ERRCODE='P0919';
 END IF;
 RETURN NEW;
END; $$;
