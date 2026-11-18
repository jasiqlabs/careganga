-- CG-09 US-003 / CG-19 real claim-bill introduction; no second object store.
-- Source-only migration. Earlier CG-01/02/03/09 files and finance workflows remain intact.
ALTER TABLE cg19_upload_intent ADD COLUMN claim_id uuid, ADD COLUMN claim_version integer;
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_intent_owner_kind_voucher,
 DROP CONSTRAINT cg19_intent_one_source_voucher,
 DROP CONSTRAINT cg19_intent_voucher_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_intent_owner_kind_voucher CHECK(owner_kind IN
   ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT','CG09_CLAIM')),
 ADD CONSTRAINT cg19_intent_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL
    AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
                     voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind='CG02_DRAFT' AND registration_id IS NOT NULL
    AND registration_draft_version>0 AND proposal_revision=registration_draft_version
    AND num_nonnulls(case_id,branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind='CG02_BRANCH' AND branch_id IS NOT NULL AND branch_version>0
    AND proposal_revision=branch_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,
                 voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT') AND voucher_id IS NOT NULL
    AND voucher_version>0 AND proposal_revision=voucher_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
                 claim_id,claim_version)=0)
  OR (owner_kind='CG09_CLAIM' AND claim_id IS NOT NULL AND claim_version>0
    AND proposal_revision=claim_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
                 voucher_id,voucher_version)=0)),
 ADD CONSTRAINT cg19_intent_voucher_classification CHECK(
  (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
  OR (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN
    ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  OR (owner_kind='CG09_VOUCHER' AND classification='FINANCE_VOUCHER_PROOF')
  OR (owner_kind='CG09_PAYMENT' AND classification='FINANCE_PAYMENT_PROOF')
  OR (owner_kind='CG09_CLAIM' AND classification='FINANCE_CLAIM_BILL')),
 ADD CONSTRAINT fk_cg19_intent_claim FOREIGN KEY(claim_id,realm_id)
   REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_intent_claim_link UNIQUE(id,realm_id,claim_id,claim_version);
CREATE INDEX ix_cg19_claim_intent ON cg19_upload_intent
 (realm_id,claim_id,claim_version,created_at DESC,id DESC)
 WHERE owner_kind='CG09_CLAIM';

ALTER TABLE cg19_stored_file ADD COLUMN claim_id uuid,ADD COLUMN claim_version integer;
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_file_owner_kind_voucher,
 DROP CONSTRAINT cg19_file_one_source_voucher;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_file_owner_kind_voucher CHECK(owner_kind IN
   ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT','CG09_CLAIM')),
 ADD CONSTRAINT cg19_file_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL
    AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
       voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind='CG02_DRAFT' AND registration_id IS NOT NULL
    AND registration_draft_version>0 AND proposal_revision=registration_draft_version
    AND num_nonnulls(case_id,branch_id,branch_version,
       voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind='CG02_BRANCH' AND branch_id IS NOT NULL AND branch_version>0
    AND proposal_revision=branch_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,
       voucher_id,voucher_version,claim_id,claim_version)=0)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT') AND voucher_id IS NOT NULL
    AND voucher_version>0 AND proposal_revision=voucher_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
       claim_id,claim_version)=0)
  OR (owner_kind='CG09_CLAIM' AND claim_id IS NOT NULL AND claim_version>0
    AND proposal_revision=claim_version AND
    num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
       voucher_id,voucher_version)=0)),
 ADD CONSTRAINT fk_cg19_file_claim FOREIGN KEY(claim_id,realm_id)
   REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_file_claim_intent
   FOREIGN KEY(upload_intent_id,realm_id,claim_id,claim_version)
   REFERENCES cg19_upload_intent(id,realm_id,claim_id,claim_version) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_file_claim_link UNIQUE(id,realm_id,claim_id,claim_version);
CREATE INDEX ix_cg19_claim_file ON cg19_stored_file
 (realm_id,claim_id,claim_version,created_at DESC,id DESC)
 WHERE owner_kind='CG09_CLAIM';

-- The CG-19 immutable event is now also traceable to the original claim.
ALTER TABLE cg19_document_event ADD COLUMN claim_id uuid;
ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_three_sources;
ALTER TABLE cg19_document_event ADD CONSTRAINT cg19_doc_event_three_sources
 CHECK(num_nonnulls(case_id,registration_id,branch_id,voucher_id,claim_id)=1);
ALTER TABLE cg19_document_event ADD CONSTRAINT fk_cg19_doc_event_claim
 FOREIGN KEY(claim_id,realm_id) REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT;

CREATE FUNCTION cg19_claim_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.claim_id IS DISTINCT FROM OLD.claim_id OR
    NEW.claim_version IS DISTINCT FROM OLD.claim_version THEN
  RAISE EXCEPTION 'Original claim evidence source cannot change' USING ERRCODE='P0918';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_claim_intent_immutable BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_claim_source_immutable();
CREATE TRIGGER cg19_claim_file_immutable BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_claim_source_immutable();

-- Keep original claim revision frozen on submission, never approve on upload.
ALTER TABLE expense_claim DROP CONSTRAINT expense_claim_status_check;
ALTER TABLE expense_claim
 ADD COLUMN bill_file_id uuid,
 ADD COLUMN bill_file_version integer,
 ADD COLUMN approval_case_id uuid,
 ADD CONSTRAINT cg09_claim_status CHECK(status IN
   ('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED')),
 ADD CONSTRAINT cg09_claim_file_if_submitted CHECK(
   (status='DRAFT' AND bill_file_id IS NULL AND bill_file_version IS NULL AND approval_case_id IS NULL)
   OR (status<>'DRAFT' AND bill_file_id IS NOT NULL
    AND bill_file_version>0 AND approval_case_id IS NOT NULL)),
 ADD CONSTRAINT fk_cg09_claim_bill FOREIGN KEY
    (bill_file_id,root_realm_id,id,version)
    REFERENCES cg19_stored_file(id,realm_id,claim_id,claim_version) ON DELETE RESTRICT;
ALTER TABLE expense_claim DROP CONSTRAINT expense_claim_version_check;
ALTER TABLE expense_claim ADD CONSTRAINT expense_claim_version_check CHECK(version>0);
DROP TRIGGER cg09_claim_draft_immutable ON expense_claim;
CREATE FUNCTION cg09_claim_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable claim cannot be deleted' USING ERRCODE='P0918'; END IF;
 IF OLD.status='DRAFT' AND NEW.status='SUBMITTED'
    AND NEW.version=OLD.version
    AND NEW.bill_file_id IS NOT NULL AND NEW.bill_file_version>0
    AND NEW.approval_case_id IS NOT NULL
    AND NEW.id=OLD.id AND NEW.root_realm_id=OLD.root_realm_id
    AND NEW.requested_by=OLD.requested_by AND NEW.purpose=OLD.purpose
    AND NEW.category_label=OLD.category_label AND NEW.expense_date=OLD.expense_date
    AND NEW.amount_minor=OLD.amount_minor AND NEW.currency=OLD.currency
    AND NEW.create_request_key=OLD.create_request_key
    AND NEW.create_digest=OLD.create_digest
    AND NEW.created_at=OLD.created_at THEN RETURN NEW;
 END IF;
 IF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED')
    AND NEW.version=OLD.version AND
    (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Claim source change is not allowed' USING ERRCODE='P0918';
END; $$;
CREATE TRIGGER cg09_claim_source_guard BEFORE UPDATE OR DELETE ON expense_claim
 FOR EACH ROW EXECUTE FUNCTION cg09_claim_source_guard();
