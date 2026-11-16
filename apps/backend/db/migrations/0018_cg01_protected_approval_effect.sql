-- CG-01-owned single protected role effect, introduced by CG-03 US-003.
-- No independent approver or role master is created.
CREATE TABLE cg01_approved_sensitive_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  effect_key uuid NOT NULL UNIQUE,
  source_case_ref uuid NOT NULL UNIQUE,
  source_decision_ref uuid NOT NULL UNIQUE,
  proposal_digest char(64) NOT NULL CHECK(proposal_digest ~ '^[0-9a-f]{64}$'),
  target_account_id uuid NOT NULL,
  target_role_id uuid NOT NULL,
  expected_access_version bigint NOT NULL CHECK(expected_access_version>0),
  resulting_access_version bigint NOT NULL CHECK(resulting_access_version>expected_access_version),
  approved_role_revision integer NOT NULL CHECK(approved_role_revision>0),
  proposer_id uuid NOT NULL,
  final_reviewer_id uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(target_account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(target_role_id,realm_id) REFERENCES role(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(proposer_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(final_reviewer_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(proposer_id<>final_reviewer_id),
  CHECK(proposer_id<>target_account_id)
);
CREATE INDEX ix_cg01_sensitive_assignment_effective
 ON cg01_approved_sensitive_assignment(realm_id,target_account_id,target_role_id,approved_role_revision);
CREATE FUNCTION cg01_sensitive_effect_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Original approved access effect is immutable';
END; $$;
CREATE TRIGGER cg01_sensitive_effect_history
 BEFORE UPDATE OR DELETE ON cg01_approved_sensitive_assignment
 FOR EACH ROW EXECUTE FUNCTION cg01_sensitive_effect_immutable();
