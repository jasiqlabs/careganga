-- CG10 US001 original source adapters: extending existing CG03 cases/processes
-- and CG19 scanned private objects (NOT a second approval/file master).
-- Added after historic CG17/19/20 migrations to preserve their immutable bytes.
-- Restrict all new IDs to a real Foundation-root original application.
ALTER TABLE cg03_case
 ADD COLUMN hr_application_id uuid,
 ADD COLUMN hr_revision_id uuid,
 ADD COLUMN hr_revision_no integer,
 ADD COLUMN hr_source_digest char(64),
 ADD CONSTRAINT fk_cg03_hr_original_revision
  FOREIGN KEY(realm_id,hr_revision_id)
  REFERENCES hr_application_revision(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg03_hr_original_application
  FOREIGN KEY(realm_id,hr_application_id)
  REFERENCES hr_employee_application(root_realm_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_hr_original_revision
 ON cg03_case(realm_id,hr_revision_id)
 WHERE case_kind='EMPLOYEE_ENROLLMENT';

-- Extend every *current* original CHECK from the database catalog, not a stale
-- copy of old CG03 case kinds. This preserves all preceding source families.
DO $migration$
DECLARE
  rec record;
  expression_sql text;
  condition_sql text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg03_process','cg03_process_kind_finance',
   'process_kind = ''EMPLOYEE_ENROLLMENT'''),
  ('cg03_case','cg03_case_kind_finance',
   'case_kind = ''EMPLOYEE_ENROLLMENT'''),
  ('cg03_case','cg03_case_finance_source_disjoint',
    'case_kind = ''EMPLOYEE_ENROLLMENT'' '||
    'AND hr_application_id IS NOT NULL AND hr_revision_id IS NOT NULL '||
    'AND hr_revision_no>0 AND hr_source_digest ~ ''^[a-f0-9]{64}$'' '||
    'AND target_account_id IS NULL AND target_role_id IS NULL '||
    'AND expected_access_version IS NULL AND expected_role_revision IS NULL '||
    'AND num_nonnulls('||
      'health_provider_id,health_center_id,health_provider_revision_id,'||
      'health_center_revision_id,health_doctor_id,health_doctor_revision_id,'||
      'health_content_revision_id,health_erp_revision_id,health_revision_no,'||
      'health_source_digest,cg15_exception_id,cg15_exception_revision,'||
      'cg15_exception_digest,cg16_price_id,cg16_price_version,cg16_price_digest,'||
      'cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest,'||
      'cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,'||
      'branch_source_ref,branch_source_revision,branch_source_digest,'||
      'finance_voucher_id,finance_voucher_revision,finance_voucher_digest,'||
      'finance_proof_file_id,finance_proof_revision,finance_claim_id,'||
      'finance_claim_revision,finance_claim_digest,finance_claim_bill_id,'||
      'finance_claim_bill_version,finance_invoice_id,finance_invoice_revision,'||
      'finance_invoice_digest,finance_budget_id,finance_budget_revision,'||
      'finance_budget_digest)=0')
  ) v(table_name,constraint_name,add_predicate)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7)
   INTO expression_sql
   FROM pg_constraint c
   WHERE c.conrelid=rec.table_name::regclass
     AND c.conname=rec.constraint_name AND c.contype='c';
  IF expression_sql IS NULL OR left(expression_sql,1)<>'(' THEN
   RAISE EXCEPTION 'Expected original CG03 constraint missing: %',rec.constraint_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',
    rec.table_name,rec.constraint_name,expression_sql,rec.add_predicate);
 END LOOP;
END $migration$;

-- Ensure the new HR identity never appears inside another approval family.
ALTER TABLE cg03_case ADD CONSTRAINT cg03_original_hr_source_disjoint CHECK(
 (case_kind='EMPLOYEE_ENROLLMENT' AND hr_application_id IS NOT NULL
   AND hr_revision_id IS NOT NULL AND hr_revision_no>0 AND
   hr_source_digest ~ '^[a-f0-9]{64}$')
 OR (case_kind<>'EMPLOYEE_ENROLLMENT' AND
   hr_application_id IS NULL AND hr_revision_id IS NULL AND
   hr_revision_no IS NULL AND hr_source_digest IS NULL)
);
CREATE TABLE cg03_hr_process_current(
  realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
  process_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(process_id,realm_id)
    REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);

-- Existing real CG19 upload intent/file/scanner becomes source-aware for HR.
ALTER TABLE cg19_upload_intent
 ADD COLUMN hr_application_id uuid,
 ADD COLUMN hr_source_version integer,
 ADD CONSTRAINT fk_cg19_hr_intent_actual_application FOREIGN KEY(hr_application_id,realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_hr_intent_source
  UNIQUE(id,realm_id,hr_application_id,hr_source_version);
ALTER TABLE cg19_stored_file
 ADD COLUMN hr_application_id uuid,
 ADD COLUMN hr_source_version integer,
 ADD CONSTRAINT fk_cg19_hr_file_actual_application FOREIGN KEY(hr_application_id,realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_hr_file_original_intent
  FOREIGN KEY(upload_intent_id,realm_id,hr_application_id,hr_source_version)
  REFERENCES cg19_upload_intent(id,realm_id,hr_application_id,hr_source_version)
  ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_hr_file_source
  UNIQUE(id,realm_id,hr_application_id,hr_source_version);
-- Extend previous source identity guards rather than weakening or replacing
-- the current CG19 upload and clean-file authority.
DO $migration$
DECLARE
 rec record;
 original_sql text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_upload_intent','cg19_upload_intent_owner_kind_check',
  'owner_kind = ''CG10_DRAFT'''),
 ('cg19_stored_file','cg19_stored_file_owner_kind_check',
  'owner_kind = ''CG10_DRAFT'''),
 ('cg19_upload_intent','cg19_intent_branch_source',
  'owner_kind = ''CG10_DRAFT'' AND case_id IS NULL '||
  'AND registration_id IS NULL AND registration_draft_version IS NULL '||
  'AND health_provider_id IS NULL AND health_center_id IS NULL '||
  'AND health_doctor_id IS NULL AND health_source_version IS NULL '||
  'AND hr_application_id IS NOT NULL AND hr_source_version>0 '||
  'AND proposal_revision=hr_source_version'),
 ('cg19_stored_file','cg19_file_branch_source',
  'owner_kind = ''CG10_DRAFT'' AND case_id IS NULL '||
  'AND registration_id IS NULL AND registration_draft_version IS NULL '||
  'AND health_provider_id IS NULL AND health_center_id IS NULL '||
  'AND health_doctor_id IS NULL AND health_source_version IS NULL '||
  'AND hr_application_id IS NOT NULL AND hr_source_version>0 '||
  'AND proposal_revision=hr_source_version'),
 ('cg19_upload_intent','cg19_intent_source_classification',
  'owner_kind = ''CG10_DRAFT'' AND '||
  'classification IN(''HR_IDENTITY_PROOF'',''HR_QUALIFICATION'',''HR_PORTRAIT'')')
 ) v(table_name,constraint_name,add_predicate)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO original_sql
  FROM pg_constraint c
  WHERE c.conrelid=rec.table_name::regclass
    AND c.conname=rec.constraint_name AND c.contype='c';
  IF original_sql IS NULL OR left(original_sql,1)<>'(' THEN
    RAISE EXCEPTION 'Expected original CG19 source constraint missing: %',
      rec.constraint_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',
   rec.table_name,rec.constraint_name,original_sql,rec.add_predicate);
 END LOOP;
END $migration$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_hr_intent_exact_presence CHECK(
 (owner_kind='CG10_DRAFT' AND hr_application_id IS NOT NULL
   AND hr_source_version>0)
 OR (owner_kind<>'CG10_DRAFT' AND hr_application_id IS NULL
   AND hr_source_version IS NULL));
ALTER TABLE cg19_stored_file ADD CONSTRAINT cg19_hr_file_exact_presence CHECK(
 (owner_kind='CG10_DRAFT' AND hr_application_id IS NOT NULL
   AND hr_source_version>0)
 OR (owner_kind<>'CG10_DRAFT' AND hr_application_id IS NULL
   AND hr_source_version IS NULL));
CREATE INDEX ix_cg19_hr_pending_upload
 ON cg19_upload_intent(realm_id,hr_application_id,hr_source_version,created_at DESC,id)
 WHERE owner_kind='CG10_DRAFT';
CREATE INDEX ix_cg19_hr_clean_file
 ON cg19_stored_file(realm_id,hr_application_id,hr_source_version,created_at DESC,id)
 WHERE owner_kind='CG10_DRAFT' AND revoked_at IS NULL;

CREATE TABLE cg19_hr_evidence_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 application_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 intent_ref uuid,
 file_ref uuid,
 action text NOT NULL CHECK(action IN(
  'UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN','FILE_REVOKED','PRIVATE_REVIEW_READ')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(application_id,realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id) REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(file_ref,realm_id) REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 CHECK(num_nonnulls(intent_ref,file_ref)=1)
);
CREATE INDEX ix_cg19_hr_event
 ON cg19_hr_evidence_event(realm_id,application_id,created_at DESC,id);
CREATE TRIGGER cg19_hr_evidence_event_immutable
 BEFORE UPDATE OR DELETE ON cg19_hr_evidence_event FOR EACH ROW
 EXECUTE FUNCTION cg19_document_event_immutable();

-- Every HR proof must be tied to an original scanned file, not an upload URL.
CREATE TABLE hr_application_proof (
 root_realm_id uuid NOT NULL,
 application_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 file_ref uuid NOT NULL,
 file_version integer NOT NULL CHECK(file_version>0),
 classification text NOT NULL
  CHECK(classification IN('HR_IDENTITY_PROOF','HR_QUALIFICATION','HR_PORTRAIT')),
 PRIMARY KEY(root_realm_id,application_id,revision_no,file_ref),
 FOREIGN KEY(application_id,root_realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(file_ref,root_realm_id,application_id,revision_no)
  REFERENCES cg19_stored_file(id,realm_id,hr_application_id,hr_source_version)
  ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_hr_application_proof_identity
 ON hr_application_proof(root_realm_id,application_id,revision_no,classification)
 WHERE classification='HR_IDENTITY_PROOF';

-- A new case number and employee reference are separate entities. The frozen
-- revision may link to its freshly created case exactly once, inside the original
-- short submission transaction; subsequent writes/deletes are rejected.
CREATE OR REPLACE FUNCTION cg10_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Submitted employee revisions cannot be deleted';
 END IF;
 IF OLD.cg03_case_ref IS NULL AND NEW.cg03_case_ref IS NOT NULL AND
    (OLD.id,OLD.root_realm_id,OLD.application_id,OLD.revision_no,
     OLD.source_digest,OLD.source_snapshot,OLD.private_file_versions,
     OLD.submitted_by,OLD.submitted_at)
    IS NOT DISTINCT FROM
    (NEW.id,NEW.root_realm_id,NEW.application_id,NEW.revision_no,
     NEW.source_digest,NEW.source_snapshot,NEW.private_file_versions,
     NEW.submitted_by,NEW.submitted_at)
 THEN RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Submitted employee revisions cannot be changed';
END; $$;
