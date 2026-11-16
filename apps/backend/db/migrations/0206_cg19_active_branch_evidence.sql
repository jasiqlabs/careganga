-- CG-02 US-002: a live approved branch can replace its private photo,
-- agreement or registration evidence using the SAME CG-19 verified object master.
-- Additive migration; never rewrite 0021/0203 or retarget issued original files.
ALTER TABLE cg19_upload_intent
  ADD COLUMN branch_id uuid,
  ADD COLUMN branch_version integer;
ALTER TABLE cg19_upload_intent
  DROP CONSTRAINT cg19_intent_branch_source,
  DROP CONSTRAINT cg19_intent_source_classification,
  DROP CONSTRAINT cg19_upload_intent_owner_kind_check;
ALTER TABLE cg19_upload_intent
  ADD CONSTRAINT cg19_intent_owner_kind CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT','CG02_BRANCH')),
  ADD CONSTRAINT cg19_intent_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NULL AND branch_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL AND registration_id IS NOT NULL
      AND registration_draft_version>0 AND proposal_revision=registration_draft_version
      AND branch_id IS NULL AND branch_version IS NULL)
    OR
    (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NOT NULL
      AND branch_version>0 AND proposal_revision=branch_version)
  ),
  ADD CONSTRAINT cg19_intent_source_classification CHECK(
    (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
    OR
    (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN
      ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  ),
  ADD CONSTRAINT cg19_intent_active_branch_fk FOREIGN KEY(branch_id,realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_intent_active_branch_unique UNIQUE(id,realm_id,branch_id,branch_version);
CREATE INDEX ix_cg19_active_branch_intents
  ON cg19_upload_intent(realm_id,branch_id,branch_version,created_at DESC,id DESC)
  WHERE owner_kind='CG02_BRANCH';

ALTER TABLE cg19_stored_file
  ADD COLUMN branch_id uuid,
  ADD COLUMN branch_version integer;
ALTER TABLE cg19_stored_file
  DROP CONSTRAINT cg19_file_branch_source,
  DROP CONSTRAINT cg19_stored_file_owner_kind_check;
ALTER TABLE cg19_stored_file
  ADD CONSTRAINT cg19_file_owner_kind CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT','CG02_BRANCH')),
  ADD CONSTRAINT cg19_file_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NULL AND branch_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL AND registration_id IS NOT NULL
      AND registration_draft_version>0 AND proposal_revision=registration_draft_version
      AND branch_id IS NULL AND branch_version IS NULL)
    OR
    (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NOT NULL
      AND branch_version>0 AND proposal_revision=branch_version)
  ),
  ADD CONSTRAINT cg19_file_active_branch_fk FOREIGN KEY(branch_id,realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_file_active_intent_fk
    FOREIGN KEY(upload_intent_id,realm_id,branch_id,branch_version)
    REFERENCES cg19_upload_intent(id,realm_id,branch_id,branch_version) ON DELETE RESTRICT;
CREATE INDEX ix_cg19_active_branch_files
  ON cg19_stored_file(realm_id,branch_id,branch_version,created_at DESC,id DESC)
  WHERE owner_kind='CG02_BRANCH';

ALTER TABLE cg19_document_event
  ADD COLUMN branch_id uuid;
ALTER TABLE cg19_document_event
  DROP CONSTRAINT cg19_doc_event_source;
ALTER TABLE cg19_document_event
  ADD CONSTRAINT cg19_doc_event_source CHECK(
    num_nonnulls(case_id,registration_id,branch_id)=1
  ),
  ADD CONSTRAINT cg19_doc_event_branch_fk FOREIGN KEY(branch_id,realm_id)
    REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT;

CREATE FUNCTION cg19_active_branch_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
  OR NEW.branch_version IS DISTINCT FROM OLD.branch_version THEN
   RAISE EXCEPTION 'Original protected branch file source is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_active_branch_intent_frozen
  BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
  EXECUTE FUNCTION cg19_active_branch_source_frozen();
CREATE TRIGGER cg19_active_branch_file_frozen
  BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
  EXECUTE FUNCTION cg19_active_branch_source_frozen();
CREATE INDEX ix_cg19_active_branch_events
  ON cg19_document_event(realm_id,branch_id,occurred_at DESC,id DESC)
  WHERE branch_id IS NOT NULL;
