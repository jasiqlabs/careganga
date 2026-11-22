-- CG10 US004: exact issued-document received-copy evidence using original CG19 file authority.
ALTER TABLE cg19_upload_intent ADD COLUMN hr_receipt_document_ref uuid;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT fk_cg19_hr_receipt_document
 FOREIGN KEY(hr_receipt_document_ref,realm_id) REFERENCES cg19_generated_document(id,realm_id) ON DELETE RESTRICT;
DO $migration$
DECLARE previous text;
BEGIN
 SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c
 WHERE c.conrelid='cg19_upload_intent'::regclass AND c.conname='cg19_intent_source_classification' AND c.contype='c';
 IF previous IS NULL OR left(previous,1)<>'(' THEN RAISE EXCEPTION 'Original CG19 classification missing'; END IF;
 EXECUTE 'ALTER TABLE cg19_upload_intent DROP CONSTRAINT cg19_intent_source_classification';
 EXECUTE format('ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_intent_source_classification CHECK ((%s) OR (owner_kind=''CG03_CASE'' AND classification=''HR_RECEIVED_COPY''))',previous);
END; $migration$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_hr_receipt_exact_kind CHECK(
 (classification='HR_RECEIVED_COPY' AND owner_kind='CG03_CASE' AND hr_receipt_document_ref IS NOT NULL)
 OR (classification<>'HR_RECEIVED_COPY' AND hr_receipt_document_ref IS NULL));
CREATE INDEX ix_cg19_hr_receipt_lookup ON cg19_upload_intent(realm_id,hr_receipt_document_ref,requested_by) WHERE classification='HR_RECEIVED_COPY';
CREATE FUNCTION cg19_hr_receipt_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND NEW.hr_receipt_document_ref IS DISTINCT FROM OLD.hr_receipt_document_ref THEN
  RAISE EXCEPTION 'Original receipt document identity is immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.classification='HR_RECEIVED_COPY' AND
  (NOT cg19_hr_document_notice_matches(NEW.realm_id,NEW.hr_receipt_document_ref,NEW.requested_by)
   OR NOT EXISTS(SELECT 1 FROM cg19_generated_document d WHERE d.realm_id=NEW.realm_id AND d.id=NEW.hr_receipt_document_ref
    AND d.case_id=NEW.case_id AND d.proposal_revision=NEW.proposal_revision))
 THEN RAISE EXCEPTION 'Current original recipient and issued document required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_receipt_intent_guard BEFORE INSERT OR UPDATE ON cg19_upload_intent FOR EACH ROW EXECUTE FUNCTION cg19_hr_receipt_intent_guard();
CREATE FUNCTION cg19_hr_receipt_file_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.upload_intent_id AND i.classification='HR_RECEIVED_COPY') AND
  NOT EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.upload_intent_id
   AND i.classification='HR_RECEIVED_COPY' AND i.status='VALIDATED' AND i.case_id=NEW.case_id AND i.proposal_revision=NEW.proposal_revision
   AND i.requested_by=NEW.created_by AND i.mime=NEW.original_mime AND i.expected_sha256=NEW.verified_sha256
   AND i.size_bytes=NEW.verified_size_bytes AND i.object_key=NEW.object_key AND NEW.owner_kind='CG03_CASE'
   AND cg19_hr_document_notice_matches(i.realm_id,i.hr_receipt_document_ref,i.requested_by))
 THEN RAISE EXCEPTION 'Exact scan-verified received copy required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_receipt_file_guard BEFORE INSERT ON cg19_stored_file FOR EACH ROW EXECUTE FUNCTION cg19_hr_receipt_file_guard();
