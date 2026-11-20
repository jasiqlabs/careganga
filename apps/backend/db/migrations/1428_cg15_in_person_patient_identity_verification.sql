-- CG-15 US-003: person-specific identity evidence. Existing CG01 phone proof
-- identifies an account, NOT the clinical patient. Reception can attest an
-- in-person document match only with the actual signed-in patient's short
-- lived challenge. Never merge patients because they share a mobile number.
CREATE TABLE cg15_patient_identity_challenge(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 issued_by_account uuid NOT NULL,
 token_digest char(64) NOT NULL CHECK(token_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,id,patient_id),
 UNIQUE(token_digest),
 CHECK(expires_at>created_at),
 CHECK(used_at IS NULL OR used_at>=created_at),
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg15_identity_one_current_challenge
 ON cg15_patient_identity_challenge(root_realm_id,patient_id) WHERE used_at IS NULL;
CREATE INDEX ix_cg15_identity_challenge_due
 ON cg15_patient_identity_challenge(root_realm_id,expires_at) WHERE used_at IS NULL;

CREATE TABLE cg15_patient_identity_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 center_id uuid NOT NULL,
 challenge_id uuid NOT NULL,
 verified_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 identity_checked_in_person boolean NOT NULL CHECK(identity_checked_in_person),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,patient_id),
 UNIQUE(root_realm_id,verified_by_account,request_key),
 FOREIGN KEY(root_realm_id,challenge_id,patient_id)
  REFERENCES cg15_patient_identity_challenge(root_realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_patient_identity_proof
 ON cg15_patient_identity_event(root_realm_id,patient_id,created_at DESC);
CREATE TRIGGER cg15_patient_identity_event_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_identity_event
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_history_immutable();

ALTER TABLE cg15_patient_change_event
 DROP CONSTRAINT cg15_patient_change_event_action_check;
ALTER TABLE cg15_patient_change_event
 ADD CONSTRAINT cg15_patient_change_event_action_check
 CHECK(action IN('REGISTERED','PROFILE_UPDATED','CONSENT_GRANTED',
  'CONSENT_WITHDRAWN','IDENTITY_VERIFIED'));
