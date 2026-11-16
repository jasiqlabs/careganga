-- CG-02 US-002: real seven-stage branch draft authority, without invented approval or file proof.
-- Submission/activation/evidence tables are introduced only with the genuine CG-03/CG-19 adapters.
CREATE TABLE branch_registration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES foundation_profile(root_realm_id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  manager_account_ref uuid,
  geography_area_id uuid,
  current_step integer NOT NULL DEFAULT 1 CHECK(current_step BETWEEN 1 AND 7),
  draft_version integer NOT NULL DEFAULT 1 CHECK(draft_version BETWEEN 1 AND 2147483647),
  current_submission_revision integer CHECK(current_submission_revision IS NULL OR current_submission_revision>0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN
    ('DRAFT','RETURNED','SUBMISSION_UNCONFIRMED','SUBMITTED','IN_REVIEW',
     'REJECTED','FINAL_APPROVED_PENDING_ACTIVATION','ACTIVE')),
  profile_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(profile_payload)='object' AND pg_column_size(profile_payload)<=12000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,root_realm_id),
  FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(manager_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(geography_area_id,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg02_branch_draft_root_status
  ON branch_registration(root_realm_id,status,updated_at DESC,id DESC);
CREATE INDEX ix_cg02_branch_draft_requester
  ON branch_registration(root_realm_id,requested_by,updated_at DESC,id DESC);
CREATE INDEX ix_cg02_branch_draft_manager
  ON branch_registration(root_realm_id,manager_account_ref,updated_at DESC,id DESC)
  WHERE manager_account_ref IS NOT NULL;

CREATE TABLE branch_registration_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_ref uuid NOT NULL,
  action text NOT NULL CHECK(action IN('BRANCH_DRAFT_CREATE','BRANCH_DRAFT_SAVE')),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  result_ref uuid,
  result_version integer CHECK(result_version IS NULL OR result_version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,action,request_key),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(result_ref,root_realm_id) REFERENCES branch_registration(id,root_realm_id) ON DELETE RESTRICT,
  CHECK ((result_ref IS NULL AND result_version IS NULL) OR
         (result_ref IS NOT NULL AND result_version IS NOT NULL))
);
CREATE INDEX ix_cg02_branch_command_original
  ON branch_registration_command(root_realm_id,actor_ref,action,request_key);

CREATE TABLE branch_registration_revision (
  registration_id uuid NOT NULL,
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  draft_version integer NOT NULL CHECK(draft_version>0),
  changed_by uuid NOT NULL,
  current_step integer NOT NULL CHECK(current_step BETWEEN 1 AND 7),
  status text NOT NULL CHECK(status IN('DRAFT','RETURNED')),
  stage_payload jsonb NOT NULL CHECK(jsonb_typeof(stage_payload)='object'),
  payload_sha256 char(64) NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(registration_id,draft_version),
  FOREIGN KEY(registration_id,root_realm_id) REFERENCES branch_registration(id,root_realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg02_registration_revision_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Branch draft history is immutable'; END;
$$;
CREATE TRIGGER cg02_registration_revision_no_mutation
  BEFORE UPDATE OR DELETE ON branch_registration_revision
  FOR EACH ROW EXECUTE FUNCTION cg02_registration_revision_immutable();
