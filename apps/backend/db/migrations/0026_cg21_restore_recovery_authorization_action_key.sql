-- CG-21 / US-002: Restore 'platform.recovery.authorize' action key dropped in migration 0025.
-- Forward-only migration ensuring compatibility across all deployed/migrated databases.
ALTER TABLE platform_operation_audit
  DROP CONSTRAINT platform_operation_audit_action_key_check;
ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check
  CHECK(action_key IN (
    'platform.setting.save',
    'platform.integration.configure',
    'platform.integration.check',
    'platform.recovery.request',
    'platform.recovery.authorize',
    'platform.message.update'
  ));
