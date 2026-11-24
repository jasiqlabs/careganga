-- CG11 US001: effective-dated payroll policy and original employee salary proposals.
-- Approval activation is introduced by the real CG03 integration; drafts are never payable.
CREATE TABLE payroll_policy (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 branch_ref uuid, cycle text NOT NULL CHECK(cycle='MONTHLY'),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 period_timezone text NOT NULL DEFAULT 'Asia/Kolkata' CHECK(period_timezone='Asia/Kolkata'),
 attendance_rules jsonb NOT NULL DEFAULT '{"absence":"UNCONFIGURED","leave":{},"lateDeductionMinor":"0"}'::jsonb CHECK((jsonb_typeof(attendance_rules)='object' AND attendance_rules->>'absence' IN('UNCONFIGURED','PAID','UNPAID') AND jsonb_typeof(attendance_rules->'leave')='object' AND (attendance_rules->>'lateDeductionMinor')~'^(0|[1-9][0-9]{0,13})$') IS TRUE),
 fiscal_year_start_month integer NOT NULL DEFAULT 4 CHECK(fiscal_year_start_month=4),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 100),
 effective_from date NOT NULL, effective_to date, supersedes_ref uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL, request_key uuid NOT NULL, request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 approval_case_ref uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,id,branch_ref), UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES payroll_policy(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg11_policy_scope ON payroll_policy(root_realm_id,branch_ref,cycle,effective_from DESC,id);
CREATE TABLE payroll_component (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL, policy_id uuid NOT NULL,
 code text NOT NULL CHECK(code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 100),
 kind text NOT NULL CHECK(kind IN('ALLOWANCE','DEDUCTION','EMPLOYER_CONTRIBUTION')),
 calc_mode text NOT NULL CHECK(calc_mode IN('FIXED','PERCENT')),
 amount_minor bigint, rate_bp integer, percent_basis text,
 tax_class text NOT NULL CHECK(tax_class IN('TAXABLE','NON_TAXABLE','NOT_CONFIGURED')),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,policy_id,code),
 FOREIGN KEY(root_realm_id,policy_id) REFERENCES payroll_policy(root_realm_id,id),
 CHECK(((calc_mode='FIXED' AND amount_minor IS NOT NULL AND amount_minor BETWEEN 0 AND 99999999999999 AND rate_bp IS NULL AND percent_basis IS NULL)
 OR (calc_mode='PERCENT' AND amount_minor IS NULL AND rate_bp IS NOT NULL AND rate_bp BETWEEN 0 AND 10000 AND percent_basis='BASIC')) IS TRUE)
);
CREATE TABLE employee_compensation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL, employee_ref uuid NOT NULL,
 branch_ref uuid NOT NULL, assignment_ref uuid NOT NULL, assignment_version integer NOT NULL CHECK(assignment_version>0),
 employee_status_version integer NOT NULL CHECK(employee_status_version>0),
 source_hr_proposal_ref uuid,source_hr_proposal_revision integer,source_hr_proposal_digest char(64),
 policy_id uuid NOT NULL, policy_revision integer NOT NULL CHECK(policy_revision>0),
 effective_from date NOT NULL,effective_to date, supersedes_ref uuid, base_salary_minor bigint NOT NULL CHECK(base_salary_minor BETWEEN 1 AND 99999999999999),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 approval_case_ref uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(root_realm_id,assignment_ref) REFERENCES hr_employment_assignment(root_realm_id,id),
 FOREIGN KEY(root_realm_id,source_hr_proposal_ref,source_hr_proposal_digest,source_hr_proposal_revision) REFERENCES hr_employment_change(root_realm_id,id,source_digest,revision),
 CHECK(num_nonnulls(source_hr_proposal_ref,source_hr_proposal_revision,source_hr_proposal_digest) IN(0,3)),
 FOREIGN KEY(root_realm_id,policy_id) REFERENCES payroll_policy(root_realm_id,id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES employee_compensation(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg11_applied_hr_proposal ON employee_compensation(root_realm_id,source_hr_proposal_ref) WHERE status='APPROVED' AND source_hr_proposal_ref IS NOT NULL;
CREATE INDEX ix_cg11_salary_history ON employee_compensation(root_realm_id,employee_ref,effective_from DESC,id);
-- Serialize approval on the actual employee/policy scope. Approved historical versions never mutate.
CREATE FUNCTION cg11_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payroll source must be a draft'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payroll policy history is immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
   OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref)) THEN
   RAISE EXCEPTION 'Payroll policy version is immutable'; END IF;
 END IF;
 IF NEW.status='APPROVED' THEN
  PERFORM 1 FROM access_realm WHERE id=NEW.root_realm_id FOR UPDATE;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch WHERE root_realm_id=NEW.root_realm_id AND id=NEW.branch_ref AND status='ACTIVE') THEN RAISE EXCEPTION 'Inactive payroll branch' USING ERRCODE='23514'; END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.branch_ref IS NOT DISTINCT FROM NEW.branch_ref AND p.cycle=NEW.cycle AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
  IF EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.branch_ref IS NOT DISTINCT FROM NEW.branch_ref AND p.cycle=NEW.cycle AND p.status='APPROVED' AND p.id<>NEW.id AND p.id IS DISTINCT FROM NEW.supersedes_ref AND daterange(p.effective_from,LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN
   RAISE EXCEPTION 'Overlapping payroll policy' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_policy_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_policy FOR EACH ROW EXECUTE FUNCTION cg11_policy_guard();
CREATE FUNCTION cg11_salary_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payroll source must be a draft'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Salary history is immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
   OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref)) THEN
   RAISE EXCEPTION 'Salary version is immutable'; END IF;
 END IF;
 IF NEW.status IN('DRAFT','SUBMITTED','APPROVED') THEN
 PERFORM 1 FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_ref FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.root_realm_id=a.root_realm_id AND e.id=a.employee_id WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.assignment_ref AND a.employee_id=NEW.employee_ref AND a.branch_ref=NEW.branch_ref AND a.assignment_version=NEW.assignment_version AND e.status_version=NEW.employee_status_version AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=NEW.effective_from AND (a.valid_to IS NULL OR a.valid_to>NEW.effective_from)) THEN
  RAISE EXCEPTION 'Original HR eligibility changed' USING ERRCODE='23514'; END IF;
 IF NEW.source_hr_proposal_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hr_employment_change h JOIN cg03_case c ON c.realm_id=h.root_realm_id AND c.id=h.case_ref AND c.hr_employment_change_id=h.id AND c.hr_employment_change_digest=h.source_digest AND c.status='OWNER_COMPLETED' JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=h.decision_ref AND d.action='APPROVE' WHERE h.root_realm_id=NEW.root_realm_id AND h.id=NEW.source_hr_proposal_ref AND h.employee_id=NEW.employee_ref AND h.new_assignment_ref=NEW.assignment_ref AND h.proposed_branch_ref=NEW.branch_ref AND h.status='APPLIED' AND h.effective_date=NEW.effective_from) THEN RAISE EXCEPTION 'Original HR proposal no longer applies' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.policy_id AND (p.branch_ref=NEW.branch_ref OR p.branch_ref IS NULL) AND p.revision=NEW.policy_revision AND p.status='APPROVED' AND p.effective_from<=NEW.effective_from AND (LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to<=LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED'))))) THEN
  RAISE EXCEPTION 'Approved policy required' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM employee_compensation p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.employee_ref=NEW.employee_ref AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM employee_compensation successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND EXISTS(SELECT 1 FROM employee_compensation c WHERE c.root_realm_id=NEW.root_realm_id AND c.employee_ref=NEW.employee_ref AND c.status='APPROVED' AND c.id<>NEW.id AND c.id IS DISTINCT FROM NEW.supersedes_ref AND daterange(c.effective_from,LEAST(c.effective_to,(SELECT successor.effective_from FROM employee_compensation successor WHERE successor.root_realm_id=c.root_realm_id AND successor.supersedes_ref=c.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN
  RAISE EXCEPTION 'Overlapping approved salary' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_salary_guard BEFORE INSERT OR UPDATE OR DELETE ON employee_compensation FOR EACH ROW EXECUTE FUNCTION cg11_salary_guard();
CREATE FUNCTION cg11_component_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Payroll components are immutable; create a new policy version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.policy_id AND p.status='DRAFT' FOR UPDATE) THEN RAISE EXCEPTION 'Draft policy required'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_component_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_component FOR EACH ROW EXECUTE FUNCTION cg11_component_guard();
CREATE TABLE payroll_source_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,actor_ref uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN('POLICY','COMPENSATION','PAYOUT')),source_ref uuid NOT NULL,
 event_key uuid NOT NULL, result_class text NOT NULL CHECK(result_class IN('DRAFT_CREATED','SUBMITTED','APPROVED','RETURNED','REJECTED','READ')),
 at timestamptz NOT NULL DEFAULT now(), UNIQUE(root_realm_id,actor_ref,event_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE FUNCTION cg11_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN RAISE EXCEPTION 'Payroll audit history is immutable'; END; $cg11$;
CREATE TRIGGER cg11_audit_immutable BEFORE UPDATE OR DELETE ON payroll_source_audit FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();

-- Employee payout destination is not a Foundation cash/bank ledger.
CREATE TABLE employee_payout_instruction(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 employee_ref uuid NOT NULL,branch_ref uuid NOT NULL,assignment_ref uuid NOT NULL,assignment_version integer NOT NULL CHECK(assignment_version>0),
 employee_status_version integer NOT NULL CHECK(employee_status_version>0),
 effective_from date NOT NULL,effective_to date, supersedes_ref uuid,
 destination_ciphertext text NOT NULL CHECK(length(destination_ciphertext) BETWEEN 20 AND 4096),
 destination_nonce text NOT NULL CHECK(length(destination_nonce)=16),
 destination_tag text NOT NULL CHECK(length(destination_tag)=22),
 destination_fingerprint char(64) NOT NULL CHECK(destination_fingerprint~'^[a-f0-9]{64}$'),
 masked_digits char(4) NOT NULL CHECK(masked_digits~'^[0-9]{4}$'),
 masked_ifsc text NOT NULL CHECK(masked_ifsc~'^[A-Z]{4}[*]{7}$'),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),created_by uuid NOT NULL,request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),approval_case_ref uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(root_realm_id,assignment_ref) REFERENCES hr_employment_assignment(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES employee_payout_instruction(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg11_payout_scope ON employee_payout_instruction(root_realm_id,employee_ref,effective_from DESC,id);
CREATE FUNCTION cg11_payout_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Employee payout history is immutable'; END IF;
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payout instruction must be a draft'; END IF;
 IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
 OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref))) THEN RAISE EXCEPTION 'Payout instruction is immutable'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED','APPROVED') THEN
 PERFORM 1 FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_ref FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.root_realm_id=a.root_realm_id AND e.id=a.employee_id
 JOIN branch b ON b.root_realm_id=a.root_realm_id AND b.id=a.branch_ref AND b.status='ACTIVE'
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.assignment_ref AND a.employee_id=NEW.employee_ref AND a.branch_ref=NEW.branch_ref AND a.assignment_version=NEW.assignment_version AND e.status_version=NEW.employee_status_version AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=NEW.effective_from AND (a.valid_to IS NULL OR a.valid_to>NEW.effective_from)) THEN RAISE EXCEPTION 'Original employee payout eligibility changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM employee_payout_instruction p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.employee_ref=NEW.employee_ref AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM employee_payout_instruction successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND EXISTS(SELECT 1 FROM employee_payout_instruction p WHERE p.root_realm_id=NEW.root_realm_id AND p.employee_ref=NEW.employee_ref AND p.id<>NEW.id AND p.id IS DISTINCT FROM NEW.supersedes_ref AND p.status='APPROVED' AND daterange(p.effective_from,LEAST(p.effective_to,(SELECT successor.effective_from FROM employee_payout_instruction successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN RAISE EXCEPTION 'Overlapping approved payout destination' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_payout_guard BEFORE INSERT OR UPDATE OR DELETE ON employee_payout_instruction FOR EACH ROW EXECUTE FUNCTION cg11_payout_guard();

CREATE UNIQUE INDEX ux_cg11_payroll_policy_successor ON payroll_policy(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW payroll_policy_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM payroll_policy x LEFT JOIN payroll_policy n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

CREATE UNIQUE INDEX ux_cg11_employee_compensation_successor ON employee_compensation(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW employee_compensation_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM employee_compensation x LEFT JOIN employee_compensation n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

CREATE UNIQUE INDEX ux_cg11_employee_payout_instruction_successor ON employee_payout_instruction(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW employee_payout_instruction_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM employee_payout_instruction x LEFT JOIN employee_payout_instruction n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

-- No statutory rate may be represented as an ordinary component until the approved statutory rule source exists.
ALTER TABLE payroll_component ADD CONSTRAINT cg11_component_no_unconfigured_statutory CHECK (code NOT IN('BASIC','RECORDED_LATE_DEDUCTION') AND code !~ '^(PF|EPF|ESI|ESIC|PT|TDS)(_|$)' AND regexp_replace(upper(label),'[^A-Z0-9]','','g') !~ '^(PF|EPF|ESI|ESIC|PT|TDS|PROVIDENTFUND|EMPLOYEE(S)?STATEINSURANCE|PROFESSIONALTAX|INCOMETAX|GRATUITY)$');
),
 fiscal_year_start_month integer NOT NULL DEFAULT 4 CHECK(fiscal_year_start_month=4),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 100),
 effective_from date NOT NULL, effective_to date, supersedes_ref uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL, request_key uuid NOT NULL, request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 approval_case_ref uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,id,branch_ref), UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES payroll_policy(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg11_policy_scope ON payroll_policy(root_realm_id,branch_ref,cycle,effective_from DESC,id);
CREATE TABLE payroll_component (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL, policy_id uuid NOT NULL,
 code text NOT NULL CHECK(code ~ '^[A-Z][A-Z0-9_]{1,29}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 100),
 kind text NOT NULL CHECK(kind IN('ALLOWANCE','DEDUCTION','EMPLOYER_CONTRIBUTION')),
 calc_mode text NOT NULL CHECK(calc_mode IN('FIXED','PERCENT')),
 amount_minor bigint, rate_bp integer, percent_basis text,
 tax_class text NOT NULL CHECK(tax_class IN('TAXABLE','NON_TAXABLE','NOT_CONFIGURED')),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,policy_id,code),
 FOREIGN KEY(root_realm_id,policy_id) REFERENCES payroll_policy(root_realm_id,id),
 CHECK(((calc_mode='FIXED' AND amount_minor IS NOT NULL AND amount_minor BETWEEN 0 AND 99999999999999 AND rate_bp IS NULL AND percent_basis IS NULL)
 OR (calc_mode='PERCENT' AND amount_minor IS NULL AND rate_bp IS NOT NULL AND rate_bp BETWEEN 0 AND 10000 AND percent_basis='BASIC')) IS TRUE)
);
CREATE TABLE employee_compensation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL, employee_ref uuid NOT NULL,
 branch_ref uuid NOT NULL, assignment_ref uuid NOT NULL, assignment_version integer NOT NULL CHECK(assignment_version>0),
 employee_status_version integer NOT NULL CHECK(employee_status_version>0),
 source_hr_proposal_ref uuid,source_hr_proposal_revision integer,source_hr_proposal_digest char(64),
 policy_id uuid NOT NULL, policy_revision integer NOT NULL CHECK(policy_revision>0),
 effective_from date NOT NULL,effective_to date, supersedes_ref uuid, base_salary_minor bigint NOT NULL CHECK(base_salary_minor BETWEEN 1 AND 99999999999999),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 approval_case_ref uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(root_realm_id,assignment_ref) REFERENCES hr_employment_assignment(root_realm_id,id),
 FOREIGN KEY(root_realm_id,source_hr_proposal_ref,source_hr_proposal_digest,source_hr_proposal_revision) REFERENCES hr_employment_change(root_realm_id,id,source_digest,revision),
 CHECK(num_nonnulls(source_hr_proposal_ref,source_hr_proposal_revision,source_hr_proposal_digest) IN(0,3)),
 FOREIGN KEY(root_realm_id,policy_id) REFERENCES payroll_policy(root_realm_id,id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES employee_compensation(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg11_applied_hr_proposal ON employee_compensation(root_realm_id,source_hr_proposal_ref) WHERE status='APPROVED' AND source_hr_proposal_ref IS NOT NULL;
CREATE INDEX ix_cg11_salary_history ON employee_compensation(root_realm_id,employee_ref,effective_from DESC,id);
-- Serialize approval on the actual employee/policy scope. Approved historical versions never mutate.
CREATE FUNCTION cg11_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payroll source must be a draft'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payroll policy history is immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
   OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref)) THEN
   RAISE EXCEPTION 'Payroll policy version is immutable'; END IF;
 END IF;
 IF NEW.status='APPROVED' THEN
  PERFORM 1 FROM access_realm WHERE id=NEW.root_realm_id FOR UPDATE;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch WHERE root_realm_id=NEW.root_realm_id AND id=NEW.branch_ref AND status='ACTIVE') THEN RAISE EXCEPTION 'Inactive payroll branch' USING ERRCODE='23514'; END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.branch_ref IS NOT DISTINCT FROM NEW.branch_ref AND p.cycle=NEW.cycle AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
  IF EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.branch_ref IS NOT DISTINCT FROM NEW.branch_ref AND p.cycle=NEW.cycle AND p.status='APPROVED' AND p.id<>NEW.id AND p.id IS DISTINCT FROM NEW.supersedes_ref AND daterange(p.effective_from,LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN
   RAISE EXCEPTION 'Overlapping payroll policy' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_policy_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_policy FOR EACH ROW EXECUTE FUNCTION cg11_policy_guard();
CREATE FUNCTION cg11_salary_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payroll source must be a draft'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Salary history is immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
   OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref)) THEN
   RAISE EXCEPTION 'Salary version is immutable'; END IF;
 END IF;
 IF NEW.status IN('DRAFT','SUBMITTED','APPROVED') THEN
 PERFORM 1 FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_ref FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.root_realm_id=a.root_realm_id AND e.id=a.employee_id WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.assignment_ref AND a.employee_id=NEW.employee_ref AND a.branch_ref=NEW.branch_ref AND a.assignment_version=NEW.assignment_version AND e.status_version=NEW.employee_status_version AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=NEW.effective_from AND (a.valid_to IS NULL OR a.valid_to>NEW.effective_from)) THEN
  RAISE EXCEPTION 'Original HR eligibility changed' USING ERRCODE='23514'; END IF;
 IF NEW.source_hr_proposal_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hr_employment_change h JOIN cg03_case c ON c.realm_id=h.root_realm_id AND c.id=h.case_ref AND c.hr_employment_change_id=h.id AND c.hr_employment_change_digest=h.source_digest AND c.status='OWNER_COMPLETED' JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=h.decision_ref AND d.action='APPROVE' WHERE h.root_realm_id=NEW.root_realm_id AND h.id=NEW.source_hr_proposal_ref AND h.employee_id=NEW.employee_ref AND h.new_assignment_ref=NEW.assignment_ref AND h.proposed_branch_ref=NEW.branch_ref AND h.status='APPLIED' AND h.effective_date=NEW.effective_from) THEN RAISE EXCEPTION 'Original HR proposal no longer applies' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.policy_id AND (p.branch_ref=NEW.branch_ref OR p.branch_ref IS NULL) AND p.revision=NEW.policy_revision AND p.status='APPROVED' AND p.effective_from<=NEW.effective_from AND (LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to<=LEAST(p.effective_to,(SELECT successor.effective_from FROM payroll_policy successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED'))))) THEN
  RAISE EXCEPTION 'Approved policy required' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM employee_compensation p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.employee_ref=NEW.employee_ref AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM employee_compensation successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND EXISTS(SELECT 1 FROM employee_compensation c WHERE c.root_realm_id=NEW.root_realm_id AND c.employee_ref=NEW.employee_ref AND c.status='APPROVED' AND c.id<>NEW.id AND c.id IS DISTINCT FROM NEW.supersedes_ref AND daterange(c.effective_from,LEAST(c.effective_to,(SELECT successor.effective_from FROM employee_compensation successor WHERE successor.root_realm_id=c.root_realm_id AND successor.supersedes_ref=c.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN
  RAISE EXCEPTION 'Overlapping approved salary' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_salary_guard BEFORE INSERT OR UPDATE OR DELETE ON employee_compensation FOR EACH ROW EXECUTE FUNCTION cg11_salary_guard();
CREATE FUNCTION cg11_component_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Payroll components are immutable; create a new policy version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_policy p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.policy_id AND p.status='DRAFT' FOR UPDATE) THEN RAISE EXCEPTION 'Draft policy required'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_component_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_component FOR EACH ROW EXECUTE FUNCTION cg11_component_guard();
CREATE TABLE payroll_source_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,actor_ref uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN('POLICY','COMPENSATION','PAYOUT')),source_ref uuid NOT NULL,
 event_key uuid NOT NULL, result_class text NOT NULL CHECK(result_class IN('DRAFT_CREATED','SUBMITTED','APPROVED','RETURNED','REJECTED','READ')),
 at timestamptz NOT NULL DEFAULT now(), UNIQUE(root_realm_id,actor_ref,event_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE FUNCTION cg11_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN RAISE EXCEPTION 'Payroll audit history is immutable'; END; $cg11$;
CREATE TRIGGER cg11_audit_immutable BEFORE UPDATE OR DELETE ON payroll_source_audit FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();

-- Employee payout destination is not a Foundation cash/bank ledger.
CREATE TABLE employee_payout_instruction(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 employee_ref uuid NOT NULL,branch_ref uuid NOT NULL,assignment_ref uuid NOT NULL,assignment_version integer NOT NULL CHECK(assignment_version>0),
 employee_status_version integer NOT NULL CHECK(employee_status_version>0),
 effective_from date NOT NULL,effective_to date, supersedes_ref uuid,
 destination_ciphertext text NOT NULL CHECK(length(destination_ciphertext) BETWEEN 20 AND 4096),
 destination_nonce text NOT NULL CHECK(length(destination_nonce)=16),
 destination_tag text NOT NULL CHECK(length(destination_tag)=22),
 destination_fingerprint char(64) NOT NULL CHECK(destination_fingerprint~'^[a-f0-9]{64}$'),
 masked_digits char(4) NOT NULL CHECK(masked_digits~'^[0-9]{4}$'),
 masked_ifsc text NOT NULL CHECK(masked_ifsc~'^[A-Z]{4}[*]{7}$'),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),created_by uuid NOT NULL,request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),approval_case_ref uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(root_realm_id,assignment_ref) REFERENCES hr_employment_assignment(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(root_realm_id,supersedes_ref) REFERENCES employee_payout_instruction(root_realm_id,id),
 CHECK(supersedes_ref IS NULL OR supersedes_ref<>id),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(status NOT IN('SUBMITTED','APPROVED') OR approval_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg11_payout_scope ON employee_payout_instruction(root_realm_id,employee_ref,effective_from DESC,id);
CREATE FUNCTION cg11_payout_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Employee payout history is immutable'; END IF;
 IF TG_OP='INSERT' AND (NEW.status<>'DRAFT' OR NEW.revision<>1 OR NEW.approval_case_ref IS NOT NULL) THEN RAISE EXCEPTION 'New payout instruction must be a draft'; END IF;
 IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['status','revision','approval_case_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','approval_case_ref'])
 OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='DRAFT' AND NEW.status='SUBMITTED') OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref))) THEN RAISE EXCEPTION 'Payout instruction is immutable'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED','APPROVED') THEN
 PERFORM 1 FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_ref FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.root_realm_id=a.root_realm_id AND e.id=a.employee_id
 JOIN branch b ON b.root_realm_id=a.root_realm_id AND b.id=a.branch_ref AND b.status='ACTIVE'
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.assignment_ref AND a.employee_id=NEW.employee_ref AND a.branch_ref=NEW.branch_ref AND a.assignment_version=NEW.assignment_version AND e.status_version=NEW.employee_status_version AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=NEW.effective_from AND (a.valid_to IS NULL OR a.valid_to>NEW.effective_from)) THEN RAISE EXCEPTION 'Original employee payout eligibility changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND NEW.supersedes_ref IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM employee_payout_instruction p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.supersedes_ref AND p.employee_ref=NEW.employee_ref AND p.status='APPROVED' AND p.effective_from<NEW.effective_from AND (p.effective_to IS NULL OR NEW.effective_from<=p.effective_to) AND NOT EXISTS(SELECT 1 FROM employee_payout_instruction successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')) THEN
   RAISE EXCEPTION 'Original approved predecessor changed' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='APPROVED' AND EXISTS(SELECT 1 FROM employee_payout_instruction p WHERE p.root_realm_id=NEW.root_realm_id AND p.employee_ref=NEW.employee_ref AND p.id<>NEW.id AND p.id IS DISTINCT FROM NEW.supersedes_ref AND p.status='APPROVED' AND daterange(p.effective_from,LEAST(p.effective_to,(SELECT successor.effective_from FROM employee_payout_instruction successor WHERE successor.root_realm_id=p.root_realm_id AND successor.supersedes_ref=p.id AND successor.status='APPROVED')),'[)') && daterange(NEW.effective_from,NEW.effective_to,'[)')) THEN RAISE EXCEPTION 'Overlapping approved payout destination' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_payout_guard BEFORE INSERT OR UPDATE OR DELETE ON employee_payout_instruction FOR EACH ROW EXECUTE FUNCTION cg11_payout_guard();

CREATE UNIQUE INDEX ux_cg11_payroll_policy_successor ON payroll_policy(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW payroll_policy_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM payroll_policy x LEFT JOIN payroll_policy n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

CREATE UNIQUE INDEX ux_cg11_employee_compensation_successor ON employee_compensation(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW employee_compensation_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM employee_compensation x LEFT JOIN employee_compensation n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

CREATE UNIQUE INDEX ux_cg11_employee_payout_instruction_successor ON employee_payout_instruction(root_realm_id,supersedes_ref) WHERE status='APPROVED' AND supersedes_ref IS NOT NULL;
CREATE VIEW employee_payout_instruction_effective AS SELECT x.*,LEAST(x.effective_to,n.effective_from) AS effective_until FROM employee_payout_instruction x LEFT JOIN employee_payout_instruction n ON n.root_realm_id=x.root_realm_id AND n.supersedes_ref=x.id AND n.status='APPROVED';

-- No statutory rate may be represented as an ordinary component until the approved statutory rule source exists.
ALTER TABLE payroll_component ADD CONSTRAINT cg11_component_no_unconfigured_statutory CHECK (code <> 'BASIC' AND code !~ '^(PF|EPF|ESI|ESIC|PT|TDS)(_|$)' AND regexp_replace(upper(label),'[^A-Z0-9]','','g') !~ '^(PF|EPF|ESI|ESIC|PT|TDS|PROVIDENTFUND|EMPLOYEE(S)?STATEINSURANCE|PROFESSIONALTAX|INCOMETAX|GRATUITY)$');
