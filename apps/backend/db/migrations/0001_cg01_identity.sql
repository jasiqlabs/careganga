-- CG-01 only: Foundation-root identity authority; no future branch, HR or healthcare tables.
-- Applied once, inside one transaction by db/migrate.ts.
CREATE TABLE access_realm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_key text NOT NULL UNIQUE CHECK (realm_key = 'FOUNDATION_ROOT'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 160),
  normalized_email text NOT NULL UNIQUE CHECK (normalized_email = lower(trim(normalized_email))),
  email_verified_at timestamptz,
  status text NOT NULL CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','DEACTIVATED')),
  access_version bigint NOT NULL DEFAULT 1 CHECK (access_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_credential (
  account_id uuid PRIMARY KEY REFERENCES account(id) ON DELETE RESTRICT,
  password_hash text NOT NULL,
  totp_ciphertext bytea,
  totp_nonce bytea,
  totp_tag bytea,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complete_totp_cipher CHECK (
    (totp_ciphertext IS NULL AND totp_nonce IS NULL AND totp_tag IS NULL)
    OR (totp_ciphertext IS NOT NULL AND totp_nonce IS NOT NULL AND totp_tag IS NOT NULL)
  )
);

CREATE TABLE role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  name text NOT NULL,
  normalized_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color_key text,
  is_protected boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (realm_id, normalized_name)
);
CREATE TABLE role_grant (
  role_id uuid NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
  capability_key text NOT NULL CHECK (capability_key ~ '^identity\\.[a-z0-9.-]+$'),
  PRIMARY KEY (role_id,capability_key)
);
CREATE TABLE account_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES account(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);
CREATE UNIQUE INDEX ux_cg01_active_assignment ON account_role(account_id,realm_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_cg01_assignment_role ON account_role(role_id) WHERE revoked_at IS NULL;

CREATE TABLE auth_challenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES account(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('INVITATION','RECOVERY','CONTACT_VERIFY')),
  digest char(64) NOT NULL UNIQUE CHECK (digest ~ '^[0-9a-f]{64}$'),
  request_key char(64) NOT NULL UNIQUE CHECK (request_key ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX ix_cg01_challenge_expiry ON auth_challenge(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE auth_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  token_digest char(64) NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  account_access_version bigint NOT NULL CHECK (account_access_version > 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  mfa_verified_at timestamptz,
  revoked_at timestamptz,
  device_label text CHECK (device_label IS NULL OR length(device_label) <= 60),
  CHECK (expires_at > issued_at)
);
CREATE INDEX ix_cg01_session_current ON auth_session(account_id,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX ix_cg01_session_digest_current ON auth_session(token_digest) WHERE revoked_at IS NULL;

-- No plain email/contact in the throttle table; HMAC keyed identifier only.
CREATE TABLE auth_login_attempt (
  key_digest char(64) PRIMARY KEY CHECK (key_digest ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0)
);

CREATE TABLE access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_account_id uuid REFERENCES account(id) ON DELETE RESTRICT,
  target_account_id uuid REFERENCES account(id) ON DELETE RESTRICT,
  action_key text NOT NULL CHECK (length(action_key) BETWEEN 4 AND 120),
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','PENDING')),
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_ref uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cg01_audit_realm_time ON access_audit(realm_id,occurred_at DESC,id DESC);
