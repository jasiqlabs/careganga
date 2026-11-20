-- CG16 US002 / CG19 original staff-issued LAB RESULT evidence.
-- A patient-owned uploaded document is NOT an independently issued lab
-- report. Use the one existing CG19 secure object adapter/malware scanner.
-- No public URL, self-approval, payment, Foundation benefit or fake release.
CREATE TABLE cg19_lab_result_intent(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
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
 UNIQUE(root_realm_id,id,order_ref,patient_ref,result_revision_ref),
 UNIQUE(root_realm_id,requested_by,request_key),
 CHECK(reserved_until>created_at),
 FOREIGN KEY(root_realm_id,order_ref,center_ref,patient_ref)
  REFERENCES lab_order(root_realm_id,id,center_ref,patient_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_lab_result_intent_due
 ON cg19_lab_result_intent(root_realm_id,reserved_until)
 WHERE status IN('INITIATED','UNKNOWN');

CREATE TABLE cg19_lab_result_file(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 intent_ref uuid NOT NULL,
 order_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
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
 UNIQUE(root_realm_id,result_revision_ref),
 UNIQUE(root_realm_id,result_revision_ref,id),
 UNIQUE(root_realm_id,intent_ref),
 FOREIGN KEY(root_realm_id,intent_ref,order_ref,patient_ref,result_revision_ref)
  REFERENCES cg19_lab_result_intent
   (root_realm_id,id,order_ref,patient_ref,result_revision_ref)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,center_ref,patient_ref)
  REFERENCES lab_order(root_realm_id,id,center_ref,patient_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);

-- Original CG19 lab report metadata must be tied to the SAME verified
-- original upload claim before any CG16 result can be marked RESULT_READY.
CREATE FUNCTION cg19_lab_result_file_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM cg19_lab_result_intent intent
  WHERE intent.root_realm_id=NEW.root_realm_id
   AND intent.id=NEW.intent_ref AND intent.status='VALIDATED'
   AND intent.order_ref=NEW.order_ref AND intent.center_ref=NEW.center_ref
   AND intent.patient_ref=NEW.patient_ref
   AND intent.result_revision_ref=NEW.result_revision_ref
   AND intent.mime=NEW.mime AND intent.size_bytes=NEW.size_bytes
   AND intent.sha256=NEW.sha256 AND intent.object_key=NEW.object_key
 ) THEN
  RAISE EXCEPTION 'Verified laboratory file requires original matching upload';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_lab_result_file_original_source
 BEFORE INSERT ON cg19_lab_result_file FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_result_file_source_guard();

CREATE INDEX ix_cg19_lab_result_protected
 ON cg19_lab_result_file(root_realm_id,order_ref,result_revision_ref,id)
 WHERE revoked_at IS NULL;

CREATE TABLE cg19_lab_result_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 intent_ref uuid NOT NULL,
 file_ref uuid,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN
  ('UPLOAD_INTENT','SCAN_VERIFIED','SCAN_REJECTED','FILE_REVOKED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,intent_ref)
  REFERENCES cg19_lab_result_intent(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,file_ref)
  REFERENCES cg19_lab_result_file(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((action IN('UPLOAD_INTENT','SCAN_REJECTED') AND file_ref IS NULL)
 OR (action IN('SCAN_VERIFIED','FILE_REVOKED') AND file_ref IS NOT NULL))
);
CREATE INDEX ix_cg19_lab_result_event
 ON cg19_lab_result_event(root_realm_id,intent_ref,occurred_at DESC,id DESC);

CREATE FUNCTION cg19_lab_result_event_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 RAISE EXCEPTION 'Original laboratory file event is immutable';
END $cg19$;
CREATE TRIGGER cg19_lab_result_event_immutable
 BEFORE UPDATE OR DELETE ON cg19_lab_result_event FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_result_event_frozen();

CREATE FUNCTION cg19_lab_result_identity_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' OR
  (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM
  (to_jsonb(OLD)-'revoked_at') OR
  (OLD.revoked_at IS NOT NULL AND
   NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
  RAISE EXCEPTION 'Original scanner verified lab report identity is immutable';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_lab_result_file_frozen BEFORE UPDATE OR DELETE
 ON cg19_lab_result_file FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_result_identity_frozen();

CREATE FUNCTION cg19_lab_result_intent_identity_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' OR
  (to_jsonb(NEW)-'status'-'reservation_ref'-'updated_at') IS DISTINCT FROM
  (to_jsonb(OLD)-'status'-'reservation_ref'-'updated_at') OR
  (OLD.status IN('VALIDATED','REJECTED') AND
   (NEW.status IS DISTINCT FROM OLD.status OR
    NEW.reservation_ref IS DISTINCT FROM OLD.reservation_ref)) THEN
  RAISE EXCEPTION 'Original lab report upload intent cannot be rewritten';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_lab_result_intent_frozen BEFORE UPDATE OR DELETE
 ON cg19_lab_result_intent FOR EACH ROW
 EXECUTE FUNCTION cg19_lab_result_intent_identity_frozen();

-- The existing CG16 result row is a DRAFT until a real CG19 scanned file
-- exists; allow precisely ONE source-backed attachment. All fields,
-- including the original order, operator and correction pointer, remain
-- immutable through this transition. Later clinical approval/release use
-- separate original independent reviewer and issued-document sources.
ALTER TABLE lab_result_revision
 DROP CONSTRAINT lab_result_revision_result_state_check,
 DROP CONSTRAINT lab_result_revision_check;
ALTER TABLE lab_result_revision
 ADD CONSTRAINT cg16_result_verified_evidence_state CHECK(
  (result_state='DRAFT' AND original_cg19_file_ref IS NULL
   AND report_digest IS NULL)
  OR (result_state='RESULT_READY' AND original_cg19_file_ref IS NOT NULL
   AND report_digest ~ '^[a-f0-9]{64}$')
 );
ALTER TABLE lab_result_revision
 ADD CONSTRAINT fk_cg16_original_cg19_result
 FOREIGN KEY(root_realm_id,id,original_cg19_file_ref)
 REFERENCES cg19_lab_result_file(root_realm_id,result_revision_ref,id)
 ON DELETE RESTRICT;
DROP TRIGGER cg16_result_revision_frozen ON lab_result_revision;
CREATE FUNCTION cg16_result_once_verified() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR OLD.result_state<>'DRAFT' OR
  NEW.result_state<>'RESULT_READY' OR
  NEW.original_cg19_file_ref IS NULL OR NEW.report_digest IS NULL OR
  (to_jsonb(NEW)-'result_state'-'original_cg19_file_ref'-'report_digest')
   IS DISTINCT FROM
  (to_jsonb(OLD)-'result_state'-'original_cg19_file_ref'-'report_digest') OR
  NOT EXISTS(
   SELECT 1 FROM cg19_lab_result_file f
   JOIN cg19_lab_result_intent intent
    ON intent.root_realm_id=f.root_realm_id AND intent.id=f.intent_ref
   WHERE f.root_realm_id=NEW.root_realm_id AND f.id=NEW.original_cg19_file_ref
    AND f.result_revision_ref=NEW.id AND f.order_ref=NEW.order_ref
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND intent.status='VALIDATED' AND f.sha256=NEW.report_digest
  ) THEN
  RAISE EXCEPTION 'Result readiness requires exact original scanner verified CG19 report';
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_result_revision_verified_once
 BEFORE UPDATE OR DELETE ON lab_result_revision FOR EACH ROW
 EXECUTE FUNCTION cg16_result_once_verified();
