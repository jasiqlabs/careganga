-- CG-14 US-003: add professional verification as a new SOURCE KIND to the
-- EXISTING CG-03 process, case, reviewer decision and audit tables.
-- Existing CG01, CG02, finance, CMS, provider and center cases remain intact.
-- DO NOT introduce a second healthcare review/approval master.
CREATE TABLE health_doctor_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  revision_no integer NOT NULL CHECK(revision_no>0),
  source_version integer NOT NULL CHECK(source_version>0),
  source_snapshot jsonb NOT NULL,
  source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
  proof_file_ref uuid NOT NULL,
  submitted_by uuid NOT NULL,
  approval_case_ref uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(id,root_realm_id,doctor_id),
  UNIQUE(root_realm_id,doctor_id,revision_no),
  FOREIGN KEY(root_realm_id,doctor_id)
    REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(proof_file_ref,root_realm_id,doctor_id,source_version)
    REFERENCES cg19_stored_file(id,realm_id,health_doctor_id,health_source_version)
    ON DELETE RESTRICT,
  FOREIGN KEY(submitted_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approval_case_ref,root_realm_id)
    REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_doctor_revision_review
 ON health_doctor_revision(root_realm_id,doctor_id,submitted_at DESC,id DESC);
CREATE FUNCTION cg14_doctor_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Submitted professional evidence revision cannot be deleted';
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
    NEW.source_version IS DISTINCT FROM OLD.source_version OR
    NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR
    NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
    NEW.proof_file_ref IS DISTINCT FROM OLD.proof_file_ref OR
    NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
    NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
    (OLD.approval_case_ref IS NOT NULL AND
      NEW.approval_case_ref IS DISTINCT FROM OLD.approval_case_ref) THEN
  RAISE EXCEPTION 'Original doctor source may only attach its CG03 case once';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg14_doctor_revision_frozen
 BEFORE UPDATE OR DELETE ON health_doctor_revision
 FOR EACH ROW EXECUTE FUNCTION cg14_doctor_revision_immutable();

-- Extend approved PROCESS/CURRENT kinds; do not replace CG03 workflow.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION','HEALTH_DOCTOR_VERIFICATION'));
ALTER TABLE cg03_health_process_current DROP CONSTRAINT cg03_health_process_current_case_kind_check;
ALTER TABLE cg03_health_process_current ADD CONSTRAINT cg03_health_process_current_case_kind_check
 CHECK(case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION'));

ALTER TABLE cg03_case
 ADD COLUMN health_doctor_id uuid,
 ADD COLUMN health_doctor_revision_id uuid,
 ADD CONSTRAINT fk_cg03_original_doctor FOREIGN KEY(health_doctor_id,realm_id)
   REFERENCES health_doctor(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg03_original_doctor_revision
   FOREIGN KEY(health_doctor_revision_id,realm_id,health_doctor_id)
   REFERENCES health_doctor_revision(id,root_realm_id,doctor_id) ON DELETE RESTRICT;

ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION','HEALTH_DOCTOR_VERIFICATION'));

-- Preserve the preceding CG03 constraint branches verbatim, extend only
-- one disjoint doctor source variant. Separate CHECK enforces doctor columns
-- NULL on all previous case variants.
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_finance_source_disjoint;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_finance_source_disjoint CHECK(

 (case_kind='CG01_ROLE' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL
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
 (case_kind='BRANCH_REGISTRATION' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL
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
 (case_kind='FINANCE_VOUCHER' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL
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
 (case_kind='FINANCE_REIMBURSEMENT' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL
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
 (case_kind='FINANCE_INVOICE' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL
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
 (case_kind='FINANCE_BUDGET' AND cms_page_id IS NULL AND cms_page_revision_id IS NULL AND cms_revision_no IS NULL AND cms_content_digest IS NULL AND
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
 OR
 (case_kind='CMS_PUBLICATION'
   AND cms_page_id IS NOT NULL AND cms_page_revision_id IS NOT NULL
   AND cms_revision_no>0 AND cms_content_digest ~ '^[a-f0-9]{64}$'
   AND branch_source_ref IS NULL AND
   branch_source_revision IS NULL AND
   branch_source_digest IS NULL AND
   finance_voucher_id IS NULL AND
   finance_voucher_revision IS NULL AND
   finance_voucher_digest IS NULL AND
   finance_proof_file_id IS NULL AND
   finance_proof_revision IS NULL AND
   finance_claim_id IS NULL AND
   finance_claim_revision IS NULL AND
   finance_claim_digest IS NULL AND
   finance_claim_bill_id IS NULL AND
   finance_claim_bill_version IS NULL AND
   finance_invoice_id IS NULL AND
   finance_invoice_revision IS NULL AND
   finance_invoice_digest IS NULL AND
   finance_budget_id IS NULL AND
   finance_budget_revision IS NULL AND
   finance_budget_digest IS NULL AND
   target_account_id IS NULL AND
   target_role_id IS NULL AND
   expected_access_version IS NULL AND
   expected_role_revision IS NULL)
 OR
 (case_kind='HEALTH_PROVIDER_VERIFICATION'
  AND health_provider_id IS NOT NULL AND health_center_id IS NULL
  AND health_provider_revision_id IS NOT NULL
  AND health_center_revision_id IS NULL
  AND health_revision_no>0 AND health_source_digest ~ '^[a-f0-9]{64}$'
  AND num_nonnulls(cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,
 branch_source_ref,branch_source_revision,branch_source_digest,
 finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
 finance_proof_file_id,finance_proof_revision,
 finance_claim_id,finance_claim_revision,finance_claim_digest,
 finance_claim_bill_id,finance_claim_bill_version,
 finance_invoice_id,finance_invoice_revision,finance_invoice_digest,
 finance_budget_id,finance_budget_revision,finance_budget_digest,
 target_account_id,target_role_id,expected_access_version,expected_role_revision)=0)
 OR
 (case_kind='HEALTH_CENTER_VERIFICATION'
  AND health_provider_id IS NOT NULL AND health_center_id IS NOT NULL
  AND health_provider_revision_id IS NULL
  AND health_center_revision_id IS NOT NULL
  AND health_revision_no>0 AND health_source_digest ~ '^[a-f0-9]{64}$'
  AND num_nonnulls(cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,
 branch_source_ref,branch_source_revision,branch_source_digest,
 finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
 finance_proof_file_id,finance_proof_revision,
 finance_claim_id,finance_claim_revision,finance_claim_digest,
 finance_claim_bill_id,finance_claim_bill_version,
 finance_invoice_id,finance_invoice_revision,finance_invoice_digest,
 finance_budget_id,finance_budget_revision,finance_budget_digest,
 target_account_id,target_role_id,expected_access_version,expected_role_revision)=0)
 OR
 (case_kind='HEALTH_DOCTOR_VERIFICATION'
  AND health_provider_id IS NULL AND health_center_id IS NULL
  AND health_provider_revision_id IS NULL AND health_center_revision_id IS NULL
  AND health_doctor_id IS NOT NULL AND health_doctor_revision_id IS NOT NULL
  AND health_revision_no>0 AND health_source_digest ~ '^[a-f0-9]{64}$'
  AND num_nonnulls(cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,
   branch_source_ref,branch_source_revision,branch_source_digest,
   finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
   finance_proof_file_id,finance_proof_revision,
   finance_claim_id,finance_claim_revision,finance_claim_digest,
   finance_claim_bill_id,finance_claim_bill_version,
   finance_invoice_id,finance_invoice_revision,finance_invoice_digest,
   finance_budget_id,finance_budget_revision,finance_budget_digest,
   target_account_id,target_role_id,expected_access_version,expected_role_revision)=0)

);
-- The pre-existing healthcare-only invariant must recognize the third
-- typed healthcare case. Other CG03 families still have no health source.
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_health_only_source;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_health_only_source CHECK(
 case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
  'HEALTH_DOCTOR_VERIFICATION')
 OR num_nonnulls(health_provider_id,health_center_id,
   health_provider_revision_id,health_center_revision_id,
   health_revision_no,health_source_digest)=0
);
ALTER TABLE cg03_case ADD CONSTRAINT cg03_doctor_only_source CHECK(
 (case_kind='HEALTH_DOCTOR_VERIFICATION' AND
  health_doctor_id IS NOT NULL AND health_doctor_revision_id IS NOT NULL AND
  health_provider_id IS NULL AND health_center_id IS NULL AND
  health_provider_revision_id IS NULL AND health_center_revision_id IS NULL)
 OR
 (case_kind<>'HEALTH_DOCTOR_VERIFICATION' AND
  health_doctor_id IS NULL AND health_doctor_revision_id IS NULL)
);
CREATE UNIQUE INDEX ux_cg03_original_doctor_revision
 ON cg03_case(realm_id,health_doctor_id,health_revision_no)
 WHERE case_kind='HEALTH_DOCTOR_VERIFICATION';
CREATE INDEX ix_cg03_health_doctor_case
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='HEALTH_DOCTOR_VERIFICATION';

-- Include the new source fields in the immutable CG03 case identity.
CREATE OR REPLACE FUNCTION cg03_health_source_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id OR
    NEW.health_center_id IS DISTINCT FROM OLD.health_center_id OR
    NEW.health_provider_revision_id IS DISTINCT FROM OLD.health_provider_revision_id OR
    NEW.health_center_revision_id IS DISTINCT FROM OLD.health_center_revision_id OR
    NEW.health_doctor_id IS DISTINCT FROM OLD.health_doctor_id OR
    NEW.health_doctor_revision_id IS DISTINCT FROM OLD.health_doctor_revision_id OR
    NEW.health_revision_no IS DISTINCT FROM OLD.health_revision_no OR
    NEW.health_source_digest IS DISTINCT FROM OLD.health_source_digest THEN
  RAISE EXCEPTION 'Original healthcare review source is immutable';
 END IF;
 RETURN NEW;
END $$;

ALTER TABLE health_doctor_event DROP CONSTRAINT health_doctor_event_action_key_check;
ALTER TABLE health_doctor_event ADD CONSTRAINT health_doctor_event_action_key_check
 CHECK(action_key IN('DOCTOR_DRAFT_CREATE','DOCTOR_DRAFT_UPDATE',
 'DOCTOR_CENTER_PROPOSE','DOCTOR_SUBMIT','DOCTOR_RETURN','DOCTOR_VERIFY'));
