-- CG-09 US-004 / CG-19 file-owner integration:
-- A bank reference and reviewer password alone are NOT statement evidence.
-- Reuse CG-19's private version-pinned clean file source. No shadow file table.
-- Existing verified historical statements must be separately audited before
-- being treated as source-document-backed; this migration does not rewrite them.

ALTER TABLE cg19_upload_intent ADD COLUMN reconciliation_id uuid;
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_intent_owner_kind_voucher,
 DROP CONSTRAINT cg19_intent_one_source_voucher,
 DROP CONSTRAINT cg19_intent_voucher_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_intent_owner_kind_voucher CHECK(owner_kind IN
  ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT',
   'CG09_CLAIM','CG09_BANK_STATEMENT')),
 ADD CONSTRAINT cg19_intent_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
   num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG02_DRAFT' AND registration_id IS NOT NULL AND
   registration_draft_version>0 AND proposal_revision=registration_draft_version AND
   num_nonnulls(case_id,branch_id,branch_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG02_BRANCH' AND branch_id IS NOT NULL AND branch_version>0 AND
   proposal_revision=branch_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT') AND voucher_id IS NOT NULL AND
   voucher_version>0 AND proposal_revision=voucher_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG09_CLAIM' AND claim_id IS NOT NULL AND claim_version>0 AND
   proposal_revision=claim_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,reconciliation_id)=0)
  OR (owner_kind='CG09_BANK_STATEMENT' AND reconciliation_id IS NOT NULL AND
   proposal_revision=1 AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version)=0)),
 ADD CONSTRAINT cg19_intent_voucher_classification CHECK(
  (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
  OR (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN
   ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  OR (owner_kind='CG09_VOUCHER' AND classification='FINANCE_VOUCHER_PROOF')
  OR (owner_kind='CG09_PAYMENT' AND classification='FINANCE_PAYMENT_PROOF')
  OR (owner_kind='CG09_CLAIM' AND classification='FINANCE_CLAIM_BILL')
  OR (owner_kind='CG09_BANK_STATEMENT' AND classification='FINANCE_BANK_STATEMENT')),
 ADD CONSTRAINT fk_cg19_intent_bank_match FOREIGN KEY(reconciliation_id,realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_intent_bank_match UNIQUE(id,realm_id,reconciliation_id);

ALTER TABLE cg19_stored_file ADD COLUMN reconciliation_id uuid;
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_file_owner_kind_voucher,
 DROP CONSTRAINT cg19_file_one_source_voucher;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_file_owner_kind_voucher CHECK(owner_kind IN
  ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT',
   'CG09_CLAIM','CG09_BANK_STATEMENT')),
 ADD CONSTRAINT cg19_file_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL AND
   num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG02_DRAFT' AND registration_id IS NOT NULL AND
   registration_draft_version>0 AND proposal_revision=registration_draft_version AND
   num_nonnulls(case_id,branch_id,branch_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG02_BRANCH' AND branch_id IS NOT NULL AND branch_version>0 AND
   proposal_revision=branch_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT') AND voucher_id IS NOT NULL AND
   voucher_version>0 AND proposal_revision=voucher_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind='CG09_CLAIM' AND claim_id IS NOT NULL AND claim_version>0 AND
   proposal_revision=claim_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,reconciliation_id)=0)
  OR (owner_kind='CG09_BANK_STATEMENT' AND reconciliation_id IS NOT NULL AND
   proposal_revision=1 AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version)=0)),
 ADD CONSTRAINT fk_cg19_file_bank_match FOREIGN KEY(reconciliation_id,realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_file_bank_intent
  FOREIGN KEY(upload_intent_id,realm_id,reconciliation_id)
  REFERENCES cg19_upload_intent(id,realm_id,reconciliation_id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_file_bank_match UNIQUE(id,realm_id,reconciliation_id);
CREATE INDEX ix_cg19_bank_match_file ON cg19_stored_file
 (realm_id,reconciliation_id,created_at DESC,id DESC)
 WHERE owner_kind='CG09_BANK_STATEMENT';

ALTER TABLE cg19_document_event ADD COLUMN reconciliation_id uuid;
ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_three_sources;
ALTER TABLE cg19_document_event ADD CONSTRAINT cg19_doc_event_three_sources CHECK(
 num_nonnulls(case_id,registration_id,branch_id,voucher_id,claim_id,reconciliation_id)=1);
ALTER TABLE cg19_document_event
 ADD CONSTRAINT fk_cg19_doc_event_bank_match FOREIGN KEY(reconciliation_id,realm_id)
 REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT;

CREATE FUNCTION cg19_bank_statement_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.reconciliation_id IS DISTINCT FROM OLD.reconciliation_id THEN
  RAISE EXCEPTION 'Original bank statement evidence cannot be retargeted'
   USING ERRCODE='P0928';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_bank_intent_source_immutable BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_bank_statement_source_immutable();
CREATE TRIGGER cg19_bank_file_source_immutable BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_bank_statement_source_immutable();

ALTER TABLE finance_reconciliation_decision
 ADD COLUMN statement_file_id uuid,
 ADD COLUMN statement_file_version integer,
 ADD CONSTRAINT fk_cg09_bank_decision_statement
 FOREIGN KEY(statement_file_id,root_realm_id,reconciliation_id)
 REFERENCES cg19_stored_file(id,realm_id,reconciliation_id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg09_bank_decision_proof_fields CHECK(
 (action='REJECT' AND statement_file_id IS NULL AND statement_file_version IS NULL)
 OR (action='VERIFY' AND statement_file_id IS NOT NULL AND statement_file_version>0)
 );

-- The new decision must reference an actual clean, current, owner-bound file.
-- A forged SQL decision or stale/revoked file must never create VERIFIED money.
CREATE FUNCTION cg09_bank_decision_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='VERIFY' THEN
  PERFORM 1 FROM cg19_stored_file f JOIN cg19_upload_intent i
   ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   JOIN finance_bank_reconciliation r
    ON r.id=f.reconciliation_id AND r.root_realm_id=f.realm_id
   WHERE f.id=NEW.statement_file_id AND f.realm_id=NEW.root_realm_id
    AND r.recorded_by=i.requested_by AND r.recorded_by=f.created_by
    AND f.reconciliation_id=NEW.reconciliation_id
    AND f.revision=NEW.statement_file_version
    AND f.owner_kind='CG09_BANK_STATEMENT' AND i.owner_kind='CG09_BANK_STATEMENT'
    AND i.reconciliation_id=NEW.reconciliation_id AND i.status='VALIDATED'
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
   FOR SHARE OF f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'A clean original bank statement file is required'
    USING ERRCODE='P0928';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_bank_decision_file_guard BEFORE INSERT ON finance_reconciliation_decision
 FOR EACH ROW EXECUTE FUNCTION cg09_bank_decision_file_guard();

-- A statement file revoked after manual review cannot back a *new* receipt.
-- Do not rewrite an earlier posted journal or silently re-open a verified match.
CREATE FUNCTION cg09_receipt_current_statement_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM finance_reconciliation_decision d
 JOIN cg19_stored_file f
  ON f.id=d.statement_file_id AND f.realm_id=d.root_realm_id
  AND f.reconciliation_id=d.reconciliation_id AND f.revision=d.statement_file_version
 JOIN cg19_upload_intent i
  ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  AND i.reconciliation_id=d.reconciliation_id
 WHERE d.root_realm_id=NEW.root_realm_id
  AND d.reconciliation_id=NEW.reconciliation_id AND d.action='VERIFY'
  AND f.owner_kind='CG09_BANK_STATEMENT'
  AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED'
  AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 FOR SHARE OF d,f,i;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Original verified bank statement proof is unavailable'
   USING ERRCODE='P0928';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_receipt_statement_file_guard
 BEFORE INSERT ON finance_invoice_receipt FOR EACH ROW
 EXECUTE FUNCTION cg09_receipt_current_statement_file_guard();
