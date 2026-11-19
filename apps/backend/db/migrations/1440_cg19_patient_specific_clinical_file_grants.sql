-- Original CG15 US-003/US-008: patient explicitly opts-in to a
-- specific scanned CG19 file being read only for one existing consultation.
-- This is not a general family/center/doctor blanket file permission.
-- The recipient is computed live from that appointment + CG14 professional
-- identity; patient never grants to an arbitrary phone/account/center.
ALTER TABLE cg15_consultation_appointment
 ADD CONSTRAINT uq_cg15_patient_clinical_share_source
 UNIQUE(root_realm_id,id,patient_id);

CREATE TABLE cg19_patient_clinical_file_grant(
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 file_id uuid NOT NULL,
 appointment_id uuid NOT NULL,
 granted_by_account uuid NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE'
  CHECK(status IN('ACTIVE','REVOKED')),
 granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,id,patient_id),
 FOREIGN KEY(realm_id,file_id,patient_id)
  REFERENCES cg19_patient_private_file(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,appointment_id,patient_id)
  REFERENCES cg15_consultation_appointment(root_realm_id,id,patient_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(granted_by_account,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='ACTIVE' AND revoked_at IS NULL) OR
  (status='REVOKED' AND revoked_at IS NOT NULL)),
 CHECK(revoked_at IS NULL OR revoked_at>=granted_at)
);
CREATE UNIQUE INDEX ux_cg19_active_patient_clinical_file_grant
 ON cg19_patient_clinical_file_grant(realm_id,patient_id,file_id,appointment_id)
 WHERE status='ACTIVE';
CREATE INDEX ix_cg19_patient_booking_file_grants
 ON cg19_patient_clinical_file_grant(realm_id,appointment_id,patient_id,id)
 WHERE status='ACTIVE';

CREATE TABLE cg19_patient_clinical_file_grant_event(
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 grant_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN('GRANTED','REVOKED')),
 actor_account_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,grant_id,action),
 FOREIGN KEY(realm_id,grant_id)
  REFERENCES cg19_patient_clinical_file_grant(realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg19_patient_clinical_file_grant_event_immutable()
 RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Original clinical file sharing history cannot be rewritten';
END; $$;
CREATE TRIGGER cg19_patient_clinical_file_grant_event_guard
 BEFORE UPDATE OR DELETE ON cg19_patient_clinical_file_grant_event
 FOR EACH ROW EXECUTE FUNCTION cg19_patient_clinical_file_grant_event_immutable();

CREATE FUNCTION cg19_patient_clinical_file_grant_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
    NEW.file_id IS DISTINCT FROM OLD.file_id OR
    NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR
    NEW.granted_by_account IS DISTINCT FROM OLD.granted_by_account OR
    NEW.granted_at IS DISTINCT FROM OLD.granted_at OR
    OLD.status<>'ACTIVE' OR NEW.status<>'REVOKED' OR
    NEW.revision<>OLD.revision+1 OR
    NEW.revoked_at IS NULL THEN
  RAISE EXCEPTION 'Original patient clinical file permission identity cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_patient_clinical_file_grant_change_guard
 BEFORE UPDATE ON cg19_patient_clinical_file_grant
 FOR EACH ROW EXECUTE FUNCTION cg19_patient_clinical_file_grant_frozen();
COMMENT ON TABLE cg19_patient_clinical_file_grant IS
 'Patient-accepted file read only for original booked clinician at actual center, while live care consent and CG01/CG14 authority remain valid';
