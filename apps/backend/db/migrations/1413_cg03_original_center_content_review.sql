-- CG-14 US-005, original CG-03 process, case and protected final decision
-- for CENTER_CONTENT_REVIEW. Existing nine original case kinds preserved.
ALTER TABLE cg03_case ADD COLUMN health_content_revision_id uuid;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_center_content_original
 FOREIGN KEY(realm_id,health_center_id,health_content_revision_id)
 REFERENCES health_center_content_revision(root_realm_id,center_id,id)
 ON DELETE RESTRICT;
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW'));
ALTER TABLE cg03_health_process_current DROP CONSTRAINT cg03_health_process_current_case_kind_check;
ALTER TABLE cg03_health_process_current ADD CONSTRAINT cg03_health_process_current_case_kind_check
 CHECK(case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW'));
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW'));
-- Preserve all pre-existing families while adding a disjoint new source.
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

 OR
 (case_kind='HEALTH_CENTER_CONTENT_REVIEW'
  AND health_provider_id IS NOT NULL AND health_center_id IS NOT NULL
  AND health_provider_revision_id IS NULL AND health_center_revision_id IS NULL
  AND health_doctor_id IS NULL AND health_doctor_revision_id IS NULL
  AND health_content_revision_id IS NOT NULL
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
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_health_only_source;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_health_only_source CHECK(
 case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
  'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW')
 OR num_nonnulls(health_provider_id,health_center_id,
   health_provider_revision_id,health_center_revision_id,
   health_revision_no,health_source_digest)=0);
ALTER TABLE cg03_case ADD CONSTRAINT cg03_center_content_only_source CHECK(
 (case_kind='HEALTH_CENTER_CONTENT_REVIEW' AND health_content_revision_id IS NOT NULL)
 OR
 (case_kind<>'HEALTH_CENTER_CONTENT_REVIEW' AND health_content_revision_id IS NULL));
CREATE UNIQUE INDEX ux_cg03_original_center_content_revision
 ON cg03_case(realm_id,health_center_id,health_revision_no)
 WHERE case_kind='HEALTH_CENTER_CONTENT_REVIEW';
CREATE INDEX ix_cg03_center_content_cases
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='HEALTH_CENTER_CONTENT_REVIEW';
-- The original healthcare source guard already protects source identity.
CREATE OR REPLACE FUNCTION cg03_health_source_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id OR
    NEW.health_center_id IS DISTINCT FROM OLD.health_center_id OR
    NEW.health_provider_revision_id IS DISTINCT FROM OLD.health_provider_revision_id OR
    NEW.health_center_revision_id IS DISTINCT FROM OLD.health_center_revision_id OR
    NEW.health_doctor_id IS DISTINCT FROM OLD.health_doctor_id OR
    NEW.health_doctor_revision_id IS DISTINCT FROM OLD.health_doctor_revision_id OR
    NEW.health_content_revision_id IS DISTINCT FROM OLD.health_content_revision_id OR
    NEW.health_revision_no IS DISTINCT FROM OLD.health_revision_no OR
    NEW.health_source_digest IS DISTINCT FROM OLD.health_source_digest THEN
  RAISE EXCEPTION 'Original healthcare review source is immutable';
 END IF;
 RETURN NEW;
END $$;
