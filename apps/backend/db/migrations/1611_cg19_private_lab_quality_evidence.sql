-- CG16 US005 evidence is a narrow CG19 private-file extension using the
-- existing S3/Firebase + ClamAV adapter, not a second object store.
CREATE TABLE cg19_lab_quality_intent(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 equipment_ref uuid NOT NULL,
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 document_kind text NOT NULL CHECK(document_kind IN
  ('MAINTENANCE','CALIBRATION','QUALITY_CERTIFICATE')),
 mime text NOT NULL CHECK(mime='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 reservation_ref text,
 reserved_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INITIATED'
  CHECK(status IN('INITIATED','UNKNOWN','VALIDATED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,requested_by,request_key),
 UNIQUE(root_realm_id,id,center_ref,equipment_ref),
 FOREIGN KEY(root_realm_id,center_ref,equipment_ref)
  REFERENCES lab_equipment(root_realm_id,center_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_lab_quality_intent_owner
 ON cg19_lab_quality_intent(root_realm_id,center_ref,equipment_ref,
 created_at DESC,id DESC);
CREATE TABLE cg19_lab_quality_file(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 intent_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 equipment_ref uuid NOT NULL,
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 mime text NOT NULL CHECK(mime='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 object_key text NOT NULL UNIQUE,
 object_version text NOT NULL CHECK(length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text NOT NULL CHECK(length(scan_proof_ref) BETWEEN 8 AND 160),
 scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),
 scanned_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_ref,equipment_ref,id),
 UNIQUE(root_realm_id,intent_ref),
 FOREIGN KEY(root_realm_id,intent_ref,center_ref,equipment_ref)
  REFERENCES cg19_lab_quality_intent(root_realm_id,id,center_ref,equipment_ref)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_ref,equipment_ref)
  REFERENCES lab_equipment(root_realm_id,center_ref,id) ON DELETE RESTRICT,
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
ALTER TABLE lab_equipment
 ADD CONSTRAINT fk_cg16_equipment_current_verified_quality
 FOREIGN KEY(root_realm_id,center_ref,id,evidence_file_ref)
 REFERENCES cg19_lab_quality_file(root_realm_id,center_ref,equipment_ref,id)
 ON DELETE RESTRICT;
ALTER TABLE lab_equipment_event
 ADD CONSTRAINT fk_cg16_event_original_verified_quality
 FOREIGN KEY(root_realm_id,center_ref,equipment_ref,evidence_file_ref)
 REFERENCES cg19_lab_quality_file(root_realm_id,center_ref,equipment_ref,id)
 ON DELETE RESTRICT;

CREATE FUNCTION cg19_lab_quality_file_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM cg19_lab_quality_intent intent
  WHERE intent.root_realm_id=NEW.root_realm_id AND intent.id=NEW.intent_ref
   AND intent.status='VALIDATED' AND intent.center_ref=NEW.center_ref
   AND intent.equipment_ref=NEW.equipment_ref AND intent.mime=NEW.mime
   AND intent.size_bytes=NEW.size_bytes AND intent.sha256=NEW.sha256
   AND intent.object_key=NEW.object_key
 ) THEN
  RAISE EXCEPTION 'Quality file requires exact validated CG19 upload intent';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_lab_quality_file_original_source
 BEFORE INSERT ON cg19_lab_quality_file FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_quality_file_source_guard();
CREATE FUNCTION cg19_lab_quality_file_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' OR
  (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM
  (to_jsonb(OLD)-'revoked_at') OR
  (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
 THEN RAISE EXCEPTION 'Private quality file identity cannot be rewritten';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_lab_quality_file_immutable
 BEFORE UPDATE OR DELETE ON cg19_lab_quality_file FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_quality_file_immutable();

CREATE FUNCTION cg16_equipment_ready_requires_quality() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF NEW.readiness='READY' THEN
  IF NEW.status<>'ACTIVE' OR NEW.evidence_file_ref IS NULL OR
     NEW.calibration_due_on IS NULL OR
     NEW.calibration_due_on<(now() AT TIME ZONE 'Asia/Kolkata')::date OR
     NOT EXISTS(SELECT 1 FROM cg19_lab_quality_file f
      JOIN cg19_lab_quality_intent intent
       ON intent.root_realm_id=f.root_realm_id AND
          intent.id=f.intent_ref AND intent.status='VALIDATED'
      WHERE f.root_realm_id=NEW.root_realm_id AND f.center_ref=NEW.center_ref
       AND f.equipment_ref=NEW.id AND f.id=NEW.evidence_file_ref
       AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'Ready equipment requires genuine clean scanned quality evidence';
  END IF;
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_equipment_ready_proof_guard
 BEFORE UPDATE ON lab_equipment FOR EACH ROW
 EXECUTE FUNCTION cg16_equipment_ready_requires_quality();
