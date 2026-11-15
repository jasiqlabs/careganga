-- CG-03 US-001: exactly one real CG-01 owner kind, Foundation-root only.
-- No CG-19 attachments, CG-02 branches, future business masters, or shadow grants.
CREATE SEQUENCE cg03_public_case_sequence;
CREATE TABLE cg03_process (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  first_reviewer_capability text CHECK (
    first_reviewer_capability IS NULL OR first_reviewer_capability='roles.assign'),
  configured_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,version), UNIQUE(id,realm_id),
  FOREIGN KEY(configured_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg03_process_step (
  process_id uuid NOT NULL REFERENCES cg03_process(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 2),
  capability_key text NOT NULL CHECK(capability_key IN ('roles.assign','approvals.review')),
  protected_root_required boolean NOT NULL,
  PRIMARY KEY(process_id,ordinal),
  CHECK((capability_key='approvals.review' AND protected_root_required)
     OR (capability_key='roles.assign' AND NOT protected_root_required))
);
CREATE TABLE cg03_process_current (
  realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
  process_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg03_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  case_number text NOT NULL UNIQUE CHECK(case_number ~ '^CG-AP-[0-9]{6,}$'),
  process_id uuid NOT NULL,
  process_version integer NOT NULL CHECK(process_version>0),
  proposer_id uuid NOT NULL,
  target_account_id uuid NOT NULL,
  target_role_id uuid NOT NULL,
  expected_access_version bigint NOT NULL CHECK(expected_access_version>0),
  expected_role_revision integer NOT NULL CHECK(expected_role_revision>0),
  proposal_revision integer NOT NULL CHECK(proposal_revision>0),
  proposal_digest char(64) NOT NULL CHECK(proposal_digest ~ '^[a-f0-9]{64}$'),
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  request_key uuid NOT NULL,
  previous_case_id uuid,
  status text NOT NULL DEFAULT 'SUBMITTED'
    CHECK(status IN('SUBMITTED','IN_REVIEW','RETURNED','REJECTED',
                    'FINAL_APPROVED','PENDING_OWNER','OWNER_COMPLETED',
                    'OWNER_BLOCKED','OWNER_FAILED_RETRYABLE')),
  current_step integer NOT NULL DEFAULT 1 CHECK(current_step BETWEEN 1 AND 2),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,proposer_id,request_key),
  UNIQUE(id,realm_id),
  FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(proposer_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(target_account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(target_role_id) REFERENCES role(id) ON DELETE RESTRICT,
  FOREIGN KEY(previous_case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  CHECK(proposer_id<>target_account_id)
);
CREATE UNIQUE INDEX ux_cg03_one_active_case_per_target
 ON cg03_case(realm_id,target_account_id)
 WHERE status IN('SUBMITTED','IN_REVIEW','FINAL_APPROVED','PENDING_OWNER',
                 'OWNER_FAILED_RETRYABLE');
CREATE INDEX ix_cg03_cases_realm_status_time
 ON cg03_case(realm_id,status,submitted_at DESC,id DESC);
CREATE INDEX ix_cg03_cases_proposer
 ON cg03_case(realm_id,proposer_id,submitted_at DESC,id DESC);
CREATE TABLE cg03_case_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN('SUBMITTED','CORRECTED','APPROVED',
    'FORWARDED','RETURNED','REJECTED','FINAL_APPROVED','PENDING_OWNER',
    'OWNER_COMPLETED','OWNER_BLOCKED','OWNER_FAILED_RETRYABLE')),
  step_ordinal integer NOT NULL CHECK(step_ordinal BETWEEN 1 AND 2),
  safe_remarks text NOT NULL DEFAULT '' CHECK(length(safe_remarks)<=500),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_ref uuid NOT NULL,
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg03_case_history ON cg03_case_event(case_id,occurred_at,id);
CREATE FUNCTION cg03_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable approval evidence cannot be edited or removed';
END; $$;
CREATE TRIGGER cg03_process_immutable BEFORE UPDATE OR DELETE ON cg03_process
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
CREATE TRIGGER cg03_process_step_immutable BEFORE UPDATE OR DELETE ON cg03_process_step
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
CREATE TRIGGER cg03_case_event_immutable BEFORE UPDATE OR DELETE ON cg03_case_event
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
CREATE FUNCTION cg03_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
     NEW.case_number IS DISTINCT FROM OLD.case_number OR
     NEW.process_id IS DISTINCT FROM OLD.process_id OR
     NEW.process_version IS DISTINCT FROM OLD.process_version OR
     NEW.proposer_id IS DISTINCT FROM OLD.proposer_id OR
     NEW.target_account_id IS DISTINCT FROM OLD.target_account_id OR
     NEW.target_role_id IS DISTINCT FROM OLD.target_role_id OR
     NEW.expected_access_version IS DISTINCT FROM OLD.expected_access_version OR
     NEW.expected_role_revision IS DISTINCT FROM OLD.expected_role_revision OR
     NEW.proposal_revision IS DISTINCT FROM OLD.proposal_revision OR
     NEW.proposal_digest IS DISTINCT FROM OLD.proposal_digest OR
     NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
     NEW.request_key IS DISTINCT FROM OLD.request_key OR
     NEW.previous_case_id IS DISTINCT FROM OLD.previous_case_id OR
     NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'Frozen proposal cannot be changed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg03_case_frozen BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_case_frozen();
