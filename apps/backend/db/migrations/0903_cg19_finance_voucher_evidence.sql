-- CG-09 US-002 introduces a narrow CG-19-owned voucher evidence source.
-- Keep one original CG-19 upload intent, scanned stored-file and event authority.
-- No CG-09 file bytes, second file table, fabricated scan or provider shortcut.
ALTER TABLE cg19_upload_intent DROP CONSTRAINT IF EXISTS cg19_intent_owner_kind;
ALTER TABLE cg19_upload_intent DROP CONSTRAINT IF EXISTS cg19_intent_branch_source;
ALTER TABLE cg19_upload_intent DROP CONSTRAINT IF EXISTS cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
 ADD COLUMN voucher_id uuid,
 ADD COLUMN voucher_version integer,
 ADD CONSTRAINT cg19_intent_owner_kind_voucher CHECK(owner_kind IN
   ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER')),
 ADD CONSTRAINT cg19_intent_one_source_voucher CHECK(
   (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NOT NULL
      AND branch_version>0 AND proposal_revision=branch_version
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG09_VOUCHER' AND case_id IS NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NOT NULL AND voucher_version>0
      AND proposal_revision=voucher_version)
 ),
 ADD CONSTRAINT cg19_intent_voucher_classification CHECK(
   (owner_kind='CG03_CASE' AND classification IN
      ('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
   OR (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN
      ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
   OR (owner_kind='CG09_VOUCHER' AND classification='FINANCE_VOUCHER_PROOF')
 ),
 ADD CONSTRAINT fk_cg19_intent_voucher FOREIGN KEY(voucher_id,realm_id)
   REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_intent_voucher_link UNIQUE(id,realm_id,voucher_id,voucher_version);
CREATE INDEX ix_cg19_voucher_intent ON cg19_upload_intent(realm_id,voucher_id,voucher_version,created_at DESC,id DESC)
 WHERE owner_kind='CG09_VOUCHER';

ALTER TABLE cg19_stored_file DROP CONSTRAINT IF EXISTS cg19_file_owner_kind;
ALTER TABLE cg19_stored_file DROP CONSTRAINT IF EXISTS cg19_file_branch_source;
ALTER TABLE cg19_stored_file
 ADD COLUMN voucher_id uuid,
 ADD COLUMN voucher_version integer,
 ADD CONSTRAINT cg19_file_owner_kind_voucher CHECK(owner_kind IN
   ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER')),
 ADD CONSTRAINT cg19_file_one_source_voucher CHECK(
   (owner_kind='CG03_CASE' AND case_id IS NOT NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG02_DRAFT' AND case_id IS NULL
      AND registration_id IS NOT NULL AND registration_draft_version>0
      AND proposal_revision=registration_draft_version
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
      AND registration_draft_version IS NULL AND branch_id IS NOT NULL
      AND branch_version>0 AND proposal_revision=branch_version
      AND voucher_id IS NULL AND voucher_version IS NULL)
   OR
   (owner_kind='CG09_VOUCHER' AND case_id IS NULL
      AND registration_id IS NULL AND registration_draft_version IS NULL
      AND branch_id IS NULL AND branch_version IS NULL
      AND voucher_id IS NOT NULL AND voucher_version>0
      AND proposal_revision=voucher_version)
 ),
 ADD CONSTRAINT fk_cg19_file_voucher_intent
   FOREIGN KEY(upload_intent_id,realm_id,voucher_id,voucher_version)
   REFERENCES cg19_upload_intent(id,realm_id,voucher_id,voucher_version)
   ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_file_voucher_link UNIQUE(id,realm_id,voucher_id,voucher_version);
CREATE INDEX ix_cg19_voucher_file ON cg19_stored_file(realm_id,voucher_id,voucher_version,created_at DESC,id DESC)
 WHERE owner_kind='CG09_VOUCHER';

ALTER TABLE cg19_document_event DROP CONSTRAINT IF EXISTS cg19_doc_event_source;
ALTER TABLE cg19_document_event
 ADD COLUMN voucher_id uuid,
 ADD CONSTRAINT cg19_doc_event_three_sources CHECK(
   num_nonnulls(case_id,registration_id,branch_id,voucher_id)=1
 ),
 ADD CONSTRAINT fk_cg19_doc_event_voucher FOREIGN KEY(voucher_id,realm_id)
   REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg19_voucher_event ON cg19_document_event(realm_id,voucher_id,occurred_at,id)
 WHERE voucher_id IS NOT NULL;

-- Original CG-03 and CG-02 source identity freeze triggers remain active.
CREATE FUNCTION cg19_voucher_upload_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.voucher_id IS DISTINCT FROM OLD.voucher_id OR
    NEW.voucher_version IS DISTINCT FROM OLD.voucher_version THEN
  RAISE EXCEPTION 'Original voucher upload source cannot be retargeted';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_voucher_intent_source_immutable
 BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
 EXECUTE FUNCTION cg19_voucher_upload_source_frozen();
CREATE TRIGGER cg19_voucher_file_source_immutable
 BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
 EXECUTE FUNCTION cg19_voucher_upload_source_frozen();
