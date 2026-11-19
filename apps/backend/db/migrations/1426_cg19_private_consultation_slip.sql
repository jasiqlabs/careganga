-- CG-19 US-005 private original consultation PDF/QR issuance.
-- New version after confirmed reschedule has a new immutable source/QR.
-- A booking display ID or QR status token never grants private file access.
CREATE TABLE cg19_consultation_slip (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision>0),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 issued_by_account uuid NOT NULL,
 issue_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'PENDING'
  CHECK(status IN('PENDING','UNKNOWN','ISSUED','REVOKED')),
 qr_digest char(64) NOT NULL CHECK(qr_digest ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 30 AND 240),
 object_version text,
 content_sha256 char(64),
 content_length integer CHECK(content_length IS NULL OR content_length BETWEEN 100 AND 10485760),
 issued_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,appointment_id,source_revision),
 UNIQUE(root_realm_id,issued_by_account,issue_key),
 UNIQUE(qr_digest),
 UNIQUE(object_key),
 FOREIGN KEY(root_realm_id,appointment_id)
   REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by_account,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='ISSUED')=(object_version IS NOT NULL AND
  content_sha256 IS NOT NULL AND content_length IS NOT NULL AND issued_at IS NOT NULL)
  OR status IN('UNKNOWN','REVOKED'))
);
CREATE INDEX ix_cg19_slip_by_patient_booking
 ON cg19_consultation_slip(root_realm_id,appointment_id,source_revision DESC);
CREATE INDEX ix_cg19_slip_qr_status
 ON cg19_consultation_slip(qr_digest,status);

CREATE FUNCTION cg19_consultation_slip_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Issued consultation records cannot be deleted'; END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.id IS DISTINCT FROM OLD.id OR
  NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR
  NEW.source_revision IS DISTINCT FROM OLD.source_revision OR
  NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
  NEW.issued_by_account IS DISTINCT FROM OLD.issued_by_account OR
  NEW.issue_key IS DISTINCT FROM OLD.issue_key OR
  NEW.qr_digest IS DISTINCT FROM OLD.qr_digest OR
  NEW.object_key IS DISTINCT FROM OLD.object_key OR
  NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Original consultation slip source is immutable';
 END IF;
 IF OLD.status='ISSUED' AND (
  NEW.object_version IS DISTINCT FROM OLD.object_version OR
  NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR
  NEW.content_length IS DISTINCT FROM OLD.content_length OR
  NEW.issued_at IS DISTINCT FROM OLD.issued_at) THEN
  RAISE EXCEPTION 'Issued PDF bytes cannot be replaced';
 END IF;
 IF NOT ((OLD.status='PENDING' AND NEW.status IN('PENDING','UNKNOWN','ISSUED')) OR
  (OLD.status='UNKNOWN' AND NEW.status IN('UNKNOWN','ISSUED')) OR
  (OLD.status='ISSUED' AND NEW.status IN('ISSUED','REVOKED')) OR
  (OLD.status='REVOKED' AND NEW.status='REVOKED')) THEN
  RAISE EXCEPTION 'Invalid consultation slip transition';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_consultation_slip_source_frozen BEFORE UPDATE OR DELETE
 ON cg19_consultation_slip FOR EACH ROW EXECUTE FUNCTION cg19_consultation_slip_source_guard();
