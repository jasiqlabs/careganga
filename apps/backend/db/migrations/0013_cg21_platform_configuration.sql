-- CG-21 / US-001. Additive, root-scoped platform settings and integration
-- metadata only. CG-01 continues to own identity/security policy/access audit.
CREATE TABLE platform_setting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  setting_key text NOT NULL CHECK(setting_key='audit.default_page_size'),
  typed_value integer NOT NULL CHECK(typed_value BETWEEN 10 AND 100),
  revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647),
  updated_by uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(foundation_realm_id,setting_key),
  FOREIGN KEY(updated_by,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE platform_setting_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_id uuid NOT NULL REFERENCES platform_setting(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
  safe_value integer NOT NULL CHECK(safe_value BETWEEN 10 AND 100),
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  correlation_ref uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(setting_id,revision)
);
CREATE TABLE integration_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  scope_kind text NOT NULL DEFAULT 'FOUNDATION' CHECK(scope_kind='FOUNDATION'),
  provider text NOT NULL CHECK(provider ~ '^[a-z][a-z0-9_-]{1,62}$'),
  purpose text NOT NULL CHECK(purpose ~ '^[a-z][a-z0-9_-]{1,62}$'),
  -- Only a pointer to a separately operated secret store; never a credential.
  secret_reference text NOT NULL CHECK(
    length(secret_reference) BETWEEN 20 AND 240
    AND secret_reference ~ '^secretref:[A-Za-z0-9/_-]+$'
  ),
  credential_revision integer NOT NULL DEFAULT 1 CHECK(credential_revision BETWEEN 1 AND 2147483647),
  revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647),
  verification_status text NOT NULL DEFAULT 'CONFIGURED_NOT_VERIFIED'
    CHECK(verification_status IN('CONFIGURED_NOT_VERIFIED','VERIFIED','FAILED','UNAVAILABLE')),
  last_checked_at timestamptz,
  last_checked_credential_revision integer,
  last_result_class text CHECK(last_result_class IS NULL OR
    last_result_class IN('CHECK_ACCEPTED','CHECK_FAILED','ADAPTER_UNAVAILABLE')),
  updated_by uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope_kind,foundation_realm_id,provider,purpose),
  FOREIGN KEY(updated_by,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((last_checked_at IS NULL AND last_checked_credential_revision IS NULL
      AND last_result_class IS NULL)
    OR (last_checked_at IS NOT NULL AND last_checked_credential_revision IS NOT NULL
      AND last_result_class IS NOT NULL)),
  CHECK(verification_status<>'VERIFIED' OR
    (last_checked_credential_revision=credential_revision
     AND last_result_class='CHECK_ACCEPTED' AND last_checked_at IS NOT NULL))
);
CREATE TABLE platform_operation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  action_key text NOT NULL CHECK(action_key IN
    ('platform.setting.save','platform.integration.configure','platform.integration.check')),
  resource_ref uuid NOT NULL,
  outcome text NOT NULL CHECK(outcome IN('SUCCESS','UNAVAILABLE')),
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(safe_context)='object'),
  correlation_ref uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(actor_account_id,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg21_platform_audit_root_time
  ON platform_operation_audit(foundation_realm_id,occurred_at DESC,id DESC);
CREATE TABLE platform_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN('SETTING_SAVE','INTEGRATION_REFERENCE')),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  resource_ref uuid NOT NULL,
  result_revision integer NOT NULL CHECK(result_revision BETWEEN 1 AND 2147483647),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_account_id,action,request_key),
  FOREIGN KEY(actor_account_id,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg21_platform_command_actor
  ON platform_command(actor_account_id,created_at DESC);
CREATE FUNCTION cg21_immutable_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CG-21 security history is append-only';
END;
$$;
CREATE TRIGGER cg21_setting_revision_immutable
  BEFORE UPDATE OR DELETE ON platform_setting_revision
  FOR EACH ROW EXECUTE FUNCTION cg21_immutable_history();
CREATE TRIGGER cg21_operation_audit_immutable
  BEFORE UPDATE OR DELETE ON platform_operation_audit
  FOR EACH ROW EXECUTE FUNCTION cg21_immutable_history();
