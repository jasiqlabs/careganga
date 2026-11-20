-- CG-14 US-001 introduces a private, source-checked CG-19 draft-file owner.
-- This extends the EXISTING CG-19 upload-intent/stored-file authority;
-- no second object store, public bucket, upload/scanner or file master.
ALTER TABLE health_center
  ADD CONSTRAINT uq_health_center_provider_source UNIQUE(root_realm_id,provider_id,id);
-- Audited center changes must belong to the same provider in this root.
ALTER TABLE health_network_event
  ADD CONSTRAINT fk_health_event_original_center
  FOREIGN KEY(root_realm_id,provider_id,center_id)
  REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT;

ALTER TABLE cg19_upload_intent
  ADD COLUMN health_provider_id uuid,
  ADD COLUMN health_center_id uuid,
  ADD COLUMN health_source_version integer,
  ADD CONSTRAINT cg19_health_intent_provider_fk FOREIGN KEY(health_provider_id,realm_id)
    REFERENCES health_provider(id,root_realm_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_intent_center_fk FOREIGN KEY(realm_id,health_provider_id,health_center_id)
    REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_intent_identity_unique
    UNIQUE(id,realm_id,health_provider_id,health_source_version),
  ADD CONSTRAINT cg19_health_intent_center_identity_unique
    UNIQUE(id,realm_id,health_provider_id,health_center_id,health_source_version);
ALTER TABLE cg19_upload_intent
  DROP CONSTRAINT cg19_upload_intent_owner_kind_check,
  DROP CONSTRAINT cg19_intent_branch_source,
  DROP CONSTRAINT cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
  ADD CONSTRAINT cg19_upload_intent_owner_kind_check
    CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT')),
  ADD CONSTRAINT cg19_intent_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND health_provider_id IS NULL AND health_center_id IS NULL
      AND health_source_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version
      AND health_provider_id IS NULL AND health_center_id IS NULL
      AND health_source_version IS NULL)
    OR
    (owner_kind='CG14_DRAFT' AND case_id IS NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND health_provider_id IS NOT NULL AND health_source_version>0
      AND proposal_revision=health_source_version)
  ),
  ADD CONSTRAINT cg19_intent_source_classification CHECK(
    (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
    OR (owner_kind='CG02_DRAFT' AND classification IN
      ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
    OR (owner_kind='CG14_DRAFT' AND
      ((health_center_id IS NULL AND classification IN
        ('HEALTH_PROVIDER_REGISTRATION','HEALTH_BANK_PROOF')) OR
       (health_center_id IS NOT NULL AND classification='HEALTH_CENTER_LICENSE')))
  );
CREATE INDEX ix_cg19_health_intents
  ON cg19_upload_intent(realm_id,health_provider_id,health_center_id,created_at DESC,id DESC)
  WHERE owner_kind='CG14_DRAFT';

ALTER TABLE cg19_stored_file
  ADD COLUMN health_provider_id uuid,
  ADD COLUMN health_center_id uuid,
  ADD COLUMN health_source_version integer,
  ADD CONSTRAINT cg19_health_file_provider_fk FOREIGN KEY(health_provider_id,realm_id)
    REFERENCES health_provider(id,root_realm_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_file_center_fk FOREIGN KEY(realm_id,health_provider_id,health_center_id)
    REFERENCES health_center(root_realm_id,provider_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_file_intent_fk
    FOREIGN KEY(upload_intent_id,realm_id,health_provider_id,health_source_version)
    REFERENCES cg19_upload_intent(id,realm_id,health_provider_id,health_source_version)
    ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_file_center_intent_fk
    FOREIGN KEY(upload_intent_id,realm_id,health_provider_id,health_center_id,health_source_version)
    REFERENCES cg19_upload_intent(id,realm_id,health_provider_id,health_center_id,health_source_version)
    ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_health_file_provider_identity_unique
    UNIQUE(id,realm_id,health_provider_id);
ALTER TABLE cg19_stored_file
  DROP CONSTRAINT cg19_stored_file_owner_kind_check,
  DROP CONSTRAINT cg19_file_branch_source;
ALTER TABLE cg19_stored_file
  ADD CONSTRAINT cg19_stored_file_owner_kind_check
    CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT','CG14_DRAFT')),
  ADD CONSTRAINT cg19_file_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND health_provider_id IS NULL AND health_center_id IS NULL
      AND health_source_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version
      AND health_provider_id IS NULL AND health_center_id IS NULL
      AND health_source_version IS NULL)
    OR
    (owner_kind='CG14_DRAFT' AND case_id IS NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND health_provider_id IS NOT NULL AND health_source_version>0
      AND proposal_revision=health_source_version)
  );
CREATE INDEX ix_cg19_health_verified_files
  ON cg19_stored_file(realm_id,health_provider_id,health_center_id,created_at DESC,id DESC)
  WHERE owner_kind='CG14_DRAFT';
-- Financial evidence is also tied to the original provider by composite FK;
-- source-level verification additionally requires CLEAN_VERIFIED, live and
-- explicitly classified HEALTH_BANK_PROOF before the reference is created.
ALTER TABLE health_provider_finance_ref
  ADD CONSTRAINT fk_health_finance_original_file_provider
  FOREIGN KEY(protected_file_ref,root_realm_id,provider_id)
  REFERENCES cg19_stored_file(id,realm_id,health_provider_id)
  ON DELETE RESTRICT;

ALTER TABLE cg19_document_event
  ADD COLUMN health_provider_id uuid,
  ADD CONSTRAINT cg19_health_doc_event_provider_fk
    FOREIGN KEY(health_provider_id,realm_id)
    REFERENCES health_provider(id,root_realm_id) ON DELETE RESTRICT;
ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_source;
ALTER TABLE cg19_document_event
  ADD CONSTRAINT cg19_doc_event_source CHECK(
    num_nonnulls(case_id,registration_id,health_provider_id)=1
  );
CREATE INDEX ix_cg19_doc_events_health
  ON cg19_document_event(realm_id,health_provider_id,occurred_at,id)
  WHERE health_provider_id IS NOT NULL;

CREATE FUNCTION cg19_health_intent_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id
 OR NEW.health_center_id IS DISTINCT FROM OLD.health_center_id
 OR NEW.health_source_version IS DISTINCT FROM OLD.health_source_version THEN
   RAISE EXCEPTION 'Original healthcare draft upload identity is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_health_intent_frozen
 BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
 EXECUTE FUNCTION cg19_health_intent_identity_frozen();

CREATE FUNCTION cg19_health_file_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.health_provider_id IS DISTINCT FROM OLD.health_provider_id
 OR NEW.health_center_id IS DISTINCT FROM OLD.health_center_id
 OR NEW.health_source_version IS DISTINCT FROM OLD.health_source_version THEN
   RAISE EXCEPTION 'Original healthcare verified file identity is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_health_file_frozen
 BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
 EXECUTE FUNCTION cg19_health_file_identity_frozen();
