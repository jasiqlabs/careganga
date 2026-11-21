-- CG-19 original patient-owned private files: scanned identity photo,
-- patient-supplied prescription copy and existing medical report.
-- REUSE the original CG-19 private object adapter, independent malware scan,
-- verified object version and storage SHA. No public blob, clinical EMR,
-- clinician-written prescription, ABHA claim or cross-center file grant.
-- Keep patient owner history separate from the CG03 case-file FK tables.
CREATE TABLE cg19_patient_file_intent(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 classification text NOT NULL CHECK(classification IN
  ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION','PATIENT_MEDICAL_REPORT')),
 mime text NOT NULL CHECK(mime IN
  ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 reserved_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INITIATED' CHECK(status IN
  ('INITIATED','UNKNOWN','VALIDATED','REJECTED')),
 storage_reservation_ref text CHECK(storage_reservation_ref IS NULL OR
  length(storage_reservation_ref) BETWEEN 1 AND 160),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,requested_by,request_key),
 UNIQUE(realm_id,id,patient_id),
 FOREIGN KEY(realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(classification<>'PATIENT_PHOTO' OR mime<>'application/pdf'),
 CHECK(reserved_until>created_at)
);
CREATE INDEX ix_cg19_patient_intent_history
 ON cg19_patient_file_intent(realm_id,patient_id,created_at DESC,id DESC);
CREATE INDEX ix_cg19_patient_intent_reserved
 ON cg19_patient_file_intent(reserved_until,id)
 WHERE status IN('INITIATED','UNKNOWN');

CREATE TABLE cg19_patient_private_file(
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 intent_id uuid NOT NULL,
 classification text NOT NULL CHECK(classification IN
  ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION','PATIENT_MEDICAL_REPORT')),
 mime text NOT NULL CHECK(mime IN
  ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 object_version text NOT NULL CHECK(length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text NOT NULL CHECK(length(scan_proof_ref) BETWEEN 8 AND 160),
 scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),
 scanned_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,intent_id),
 UNIQUE(realm_id,id,patient_id),
 FOREIGN KEY(realm_id,intent_id,patient_id)
  REFERENCES cg19_patient_file_intent(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX ix_cg19_patient_file_history
 ON cg19_patient_private_file(realm_id,patient_id,created_at DESC,id DESC);
CREATE INDEX ix_cg19_patient_file_active
 ON cg19_patient_private_file(realm_id,patient_id,id)
 WHERE revoked_at IS NULL;

-- Immutable source/account/scanner/object identity, revocation by CAS only.
CREATE FUNCTION cg19_patient_private_source_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
    NEW.intent_id IS DISTINCT FROM OLD.intent_id OR
    NEW.classification IS DISTINCT FROM OLD.classification OR
    NEW.mime IS DISTINCT FROM OLD.mime OR
    NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
    NEW.sha256 IS DISTINCT FROM OLD.sha256 OR
    NEW.object_key IS DISTINCT FROM OLD.object_key OR
    NEW.object_version IS DISTINCT FROM OLD.object_version OR
    NEW.scan_proof_ref IS DISTINCT FROM OLD.scan_proof_ref OR
    NEW.scan_status IS DISTINCT FROM OLD.scan_status OR
    NEW.scanned_at IS DISTINCT FROM OLD.scanned_at OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR
    NEW.revision<>OLD.revision+1 OR
    (OLD.revoked_at IS NULL AND NEW.revoked_at IS NULL) THEN
  RAISE EXCEPTION 'Original patient private object identity cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_patient_private_file_identity_guard
 BEFORE UPDATE ON cg19_patient_private_file
 FOR EACH ROW EXECUTE FUNCTION cg19_patient_private_source_immutable();

CREATE FUNCTION cg19_patient_intent_source_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
    NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
    NEW.classification IS DISTINCT FROM OLD.classification OR
    NEW.mime IS DISTINCT FROM OLD.mime OR
    NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
    NEW.sha256 IS DISTINCT FROM OLD.sha256 OR
    NEW.object_key IS DISTINCT FROM OLD.object_key OR
    NEW.reserved_until IS DISTINCT FROM OLD.reserved_until OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Original patient upload source cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_patient_private_intent_guard
 BEFORE UPDATE ON cg19_patient_file_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_patient_intent_source_immutable();

CREATE TABLE cg19_patient_file_event(
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 intent_id uuid NOT NULL,
 file_id uuid,
 actor_account_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN
  ('INTENT_CREATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','FILE_REVOKED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 FOREIGN KEY(realm_id,intent_id,patient_id)
  REFERENCES cg19_patient_file_intent(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,file_id,patient_id)
  REFERENCES cg19_patient_private_file(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((action IN('INTENT_CREATED','UPLOAD_REJECTED') AND file_id IS NULL)
  OR (action IN('UPLOAD_VERIFIED','FILE_REVOKED') AND file_id IS NOT NULL))
);
CREATE INDEX ix_cg19_patient_file_events
 ON cg19_patient_file_event(realm_id,patient_id,occurred_at,id);
CREATE FUNCTION cg19_patient_file_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Patient private document event history is append-only';
END; $$;
CREATE TRIGGER cg19_patient_file_event_immutable_guard
 BEFORE UPDATE OR DELETE ON cg19_patient_file_event FOR EACH ROW
 EXECUTE FUNCTION cg19_patient_file_event_immutable();

COMMENT ON TABLE cg19_patient_private_file IS
 'CG19 verified private objects supplied by the patient; no clinician authored e-prescription, no public URL or automatic clinical sharing';
