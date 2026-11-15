-- CG-21 / US-002: conditional root authorization of an existing request.
-- No external restore execution is introduced by this migration.
ALTER TABLE platform_operation_audit
  DROP CONSTRAINT platform_operation_audit_action_key_check;
ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check
  CHECK(action_key IN ('platform.setting.save','platform.integration.configure',
    'platform.integration.check','platform.recovery.request','platform.recovery.authorize'));
-- Enforce the recovery root at the FK level, not only through application guards.
ALTER TABLE recovery_operation
  ADD CONSTRAINT ux_cg21_recovery_id_realm UNIQUE(id,foundation_realm_id);
CREATE TABLE recovery_authorization_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  recovery_operation_id uuid NOT NULL,

  actor_account_id uuid NOT NULL,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  result_version integer NOT NULL CHECK(result_version>1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(foundation_realm_id,request_key),
  FOREIGN KEY(recovery_operation_id,foundation_realm_id)
    REFERENCES recovery_operation(id,foundation_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_account_id,foundation_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg21_authorization_operation
  ON recovery_authorization_command(recovery_operation_id,created_at DESC);
CREATE TRIGGER cg21_authorization_command_immutable
  BEFORE UPDATE OR DELETE ON recovery_authorization_command
  FOR EACH ROW EXECUTE FUNCTION cg21_immutable_history();
