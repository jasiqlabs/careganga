-- CG15 original US-003-QA07: optional patient-supplied blood group,
-- emergency contact and non-authoritative health description. Never an EMR,
-- clinical diagnosis, patient identity match, or center-wide directory.
-- All user-entered details are a single AES-256-GCM authenticated ciphertext.
CREATE TABLE cg15_patient_private_details(
 root_realm_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 private_ciphertext bytea NOT NULL CHECK(octet_length(private_ciphertext) BETWEEN 2 AND 8192),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=12),
 auth_tag bytea NOT NULL CHECK(octet_length(auth_tag)=16),
 key_version text NOT NULL CHECK(key_version='v1'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by_account uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
COMMENT ON TABLE cg15_patient_private_details IS
 'Patient-authored encrypted optional care context; never automatic proof of diagnosis, blood transfusion eligibility, center access or account link';
CREATE TABLE cg15_patient_private_details_event(
 root_realm_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 actor_account_id uuid NOT NULL,
 action text NOT NULL CHECK(action='UPDATED'),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,patient_id,revision),
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg15_patient_private_details_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Private patient changes have an append-only event history';
END; $$;
CREATE TRIGGER cg15_patient_private_details_event_guard
 BEFORE UPDATE OR DELETE ON cg15_patient_private_details_event
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_private_details_event_immutable();
