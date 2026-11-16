-- CG-02 US-002: immutable branch submission, approved operating source and
-- versioned Foundation/branch department links. Actual CG-03/19 proof mandatory.
CREATE TABLE branch_registration_submission(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  submitted_revision integer NOT NULL CHECK(submitted_revision>0),
  source_submission_key uuid NOT NULL,
  immutable_payload jsonb NOT NULL CHECK(jsonb_typeof(immutable_payload)='object'),
  immutable_payload_digest char(64) NOT NULL CHECK(immutable_payload_digest ~ '^[0-9a-f]{64}$'),
  verified_file_versions jsonb NOT NULL CHECK(jsonb_typeof(verified_file_versions)='array'),
  approval_case_ref uuid,
  status text NOT NULL DEFAULT 'SUBMISSION_UNCONFIRMED'
    CHECK(status IN('SUBMISSION_UNCONFIRMED','SUBMITTED','IN_REVIEW','RETURNED','REJECTED',
      'FINAL_APPROVED_PENDING_ACTIVATION','ACTIVE')),
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,root_realm_id),
  UNIQUE(registration_id,submitted_revision),
  UNIQUE(registration_id,source_submission_key),
  UNIQUE(approval_case_ref),
  FOREIGN KEY(registration_id,root_realm_id)
    REFERENCES branch_registration(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(submitted_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approval_case_ref,root_realm_id)
    REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg02_submission_recent
 ON branch_registration_submission(root_realm_id,registration_id,submitted_at DESC,id DESC);
CREATE FUNCTION cg02_submission_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
  OR NEW.submitted_revision IS DISTINCT FROM OLD.submitted_revision
  OR NEW.source_submission_key IS DISTINCT FROM OLD.source_submission_key
  OR NEW.immutable_payload IS DISTINCT FROM OLD.immutable_payload
  OR NEW.immutable_payload_digest IS DISTINCT FROM OLD.immutable_payload_digest
  OR NEW.verified_file_versions IS DISTINCT FROM OLD.verified_file_versions
  OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
  OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
  OR (OLD.approval_case_ref IS NOT NULL
      AND NEW.approval_case_ref IS DISTINCT FROM OLD.approval_case_ref) THEN
   RAISE EXCEPTION 'Submitted branch source is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg02_submission_immutable
 BEFORE UPDATE ON branch_registration_submission FOR EACH ROW
 EXECUTE FUNCTION cg02_submission_source_frozen();
CREATE TRIGGER cg02_submission_no_delete
 BEFORE DELETE ON branch_registration_submission FOR EACH ROW
 EXECUTE FUNCTION cg02_registration_revision_immutable();

CREATE SEQUENCE cg02_branch_code_sequence;
CREATE TABLE branch(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES foundation_profile(root_realm_id) ON DELETE RESTRICT,
  registration_id uuid NOT NULL,
  approved_submission_id uuid NOT NULL,
  branch_code text NOT NULL UNIQUE CHECK(branch_code ~ '^CG-BR-[0-9]{6,}$'),
  name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 160),
  normalized_name text NOT NULL,
  branch_type text NOT NULL DEFAULT '',
  opening_date date,
  geography_area_id uuid NOT NULL,
  postal_address text NOT NULL DEFAULT '',
  pin_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  official_phone text NOT NULL DEFAULT '',
  official_email text NOT NULL DEFAULT '',
  manager_account_ref uuid NOT NULL,
  evidence_versions jsonb NOT NULL CHECK(jsonb_typeof(evidence_versions)='array'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE','CLOSED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  activated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,root_realm_id),
  UNIQUE(registration_id),
  UNIQUE(approved_submission_id),
  FOREIGN KEY(registration_id,root_realm_id)
    REFERENCES branch_registration(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_submission_id,root_realm_id)
    REFERENCES branch_registration_submission(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(geography_area_id,root_realm_id)
    REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(manager_account_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK(pin_code IS NULL OR pin_code ~ '^[0-9]{6}$'),
  CHECK(closed_at IS NULL OR status='CLOSED')
);
CREATE INDEX ix_cg02_branch_root_status
 ON branch(root_realm_id,status,normalized_name,id);

CREATE TABLE branch_profile_revision(
  branch_id uuid NOT NULL,
  root_realm_id uuid NOT NULL,
  branch_version integer NOT NULL CHECK(branch_version>0),
  mutation_key uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL,
  change_reason text NOT NULL DEFAULT '',
  before_payload jsonb NOT NULL CHECK(jsonb_typeof(before_payload)='object'),
  after_payload jsonb NOT NULL CHECK(jsonb_typeof(after_payload)='object'),
  evidence_versions jsonb NOT NULL CHECK(jsonb_typeof(evidence_versions)='array'),
  approved_submission_id uuid NOT NULL,
  PRIMARY KEY(branch_id,branch_version),
  UNIQUE(branch_id,mutation_key),
  FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_submission_id,root_realm_id)
    REFERENCES branch_registration_submission(id,root_realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg02_branch_revision_no_mutation
 BEFORE UPDATE OR DELETE ON branch_profile_revision FOR EACH ROW
 EXECUTE FUNCTION cg02_registration_revision_immutable();

CREATE TABLE branch_department_link(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  foundation_department_id uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NOT NULL,
  ended_at timestamptz,
  ended_by uuid,
  UNIQUE(id,root_realm_id),
  FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(foundation_department_id,root_realm_id)
    REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(ended_at IS NULL OR ended_at>=linked_at),
  CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL))
);
CREATE UNIQUE INDEX ux_cg02_branch_department_active_link
 ON branch_department_link(branch_id,foundation_department_id) WHERE ended_at IS NULL;
CREATE INDEX ix_cg02_branch_department_history
 ON branch_department_link(root_realm_id,branch_id,linked_at DESC,id DESC);

-- One department authority with row-local scope and serialized ACTIVE branch guards.
ALTER TABLE department ADD COLUMN branch_id uuid;
ALTER TABLE department
  DROP CONSTRAINT IF EXISTS department_scope_kind_check;
ALTER TABLE department
  ADD CONSTRAINT cg02_department_valid_scope CHECK(
    (scope_kind='FOUNDATION' AND branch_id IS NULL)
    OR (scope_kind='BRANCH' AND branch_id IS NOT NULL)),
  ADD CONSTRAINT cg02_department_branch_fk FOREIGN KEY(branch_id,root_realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT;
DROP INDEX ux_cg02_department_foundation;
CREATE UNIQUE INDEX ux_cg02_department_foundation
 ON department(root_realm_id,kind,normalized_name)
 WHERE branch_id IS NULL;
CREATE UNIQUE INDEX ux_cg02_department_branch
 ON department(root_realm_id,branch_id,kind,normalized_name)
 WHERE branch_id IS NOT NULL;
CREATE INDEX ix_cg02_department_branch
 ON department(root_realm_id,branch_id,active,name,id)
 WHERE branch_id IS NOT NULL;

CREATE TABLE branch_operation_command(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_ref uuid NOT NULL,
  action text NOT NULL CHECK(action IN(
    'SUBMIT','ACTIVATE','UPDATE_BRANCH','CHANGE_BRANCH_STATUS',
    'CREATE_BRANCH_DEPARTMENT','UPDATE_BRANCH_DEPARTMENT','LINK_DEPARTMENT','UNLINK_DEPARTMENT')),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL,
  result_ref uuid,
  result_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,action,request_key),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg02_operation_root
 ON branch_operation_command(root_realm_id,created_at DESC,id DESC);
