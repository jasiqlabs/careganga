-- CG-16 US-001: use genuine CG-03 source-pinned independent price decisions.
-- Requires prior 1421 CG-03 original case constraints and 1601 CG-16 price.
-- This is NOT optional Lab ERP and never authorizes a patient payment/benefit.
ALTER TABLE cg03_case ADD COLUMN cg16_price_id uuid,
 ADD COLUMN cg16_price_version integer,
 ADD COLUMN cg16_price_digest char(64);
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_original_lab_price
 FOREIGN KEY(realm_id,cg16_price_id)
 REFERENCES lab_center_price_version(root_realm_id,id) ON DELETE RESTRICT;

ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT','CG15_DOCTOR_LEAVE','HEALTH_LAB_PRICE_REVIEW'));

ALTER TABLE cg03_health_process_current DROP CONSTRAINT cg03_health_process_current_case_kind_check;
ALTER TABLE cg03_health_process_current ADD CONSTRAINT cg03_health_process_current_case_kind_check
 CHECK(case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT','CG15_DOCTOR_LEAVE','HEALTH_LAB_PRICE_REVIEW'));

ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT','CG15_DOCTOR_LEAVE','HEALTH_LAB_PRICE_REVIEW'));

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

 OR
 (case_kind='HEALTH_CENTER_ERP_GRANT'
  AND health_provider_id IS NOT NULL AND health_center_id IS NOT NULL
  AND health_provider_revision_id IS NULL AND health_center_revision_id IS NULL
  AND health_doctor_id IS NULL AND health_doctor_revision_id IS NULL
  AND health_content_revision_id IS NULL AND health_erp_revision_id IS NOT NULL
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
 (case_kind='CG15_DOCTOR_LEAVE'
  AND health_doctor_id IS NOT NULL AND health_center_id IS NOT NULL
  AND cg15_exception_id IS NOT NULL AND cg15_exception_revision>0
  AND cg15_exception_digest ~ '^[0-9a-f]{64}$'
  AND num_nonnulls(health_provider_id,health_provider_revision_id,
   health_center_revision_id,health_doctor_revision_id,health_content_revision_id,
   health_erp_revision_id,health_revision_no,health_source_digest,
   cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,
   branch_source_ref,branch_source_revision,branch_source_digest,
   finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
   finance_proof_file_id,finance_proof_revision,
   finance_claim_id,finance_claim_revision,finance_claim_digest,
   finance_claim_bill_id,finance_claim_bill_version,
   finance_invoice_id,finance_invoice_revision,finance_invoice_digest,
   finance_budget_id,finance_budget_revision,finance_budget_digest,
   target_account_id,target_role_id,expected_access_version,expected_role_revision)=0)

 OR
 (case_kind='HEALTH_LAB_PRICE_REVIEW'
  AND cg16_price_id IS NOT NULL AND cg16_price_version>0
  AND cg16_price_digest ~ '^[0-9a-f]{64}
  AND num_nonnulls(
   health_provider_id,health_center_id,health_provider_revision_id,
   health_center_revision_id,health_doctor_id,health_doctor_revision_id,
   health_content_revision_id,health_erp_revision_id,health_revision_no,
   health_source_digest,cg15_exception_id,cg15_exception_revision,
   cg15_exception_digest,
   cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,
   branch_source_ref,branch_source_revision,branch_source_digest,
   finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
   finance_proof_file_id,finance_proof_revision,
   finance_claim_id,finance_claim_revision,finance_claim_digest,
   finance_claim_bill_id,finance_claim_bill_version,
   finance_invoice_id,finance_invoice_revision,finance_invoice_digest,
   finance_budget_id,finance_budget_revision,finance_budget_digest,
   target_account_id,target_role_id,expected_access_version,expected_role_revision)=0)

);

-- The price source must appear in precisely its own case kind. Existing
-- CG-03 case kinds continue to enforce their original disjoint invariants.
ALTER TABLE cg03_case ADD CONSTRAINT cg03_lab_price_only_source CHECK (
 (case_kind='HEALTH_LAB_PRICE_REVIEW' AND
  cg16_price_id IS NOT NULL AND cg16_price_version>0 AND
  cg16_price_digest ~ '^[a-f0-9]{64}$')
 OR
 (case_kind<>'HEALTH_LAB_PRICE_REVIEW' AND
  cg16_price_id IS NULL AND cg16_price_version IS NULL AND
  cg16_price_digest IS NULL)
);
CREATE UNIQUE INDEX ux_cg03_lab_price_exact
 ON cg03_case(realm_id,cg16_price_id)
 WHERE case_kind='HEALTH_LAB_PRICE_REVIEW';
CREATE INDEX ix_cg03_lab_price_pending
 ON cg03_case(realm_id,status,submitted_at DESC,id DESC)
 WHERE case_kind='HEALTH_LAB_PRICE_REVIEW';

-- Preserve the original CG03 freeze contract and extend it to lab price refs.
CREATE FUNCTION cg16_cg03_lab_price_source_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF NEW.cg16_price_id IS DISTINCT FROM OLD.cg16_price_id OR
    NEW.cg16_price_version IS DISTINCT FROM OLD.cg16_price_version OR
    NEW.cg16_price_digest IS DISTINCT FROM OLD.cg16_price_digest THEN
   RAISE EXCEPTION 'Original CG03 lab price review source cannot change';
 END IF;
 RETURN NEW;
END
$cg16$;
CREATE TRIGGER cg16_cg03_lab_price_frozen BEFORE UPDATE
 ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg16_cg03_lab_price_source_frozen();
