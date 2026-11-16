-- CG-02 US-002 introducing CG-03-owned BRANCH_REGISTRATION case type.
-- Additive; preserve CG-03's original protected CG-01 role approval, immutable cases,
-- decisions and migration checksums. No branch database table is owned by CG-03.
ALTER TABLE cg03_process
  ADD COLUMN process_kind text NOT NULL DEFAULT 'CG01_ROLE'
    CHECK(process_kind IN('CG01_ROLE','BRANCH_REGISTRATION'));
CREATE TABLE cg03_branch_process_current(
  realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
  process_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE cg03_case
  ADD COLUMN case_kind text NOT NULL DEFAULT 'CG01_ROLE'
    CHECK(case_kind IN('CG01_ROLE','BRANCH_REGISTRATION')),
  ADD COLUMN branch_source_ref uuid,
  ADD COLUMN branch_source_revision integer,
  ADD COLUMN branch_source_digest char(64),
  ADD CONSTRAINT cg03_case_source_disjoint CHECK(
    (case_kind='CG01_ROLE' AND branch_source_ref IS NULL
      AND branch_source_revision IS NULL AND branch_source_digest IS NULL
      AND target_account_id IS NOT NULL AND target_role_id IS NOT NULL
      AND expected_access_version IS NOT NULL AND expected_role_revision IS NOT NULL)
    OR
    (case_kind='BRANCH_REGISTRATION'
      AND branch_source_ref IS NOT NULL AND branch_source_revision>0
      AND branch_source_digest ~ '^[0-9a-f]{64}$'
      AND target_account_id IS NULL AND target_role_id IS NULL
      AND expected_access_version IS NULL AND expected_role_revision IS NULL)
  );
ALTER TABLE cg03_case ALTER COLUMN target_account_id DROP NOT NULL;
ALTER TABLE cg03_case ALTER COLUMN target_role_id DROP NOT NULL;
ALTER TABLE cg03_case ALTER COLUMN expected_access_version DROP NOT NULL;
ALTER TABLE cg03_case ALTER COLUMN expected_role_revision DROP NOT NULL;
CREATE UNIQUE INDEX ux_cg03_branch_snapshot_case
  ON cg03_case(realm_id,branch_source_ref,branch_source_revision)
  WHERE case_kind='BRANCH_REGISTRATION';
CREATE INDEX ix_cg03_branch_case_root
  ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC);
-- Existing cg03_case_frozen() protects previous fields; guard the new source identity.
CREATE FUNCTION cg03_branch_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.case_kind IS DISTINCT FROM OLD.case_kind
    OR NEW.branch_source_ref IS DISTINCT FROM OLD.branch_source_ref
    OR NEW.branch_source_revision IS DISTINCT FROM OLD.branch_source_revision
    OR NEW.branch_source_digest IS DISTINCT FROM OLD.branch_source_digest THEN
    RAISE EXCEPTION 'Original branch approval source cannot be changed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg03_branch_identity_guard
  BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_branch_identity_frozen();

-- No CG-01 protected assignment is created by a branch decision. CG-02 is sole finalizer.
CREATE TABLE cg03_branch_owner_effect(
  case_id uuid NOT NULL,
  realm_id uuid NOT NULL,
  final_decision_id uuid NOT NULL,
  effect_key uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING_OWNER'
    CHECK(status IN('PENDING_OWNER','OWNER_COMPLETED','OWNER_BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY(case_id),
  UNIQUE(effect_key),UNIQUE(final_decision_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(final_decision_id,case_id,realm_id)
    REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
  CHECK(status<>'OWNER_COMPLETED' OR completed_at IS NOT NULL)
);
CREATE FUNCTION cg03_branch_effect_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.case_id IS DISTINCT FROM OLD.case_id
    OR NEW.realm_id IS DISTINCT FROM OLD.realm_id
    OR NEW.final_decision_id IS DISTINCT FROM OLD.final_decision_id
    OR NEW.effect_key IS DISTINCT FROM OLD.effect_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Approved branch decision identity is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg03_branch_effect_frozen
  BEFORE UPDATE ON cg03_branch_owner_effect FOR EACH ROW
  EXECUTE FUNCTION cg03_branch_effect_identity_frozen();
