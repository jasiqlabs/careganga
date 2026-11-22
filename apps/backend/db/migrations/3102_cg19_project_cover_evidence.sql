-- CG05 US001: project cover bytes remain under the original CG19 scanner/storage
-- authority. Bind both intent and file to the exact immutable CG05 project revision.
ALTER TABLE cg19_upload_intent ADD COLUMN project_id uuid,
 ADD CONSTRAINT fk_cg19_project_intent_version FOREIGN KEY(realm_id,project_id,proposal_revision)
 REFERENCES project_event(root_realm_id,project_id,result_version) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_project_intent_version UNIQUE(id,realm_id,project_id,proposal_revision);
ALTER TABLE cg19_stored_file ADD COLUMN project_id uuid,
 ADD CONSTRAINT fk_cg19_project_file_version FOREIGN KEY(realm_id,project_id,proposal_revision)
 REFERENCES project_event(root_realm_id,project_id,result_version) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_project_file_intent FOREIGN KEY(upload_intent_id,realm_id,project_id,proposal_revision)
 REFERENCES cg19_upload_intent(id,realm_id,project_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_project_file_version UNIQUE(id,realm_id,project_id,proposal_revision);
DO $cg05$
DECLARE rec record; original_sql text; predicate text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) v(table_name,constraint_name,kind)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original_sql
   FROM pg_constraint WHERE conrelid=rec.table_name::regclass AND conname=rec.constraint_name AND contype='c';
  IF original_sql IS NULL THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
  IF rec.kind='OWNER' THEN
   predicate:='owner_kind=''CG05_PROJECT''';
  ELSIF rec.kind='CLASS' THEN
   predicate:='owner_kind=''CG05_PROJECT'' AND classification=''PROJECT_COVER'' AND mime IN(''image/jpeg'',''image/png'',''image/webp'')';
  ELSE
   predicate:='owner_kind=''CG05_PROJECT'' AND project_id IS NOT NULL AND num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version,reconciliation_id,health_provider_id,health_center_id,health_doctor_id,health_source_version,support_case_id,hr_application_id,hr_source_version,inventory_receipt_id,inventory_operation_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.table_name,rec.constraint_name,original_sql,predicate);
 END LOOP;
END; $cg05$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_project_intent_disjoint CHECK(
 (owner_kind='CG05_PROJECT' AND project_id IS NOT NULL)
 OR (owner_kind<>'CG05_PROJECT' AND project_id IS NULL));
ALTER TABLE cg19_stored_file ADD CONSTRAINT cg19_project_file_disjoint CHECK(
 (owner_kind='CG05_PROJECT' AND project_id IS NOT NULL AND original_mime IN('image/jpeg','image/png','image/webp'))
 OR (owner_kind<>'CG05_PROJECT' AND project_id IS NULL));
CREATE INDEX ix_cg19_project_verified_cover ON cg19_stored_file(realm_id,project_id,proposal_revision,created_at DESC,id)
 WHERE owner_kind='CG05_PROJECT' AND revoked_at IS NULL;
CREATE FUNCTION cg19_project_cover_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
  RAISE EXCEPTION 'Original project cover identity is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_project_intent_identity BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_project_cover_identity_guard();
CREATE TRIGGER cg19_project_file_identity BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_project_cover_identity_guard();
CREATE TABLE cg19_project_cover_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 project_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 intent_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id) REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg19_project_cover_event_immutable BEFORE UPDATE OR DELETE ON cg19_project_cover_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();
