-- CG-14 US-002: immutable verification submission, original CG-03 approval
-- and separate center access/publication. Extends original CG-03 case engine;
-- never creates a competing healthcare approval master.
ALTER TABLE health_provider DROP CONSTRAINT health_provider_status_check;
ALTER TABLE health_provider ADD CONSTRAINT health_provider_status_check
 CHECK(status IN('PENDING','SUBMITTED','RETURNED','REJECTED','VERIFIED','SUSPENDED'));
ALTER TABLE health_center DROP CONSTRAINT health_center_status_check;
ALTER TABLE health_center ADD CONSTRAINT health_center_status_check
 CHECK(status IN('PENDING','SUBMITTED','RETURNED','REJECTED','VERIFIED','SUSPENDED'));
ALTER TABLE health_center ADD COLUMN access_state text NOT NULL DEFAULT 'DISABLED'
 CHECK(access_state IN('DISABLED','ENABLED')),
 ADD COLUMN publication_state text NOT NULL DEFAULT 'UNPUBLISHED'
 CHECK(publication_state IN('UNPUBLISHED','PUBLISHED')),
 ADD COLUMN public_slug text CHECK(public_slug IS NULL OR
  public_slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 ADD COLUMN publication_generation integer NOT NULL DEFAULT 0
 CHECK(publication_generation>=0);
ALTER TABLE health_center ADD CONSTRAINT health_center_publication_safety CHECK(
 publication_state<>'PUBLISHED' OR
 (status='VERIFIED' AND access_state='ENABLED' AND public_slug IS NOT NULL));
CREATE UNIQUE INDEX ux_health_center_published_slug
 ON health_center(root_realm_id,public_slug)
 WHERE public_slug IS NOT NULL;
CREATE INDEX ix_health_center_public_eligible
 ON health_center(root_realm_id,publication_state,status,public_slug)
 WHERE publication_state='PUBLISHED';

-- Original CG-19 private file must belong to precisely the submitted source.
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT uq_cg19_health_center_evidence_identity
 UNIQUE(id,realm_id,health_provider_id,health_center_id);

CREATE TABLE health_provider_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 provider_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 source_version integer NOT NULL CHECK(source_version>0),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 proof_file_ref uuid NOT NULL,
 submitted_by uuid NOT NULL,
 approval_case_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,provider_id,revision_no),
 UNIQUE(id,root_realm_id,provider_id),
 FOREIGN KEY(root_realm_id,provider_id)
  REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(proof_file_ref,root_realm_id,provider_id)
  REFERENCES cg19_stored_file(id,realm_id,health_provider_id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE health_center_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 provider_id uuid NOT NULL,
 center_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 source_version integer NOT NULL CHECK(source_version>0),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 proof_file_ref uuid NOT NULL,
 submitted_by uuid NOT NULL,
 approval_case_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,center_id,revision_no),
 UNIQUE(id,root_realm_id,provider_id,center_id),
 FOREIGN KEY(root_realm_id,provider_id,center_id)
  REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(proof_file_ref,root_realm_id,provider_id,center_id)
  REFERENCES cg19_stored_file(id,realm_id,health_provider_id,health_center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg14_submitted_revision_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.provider_id IS DISTINCT FROM OLD.provider_id OR
    NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
    NEW.source_version IS DISTINCT FROM OLD.source_version OR
    NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR
    NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
    NEW.proof_file_ref IS DISTINCT FROM OLD.proof_file_ref OR
    NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
    NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
    (OLD.approval_case_ref IS NOT NULL AND
     NEW.approval_case_ref IS DISTINCT FROM OLD.approval_case_ref) THEN
  RAISE EXCEPTION 'Submitted healthcare evidence revision is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION cg14_submitted_center_revision_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.provider_id IS DISTINCT FROM OLD.provider_id OR
    NEW.center_id IS DISTINCT FROM OLD.center_id OR
    NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
    NEW.source_version IS DISTINCT FROM OLD.source_version OR
    NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR
    NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
    NEW.proof_file_ref IS DISTINCT FROM OLD.proof_file_ref OR
    NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
    NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
    (OLD.approval_case_ref IS NOT NULL AND
     NEW.approval_case_ref IS DISTINCT FROM OLD.approval_case_ref) THEN
  RAISE EXCEPTION 'Submitted center evidence revision is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg14_provider_revision_frozen BEFORE UPDATE OR DELETE
 ON health_provider_revision FOR EACH ROW
 EXECUTE FUNCTION cg14_submitted_revision_frozen();
CREATE TRIGGER cg14_center_revision_frozen BEFORE UPDATE OR DELETE
 ON health_center_revision FOR EACH ROW
 EXECUTE FUNCTION cg14_submitted_center_revision_frozen();

-- The same original CG-03 process/decision engine now recognizes two
-- provider source kinds. Process_current merely chooses an existing process.
ALTER TABLE cg03_process DROP CONSTRAINT cg03_process_kind_finance;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION'));
CREATE TABLE cg03_health_process_current(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 case_kind text NOT NULL CHECK(case_kind IN
  ('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION')),
 process_id uuid NOT NULL,
 PRIMARY KEY(realm_id,case_kind),
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
  ON DELETE RESTRICT
);
ALTER TABLE cg03_case ADD COLUMN health_provider_id uuid,
 ADD COLUMN health_center_id uuid,
 ADD COLUMN health_provider_revision_id uuid,
 ADD COLUMN health_center_revision_id uuid,
 ADD COLUMN health_revision_no integer,
 ADD COLUMN health_source_digest char(64);
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_kind_finance;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_kind_finance CHECK(
 case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER',
 'FINANCE_REIMBURSEMENT','FINANCE_INVOICE','FINANCE_BUDGET','CMS_PUBLICATION',
 'HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION'));
-- Existing original seven case variants continue to satisfy the exact
-- prior CG-03 conditions; the new variants are fully source-disjoint.
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
);
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_health_only_source CHECK(
 case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION')
 OR num_nonnulls(health_provider_id,health_center_id,
  health_provider_revision_id,health_center_revision_id,
  health_revision_no,health_source_digest)=0);
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_health_provider_root
 FOREIGN KEY(health_provider_id,realm_id)
 REFERENCES health_provider(id,root_realm_id) ON DELETE RESTRICT;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_health_center_source
 FOREIGN KEY(realm_id,health_provider_id,health_center_id)
 REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_health_provider_exact_revision
 FOREIGN KEY(health_provider_revision_id,realm_id,health_provider_id)
 REFERENCES health_provider_revision(id,root_realm_id,provider_id) ON DELETE RESTRICT;
ALTER TABLE cg03_case ADD CONSTRAINT fk_cg03_health_center_exact_revision
 FOREIGN KEY(health_center_revision_id,realm_id,health_provider_id,health_center_id)
 REFERENCES health_center_revision(id,root_realm_id,provider_id,center_id)
 ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_health_provider_revision
 ON cg03_case(realm_id,health_provider_id,health_revision_no)
 WHERE case_kind='HEALTH_PROVIDER_VERIFICATION';
CREATE UNIQUE INDEX ux_cg03_health_center_revision
 ON cg03_case(realm_id,health_center_id,health_revision_no)
 WHERE case_kind='HEALTH_CENTER_VERIFICATION';
CREATE INDEX ix_cg03_health_case_inbox
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION');
CREATE FUNCTION cg03_health_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id OR
    NEW.health_center_id IS DISTINCT FROM OLD.health_center_id OR
    NEW.health_provider_revision_id IS DISTINCT FROM OLD.health_provider_revision_id OR
    NEW.health_center_revision_id IS DISTINCT FROM OLD.health_center_revision_id OR
    NEW.health_revision_no IS DISTINCT FROM OLD.health_revision_no OR
    NEW.health_source_digest IS DISTINCT FROM OLD.health_source_digest THEN
  RAISE EXCEPTION 'Original healthcare review source is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg03_health_source_frozen BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_health_source_immutable();

-- A center publication can reference only its OWN verified center revision and
-- genuine CG-03 final decision; no self-attested publication.
CREATE TABLE health_center_publication(
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 verified_center_revision_id uuid NOT NULL,
 original_final_decision_ref uuid NOT NULL,
 published_by uuid NOT NULL,
 generation integer NOT NULL CHECK(generation>0),
 changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,center_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_center_revision_id,root_realm_id,center_id)
  REFERENCES health_center_revision(id,root_realm_id,center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(original_final_decision_ref,root_realm_id)
  REFERENCES cg03_case_decision(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(published_by,root_realm_id) REFERENCES account(id,realm_id)
  ON DELETE RESTRICT
);
