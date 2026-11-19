-- CG19 patient-owned optional scanned evidence for original CG15 US-003/008.
-- Reuse the existing PrivateObjectStorage + external CLEAN_VERIFIED scanner:
-- only patient-scoped metadata and immutable access events live in PostgreSQL.
-- No second object store, EMR, diagnosis or clinic-prescribed prescription.
CREATE TABLE cg19_patient_file_intent(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 classification text NOT NULL CHECK(classification IN
   ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION','PATIENT_MEDICAL_REPORT')),
 mime text NOT NULL CHECK(mime IN
   ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 storage_reservation_ref text,
 reserved_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INITIATED' CHECK(status IN
  ('INITIATED','UNKNOWN','VALIDATED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,requested_by,request_key),
 UNIQUE(realm_id,id,patient_id),
 FOREIGN KEY(realm_id,patient_id)
   REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(reserved_until>created_at)
);
CREATE INDEX ix_cg19_patient_intent_recent ON cg19_patient_file_intent
 (realm_id,patient_id,created_at DESC,id DESC);
CREATE TABLE cg19_patient_private_file(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 intent_id uuid NOT NULL,
 classification text NOT NULL CHECK(classification IN
  ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION','PATIENT_MEDICAL_REPORT')),
 mime text NOT NULL CHECK(mime IN
  ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE,
 object_version text NOT NULL CHECK(length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text NOT NULL CHECK(length(scan_proof_ref) BETWEEN 8 AND 160),
 scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),
 scanned_at timestamptz NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,intent_id),
 FOREIGN KEY(realm_id,intent_id,patient_id)
  REFERENCES cg19_patient_file_intent(realm_id,id,patient_id) ON DELETE RESTRICT,
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX ix_cg19_patient_file_recent ON cg19_patient_private_file
 (realm_id,patient_id,created_at DESC,id DESC)
 WHERE revoked_at IS NULL;
CREATE TABLE cg19_patient_file_event(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 intent_id uuid NOT NULL,
 file_id uuid,
 actor_account_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN
  ('INTENT_CREATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','FILE_REVOKED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 FOREIGN KEY(realm_id,intent_id,patient_id)
  REFERENCES cg19_patient_file_intent(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,file_id)
  REFERENCES cg19_patient_private_file(realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((file_id IS NULL AND action='INTENT_CREATED') OR
  (file_id IS NOT NULL AND action<>'INTENT_CREATED'))
);
CREATE INDEX ix_cg19_patient_file_events ON cg19_patient_file_event
 (realm_id,patient_id,created_at DESC,id DESC);
CREATE FUNCTION cg19_patient_file_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Patient file audit events cannot be modified';
END; $$;
CREATE TRIGGER cg19_patient_file_event_frozen BEFORE UPDATE OR DELETE
 ON cg19_patient_file_event FOR EACH ROW
 EXECUTE FUNCTION cg19_patient_file_event_immutable();
CREATE FUNCTION cg19_patient_file_identity_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'revision'-'revoked_at')
    IS DISTINCT FROM (to_jsonb(OLD)-'revision'-'revoked_at') THEN
  RAISE EXCEPTION 'Scanned original patient file identity cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_patient_scanned_file_frozen BEFORE UPDATE
 ON cg19_patient_private_file FOR EACH ROW
 EXECUTE FUNCTION cg19_patient_file_identity_frozen();
COMMENT ON TABLE cg19_patient_private_file IS
 'Patient-owned, scanner-verified private object metadata in existing CG19 storage; never a diagnosis or clinician-issued prescription';
