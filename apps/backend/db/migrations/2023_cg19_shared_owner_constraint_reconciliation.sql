-- Reconcile installations with older historical CG19 constraint families.
-- This migration is additive in the migration ledger; existing data and FKs
-- remain intact. Every replacement is validated against existing rows.
-- No exception handler suppresses invalid/mixed ownership.
DO $migration$
DECLARE rec record; old_check text; predicate text;
 legacy_owner constant text := 'owner_kind IN(''CG03_CASE'',''CG02_DRAFT'',''CG02_BRANCH'',''CG09_VOUCHER'',''CG09_PAYMENT'',''CG09_CLAIM'',''CG09_BANK_STATEMENT'')';
 legacy_source constant text := '(owner_kind=''CG03_CASE'' AND case_id IS NOT NULL AND
   num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind=''CG02_DRAFT'' AND registration_id IS NOT NULL AND
   registration_draft_version>0 AND proposal_revision=registration_draft_version AND
   num_nonnulls(case_id,branch_id,branch_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind=''CG02_BRANCH'' AND branch_id IS NOT NULL AND branch_version>0 AND
   proposal_revision=branch_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,voucher_id,voucher_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind IN(''CG09_VOUCHER'',''CG09_PAYMENT'') AND voucher_id IS NOT NULL AND
   voucher_version>0 AND proposal_revision=voucher_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    claim_id,claim_version,reconciliation_id)=0)
  OR (owner_kind=''CG09_CLAIM'' AND claim_id IS NOT NULL AND claim_version>0 AND
   proposal_revision=claim_version AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,reconciliation_id)=0)
  OR (owner_kind=''CG09_BANK_STATEMENT'' AND reconciliation_id IS NOT NULL AND
   proposal_revision=1 AND
   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
    voucher_id,voucher_version,claim_id,claim_version)=0)';
 legacy_classification constant text := '(owner_kind=''CG03_CASE'' AND classification IN(''PRIVATE_CASE_EVIDENCE'',''PRIVATE_CASE_ARCHIVE''))
  OR (owner_kind IN(''CG02_DRAFT'',''CG02_BRANCH'') AND classification IN
   (''BRANCH_PHOTO'',''BRANCH_LOGO'',''REGISTRATION_PROOF'',''AGREEMENT''))
  OR (owner_kind=''CG09_VOUCHER'' AND classification=''FINANCE_VOUCHER_PROOF'')
  OR (owner_kind=''CG09_PAYMENT'' AND classification=''FINANCE_PAYMENT_PROOF'')
  OR (owner_kind=''CG09_CLAIM'' AND classification=''FINANCE_CLAIM_BILL'')
  OR (owner_kind=''CG09_BANK_STATEMENT'' AND classification=''FINANCE_BANK_STATEMENT'')';
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
 ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
 ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
 ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
 ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) v(table_name,constraint_name,kind)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO old_check FROM pg_constraint
   WHERE conrelid=rec.table_name::regclass AND conname=rec.constraint_name AND contype='c';
  IF old_check IS NULL OR left(old_check,1)<>'(' THEN
   RAISE EXCEPTION 'Reviewed CG19 source constraint missing: %',rec.constraint_name;
  END IF;
  IF rec.kind='OWNER' THEN
   predicate:=format('(%s) OR (%s)',legacy_owner,old_check);
  ELSIF rec.kind='SOURCE' THEN
   predicate:=format('((%s) AND num_nonnulls(health_provider_id,health_center_id,health_doctor_id,health_source_version,support_case_id,hr_application_id,hr_source_version)=0) OR (NOT (%s) AND (%s) AND num_nonnulls(branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version,reconciliation_id)=0)',legacy_source,legacy_owner,old_check);
  ELSE
   predicate:=format('(%s) OR (owner_kind=''CG03_CASE'' AND classification=''HR_RECEIVED_COPY'') OR (NOT (%s) AND (%s))',legacy_classification,legacy_owner,old_check);
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) IS TRUE)',rec.table_name,rec.constraint_name,predicate);
 END LOOP;
END; $migration$;
-- The full validated replacement now enforces all prior owner shapes and
-- classifications. Remove obsolete restrictive aliases only after validation.
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT IF EXISTS cg19_intent_owner_kind_voucher,
 DROP CONSTRAINT IF EXISTS cg19_intent_one_source_voucher,
 DROP CONSTRAINT IF EXISTS cg19_intent_voucher_classification,
 DROP CONSTRAINT IF EXISTS cg19_intent_owner_kind;
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT IF EXISTS cg19_file_owner_kind_voucher,
 DROP CONSTRAINT IF EXISTS cg19_file_one_source_voucher,
 DROP CONSTRAINT IF EXISTS cg19_file_owner_kind;
ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_source;
ALTER TABLE cg19_document_event ADD CONSTRAINT cg19_doc_event_source CHECK(
 (NOT hr_template_asset AND num_nonnulls(case_id,registration_id,branch_id,voucher_id,claim_id,reconciliation_id,health_provider_id,health_doctor_id)=1)
 OR (hr_template_asset AND num_nonnulls(case_id,registration_id,branch_id,voucher_id,claim_id,reconciliation_id,health_provider_id,health_doctor_id)=0
 AND intent_id IS NOT NULL AND document_id IS NULL AND file_id IS NULL));
ALTER TABLE cg19_document_event DROP CONSTRAINT IF EXISTS cg19_doc_event_three_sources;
