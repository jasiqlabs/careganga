-- CG-14 US-003: CG-19 remains the original private upload/scanner/file owner.
-- Add a doctor-specific source identity; never attach a global professional
-- license to an arbitrary provider/center or create a second object store.
-- Existing CG03, CG02 and CG14 provider/center upload contracts are preserved.

ALTER TABLE cg19_upload_intent
 ADD COLUMN health_doctor_id uuid,
 ADD CONSTRAINT cg19_doctor_intent_fk
   FOREIGN KEY(health_doctor_id,realm_id)
   REFERENCES health_doctor(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_doctor_intent_identity
   UNIQUE(id,realm_id,health_doctor_id,health_source_version);
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_upload_intent_owner_kind_check,
 DROP CONSTRAINT cg19_intent_branch_source,
 DROP CONSTRAINT cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_upload_intent_owner_kind_check CHECK(
   owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR')),
 ADD CONSTRAINT cg19_intent_branch_source CHECK(
   (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NULL AND health_source_version IS NULL)
   OR
   (owner_kind='CG02_DRAFT' AND case_id IS NULL AND
    registration_id IS NOT NULL AND registration_draft_version>0 AND
    proposal_revision=registration_draft_version AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NULL AND health_source_version IS NULL)
   OR
   (owner_kind='CG14_DRAFT' AND case_id IS NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NOT NULL AND health_doctor_id IS NULL AND
    health_source_version>0 AND proposal_revision=health_source_version)
   OR
   (owner_kind='CG14_DOCTOR' AND case_id IS NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NOT NULL AND health_source_version>0 AND
    proposal_revision=health_source_version)
 ),
 ADD CONSTRAINT cg19_intent_source_classification CHECK(
   (owner_kind='CG03_CASE' AND
    classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
   OR (owner_kind='CG02_DRAFT' AND
    classification IN('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
   OR (owner_kind='CG14_DRAFT' AND
    ((health_center_id IS NULL AND
      classification IN('HEALTH_PROVIDER_REGISTRATION','HEALTH_BANK_PROOF'))
     OR (health_center_id IS NOT NULL AND
      classification='HEALTH_CENTER_LICENSE')))
   OR (owner_kind='CG14_DOCTOR' AND classification='HEALTH_DOCTOR_LICENSE')
 );
CREATE INDEX ix_cg19_doctor_intents
 ON cg19_upload_intent(realm_id,health_doctor_id,created_at DESC,id DESC)
 WHERE owner_kind='CG14_DOCTOR';

ALTER TABLE cg19_stored_file
 ADD COLUMN health_doctor_id uuid,
 ADD CONSTRAINT cg19_doctor_file_fk FOREIGN KEY(health_doctor_id,realm_id)
   REFERENCES health_doctor(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_doctor_file_intent_fk
   FOREIGN KEY(upload_intent_id,realm_id,health_doctor_id,health_source_version)
   REFERENCES cg19_upload_intent(id,realm_id,health_doctor_id,health_source_version)
   ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_doctor_file_identity
   UNIQUE(id,realm_id,health_doctor_id,health_source_version);
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_stored_file_owner_kind_check,
 DROP CONSTRAINT cg19_file_branch_source;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_stored_file_owner_kind_check CHECK(
   owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT','CG14_DOCTOR')),
 ADD CONSTRAINT cg19_file_branch_source CHECK(
   (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NULL AND health_source_version IS NULL)
   OR
   (owner_kind='CG02_DRAFT' AND case_id IS NULL AND
    registration_id IS NOT NULL AND registration_draft_version>0 AND
    proposal_revision=registration_draft_version AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NULL AND health_source_version IS NULL)
   OR
   (owner_kind='CG14_DRAFT' AND case_id IS NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NOT NULL AND health_doctor_id IS NULL AND
    health_source_version>0 AND proposal_revision=health_source_version)
   OR
   (owner_kind='CG14_DOCTOR' AND case_id IS NULL AND
    registration_id IS NULL AND registration_draft_version IS NULL AND
    health_provider_id IS NULL AND health_center_id IS NULL AND
    health_doctor_id IS NOT NULL AND health_source_version>0 AND
    proposal_revision=health_source_version)
 );
CREATE INDEX ix_cg19_doctor_private_files
 ON cg19_stored_file(realm_id,health_doctor_id,created_at DESC,id DESC)
 WHERE owner_kind='CG14_DOCTOR';

ALTER TABLE cg19_document_event
 ADD COLUMN health_doctor_id uuid,
 ADD CONSTRAINT cg19_doctor_event_fk FOREIGN KEY(health_doctor_id,realm_id)
   REFERENCES health_doctor(id,root_realm_id) ON DELETE RESTRICT;
ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_source;
ALTER TABLE cg19_document_event
 ADD CONSTRAINT cg19_doc_event_source CHECK(
   num_nonnulls(case_id,registration_id,health_provider_id,health_doctor_id)=1
 );
CREATE INDEX ix_cg19_doctor_file_events
 ON cg19_document_event(realm_id,health_doctor_id,occurred_at,id)
 WHERE health_doctor_id IS NOT NULL;

-- Preserve original immutability and include the doctor identity in it.
CREATE OR REPLACE FUNCTION cg19_health_intent_identity_frozen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id OR
    NEW.health_center_id IS DISTINCT FROM OLD.health_center_id OR
    NEW.health_doctor_id IS DISTINCT FROM OLD.health_doctor_id OR
    NEW.health_source_version IS DISTINCT FROM OLD.health_source_version THEN
   RAISE EXCEPTION 'Original private healthcare upload source cannot change';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION cg19_health_file_identity_frozen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id OR
    NEW.health_center_id IS DISTINCT FROM OLD.health_center_id OR
    NEW.health_doctor_id IS DISTINCT FROM OLD.health_doctor_id OR
    NEW.health_source_version IS DISTINCT FROM OLD.health_source_version THEN
   RAISE EXCEPTION 'Original scanned healthcare file source cannot change';
 END IF;
 RETURN NEW;
END $$;
