-- CG10 US004 intent only. CG19 remains the original template/file/issuance authority.
ALTER TABLE cg19_document_template DROP CONSTRAINT cg19_document_template_template_kind_check;
ALTER TABLE cg19_document_template ADD CONSTRAINT cg19_document_template_template_kind_check CHECK(
 template_kind IN('PRIVATE_APPROVED_ACCESS_LETTER','HR_APPOINTMENT','HR_OFFER','HR_JOINING','HR_EXPERIENCE','HR_RELIEVING','HR_MEMO','HR_EMPLOYEE_ID'));
CREATE SEQUENCE hr_document_request_seq;
CREATE TABLE hr_document_request(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,
 reference text NOT NULL UNIQUE DEFAULT ('CG-HR-DOC-'||lpad(nextval('hr_document_request_seq')::text,6,'0')),
 kind text NOT NULL CHECK(kind IN('APPOINTMENT','OFFER','JOINING','EXPERIENCE','RELIEVING','MEMO','EMPLOYEE_ID')),employee_id uuid,application_id uuid,application_revision_id uuid,
 application_revision_no integer,application_source_digest char(64),assignment_id uuid,assignment_version integer,
 employee_version integer,exit_change_id uuid,source_branch_ref uuid NOT NULL,
 template_id uuid NOT NULL,template_version integer NOT NULL CHECK(template_version>0),
 issue_date date NOT NULL,expiry_date date,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 created_by uuid NOT NULL, status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,decision_ref uuid,created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz,
 CHECK((kind='OFFER' AND employee_id IS NULL AND assignment_id IS NULL AND assignment_version IS NULL AND employee_version IS NULL
  AND application_id IS NOT NULL AND application_revision_id IS NOT NULL AND application_revision_no IS NOT NULL AND application_revision_no>0 AND application_source_digest IS NOT NULL)
 OR (kind<>'OFFER' AND employee_id IS NOT NULL AND assignment_id IS NOT NULL AND assignment_version IS NOT NULL AND assignment_version>0 AND employee_version IS NOT NULL AND employee_version>0
  AND application_id IS NULL AND application_revision_id IS NULL AND application_revision_no IS NULL AND application_source_digest IS NULL)),
 CHECK((kind='RELIEVING')=(exit_change_id IS NOT NULL)),
 CHECK((kind='EMPLOYEE_ID' AND expiry_date IS NOT NULL AND expiry_date>issue_date) OR (kind<>'EMPLOYEE_ID' AND expiry_date IS NULL)),
 CHECK((status='DRAFT' AND case_ref IS NULL AND decision_ref IS NULL AND decided_at IS NULL)
 OR (status='SUBMITTED' AND case_ref IS NOT NULL AND decision_ref IS NULL AND decided_at IS NULL)
 OR (status IN('APPROVED','RETURNED','REJECTED') AND case_ref IS NOT NULL AND decision_ref IS NOT NULL AND decided_at IS NOT NULL)),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,source_digest,revision),
 UNIQUE(root_realm_id,created_by,request_key),UNIQUE(root_realm_id,case_ref),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(assignment_id,root_realm_id,employee_id) REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,application_id,application_revision_id,application_revision_no,application_source_digest)
  REFERENCES hr_application_revision(root_realm_id,application_id,id,revision_no,source_digest) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,exit_change_id) REFERENCES hr_employment_change(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(source_branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(template_id,root_realm_id,template_version) REFERENCES cg19_document_template(id,realm_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_ref,case_ref,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_document_request_scope ON hr_document_request(root_realm_id,source_branch_ref,created_at DESC,id);
CREATE INDEX ix_hr_document_request_employee ON hr_document_request(root_realm_id,employee_id,created_at DESC,id);
CREATE UNIQUE INDEX ux_hr_document_exact_pending_employee ON hr_document_request(root_realm_id,employee_id,kind,source_digest)
 WHERE status IN('DRAFT','SUBMITTED','APPROVED') AND employee_id IS NOT NULL;
CREATE UNIQUE INDEX ux_hr_document_exact_pending_application ON hr_document_request(root_realm_id,application_id,kind,source_digest)
 WHERE status IN('DRAFT','SUBMITTED','APPROVED') AND application_id IS NOT NULL;
ALTER TABLE cg03_case ADD COLUMN hr_document_request_id uuid,ADD COLUMN hr_document_source_digest char(64),
 ADD CONSTRAINT fk_cg03_hr_document_exact FOREIGN KEY(realm_id,hr_document_request_id,hr_document_source_digest,proposal_revision)
 REFERENCES hr_document_request(root_realm_id,id,source_digest,revision) ON DELETE RESTRICT;
DO $migration$
DECLARE rec record;previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind=''HR_DOCUMENT_REVIEW'''),
 ('cg03_case','cg03_case_kind_finance','case_kind=''HR_DOCUMENT_REVIEW'''),
 ('cg03_case','cg03_case_finance_source_disjoint',
  'case_kind=''HR_DOCUMENT_REVIEW'' AND hr_document_request_id IS NOT NULL AND hr_document_source_digest IS NOT NULL '||
  'AND proposal_digest=hr_document_source_digest AND num_nonnulls(target_account_id,target_role_id,expected_access_version,expected_role_revision,'||
  'hr_application_id,hr_revision_id,hr_revision_no,hr_source_digest,hr_leave_request_id,hr_leave_source_digest,hr_attendance_change_id,hr_attendance_change_digest,'||
  'hr_employment_change_id,hr_employment_change_digest,health_provider_id,health_center_id,health_provider_revision_id,health_center_revision_id,'||
  'health_doctor_id,health_doctor_revision_id,health_content_revision_id,health_erp_revision_id,health_revision_no,health_source_digest,'||
  'cg15_exception_id,cg15_exception_revision,cg15_exception_digest,cg16_price_id,cg16_price_version,cg16_price_digest,cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest,'||
  'cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,branch_source_ref,branch_source_revision,branch_source_digest,'||
  'finance_voucher_id,finance_voucher_revision,finance_voucher_digest,finance_proof_file_id,finance_proof_revision,'||
  'finance_claim_id,finance_claim_revision,finance_claim_digest,finance_claim_bill_id,finance_claim_bill_version,finance_invoice_id,finance_invoice_revision,finance_invoice_digest,'||
  'finance_budget_id,finance_budget_revision,finance_budget_digest)=0')
 ) v(table_name,constraint_name,extra)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c
   WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF previous IS NULL OR left(previous,1)<>'(' THEN RAISE EXCEPTION 'Original approval constraint missing: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,previous,rec.extra);
 END LOOP;
END; $migration$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_hr_document_only_source CHECK(
 (case_kind='HR_DOCUMENT_REVIEW' AND hr_document_request_id IS NOT NULL AND hr_document_source_digest IS NOT NULL AND proposal_digest=hr_document_source_digest)
 OR (case_kind<>'HR_DOCUMENT_REVIEW' AND hr_document_request_id IS NULL AND hr_document_source_digest IS NULL));
CREATE UNIQUE INDEX ux_cg03_hr_document_source ON cg03_case(realm_id,hr_document_request_id) WHERE case_kind='HR_DOCUMENT_REVIEW';
CREATE UNIQUE INDEX ux_cg03_hr_document_process ON cg03_process(realm_id,process_kind) WHERE process_kind='HR_DOCUMENT_REVIEW';
CREATE FUNCTION cg03_hr_document_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (NEW.hr_document_request_id,NEW.hr_document_source_digest) IS DISTINCT FROM (OLD.hr_document_request_id,OLD.hr_document_source_digest)
 THEN RAISE EXCEPTION 'Original document source cannot change'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg03_hr_document_source_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_hr_document_source_frozen();
CREATE FUNCTION cg10_document_request_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document intent history cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.revision<>1 OR NOT EXISTS(SELECT 1 FROM cg19_document_template t
   WHERE t.id=NEW.template_id AND t.realm_id=NEW.root_realm_id AND t.version=NEW.template_version AND t.template_kind='HR_'||NEW.kind AND t.status='APPROVED')
  THEN RAISE EXCEPTION 'Approved matching HR template required'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['status','case_ref','decision_ref','decided_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','case_ref','decision_ref','decided_at'])
 THEN RAISE EXCEPTION 'Original document intent cannot change'; END IF;
 IF OLD.status='DRAFT' AND NEW.status='SUBMITTED' AND EXISTS(SELECT 1 FROM cg03_case c
  WHERE c.id=NEW.case_ref AND c.realm_id=NEW.root_realm_id AND c.hr_document_request_id=NEW.id AND c.hr_document_source_digest=NEW.source_digest
  AND c.proposal_revision=NEW.revision AND c.proposer_id=NEW.created_by AND c.status='SUBMITTED')
 THEN RETURN NEW; END IF;
 IF OLD.status='SUBMITTED' AND NEW.case_ref=OLD.case_ref AND EXISTS(
  SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
  JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id AND a.status='ACTIVE'
  JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
  JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active AND r.is_protected
  WHERE c.id=NEW.case_ref AND c.realm_id=NEW.root_realm_id AND c.hr_document_request_id=NEW.id AND c.hr_document_source_digest=NEW.source_digest
   AND d.id=NEW.decision_ref AND d.actor_id<>NEW.created_by AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
   AND NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=NEW.root_realm_id AND e.id=NEW.employee_id AND e.account_ref=d.actor_id)
   AND NOT EXISTS(SELECT 1 FROM hr_employee_application ap WHERE ap.root_realm_id=NEW.root_realm_id AND ap.id=NEW.application_id AND ap.applicant_account_ref=d.actor_id)
   AND ((NEW.status='APPROVED' AND d.action='APPROVE' AND c.status='FINAL_APPROVED')
    OR (NEW.status='RETURNED' AND d.action='RETURN' AND c.status='RETURNED')
    OR (NEW.status='REJECTED' AND d.action='REJECT' AND c.status='REJECTED'))
 ) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Actual original independent document decision required';
END; $fn$;
CREATE TRIGGER cg10_document_request_guard BEFORE INSERT OR UPDATE OR DELETE ON hr_document_request FOR EACH ROW EXECUTE FUNCTION cg10_document_request_guard();
-- Generated bytes and version/audit stay in CG19. This check prevents mismatched HR templates from entering an access letter or vice versa.
CREATE FUNCTION cg19_hr_document_exact_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM cg03_case c WHERE c.id=NEW.case_id AND c.realm_id=NEW.realm_id AND c.case_kind='HR_DOCUMENT_REVIEW') THEN
  IF NOT EXISTS(SELECT 1 FROM hr_document_request h JOIN cg03_case c
   ON c.id=h.case_ref AND c.realm_id=h.root_realm_id AND c.hr_document_request_id=h.id AND c.hr_document_source_digest=h.source_digest
   WHERE h.root_realm_id=NEW.realm_id AND h.case_ref=NEW.case_id AND h.revision=NEW.proposal_revision AND h.status='APPROVED'
    AND c.status='FINAL_APPROVED' AND h.template_id=NEW.template_id AND h.template_version=NEW.template_version
    AND h.source_digest=NEW.source_sha256 AND h.source_snapshot=NEW.source_snapshot)
  THEN RAISE EXCEPTION 'Original approved HR document snapshot required'; END IF;
 ELSIF EXISTS(SELECT 1 FROM cg19_document_template t WHERE t.id=NEW.template_id AND t.realm_id=NEW.realm_id AND t.template_kind LIKE 'HR_%')
 THEN RAISE EXCEPTION 'HR template is not allowed for another document source'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_document_exact_guard BEFORE INSERT ON cg19_generated_document FOR EACH ROW EXECUTE FUNCTION cg19_hr_document_exact_guard();

CREATE FUNCTION cg03_hr_document_link_required() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.case_kind='HR_DOCUMENT_REVIEW' AND NOT EXISTS(
  SELECT 1 FROM cg03_case c JOIN hr_document_request h ON h.root_realm_id=c.realm_id AND h.id=c.hr_document_request_id
   AND h.case_ref=c.id AND h.source_digest=c.hr_document_source_digest AND h.revision=c.proposal_revision AND h.created_by=c.proposer_id
  WHERE c.id=NEW.id AND c.realm_id=NEW.realm_id AND (
   (c.status IN('SUBMITTED','IN_REVIEW') AND h.status='SUBMITTED')
   OR (c.status='FINAL_APPROVED' AND h.status='APPROVED')
   OR (c.status='RETURNED' AND h.status='RETURNED') OR (c.status='REJECTED' AND h.status='REJECTED')))
 THEN RAISE EXCEPTION 'Original document request and case outcome required'; END IF;
 RETURN NULL;
END; $fn$;
CREATE CONSTRAINT TRIGGER cg03_hr_document_link_required AFTER INSERT OR UPDATE ON cg03_case
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg03_hr_document_link_required();
