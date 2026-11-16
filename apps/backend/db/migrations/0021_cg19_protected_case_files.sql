-- CG-19 / US-001: first real private case-file and document authority.
-- This migration only references already delivered CG-01 and CG-03 tables.
-- No file/blob bytes are kept in PostgreSQL; no public or future-owner master.
CREATE TABLE cg19_upload_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL,
  proposal_revision integer NOT NULL CHECK(proposal_revision > 0),
  requested_by uuid NOT NULL,
  request_key uuid NOT NULL,
  mime text NOT NULL CHECK(mime IN (
    'application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  expected_sha256 char(64) NOT NULL CHECK(expected_sha256 ~ '^[0-9a-f]{64}$'),
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  classification text NOT NULL CHECK(classification IN (
    'PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE')),
  status text NOT NULL DEFAULT 'INITIATED' CHECK(status IN (
    'INITIATED','VERIFYING','VALIDATED','REJECTED','UNKNOWN','EXPIRED')),
  object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
  storage_reservation_ref text CHECK(length(storage_reservation_ref) BETWEEN 1 AND 160),
  reserved_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,requested_by,request_key),
  UNIQUE(id,realm_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(requested_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_intent_case
  ON cg19_upload_intent(realm_id,case_id,proposal_revision,created_at DESC,id DESC);
CREATE INDEX ix_cg19_intent_expiry
  ON cg19_upload_intent(reserved_until,id)
  WHERE status IN('INITIATED','VERIFYING','UNKNOWN');

CREATE TABLE cg19_stored_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  upload_intent_id uuid NOT NULL UNIQUE,
  case_id uuid NOT NULL,
  proposal_revision integer NOT NULL CHECK(proposal_revision>0),
  original_mime text NOT NULL CHECK(original_mime IN (
    'application/pdf','image/jpeg','image/png','image/webp')),
  verified_sha256 char(64) NOT NULL CHECK(verified_sha256 ~ '^[0-9a-f]{64}$'),
  verified_size_bytes bigint NOT NULL CHECK(verified_size_bytes BETWEEN 1 AND 10485760),
  object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
  object_version text NOT NULL CHECK(length(object_version) BETWEEN 1 AND 160),
  scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(id,realm_id),
  FOREIGN KEY(upload_intent_id,realm_id)
    REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX ix_cg19_file_case
  ON cg19_stored_file(realm_id,case_id,proposal_revision,created_at DESC,id DESC);

CREATE TABLE cg19_document_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  template_kind text NOT NULL CHECK(template_kind='PRIVATE_APPROVED_ACCESS_LETTER'),
  version integer NOT NULL CHECK(version>0),
  content_sha256 char(64) NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
  approved_by uuid NOT NULL,
  status text NOT NULL CHECK(status IN('APPROVED','WITHDRAWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,template_kind,version),
  UNIQUE(id,realm_id),
  FOREIGN KEY(approved_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TABLE cg19_generated_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL,
  proposal_revision integer NOT NULL CHECK(proposal_revision>0),
  template_id uuid NOT NULL,
  template_version integer NOT NULL CHECK(template_version>0),
  issue_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  issued_by uuid NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN(
    'PENDING','VERIFYING','ISSUED','UNKNOWN','FAILED','REVOKED')),
  object_key text UNIQUE CHECK(object_key IS NULL OR length(object_key) BETWEEN 24 AND 255),
  object_version text CHECK(object_version IS NULL OR length(object_version) BETWEEN 1 AND 160),
  content_sha256 char(64) CHECK(content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  revoked_at timestamptz,
  UNIQUE(realm_id,case_id,proposal_revision,template_id,template_version,issue_key),
  UNIQUE(id,realm_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(template_id,realm_id) REFERENCES cg19_document_template(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(issued_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(state<>'ISSUED' OR
    (object_key IS NOT NULL AND object_version IS NOT NULL AND
      content_sha256 IS NOT NULL AND issued_at IS NOT NULL)),
  CHECK(state<>'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE INDEX ix_cg19_document_case
  ON cg19_generated_document(realm_id,case_id,created_at DESC,id DESC);

CREATE TABLE cg19_document_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  intent_id uuid,
  file_id uuid,
  document_id uuid,
  event_key text NOT NULL CHECK(event_key IN(
    'UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN',
    'FILE_REVOKED','ISSUE_PENDING','ISSUED','ISSUE_UNKNOWN','REVOKED')),
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(intent_id,realm_id) REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(file_id,realm_id) REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(document_id,realm_id)
    REFERENCES cg19_generated_document(id,realm_id) ON DELETE RESTRICT,
  CHECK(num_nonnulls(intent_id,file_id,document_id) BETWEEN 1 AND 2)
);
CREATE INDEX ix_cg19_doc_events_case
  ON cg19_document_event(realm_id,case_id,occurred_at,id);
CREATE FUNCTION cg19_document_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Private file and document history is immutable';
END; $$;
CREATE TRIGGER cg19_document_event_immutable_guard
  BEFORE UPDATE OR DELETE ON cg19_document_event
  FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();
CREATE FUNCTION cg19_document_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
     NEW.case_id IS DISTINCT FROM OLD.case_id OR
     NEW.proposal_revision IS DISTINCT FROM OLD.proposal_revision OR
     NEW.upload_intent_id IS DISTINCT FROM OLD.upload_intent_id OR
     NEW.object_key IS DISTINCT FROM OLD.object_key OR
     NEW.object_version IS DISTINCT FROM OLD.object_version OR
     NEW.verified_sha256 IS DISTINCT FROM OLD.verified_sha256 OR
     NEW.verified_size_bytes IS DISTINCT FROM OLD.verified_size_bytes OR
     NEW.original_mime IS DISTINCT FROM OLD.original_mime OR
     NEW.created_by IS DISTINCT FROM OLD.created_by THEN
     RAISE EXCEPTION 'Verified private object identity cannot be changed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg19_file_identity_frozen
  BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
  EXECUTE FUNCTION cg19_document_identity_frozen();
