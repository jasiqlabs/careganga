-- CG-15 US-008-QA10: capture specific in-person guardian/dependent
-- authorization evidence only for the original PROVISIONAL INTAKE.
-- Does not create a CG01 family account link, verified patient identity,
-- clinical file access, future appointment authority or general guardianship.
-- CG15 intake's existing PK is (root_realm_id,id) and does not
-- provide the four-column unique key required by the dependent evidence FK.
-- Add the exact-source candidate key before creating the dependent table.
ALTER TABLE cg15_patient_center_intake
 ADD CONSTRAINT uq_cg15_center_intake_identity_for_dependents
 UNIQUE(root_realm_id,id,patient_id,center_id);

CREATE TABLE cg15_patient_dependent_intake_authorization (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 intake_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 center_id uuid NOT NULL,
 recorded_by_account uuid NOT NULL,
 relationship text NOT NULL CHECK(relationship IN
  ('PARENT','LEGAL_GUARDIAN','AUTHORIZED_REPRESENTATIVE')),
 context text NOT NULL DEFAULT 'PROVISIONAL_INTAKE'
  CHECK(context='PROVISIONAL_INTAKE'),
 identity_checked_in_person boolean NOT NULL CHECK(identity_checked_in_person=true),
 authority_checked_in_person boolean NOT NULL CHECK(authority_checked_in_person=true),
 limited_consent_attested boolean NOT NULL CHECK(limited_consent_attested=true),
 consent_version text NOT NULL CHECK(length(consent_version) BETWEEN 1 AND 32),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,intake_id),
 FOREIGN KEY(root_realm_id,intake_id,patient_id,center_id)
  REFERENCES cg15_patient_center_intake(root_realm_id,id,patient_id,center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_dependent_intake_authorization_patient
 ON cg15_patient_dependent_intake_authorization
 (root_realm_id,patient_id,center_id,recorded_at DESC);
CREATE TRIGGER cg15_dependent_intake_authorization_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_dependent_intake_authorization
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_history_immutable();
COMMENT ON TABLE cg15_patient_dependent_intake_authorization IS
 'Own-center staff attestation of in-person representative identity, authority, and limited provisional intake consent. Not verified guardianship or general patient access.';
