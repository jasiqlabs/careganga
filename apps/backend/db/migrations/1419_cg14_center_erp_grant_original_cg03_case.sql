-- CG-14 US005 source-only optional ERP center entitlement. No ERP operations.
-- CG-03 remains the ONLY real review/decision source; CG16/22/23/24 remain OFF.
-- Match a center to its verified owning provider at the database boundary.
-- Previous health_center uniqueness covers (root,id), not (root,provider,id).
ALTER TABLE health_center ADD CONSTRAINT uq_cg14_center_root_provider_identity
 UNIQUE(root_realm_id,provider_id,id);
CREATE TABLE health_center_erp_grant_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 provider_id uuid NOT NULL,
 center_id uuid NOT NULL,
 capability text NOT NULL CHECK(capability IN('LAB_ERP','PHARMACY_ERP','NURSING_ERP','OT_ERP')),
 revision_no integer NOT NULL CHECK(revision_no BETWEEN 1 AND 2147483647),
 effective_from timestamptz NOT NULL,
 effective_until timestamptz,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 submitted_by uuid NOT NULL,
 original_case_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,id),
 UNIQUE(root_realm_id,center_id,capability,id),
 UNIQUE(root_realm_id,center_id,capability,revision_no),
 FOREIGN KEY(root_realm_id,provider_id,center_id)
  REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(original_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(effective_until IS NULL OR effective_until>effective_from)
);
CREATE TABLE health_center_erp_grant(
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 capability text NOT NULL CHECK(capability IN('LAB_ERP','PHARMACY_ERP','NURSING_ERP','OT_ERP')),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483647),
 state text NOT NULL CHECK(state IN('REQUESTED','APPROVED','SUSPENDED','WITHDRAWN')),
 pending_revision_id uuid NOT NULL,
 approved_revision_id uuid,
 original_decision_ref uuid,
 approved_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,center_id,capability),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id,capability,pending_revision_id)
  REFERENCES health_center_erp_grant_revision(root_realm_id,center_id,capability,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id,capability,approved_revision_id)
  REFERENCES health_center_erp_grant_revision(root_realm_id,center_id,capability,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(original_decision_ref,root_realm_id)
  REFERENCES cg03_case_decision(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(state<>'APPROVED' OR
  (approved_revision_id IS NOT NULL AND original_decision_ref IS NOT NULL
   AND approved_by IS NOT NULL))
);
CREATE INDEX ix_health_erp_grant_pending
 ON health_center_erp_grant(root_realm_id,state,updated_at DESC,center_id)
 WHERE state='REQUESTED';
CREATE TABLE health_center_erp_grant_command(
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 case_ref uuid,
 revision_no integer NOT NULL CHECK(revision_no>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE health_center_erp_grant_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 capability text NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('REQUESTED','APPROVED','SUSPENDED','WITHDRAWN')),
 source_revision_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(root_realm_id,center_id,capability,source_revision_id)
  REFERENCES health_center_erp_grant_revision(root_realm_id,center_id,capability,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_erp_grant_audit
 ON health_center_erp_grant_event(root_realm_id,center_id,capability,occurred_at DESC,id);
CREATE OR REPLACE FUNCTION cg14_erp_grant_revision_frozen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR
  NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.provider_id IS DISTINCT FROM OLD.provider_id OR
  NEW.center_id IS DISTINCT FROM OLD.center_id OR
  NEW.id IS DISTINCT FROM OLD.id OR
  NEW.capability IS DISTINCT FROM OLD.capability OR
  NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
  NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
  NEW.effective_until IS DISTINCT FROM OLD.effective_until OR
  NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
  NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
  NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
  (OLD.original_case_ref IS NOT NULL AND
   NEW.original_case_ref IS DISTINCT FROM OLD.original_case_ref) THEN
  RAISE EXCEPTION 'Original ERP grant request cannot be rewritten';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg14_erp_revision_immutable
 BEFORE UPDATE OR DELETE ON health_center_erp_grant_revision
 FOR EACH ROW EXECUTE FUNCTION cg14_erp_grant_revision_frozen();
CREATE TRIGGER cg14_erp_command_immutable
 BEFORE UPDATE OR DELETE ON health_center_erp_grant_command
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
CREATE TRIGGER cg14_erp_event_immutable
 BEFORE UPDATE OR DELETE ON health_center_erp_grant_event
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();

ALTER TABLE cg03_case ADD COLUMN health_erp_revision_id uuid;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_center_erp_original
 FOREIGN KEY(realm_id,health_center_id,health_erp_revision_id)
 REFERENCES health_center_erp_grant_revision(root_realm_id,center_id,id)
 ON DELETE RESTRICT;
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT'));
ALTER TABLE cg03_health_process_current DROP CONSTRAINT cg03_health_process_current_case_kind_check;
ALTER TABLE cg03_health_process_current ADD CONSTRAINT cg03_health_process_current_case_kind_check
 CHECK(case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT'));
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
 'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT'));

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

);

ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_health_only_source;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_health_only_source CHECK(
 case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',
  'HEALTH_DOCTOR_VERIFICATION','HEALTH_CENTER_CONTENT_REVIEW','HEALTH_CENTER_ERP_GRANT')
 OR num_nonnulls(health_provider_id,health_center_id,
   health_provider_revision_id,health_center_revision_id,
   health_revision_no,health_source_digest)=0);
ALTER TABLE cg03_case ADD CONSTRAINT cg03_erp_only_source CHECK(
 (case_kind='HEALTH_CENTER_ERP_GRANT' AND health_erp_revision_id IS NOT NULL
  AND health_content_revision_id IS NULL)
 OR (case_kind<>'HEALTH_CENTER_ERP_GRANT' AND health_erp_revision_id IS NULL));
CREATE UNIQUE INDEX ux_cg03_erp_original_revision
 ON cg03_case(realm_id,health_erp_revision_id)
 WHERE case_kind='HEALTH_CENTER_ERP_GRANT';
CREATE INDEX ix_cg03_erp_review
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='HEALTH_CENTER_ERP_GRANT';
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
    NEW.health_erp_revision_id IS DISTINCT FROM OLD.health_erp_revision_id OR
    NEW.health_revision_no IS DISTINCT FROM OLD.health_revision_no OR
    NEW.health_source_digest IS DISTINCT FROM OLD.health_source_digest THEN
  RAISE EXCEPTION 'Original healthcare review source is immutable';
 END IF;
 RETURN NEW;
END $$;

