-- CG-01/US-004 only. One Foundation-root policy; no CG-21 or generic settings.
-- Absent row means the built-in secure defaults enforced in SessionService.
CREATE TABLE auth_security_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_realm_id uuid NOT NULL UNIQUE REFERENCES access_realm(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 2147483647),
  max_session_age_seconds integer NOT NULL CHECK (max_session_age_seconds BETWEEN 900 AND 28800),
  idle_timeout_seconds integer NOT NULL CHECK (idle_timeout_seconds BETWEEN 300 AND 3600
    AND idle_timeout_seconds <= max_session_age_seconds),
  failed_attempt_window_seconds integer NOT NULL
    CHECK (failed_attempt_window_seconds BETWEEN 300 AND 3600),
  max_failed_attempts integer NOT NULL CHECK (max_failed_attempts BETWEEN 3 AND 10),
  root_mfa_required boolean NOT NULL DEFAULT TRUE CHECK (root_mfa_required IS TRUE),
  updated_by uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_security_policy_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES auth_security_policy(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision BETWEEN 1 AND 2147483647),
  safe_previous_values jsonb NOT NULL CHECK (jsonb_typeof(safe_previous_values)='object'),
  safe_effective_values jsonb NOT NULL CHECK (jsonb_typeof(safe_effective_values)='object'),
  actor_ref uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  correlation_ref uuid NOT NULL,
  UNIQUE (policy_id,revision)
);
CREATE TABLE auth_security_policy_command (
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  policy_id uuid NOT NULL REFERENCES auth_security_policy(id) ON DELETE RESTRICT,
  result_revision integer NOT NULL CHECK (result_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_account_id,idempotency_key)
);
-- Revisions are append-only even when application code changes later.
CREATE FUNCTION cg01_deny_security_policy_revision_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Security policy revision history is immutable';
END;
$$;
CREATE TRIGGER cg01_policy_revision_immutable BEFORE UPDATE OR DELETE
  ON auth_security_policy_revision FOR EACH ROW
  EXECUTE FUNCTION cg01_deny_security_policy_revision_change();
