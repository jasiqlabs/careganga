-- CG-03 / US-002: real reviewer decisions, never source-owner effects.
-- One immutable decision per expected case revision; actor+request replay is exact.
CREATE TABLE cg03_case_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN('APPROVE','RETURN','REJECT','FORWARD')),
  step_ordinal integer NOT NULL CHECK(step_ordinal BETWEEN 1 AND 2),
  expected_case_revision integer NOT NULL CHECK(expected_case_revision>0),
  accepted_case_revision integer NOT NULL CHECK(accepted_case_revision>1),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  safe_remarks text NOT NULL DEFAULT '' CHECK(length(safe_remarks)<=500),
  -- Set only after CG-01 locked, one-use TOTP verification in the decision TX.
  fresh_mfa_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id,request_key),
  UNIQUE(case_id,expected_case_revision),
  UNIQUE(id,realm_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg03_case_decisions_history ON cg03_case_decision(case_id,created_at,id);
CREATE TRIGGER cg03_decision_immutable BEFORE UPDATE OR DELETE ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
