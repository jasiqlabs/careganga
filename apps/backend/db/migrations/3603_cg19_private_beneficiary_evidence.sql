-- CG06/CG19 US001: original private scanned-document owner, no second object store.
-- The beneficiary is CG06-owned; bytes, scan and download remain CG19-owned.
ALTER TABLE cg19_upload_intent ADD COLUMN beneficiary_id uuid,
 ADD CONSTRAINT fk_cg19_beneficiary_intent
 FOREIGN KEY(realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_beneficiary_intent UNIQUE(id,realm_id,beneficiary_id,proposal_revision);
ALTER TABLE cg19_stored_file ADD COLUMN beneficiary_id uuid,
 ADD CONSTRAINT fk_cg19_beneficiary_file
 FOREIGN KEY(realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_beneficiary_file_intent
 FOREIGN KEY(upload_intent_id,realm_id,beneficiary_id,proposal_revision)
 REFERENCES cg19_upload_intent(id,realm_id,beneficiary_id,proposal_revision) ON DELETE RESTRICT;

DO $cg06$
DECLARE rec record; original text; extra text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) AS v(table_name,constraint_name,guard_kind)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original
  FROM pg_constraint WHERE conrelid=rec.table_name::regclass AND conname=rec.constraint_name AND contype='c';
  IF original IS NULL THEN RAISE EXCEPTION 'CG19 original owner constraint missing: %',rec.constraint_name; END IF;
  IF rec.guard_kind='OWNER' THEN
   extra:='owner_kind=''CG06_BENEFICIARY''';
  ELSIF rec.guard_kind='CLASS' THEN
   extra:='owner_kind=''CG06_BENEFICIARY'' AND classification=''BENEFICIARY_EVIDENCE''
     AND mime IN(''image/jpeg'',''image/png'',''image/webp'',''application/pdf'')';
  ELSE
   extra:='owner_kind=''CG06_BENEFICIARY'' AND beneficiary_id IS NOT NULL
     AND num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,
       voucher_id,voucher_version,claim_id,claim_version,reconciliation_id,
       health_provider_id,health_center_id,health_doctor_id,health_source_version,
       support_case_id,hr_application_id,hr_source_version,inventory_receipt_id,
       inventory_operation_id,project_id,activity_id,visit_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
    rec.table_name,rec.constraint_name,original,extra);
 END LOOP;
END; $cg06$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_beneficiary_intent_disjoint CHECK(
 (owner_kind='CG06_BENEFICIARY' AND beneficiary_id IS NOT NULL AND case_id IS NULL)
 OR (owner_kind<>'CG06_BENEFICIARY' AND beneficiary_id IS NULL));
ALTER TABLE cg19_stored_file ADD CONSTRAINT cg19_beneficiary_file_disjoint CHECK(
 (owner_kind='CG06_BENEFICIARY' AND beneficiary_id IS NOT NULL AND case_id IS NULL
   AND original_mime IN('image/jpeg','image/png','image/webp','application/pdf'))
 OR (owner_kind<>'CG06_BENEFICIARY' AND beneficiary_id IS NULL));
CREATE INDEX ix_cg19_beneficiary_current_files
 ON cg19_stored_file(realm_id,beneficiary_id,proposal_revision,created_at DESC,id DESC)
 WHERE owner_kind='CG06_BENEFICIARY' AND revoked_at IS NULL;

CREATE FUNCTION cg19_beneficiary_evidence_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.beneficiary_id IS DISTINCT FROM OLD.beneficiary_id THEN
  RAISE EXCEPTION 'CG19 beneficiary evidence owner is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_beneficiary_intent_identity BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_beneficiary_evidence_identity_guard();
CREATE TRIGGER cg19_beneficiary_file_identity BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_beneficiary_evidence_identity_guard();

ALTER TABLE cg19_stored_file ADD CONSTRAINT uq_cg19_beneficiary_file_revision UNIQUE(id,realm_id,beneficiary_id,proposal_revision);
ALTER TABLE cg19_upload_intent ADD COLUMN beneficiary_consent_confirmed boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT ck_cg19_beneficiary_consent CHECK((owner_kind='CG06_BENEFICIARY')=beneficiary_consent_confirmed);
CREATE FUNCTION cg19_beneficiary_consent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.beneficiary_consent_confirmed IS DISTINCT FROM OLD.beneficiary_consent_confirmed THEN
  RAISE EXCEPTION 'Beneficiary evidence consent is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_beneficiary_intent_consent BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW EXECUTE FUNCTION cg19_beneficiary_consent_guard();
CREATE TABLE cg19_beneficiary_evidence_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 intent_ref uuid,
 file_ref uuid,
 source_revision integer NOT NULL CHECK(source_revision>0),
 action text NOT NULL CHECK(action IN(
  'UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN','FILE_REVOKED','FILE_READ')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id,beneficiary_id,source_revision)
 REFERENCES cg19_upload_intent(id,realm_id,beneficiary_id,proposal_revision) ON DELETE RESTRICT,
 FOREIGN KEY(file_ref,realm_id,beneficiary_id,source_revision) REFERENCES cg19_stored_file(id,realm_id,beneficiary_id,proposal_revision) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_beneficiary_proof_events
 ON cg19_beneficiary_evidence_event(realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE TRIGGER cg19_beneficiary_proof_event_immutable BEFORE UPDATE OR DELETE
 ON cg19_beneficiary_evidence_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();
