-- CG10 US002 / CG03: one immutable original leave request, original CG03 case.
CREATE TABLE hr_leave_request(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 shift_id uuid NOT NULL,
 shift_policy_id uuid NOT NULL,
 policy_id uuid NOT NULL,
 start_date date NOT NULL,
 end_date date NOT NULL,
 half_days integer NOT NULL CHECK(half_days BETWEEN 1 AND 732),
 half_day boolean NOT NULL,
 reason_ciphertext text NOT NULL,
 reason_nonce text NOT NULL,
 reason_tag text NOT NULL,
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 case_ref uuid,
 status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','APPROVED','RETURNED','REJECTED')),
 decision_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,id,source_digest),
 UNIQUE(root_realm_id,submitted_by,request_key),
 UNIQUE(root_realm_id,case_ref),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(assignment_id,root_realm_id,employee_id)
  REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(shift_id,root_realm_id,employee_id,shift_policy_id)
  REFERENCES hr_employee_shift(id,root_realm_id,employee_id,policy_id) ON DELETE RESTRICT,
 FOREIGN KEY(policy_id,root_realm_id) REFERENCES hr_leave_policy(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_ref,case_ref,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
 CHECK(end_date>=start_date AND extract(year from start_date)=extract(year from end_date)),
 CHECK((half_day AND start_date=end_date AND half_days=1) OR (NOT half_day AND half_days%2=0)),
 CHECK((status='SUBMITTED' AND decision_ref IS NULL AND decided_at IS NULL) OR
  (status<>'SUBMITTED' AND case_ref IS NOT NULL AND decision_ref IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX ix_hr_leave_employee_year ON hr_leave_request(root_realm_id,employee_id,start_date,end_date,status);
CREATE INDEX ix_hr_leave_policy_usage ON hr_leave_request(root_realm_id,employee_id,policy_id,start_date) WHERE status='APPROVED';
CREATE INDEX ix_hr_leave_review_queue ON hr_leave_request(root_realm_id,status,submitted_at DESC,id DESC);

ALTER TABLE cg03_case ADD COLUMN hr_leave_request_id uuid,
 ADD COLUMN hr_leave_source_digest char(64),
 ADD CONSTRAINT fk_cg03_hr_leave_exact FOREIGN KEY(realm_id,hr_leave_request_id,hr_leave_source_digest)
 REFERENCES hr_leave_request(root_realm_id,id,source_digest) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_hr_leave_request ON cg03_case(realm_id,hr_leave_request_id) WHERE case_kind='LEAVE_REQUEST';
CREATE INDEX ix_cg03_hr_leave_inbox ON cg03_case(realm_id,status,submitted_at DESC,id DESC) WHERE case_kind='LEAVE_REQUEST';

-- Preserve all existing approval families, including employee enrollment.
DO $migration$
DECLARE rec record; original_sql text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind = ''LEAVE_REQUEST'''),
 ('cg03_case','cg03_case_kind_finance','case_kind = ''LEAVE_REQUEST'''),
 ('cg03_case','cg03_case_finance_source_disjoint',
  'case_kind = ''LEAVE_REQUEST'' AND hr_leave_request_id IS NOT NULL '||
  'AND hr_leave_source_digest IS NOT NULL AND hr_leave_source_digest ~ ''^[a-f0-9]{64}$'' '||
  'AND proposal_revision=1 AND proposal_digest=hr_leave_source_digest '||
  'AND num_nonnulls(target_account_id,target_role_id,expected_access_version,expected_role_revision,'||
  'hr_application_id,hr_revision_id,hr_revision_no,hr_source_digest,'||
  'health_provider_id,health_center_id,health_provider_revision_id,health_center_revision_id,'||
  'health_doctor_id,health_doctor_revision_id,health_content_revision_id,health_erp_revision_id,'||
  'health_revision_no,health_source_digest,cg15_exception_id,cg15_exception_revision,cg15_exception_digest,'||
  'cg16_price_id,cg16_price_version,cg16_price_digest,cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest,'||
  'cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,branch_source_ref,branch_source_revision,branch_source_digest,'||
  'finance_voucher_id,finance_voucher_revision,finance_voucher_digest,finance_proof_file_id,finance_proof_revision,'||
  'finance_claim_id,finance_claim_revision,finance_claim_digest,finance_claim_bill_id,finance_claim_bill_version,'||
  'finance_invoice_id,finance_invoice_revision,finance_invoice_digest,finance_budget_id,finance_budget_revision,finance_budget_digest)=0')
 ) v(table_name,constraint_name,additional)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO original_sql
   FROM pg_constraint c WHERE c.conrelid=rec.table_name::regclass
   AND c.conname=rec.constraint_name AND c.contype='c';
  IF original_sql IS NULL OR left(original_sql,1)<>'(' THEN
   RAISE EXCEPTION 'Original review constraint not found: %',rec.constraint_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',
   rec.table_name,rec.constraint_name,original_sql,rec.additional);
 END LOOP;
END $migration$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_hr_leave_only_source CHECK(
 (case_kind='LEAVE_REQUEST' AND hr_leave_request_id IS NOT NULL AND hr_leave_source_digest IS NOT NULL
  AND proposal_digest=hr_leave_source_digest AND proposal_revision=1)
 OR (case_kind<>'LEAVE_REQUEST' AND hr_leave_request_id IS NULL AND hr_leave_source_digest IS NULL));
CREATE UNIQUE INDEX ux_cg03_hr_leave_process ON cg03_process(realm_id) WHERE process_kind='LEAVE_REQUEST';
CREATE FUNCTION cg03_hr_leave_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (NEW.hr_leave_request_id,NEW.hr_leave_source_digest) IS DISTINCT FROM
    (OLD.hr_leave_request_id,OLD.hr_leave_source_digest) THEN
  RAISE EXCEPTION 'Original leave case source cannot be changed';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER cg03_hr_leave_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_hr_leave_frozen();

-- The submitted request may link its exact case once and subsequently accept
-- only the matching immutable decision, never a manually changed leave balance.
CREATE FUNCTION cg10_leave_request_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Leave requests cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'SUBMITTED' OR NEW.case_ref IS NOT NULL OR NEW.decision_ref IS NOT NULL THEN
   RAISE EXCEPTION 'New leave must begin as an original submission';
  END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['case_ref','status','decision_ref','decided_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['case_ref','status','decision_ref','decided_at']) THEN
  RAISE EXCEPTION 'Submitted leave evidence cannot be changed';
 END IF;
 IF OLD.case_ref IS NULL AND NEW.case_ref IS NOT NULL AND OLD.status='SUBMITTED' AND
   NEW.status='SUBMITTED' AND NEW.decision_ref IS NULL AND EXISTS(
    SELECT 1 FROM cg03_case c WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.case_ref
     AND c.case_kind='LEAVE_REQUEST' AND c.hr_leave_request_id=NEW.id
     AND c.hr_leave_source_digest=NEW.source_digest AND c.proposer_id=NEW.submitted_by
   ) THEN RETURN NEW; END IF;
 IF OLD.status='SUBMITTED' AND OLD.case_ref IS NOT NULL AND NEW.case_ref=OLD.case_ref AND
   NEW.status IN('APPROVED','RETURNED','REJECTED') AND EXISTS(
    SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
    JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE'
    JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL
    JOIN role current_role ON current_role.id=ar.role_id AND current_role.realm_id=ar.realm_id AND current_role.active AND current_role.is_protected
    WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.case_ref
     AND c.case_kind='LEAVE_REQUEST' AND c.hr_leave_request_id=NEW.id
     AND c.hr_leave_source_digest=NEW.source_digest AND d.id=NEW.decision_ref
     AND d.actor_id<>NEW.submitted_by AND d.fresh_password_verified_at IS NOT NULL
     AND d.accepted_case_revision=c.revision
     AND ((NEW.status='APPROVED' AND d.action='APPROVE' AND c.status='PENDING_OWNER') OR
          (NEW.status='RETURNED' AND d.action='RETURN' AND c.status='RETURNED') OR
          (NEW.status='REJECTED' AND d.action='REJECT' AND c.status='REJECTED'))
   ) THEN
  IF NEW.status='APPROVED' THEN
   PERFORM id FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_id FOR UPDATE;
   IF EXISTS(SELECT 1 FROM hr_leave_request other WHERE other.root_realm_id=NEW.root_realm_id
      AND other.employee_id=NEW.employee_id AND other.id<>NEW.id AND other.status='APPROVED'
      AND other.start_date<=NEW.end_date AND other.end_date>=NEW.start_date) THEN
    RAISE EXCEPTION 'Approved leave dates overlap';
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Matching original leave decision is required';
END $fn$;
CREATE TRIGGER cg10_leave_request_frozen BEFORE INSERT OR UPDATE OR DELETE ON hr_leave_request
 FOR EACH ROW EXECUTE FUNCTION cg10_leave_request_frozen();

-- The initial request and actual original case must commit together.
CREATE FUNCTION cg10_leave_link_required() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM hr_leave_request r JOIN cg03_case c
  ON c.id=r.case_ref AND c.realm_id=r.root_realm_id AND c.hr_leave_request_id=r.id
  AND c.hr_leave_source_digest=r.source_digest AND c.case_kind='LEAVE_REQUEST'
  AND c.proposer_id=r.submitted_by
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.id)
 THEN RAISE EXCEPTION 'An original leave case is required before commit'; END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER cg10_leave_link_required AFTER INSERT OR UPDATE ON hr_leave_request
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg10_leave_link_required();
