-- CG-02 US-002 introducing CG-19-owned pre-approval private file sources.
-- Reuse the one CG-19 verified object metadata authority: no second file master.
-- The original CG-03 private case upload/letter paths retain their source identity.
ALTER TABLE cg19_upload_intent ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE cg19_upload_intent
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'CG03_CASE'
    CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT')),
  ADD COLUMN registration_id uuid,
  ADD COLUMN registration_draft_version integer,
  ADD CONSTRAINT cg19_intent_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version)
  ),
  ADD CONSTRAINT cg19_intent_draft_registration_fk
    FOREIGN KEY(registration_id,realm_id)
    REFERENCES branch_registration(id,root_realm_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cg19_intent_branch_composite
    UNIQUE(id,realm_id,registration_id,registration_draft_version);
ALTER TABLE cg19_upload_intent
  DROP CONSTRAINT IF EXISTS cg19_upload_intent_classification_check;
ALTER TABLE cg19_upload_intent
  ADD CONSTRAINT cg19_intent_source_classification CHECK(
    (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
    OR
    (owner_kind='CG02_DRAFT' AND classification IN
      ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  );
CREATE INDEX ix_cg19_registration_intent
  ON cg19_upload_intent(realm_id,registration_id,registration_draft_version,created_at DESC,id DESC)
  WHERE owner_kind='CG02_DRAFT';

ALTER TABLE cg19_stored_file ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE cg19_stored_file
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'CG03_CASE'
    CHECK(owner_kind IN('CG03_CASE','CG02_DRAFT')),
  ADD COLUMN registration_id uuid,
  ADD COLUMN registration_draft_version integer,
  ADD CONSTRAINT cg19_file_branch_source CHECK(
    (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL)
    OR
    (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version)
  ),
  ADD CONSTRAINT cg19_file_draft_intent_fk
    FOREIGN KEY(upload_intent_id,realm_id,registration_id,registration_draft_version)
    REFERENCES cg19_upload_intent(id,realm_id,registration_id,registration_draft_version)
    ON DELETE RESTRICT;
CREATE INDEX ix_cg19_registration_files
  ON cg19_stored_file(realm_id,registration_id,registration_draft_version,created_at DESC,id DESC)
  WHERE owner_kind='CG02_DRAFT';

ALTER TABLE cg19_document_event ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE cg19_document_event
  ADD COLUMN registration_id uuid,
  ADD CONSTRAINT cg19_doc_event_source CHECK(
    (case_id IS NOT NULL AND registration_id IS NULL)
    OR (case_id IS NULL AND registration_id IS NOT NULL)
  ),
  ADD CONSTRAINT cg19_doc_event_draft_fk
    FOREIGN KEY(registration_id,realm_id)
    REFERENCES branch_registration(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg19_doc_event_draft
  ON cg19_document_event(realm_id,registration_id,occurred_at,id)
  WHERE registration_id IS NOT NULL;

-- Existing source-immutability triggers continue protecting existing CG-03 fields.
-- Add separate frozen CG-02 adapter identity guards; revocation/status remains mutable.
CREATE FUNCTION cg19_branch_intent_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.owner_kind IS DISTINCT FROM OLD.owner_kind
  OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
  OR NEW.registration_draft_version IS DISTINCT FROM OLD.registration_draft_version THEN
   RAISE EXCEPTION 'Original branch upload identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_branch_intent_frozen
  BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
  EXECUTE FUNCTION cg19_branch_intent_source_frozen();
CREATE FUNCTION cg19_branch_file_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.owner_kind IS DISTINCT FROM OLD.owner_kind
  OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
  OR NEW.registration_draft_version IS DISTINCT FROM OLD.registration_draft_version THEN
   RAISE EXCEPTION 'Original verified branch file identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_branch_file_frozen
  BEFORE UPDATE ON cg19_stored_file FOR EACH ROW EXECUTE FUNCTION cg19_branch_file_source_frozen();
