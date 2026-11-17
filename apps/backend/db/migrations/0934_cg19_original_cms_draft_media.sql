-- CG-18 US-001: CG-19-owned early CMS draft uploads, before CG-03 case.
-- Uses the SAME configured CG-19 S3/Firebase storage+scanner; NO public bucket,
-- duplicate filesystem or fake 'uploaded' state. Root/content revision bound.
CREATE TABLE cg19_cms_upload_intent(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_id uuid NOT NULL,
 page_revision_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[0-9a-f]{64}$'),
 original_mime text NOT NULL CHECK(original_mime IN('image/png','image/jpeg','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 expected_sha256 char(64) NOT NULL CHECK(expected_sha256~'^[0-9a-f]{64}$'),
 object_key text NOT NULL UNIQUE CHECK(length(object_key)<=240),
 reserved_until timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'INITIATED'
  CHECK(status IN('INITIATED','UNKNOWN','VALIDATED','REJECTED','EXPIRED')),
 rights_confirmed boolean NOT NULL CHECK(rights_confirmed=true),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,realm_id),
 UNIQUE(realm_id,owner_id,request_key),
 FOREIGN KEY(realm_id,page_id,page_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,page_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg19_cms_media_file(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 upload_intent_id uuid NOT NULL UNIQUE,
 page_id uuid NOT NULL,
 page_revision_id uuid NOT NULL,
 original_mime text NOT NULL,
 verified_sha256 char(64) NOT NULL CHECK(verified_sha256~'^[0-9a-f]{64}$'),
 verified_size_bytes bigint NOT NULL CHECK(verified_size_bytes BETWEEN 1 AND 10485760),
 object_key text NOT NULL,
 object_version text NOT NULL CHECK(length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text NOT NULL CHECK(length(scan_proof_ref) BETWEEN 8 AND 160),
 scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),
 scanned_at timestamptz NOT NULL,
 public_rights_confirmed boolean NOT NULL CHECK(public_rights_confirmed=true),
 revoked_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,realm_id),
 UNIQUE(id,realm_id,page_revision_id),
 FOREIGN KEY(upload_intent_id,realm_id)
  REFERENCES cg19_cms_upload_intent(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,page_id,page_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,page_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_cms_media_revision
 ON cg19_cms_media_file(realm_id,page_revision_id,revoked_at,id);
CREATE INDEX ix_cg19_cms_intents_due
 ON cg19_cms_upload_intent(reserved_until,id)
 WHERE status IN('INITIATED','UNKNOWN');
ALTER TABLE cms_asset_placement ADD CONSTRAINT fk_cg18_cg19_original_media
 FOREIGN KEY(cg19_file_ref,foundation_root_id,page_revision_id)
 REFERENCES cg19_cms_media_file(id,realm_id,page_revision_id) ON DELETE RESTRICT;
CREATE FUNCTION cg19_cms_file_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'revoked_at'-'revision')
    IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revision') OR
   (TG_OP='UPDATE' AND (NEW.revoked_at IS NULL OR OLD.revoked_at IS NOT NULL OR
      NEW.revision<>OLD.revision+1)) THEN
  RAISE EXCEPTION 'CMS media evidence is immutable except one rights revocation'
    USING ERRCODE='P1834';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_cms_file_frozen BEFORE UPDATE OR DELETE
 ON cg19_cms_media_file FOR EACH ROW EXECUTE FUNCTION cg19_cms_file_immutable();
