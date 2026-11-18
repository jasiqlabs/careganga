-- CG-21-owned approved wording overrides: edit copy, never validation, auth, or codes.
-- Added by CG-09 integration for owner-mandated actionable/error wording.
CREATE TABLE platform_error_message(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 message_key text NOT NULL CHECK(message_key ~ '^[A-Z][A-Z0-9_]{2,90}$'),
 safe_message text NOT NULL CHECK(char_length(btrim(safe_message)) BETWEEN 16 AND 220
   AND position(E'\n' IN safe_message)=0 AND position(E'\r' IN safe_message)=0
   AND position('<' IN safe_message)=0 AND position('>' IN safe_message)=0),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(foundation_realm_id,message_key),
 UNIQUE(id,foundation_realm_id),
 FOREIGN KEY(updated_by,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE platform_error_message_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL REFERENCES platform_error_message(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0),
 safe_message text NOT NULL CHECK(char_length(btrim(safe_message)) BETWEEN 16 AND 220),
 actor_ref uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
 changed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(message_id,revision)
);
CREATE TABLE platform_error_message_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 message_key text NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 result_revision integer NOT NULL CHECK(result_revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(foundation_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,foundation_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg21_message_history_immutable
 BEFORE UPDATE OR DELETE ON platform_error_message_revision FOR EACH ROW
 EXECUTE FUNCTION cg21_immutable_history();
CREATE TRIGGER cg21_message_command_immutable
 BEFORE UPDATE OR DELETE ON platform_error_message_command FOR EACH ROW
 EXECUTE FUNCTION cg21_immutable_history();
ALTER TABLE platform_operation_audit DROP CONSTRAINT platform_operation_audit_action_key_check;
ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check
 CHECK(action_key IN('platform.setting.save','platform.integration.configure',
   'platform.integration.check','platform.recovery.request','platform.message.update'));
