-- CG-15 US-003: a verified CG-01 account may own one patient profile.
-- No self-service account/OTP bypass and no auto-merge by shared family phone.
CREATE TABLE cg15_patient (
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  virtual_display_id text NOT NULL CHECK(virtual_display_id ~ '^CGP-[A-F0-9]{16}$'),
  first_name text NOT NULL CHECK(length(trim(first_name)) BETWEEN 2 AND 100),
  last_name text NOT NULL CHECK(length(trim(last_name)) BETWEEN 1 AND 100),
  date_of_birth date,
  profile_status text NOT NULL DEFAULT 'VERIFIED'
    CHECK(profile_status IN ('PROVISIONAL','VERIFIED','RESTRICTED','ARCHIVED')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_by_account uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(root_realm_id,id),
  UNIQUE(root_realm_id,virtual_display_id),
  CHECK(date_of_birth IS NULL OR
    date_of_birth BETWEEN DATE '1900-01-01' AND DATE '2100-01-01'),
  FOREIGN KEY(created_by_account,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_patient_root_status
 ON cg15_patient(root_realm_id,profile_status,id);

CREATE TABLE cg15_patient_account_link (
  root_realm_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  account_id uuid NOT NULL,
  proof_type text NOT NULL CHECK(proof_type='CG01_VERIFIED_ACCOUNT_CONTACT'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY(root_realm_id,id),
  FOREIGN KEY(root_realm_id,patient_id)
    REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(account_id,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(revoked_at IS NULL OR revoked_at>=verified_at)
);
CREATE UNIQUE INDEX ux_cg15_patient_one_active_self_account
 ON cg15_patient_account_link(root_realm_id,account_id)
 WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX ux_cg15_patient_one_active_owner
 ON cg15_patient_account_link(root_realm_id,patient_id)
 WHERE revoked_at IS NULL;

CREATE TABLE cg15_patient_registration_command (
  root_realm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL
    CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  patient_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(root_realm_id,account_id,request_key),
  FOREIGN KEY(account_id,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(root_realm_id,patient_id)
    REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_patient_command_created
 ON cg15_patient_registration_command(root_realm_id,created_at DESC);

CREATE TABLE cg15_patient_consent (
  root_realm_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  revision_no integer NOT NULL CHECK(revision_no > 0),
  purpose text NOT NULL CHECK(purpose='PATIENT_CARE'),
  terms_version text NOT NULL CHECK(length(terms_version) BETWEEN 1 AND 32),
  granted boolean NOT NULL,
  recorded_by_account uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(root_realm_id,id),
  UNIQUE(root_realm_id,patient_id,purpose,revision_no),
  FOREIGN KEY(root_realm_id,patient_id)
    REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(recorded_by_account,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_patient_current_consent
 ON cg15_patient_consent(root_realm_id,patient_id,purpose,revision_no DESC);

CREATE TABLE cg15_patient_change_event (
  root_realm_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  revision_no integer NOT NULL CHECK(revision_no>0),
  action text NOT NULL CHECK(action IN ('REGISTERED','PROFILE_UPDATED','CONSENT_GRANTED','CONSENT_WITHDRAWN')),
  actor_account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(root_realm_id,id),
  UNIQUE(root_realm_id,patient_id,revision_no),
  FOREIGN KEY(root_realm_id,patient_id)
    REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_account_id,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_patient_events
 ON cg15_patient_change_event(root_realm_id,patient_id,created_at DESC,id DESC);
-- Source events and consent history cannot be retroactively rewritten.
CREATE FUNCTION cg15_patient_history_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Patient consent and source history are immutable';
END; $$;
CREATE TRIGGER cg15_patient_consent_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_consent
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_history_immutable();
CREATE TRIGGER cg15_patient_event_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_change_event
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_history_immutable();
