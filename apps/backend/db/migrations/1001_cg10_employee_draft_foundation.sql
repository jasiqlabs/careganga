-- CG-10 US-001, first additive source slice. No employee is created on draft save.
-- All identities are Foundation-root derived and cross-owner FKs use the real owners.
-- Final approval, CG-03 source case, CG-19 evidence and CG-01 grants follow in US-001
-- review integration; never activate from a mere HR draft.
CREATE SEQUENCE hr_application_public_sequence START WITH 1;
CREATE SEQUENCE hr_employee_public_sequence START WITH 1;

CREATE TABLE hr_employee_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  application_no text NOT NULL UNIQUE CHECK(application_no ~ '^CG-HR-APP-[0-9]{6,}$'),
  legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 2 AND 160),
  designation text NOT NULL CHECK(length(btrim(designation)) BETWEEN 2 AND 120),
  employment_type text NOT NULL CHECK(employment_type IN ('FULL_TIME','PART_TIME','CONTRACT','VOLUNTEER_STAFF')),
  proposed_branch_ref uuid NOT NULL,
  department_ref uuid,
  proposed_manager_employee_ref uuid,
  applicant_account_ref uuid,
  hire_date date NOT NULL,
  role_proposal_key text,
  state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN(
    'DRAFT','RETURNED','SUBMISSION_UNCONFIRMED','SUBMITTED',
    'IN_REVIEW','REJECTED','FINAL_APPROVED_PENDING_ACTIVATION',
    'PENDING_ACCESS','ACTIVE')),
  revision_no integer NOT NULL DEFAULT 1 CHECK(revision_no>0),
  submitted_digest char(64),
  cg03_case_ref uuid,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,request_key),
  FOREIGN KEY(proposed_branch_ref,root_realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(department_ref,root_realm_id)
    REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(applicant_account_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(cg03_case_ref,root_realm_id)
    REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  CHECK(role_proposal_key IS NULL OR role_proposal_key ~ '^[a-z][a-z0-9.-]{1,79}$'),
  CHECK((cg03_case_ref IS NULL AND submitted_digest IS NULL)
    OR (cg03_case_ref IS NOT NULL AND submitted_digest IS NOT NULL)
    OR (state='SUBMISSION_UNCONFIRMED' AND cg03_case_ref IS NULL
         AND submitted_digest IS NOT NULL))
);
CREATE INDEX ix_hr_application_branch_state
  ON hr_employee_application(root_realm_id,proposed_branch_ref,state,created_at DESC,id DESC);
CREATE UNIQUE INDEX ux_hr_active_account_candidate ON hr_employee_application(root_realm_id,applicant_account_ref)
  WHERE applicant_account_ref IS NOT NULL AND state NOT IN ('REJECTED');

CREATE TABLE hr_application_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  application_ref uuid NOT NULL,
  action text NOT NULL CHECK(action IN('CREATE','UPDATE')),
  resulting_revision integer NOT NULL CHECK(resulting_revision>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,request_key),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(application_ref,root_realm_id)
    REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT
);

CREATE TABLE hr_application_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  application_id uuid NOT NULL,
  revision_no integer NOT NULL CHECK(revision_no>0),
  source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
  source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
  private_file_versions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK(jsonb_typeof(private_file_versions)='array'),
  cg03_case_ref uuid,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,application_id,revision_no),
  FOREIGN KEY(application_id,root_realm_id)
    REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(submitted_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(cg03_case_ref,root_realm_id)
    REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg10_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Submitted employee revisions cannot be changed or deleted';
END; $$;
CREATE TRIGGER hr_revision_frozen BEFORE UPDATE OR DELETE ON hr_application_revision
  FOR EACH ROW EXECUTE FUNCTION cg10_revision_immutable();

CREATE TABLE hr_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  application_id uuid NOT NULL,
  employee_code text NOT NULL UNIQUE CHECK(employee_code ~ '^CG-HR-EMP-[0-9]{6,}$'),
  account_ref uuid,
  status text NOT NULL DEFAULT 'PENDING_ACCESS'
    CHECK(status IN('ACTIVE','PROBATION','ON_HOLD','PENDING_ACCESS','EXITED')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  status_version integer NOT NULL DEFAULT 1 CHECK(status_version>0),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,application_id),
  FOREIGN KEY(application_id,root_realm_id)
    REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(account_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_hr_employee_account ON hr_employee(root_realm_id,account_ref)
 WHERE account_ref IS NOT NULL;
CREATE INDEX ix_hr_employee_scope ON hr_employee(root_realm_id,status,id);

CREATE TABLE hr_employment_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  branch_ref uuid NOT NULL,
  department_ref uuid,
  manager_employee_ref uuid,
  designation text NOT NULL CHECK(length(btrim(designation)) BETWEEN 2 AND 120),
  employment_type text NOT NULL CHECK(employment_type IN ('FULL_TIME','PART_TIME','CONTRACT','VOLUNTEER_STAFF')),
  valid_from date NOT NULL,
  valid_to date,
  assignment_version integer NOT NULL DEFAULT 1 CHECK(assignment_version>0),
  origin_application_ref uuid NOT NULL,
  CHECK(valid_to IS NULL OR valid_to>valid_from),
  CHECK(manager_employee_ref IS NULL OR manager_employee_ref<>employee_id),
  UNIQUE(root_realm_id,id),
  FOREIGN KEY(employee_id,root_realm_id)
    REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(branch_ref,root_realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(department_ref,root_realm_id)
    REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(manager_employee_ref,root_realm_id)
    REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(origin_application_ref,root_realm_id)
    REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_hr_assignment_one_current
 ON hr_employment_assignment(root_realm_id,employee_id) WHERE valid_to IS NULL;
CREATE INDEX ix_hr_assignment_branch
 ON hr_employment_assignment(root_realm_id,branch_ref,valid_from DESC,id);

CREATE TABLE hr_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  application_ref uuid,
  employee_ref uuid,
  event_key uuid NOT NULL,
  action text NOT NULL CHECK(action IN('DRAFT_CREATED','DRAFT_UPDATED','SUBMITTED','RETURNED','REJECTED','ACTIVATED','PENDING_ACCESS','ACCESS_CONFIRMED')),
  summary text NOT NULL DEFAULT '' CHECK(length(summary)<=200),
  happened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,event_key),
  FOREIGN KEY(actor_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(application_ref,root_realm_id)
    REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(employee_ref,root_realm_id)
    REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_audit_application ON hr_audit(root_realm_id,application_ref,happened_at DESC);
