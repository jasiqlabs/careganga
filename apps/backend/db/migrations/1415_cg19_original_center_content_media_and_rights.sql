-- CG14 US005: extend ORIGINAL CG19 private scanner/media authority for
-- verified center-content photos. No new bucket, downloader or public upload.
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_upload_intent_owner_kind_check,
 DROP CONSTRAINT cg19_intent_branch_source,
 DROP CONSTRAINT cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_upload_intent_owner_kind_check CHECK(
  owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR',
   'CG14_CENTER_CONTENT')),
 ADD CONSTRAINT cg19_intent_branch_source CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NULL AND health_source_version IS NULL)
  OR (owner_kind='CG02_DRAFT' AND case_id IS NULL AND
   registration_id IS NOT NULL AND registration_draft_version>0 AND
   proposal_revision=registration_draft_version AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NULL AND health_source_version IS NULL)
  OR (owner_kind='CG14_DRAFT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NOT NULL AND health_doctor_id IS NULL AND
   health_source_version>0 AND proposal_revision=health_source_version)
  OR (owner_kind='CG14_DOCTOR' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NOT NULL AND health_source_version>0 AND
   proposal_revision=health_source_version)
  OR (owner_kind='CG14_CENTER_CONTENT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NOT NULL AND health_center_id IS NOT NULL AND
   health_doctor_id IS NULL AND health_source_version>0 AND
   proposal_revision=health_source_version)),
 ADD CONSTRAINT cg19_intent_source_classification CHECK(
  (owner_kind='CG03_CASE' AND
   classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
  OR (owner_kind='CG02_DRAFT' AND
   classification IN('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  OR (owner_kind='CG14_DRAFT' AND
   ((health_center_id IS NULL AND
    classification IN('HEALTH_PROVIDER_REGISTRATION','HEALTH_BANK_PROOF'))
    OR (health_center_id IS NOT NULL AND classification='HEALTH_CENTER_LICENSE')))
  OR (owner_kind='CG14_DOCTOR' AND
   classification IN('HEALTH_DOCTOR_LICENSE','HEALTH_DOCTOR_PORTRAIT'))
  OR (owner_kind='CG14_CENTER_CONTENT' AND
   classification IN('HEALTH_CENTER_PHOTO','HEALTH_CENTER_LOGO')));
CREATE INDEX ix_cg19_center_content_uploads
 ON cg19_upload_intent(realm_id,health_center_id,created_at DESC,id DESC)
 WHERE owner_kind='CG14_CENTER_CONTENT';
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_stored_file_owner_kind_check,
 DROP CONSTRAINT cg19_file_branch_source;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_stored_file_owner_kind_check CHECK(
  owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR',
   'CG14_CENTER_CONTENT')),
 ADD CONSTRAINT cg19_file_branch_source CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NULL AND health_source_version IS NULL)
  OR (owner_kind='CG02_DRAFT' AND case_id IS NULL AND
   registration_id IS NOT NULL AND registration_draft_version>0 AND
   proposal_revision=registration_draft_version AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NULL AND health_source_version IS NULL)
  OR (owner_kind='CG14_DRAFT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NOT NULL AND health_doctor_id IS NULL AND
   health_source_version>0 AND proposal_revision=health_source_version)
  OR (owner_kind='CG14_DOCTOR' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NULL AND
   health_doctor_id IS NOT NULL AND health_source_version>0 AND
   proposal_revision=health_source_version)
  OR (owner_kind='CG14_CENTER_CONTENT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NOT NULL AND health_center_id IS NOT NULL AND
   health_doctor_id IS NULL AND health_source_version>0 AND
   proposal_revision=health_source_version));
CREATE INDEX ix_cg19_center_content_files
 ON cg19_stored_file(realm_id,health_center_id,created_at DESC,id DESC)
 WHERE owner_kind='CG14_CENTER_CONTENT';
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT uq_cg19_center_content_media_owner
 UNIQUE(id,realm_id,health_center_id);
CREATE TABLE cg19_center_content_media_rights(
 file_ref uuid PRIMARY KEY,
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 rights_basis text NOT NULL
  CHECK(rights_basis IN('OWNED_ORIGINAL','DOCUMENTED_CONSENT')),
 rights_holder text NOT NULL CHECK(length(btrim(rights_holder)) BETWEEN 3 AND 120),
 alt_text text NOT NULL CHECK(length(btrim(alt_text)) BETWEEN 5 AND 180),
 attested_by uuid NOT NULL,
 attested_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 FOREIGN KEY(file_ref,root_realm_id,center_id)
  REFERENCES cg19_stored_file(id,realm_id,health_center_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(attested_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_center_media_live
 ON cg19_center_content_media_rights(root_realm_id,center_id,attested_at DESC,file_ref)
 WHERE revoked_at IS NULL;
CREATE FUNCTION cg19_center_media_rights_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR
  NEW.file_ref IS DISTINCT FROM OLD.file_ref OR
  NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.center_id IS DISTINCT FROM OLD.center_id OR
  NEW.rights_basis IS DISTINCT FROM OLD.rights_basis OR
  NEW.rights_holder IS DISTINCT FROM OLD.rights_holder OR
  NEW.alt_text IS DISTINCT FROM OLD.alt_text OR
  NEW.attested_by IS DISTINCT FROM OLD.attested_by OR
  NEW.attested_at IS DISTINCT FROM OLD.attested_at OR
  (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR
  (NEW.revoked_at IS NULL AND NEW.version<>OLD.version) OR
  (NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL AND NEW.version<>OLD.version+1)
 THEN RAISE EXCEPTION 'Original photo publication consent cannot be rewritten'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_center_media_rights_guard
 BEFORE UPDATE OR DELETE ON cg19_center_content_media_rights
 FOR EACH ROW EXECUTE FUNCTION cg19_center_media_rights_immutable();
