-- CG15 US-004-QA11: original patient-authorized consultation reason/purpose.
-- Encrypted patient-entered optional reason and original immutable consent
-- snapshot. Never put sensitive text in booking, event, slip, QR, notification
-- or plain database JSON. No EMR/prescription/clinical decision record.
CREATE TABLE cg15_consultation_private_intent(
 root_realm_id uuid NOT NULL,
 appointment_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 purpose text NOT NULL DEFAULT 'PATIENT_CARE'
  CHECK(purpose='PATIENT_CARE'),
 consent_revision integer NOT NULL CHECK(consent_revision>0),
 consent_terms_version text NOT NULL CHECK(length(consent_terms_version) BETWEEN 1 AND 32),
 consent_recorded_at timestamptz NOT NULL,
 reason_ciphertext bytea,
 reason_iv bytea,
 reason_auth_tag bytea,
 key_version text,
 recorded_by_account uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,appointment_id),
 FOREIGN KEY(root_realm_id,appointment_id)
  REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id,purpose,consent_revision)
  REFERENCES cg15_patient_consent(root_realm_id,patient_id,purpose,revision_no)
  ON DELETE RESTRICT,
 CHECK((reason_ciphertext IS NULL AND reason_iv IS NULL AND
   reason_auth_tag IS NULL AND key_version IS NULL)
   OR (reason_ciphertext IS NOT NULL AND length(reason_ciphertext)>0
     AND octet_length(reason_ciphertext)<=8192
     AND octet_length(reason_iv)=12
     AND octet_length(reason_auth_tag)=16 AND key_version='v1'))
);
-- The original consent event and this booking-specific snapshot cannot be
-- silently mutated after confirmation. Revocation gates future reads separately.
CREATE FUNCTION cg15_consultation_private_intent_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Patient consultation purpose and consent snapshot are immutable';
END; $$;
CREATE TRIGGER cg15_private_intent_history_guard
 BEFORE UPDATE OR DELETE ON cg15_consultation_private_intent
 FOR EACH ROW EXECUTE FUNCTION cg15_consultation_private_intent_immutable();
COMMENT ON TABLE cg15_consultation_private_intent IS
 'Original consent version and optional AES-256-GCM private patient reason, captured atomically with consultation confirmation';
