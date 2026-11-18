-- US005: extend original CG19 scanner-backed support-case private attachments.
-- Never create a second ticket/file master or public object store.
ALTER TABLE cg19_upload_intent
 ADD COLUMN support_case_id uuid,
 ADD CONSTRAINT fk_cg19_original_support_intent FOREIGN KEY(support_case_id,realm_id)
 REFERENCES cg19_support_case(id,realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_support_upload_source UNIQUE
 (id,realm_id,support_case_id,health_center_id,health_source_version);
ALTER TABLE cg19_stored_file
 ADD COLUMN support_case_id uuid,
 ADD CONSTRAINT fk_cg19_original_support_file FOREIGN KEY(support_case_id,realm_id)
 REFERENCES cg19_support_case(id,realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_support_file_matches_upload FOREIGN KEY
 (upload_intent_id,realm_id,support_case_id,health_center_id,health_source_version)
 REFERENCES cg19_upload_intent
 (id,realm_id,support_case_id,health_center_id,health_source_version)
 ON DELETE RESTRICT;
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_upload_intent_owner_kind_check,
 DROP CONSTRAINT cg19_intent_branch_source,
 DROP CONSTRAINT cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_upload_intent_owner_kind_check CHECK(
  owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR',
   'CG14_CENTER_CONTENT','CG19_SUPPORT')),
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
   proposal_revision=health_source_version)
  OR (owner_kind='CG19_SUPPORT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NOT NULL AND
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
   classification IN('HEALTH_CENTER_PHOTO','HEALTH_CENTER_LOGO'))
  OR (owner_kind='CG19_SUPPORT' AND classification='SUPPORT_CASE_ATTACHMENT'));

ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_support_upload_exact_presence CHECK(
 (owner_kind='CG19_SUPPORT' AND support_case_id IS NOT NULL) OR
 (owner_kind<>'CG19_SUPPORT' AND support_case_id IS NULL));
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_stored_file_owner_kind_check,
 DROP CONSTRAINT cg19_file_branch_source;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_stored_file_owner_kind_check CHECK(
  owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR',
   'CG14_CENTER_CONTENT','CG19_SUPPORT')),
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
   proposal_revision=health_source_version)
  OR (owner_kind='CG19_SUPPORT' AND case_id IS NULL AND
   registration_id IS NULL AND registration_draft_version IS NULL AND
   health_provider_id IS NULL AND health_center_id IS NOT NULL AND
   health_doctor_id IS NULL AND health_source_version>0 AND
   proposal_revision=health_source_version));

ALTER TABLE cg19_stored_file ADD CONSTRAINT cg19_support_file_exact_presence CHECK(
 (owner_kind='CG19_SUPPORT' AND support_case_id IS NOT NULL) OR
 (owner_kind<>'CG19_SUPPORT' AND support_case_id IS NULL));
CREATE INDEX ix_cg19_support_attachment_intent
 ON cg19_upload_intent(realm_id,support_case_id,created_at DESC,id DESC)
 WHERE owner_kind='CG19_SUPPORT';
CREATE INDEX ix_cg19_support_attachment_file
 ON cg19_stored_file(realm_id,support_case_id,created_at DESC,id DESC)
 WHERE owner_kind='CG19_SUPPORT';
CREATE OR REPLACE FUNCTION cg19_support_attachment_source_frozen()
 RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.support_case_id IS DISTINCT FROM OLD.support_case_id
 THEN RAISE EXCEPTION 'Support file case cannot be reassigned'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_support_intent_owner_frozen
 BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
 EXECUTE FUNCTION cg19_support_attachment_source_frozen();
CREATE TRIGGER cg19_support_file_owner_frozen
 BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
 EXECUTE FUNCTION cg19_support_attachment_source_frozen();
CREATE TABLE cg19_support_attachment_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 support_case_id uuid NOT NULL,
 center_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED',
  'UPLOAD_REJECTED','FILE_REVOKED')),
 intent_ref uuid,
 file_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(support_case_id,realm_id)
 REFERENCES cg19_support_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,center_id)
 REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id)
 REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id)
 REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(file_ref,realm_id)
 REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 CHECK(num_nonnulls(intent_ref,file_ref)=1)
);
CREATE INDEX ix_cg19_support_attachment_audit
 ON cg19_support_attachment_event(realm_id,support_case_id,created_at DESC,id);
CREATE TRIGGER cg19_support_attachment_event_frozen
 BEFORE UPDATE OR DELETE ON cg19_support_attachment_event
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
