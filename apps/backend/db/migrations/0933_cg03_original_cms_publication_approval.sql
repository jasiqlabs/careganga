-- CG-18 US-001: extend ACTUAL CG-03 case/process, never create a shadow
-- CMS approval master. Retain every existing role/branch/finance case variant.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
  'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION'));
CREATE TABLE cg03_cms_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
  ON DELETE RESTRICT
);
ALTER TABLE cg03_case ADD COLUMN cms_page_id uuid,
 ADD COLUMN cms_page_revision_id uuid,
 ADD COLUMN cms_revision_no integer,
 ADD COLUMN cms_content_digest char(64);
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
  'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION'));
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
));
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_cms_page_root
 FOREIGN KEY(cms_page_id,realm_id) REFERENCES cms_page(id,foundation_root_id)
 ON DELETE RESTRICT;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_cms_revision_root
 FOREIGN KEY(realm_id,cms_page_id,cms_page_revision_id)
 REFERENCES cms_page_revision(foundation_root_id,page_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_cms_exact_page_revision ON cg03_case
 (realm_id,cms_page_id,cms_revision_no) WHERE case_kind='CMS_PUBLICATION';
CREATE INDEX ix_cg03_cms_publications ON cg03_case
 (realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='CMS_PUBLICATION';
ALTER TABLE cms_page_revision ADD CONSTRAINT fk_cms_revision_real_cg03_case
 FOREIGN KEY(approval_case_ref,foundation_root_id)
 REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT;
ALTER TABLE cms_publication ADD CONSTRAINT fk_cms_original_cg03_decision
 FOREIGN KEY(cg03_final_decision_ref)
 REFERENCES cg03_case_decision(id) ON DELETE RESTRICT;
CREATE FUNCTION cg03_cms_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.cms_page_id IS DISTINCT FROM OLD.cms_page_id OR
    NEW.cms_page_revision_id IS DISTINCT FROM OLD.cms_page_revision_id OR
    NEW.cms_revision_no IS DISTINCT FROM OLD.cms_revision_no OR
    NEW.cms_content_digest IS DISTINCT FROM OLD.cms_content_digest THEN
  RAISE EXCEPTION 'Original CMS approval source cannot change' USING ERRCODE='P1833';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_cms_immutable_case_source BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_cms_source_immutable();
