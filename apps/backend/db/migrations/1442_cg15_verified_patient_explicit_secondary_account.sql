-- CG15 US-003-QA12: a verified individual can explicitly link a second
-- independently signed-in CG01 account to that SAME original patient.
-- The first active self-owner remains uniquely identified; no automatic
-- linkage via mobile, name, email, staff role or existing member association.
DROP INDEX ux_cg15_patient_one_active_owner;
ALTER TABLE cg15_patient_account_link
 DROP CONSTRAINT cg15_patient_account_link_proof_type_check;
ALTER TABLE cg15_patient_account_link
 ADD CONSTRAINT cg15_patient_account_link_proof_type_check
 CHECK(proof_type IN('CG01_VERIFIED_ACCOUNT_CONTACT','CG15_EXPLICIT_SECOND_ACCOUNT'));
CREATE UNIQUE INDEX ux_cg15_patient_one_primary_owner
 ON cg15_patient_account_link(root_realm_id,patient_id)
 WHERE revoked_at IS NULL AND proof_type='CG01_VERIFIED_ACCOUNT_CONTACT';

CREATE TABLE cg15_patient_second_account_link_code(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 issued_by_account uuid NOT NULL,
 recipient_account_id uuid NOT NULL,
 code_digest char(64) NOT NULL CHECK(code_digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 used_at timestamptz,
 used_by_account uuid,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(code_digest),
 CHECK(expires_at>created_at),
 CHECK((used_at IS NULL AND used_by_account IS NULL)
    OR (used_at IS NOT NULL AND used_by_account IS NOT NULL)),
 CHECK(used_at IS NULL OR used_at>=created_at),
 CHECK(revoked_at IS NULL OR (revoked_at>=created_at AND used_at IS NULL)),
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(used_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg15_one_active_second_account_code
 ON cg15_patient_second_account_link_code(root_realm_id,patient_id)
 WHERE revoked_at IS NULL AND used_at IS NULL;
CREATE INDEX ix_cg15_second_account_code_due
 ON cg15_patient_second_account_link_code(root_realm_id,expires_at)
 WHERE revoked_at IS NULL AND used_at IS NULL;

CREATE FUNCTION cg15_second_account_code_source_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Verified patient link proof cannot be deleted';
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
    NEW.issued_by_account IS DISTINCT FROM OLD.issued_by_account OR
    NEW.recipient_account_id IS DISTINCT FROM OLD.recipient_account_id OR
    NEW.code_digest IS DISTINCT FROM OLD.code_digest OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR
    (OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at) OR
    (OLD.used_by_account IS NOT NULL AND NEW.used_by_account IS DISTINCT FROM OLD.used_by_account) OR
    (NEW.used_at IS NOT NULL AND (NEW.revoked_at IS NOT NULL OR
     NEW.used_by_account IS NULL)) THEN
  RAISE EXCEPTION 'Verified patient link proof is immutable after use';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg15_second_account_code_source_guard
 BEFORE UPDATE OR DELETE ON cg15_patient_second_account_link_code
 FOR EACH ROW EXECUTE FUNCTION cg15_second_account_code_source_guard();

ALTER TABLE cg15_patient_change_event
 DROP CONSTRAINT cg15_patient_change_event_action_check;
ALTER TABLE cg15_patient_change_event
 ADD CONSTRAINT cg15_patient_change_event_action_check
 CHECK(action IN('REGISTERED','PROFILE_UPDATED','CONSENT_GRANTED',
  'CONSENT_WITHDRAWN','IDENTITY_VERIFIED','SECOND_ACCOUNT_LINKED'));

-- Bounded recipient proof attempts; isolated from existing center claims.
CREATE TABLE cg15_patient_second_link_attempt(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 window_started_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 2147483645),
 PRIMARY KEY(root_realm_id,account_id),
 FOREIGN KEY(account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
