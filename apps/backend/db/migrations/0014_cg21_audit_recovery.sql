-- CG-21 / US-002. Recovery is a real, guarded operational record, not a
-- fabricated restore. The default adapter reports NOT_AVAILABLE.
ALTER TABLE platform_operation_audit
  DROP CONSTRAINT platform_operation_audit_action_key_check;
ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check
  CHECK(action_key IN ('platform.setting.save','platform.integration.configure',
    'platform.integration.check','platform.recovery.request'));
CREATE TABLE recovery_operation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  operation_type text NOT NULL CHECK(operation_type='RESTORE_REQUEST'),
  -- Only stable externally issued secured-facility backup references, not secrets.
  backup_reference text NOT NULL CHECK (
    length(backup_reference) BETWEEN 16 AND 180 AND
    backup_reference ~ '^backupref:[A-Za-z0-9/_-]+$'
  ),
  requested_by uuid NOT NULL,
  authorized_by uuid,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN
    ('REQUESTED','PRIVILEGED_AUTHORIZED','RUNNING','VERIFIED_SUCCEEDED','FAILED','UNKNOWN')),
  provider_operation_ref text,
  verified_proof_ref text,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(foundation_realm_id,request_key),
  FOREIGN KEY(requested_by,foundation_realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(authorized_by,foundation_realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT,
  CHECK(authorized_by IS NULL OR status<>'REQUESTED'),
  CHECK(status<>'RUNNING' OR provider_operation_ref IS NOT NULL),
  CHECK(status<>'VERIFIED_SUCCEEDED' OR
    (provider_operation_ref IS NOT NULL AND verified_proof_ref IS NOT NULL))
);
CREATE INDEX ix_cg21_recovery_root_time
  ON recovery_operation(foundation_realm_id,requested_at DESC,id DESC);
CREATE INDEX ix_cg21_recovery_root_status
  ON recovery_operation(foundation_realm_id,status,updated_at DESC);
-- This developer-owned API may never assert that external restore completed.
-- Only a later, independently verified adapter and production operations
-- authorization can progress the record beyond REQUESTED.
CREATE FUNCTION cg21_recovery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- A plain application/DB session cannot mark a restore as running or
  -- successful. A later verified operations adapter must bring its own
  -- separately reviewed migration/privileged execution path.
  IF NEW.status IN ('RUNNING','VERIFIED_SUCCEEDED') THEN
    RAISE EXCEPTION 'Recovery execution requires a verified operations adapter';
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.foundation_realm_id<>OLD.foundation_realm_id OR
    NEW.backup_reference<>OLD.backup_reference OR
    NEW.request_key<>OLD.request_key OR NEW.requested_by<>OLD.requested_by
  ) THEN
    RAISE EXCEPTION 'Recovery identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cg21_recovery_state_guard BEFORE INSERT OR UPDATE ON recovery_operation
  FOR EACH ROW EXECUTE FUNCTION cg21_recovery_guard();
