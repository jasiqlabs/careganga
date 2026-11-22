-- CG04 US002 / CG19 original B41/B42, client 20-Nov source.
-- Genuine private official member cards/certificates/welcome letters with verified assets.
-- No sample signature, logo, stamp, recipient or guessed QR verification is valid.
CREATE TABLE cg19_member_brand_asset (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN('SIGNATURE','SEAL','LOGO')),
 requested_by uuid NOT NULL,request_key uuid NOT NULL,
 mime text NOT NULL CHECK(mime IN('image/png','image/jpeg')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 2097152),
 expected_sha256 char(64) NOT NULL CHECK(expected_sha256 ~ '^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 object_version text CHECK(length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text CHECK(length(scan_proof_ref) BETWEEN 8 AND 160),
 reserved_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INITIATED' CHECK(status IN('INITIATED','VALIDATED','REJECTED')),
 verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,requested_by,request_key),
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(status<>'VALIDATED' OR num_nonnulls(object_version,scan_proof_ref,verified_at)=3)
);
CREATE INDEX ix_cg19_member_brand_intent ON cg19_member_brand_asset(root_realm_id,requested_by,created_at DESC);

CREATE TABLE cg19_member_brand_config (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483646),
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 3 AND 120),
 signatory_name text NOT NULL CHECK(length(trim(signatory_name)) BETWEEN 2 AND 120),
 signature_asset_id uuid NOT NULL,seal_asset_id uuid NOT NULL,logo_asset_id uuid NOT NULL,
 approved_by uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),approved_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN('APPROVED','WITHDRAWN')),
 PRIMARY KEY(root_realm_id,version),UNIQUE(root_realm_id,approved_by,request_key),
 FOREIGN KEY(signature_asset_id,root_realm_id) REFERENCES cg19_member_brand_asset(id,root_realm_id),
 FOREIGN KEY(seal_asset_id,root_realm_id) REFERENCES cg19_member_brand_asset(id,root_realm_id),
 FOREIGN KEY(logo_asset_id,root_realm_id) REFERENCES cg19_member_brand_asset(id,root_realm_id),
 FOREIGN KEY(approved_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(signature_asset_id<>seal_asset_id AND signature_asset_id<>logo_asset_id AND seal_asset_id<>logo_asset_id)
);
CREATE UNIQUE INDEX ux_cg19_member_brand_approved ON cg19_member_brand_config(root_realm_id)
 WHERE status='APPROVED';

CREATE TABLE cg19_member_pack (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),member_id uuid NOT NULL,term_id uuid NOT NULL,
 brand_version integer NOT NULL,issue_revision integer NOT NULL CHECK(issue_revision>0),
 issue_key uuid NOT NULL,issued_by uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 qr_token_digest char(64) NOT NULL CHECK(qr_token_digest ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','VERIFYING','UNKNOWN','ISSUED','REVOKED')),
 claim_token uuid,claim_expires_at timestamptz,attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz,revoked_at timestamptz,
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,issued_by,issue_key),
 UNIQUE(root_realm_id,member_id,term_id,issue_revision),UNIQUE(qr_token_digest),
 FOREIGN KEY(root_realm_id,member_id) REFERENCES member(root_realm_id,id),
 FOREIGN KEY(root_realm_id,term_id) REFERENCES membership_term(root_realm_id,id),
 FOREIGN KEY(root_realm_id,brand_version) REFERENCES cg19_member_brand_config(root_realm_id,version),
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(state<>'ISSUED' OR issued_at IS NOT NULL),
 CHECK(state<>'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg19_member_pack_current ON cg19_member_pack(root_realm_id,member_id,term_id)
 WHERE state IN('PENDING','VERIFYING','UNKNOWN','ISSUED');
CREATE INDEX ix_cg19_member_pack_member ON cg19_member_pack(root_realm_id,member_id,created_at DESC);

CREATE TABLE cg19_member_pack_document (
 root_realm_id uuid NOT NULL,pack_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('CARD','CERTIFICATE','WELCOME')),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 object_version text CHECK(length(object_version) BETWEEN 1 AND 160),
 content_sha256 char(64) CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','ISSUED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,pack_id,kind),
 FOREIGN KEY(root_realm_id,pack_id) REFERENCES cg19_member_pack(root_realm_id,id),
 CHECK(state<>'ISSUED' OR num_nonnulls(object_version,content_sha256)=2)
);
CREATE TABLE cg19_member_pack_event (
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 pack_id uuid NOT NULL,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('PENDING','ISSUED','UNKNOWN','REVOKED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,pack_id) REFERENCES cg19_member_pack(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE FUNCTION cg19_member_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Issued member document history is immutable'; END; $$;
CREATE TRIGGER cg19_member_pack_event_immutable BEFORE UPDATE OR DELETE ON cg19_member_pack_event
 FOR EACH ROW EXECUTE FUNCTION cg19_member_immutable_event();

CREATE FUNCTION cg19_member_brand_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
  (NEW.root_realm_id,NEW.id,NEW.kind,NEW.requested_by,NEW.request_key,NEW.mime,NEW.size_bytes,NEW.expected_sha256,NEW.object_key,NEW.reserved_until)
   IS DISTINCT FROM
  (OLD.root_realm_id,OLD.id,OLD.kind,OLD.requested_by,OLD.request_key,OLD.mime,OLD.size_bytes,OLD.expected_sha256,OLD.object_key,OLD.reserved_until)
 THEN RAISE EXCEPTION 'Private brand asset identity cannot change'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='VALIDATED' AND (NEW.status,NEW.object_version,NEW.scan_proof_ref,NEW.verified_at) IS DISTINCT FROM
  (OLD.status,OLD.object_version,OLD.scan_proof_ref,OLD.verified_at)
 THEN RAISE EXCEPTION 'Verified brand proof is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_member_brand_asset_guard BEFORE UPDATE ON cg19_member_brand_asset
 FOR EACH ROW EXECUTE FUNCTION cg19_member_brand_asset_guard();

CREATE FUNCTION cg19_member_brand_config_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
  (NEW.root_realm_id,NEW.version,NEW.display_name,NEW.signatory_name,NEW.signature_asset_id,NEW.seal_asset_id,NEW.logo_asset_id,NEW.approved_by,NEW.request_key,NEW.request_digest,NEW.approved_at)
   IS DISTINCT FROM
  (OLD.root_realm_id,OLD.version,OLD.display_name,OLD.signatory_name,OLD.signature_asset_id,OLD.seal_asset_id,OLD.logo_asset_id,OLD.approved_by,OLD.request_key,OLD.request_digest,OLD.approved_at)
 THEN RAISE EXCEPTION 'Approved brand snapshot cannot change'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(
  SELECT 1 FROM cg19_member_brand_asset a
  JOIN cg19_member_brand_asset b ON b.root_realm_id=a.root_realm_id AND b.id=NEW.seal_asset_id AND b.kind='SEAL' AND b.status='VALIDATED'
  JOIN cg19_member_brand_asset c ON c.root_realm_id=a.root_realm_id AND c.id=NEW.logo_asset_id AND c.kind='LOGO' AND c.status='VALIDATED'
  WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.signature_asset_id AND a.kind='SIGNATURE' AND a.status='VALIDATED'
 ) THEN RAISE EXCEPTION 'Original verified logo, signature and seal are required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_member_brand_config_guard BEFORE INSERT OR UPDATE ON cg19_member_brand_config
 FOR EACH ROW EXECUTE FUNCTION cg19_member_brand_config_guard();

CREATE FUNCTION cg19_member_pack_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
 (NEW.root_realm_id,NEW.id,NEW.member_id,NEW.term_id,NEW.brand_version,NEW.issue_revision,NEW.issue_key,NEW.issued_by,NEW.source_snapshot,NEW.source_digest,NEW.qr_token_digest)
 IS DISTINCT FROM
 (OLD.root_realm_id,OLD.id,OLD.member_id,OLD.term_id,OLD.brand_version,OLD.issue_revision,OLD.issue_key,OLD.issued_by,OLD.source_snapshot,OLD.source_digest,OLD.qr_token_digest)
 THEN RAISE EXCEPTION 'Original member document identity cannot change'; END IF;
 IF TG_OP='UPDATE' AND OLD.state='REVOKED' AND NEW.state<>'REVOKED' THEN
 RAISE EXCEPTION 'Revoked original member pack cannot be restored'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_member_pack_integrity BEFORE UPDATE ON cg19_member_pack FOR EACH ROW EXECUTE FUNCTION cg19_member_pack_integrity();

CREATE FUNCTION cg19_member_pack_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
 (NEW.root_realm_id,NEW.pack_id,NEW.kind,NEW.object_key) IS DISTINCT FROM (OLD.root_realm_id,OLD.pack_id,OLD.kind,OLD.object_key)
 THEN RAISE EXCEPTION 'Official document identity is immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.state='ISSUED' AND (NEW.state,NEW.object_version,NEW.content_sha256) IS DISTINCT FROM (OLD.state,OLD.object_version,OLD.content_sha256)
 THEN RAISE EXCEPTION 'Issued document proof is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_member_pack_document_guard BEFORE UPDATE ON cg19_member_pack_document FOR EACH ROW
 EXECUTE FUNCTION cg19_member_pack_document_guard();
