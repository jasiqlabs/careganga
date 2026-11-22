-- CG10 US004: root-authorized signatory assets remain in original CG19 private file authority.
DO $migration$
DECLARE rec record; old_check text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','owner_kind=''CG19_HR_TEMPLATE_ASSET'''),
 ('cg19_stored_file','cg19_stored_file_owner_kind_check','owner_kind=''CG19_HR_TEMPLATE_ASSET'''),
 ('cg19_upload_intent','cg19_intent_branch_source','owner_kind=''CG19_HR_TEMPLATE_ASSET'' AND case_id IS NULL AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,health_provider_id,health_center_id,health_doctor_id,health_source_version,hr_application_id,hr_source_version)=0 AND proposal_revision=1'),
 ('cg19_stored_file','cg19_file_branch_source','owner_kind=''CG19_HR_TEMPLATE_ASSET'' AND case_id IS NULL AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,health_provider_id,health_center_id,health_doctor_id,health_source_version,hr_application_id,hr_source_version)=0 AND proposal_revision=1'),
 ('cg19_upload_intent','cg19_intent_source_classification','owner_kind=''CG19_HR_TEMPLATE_ASSET'' AND classification IN(''HR_TEMPLATE_SIGNATURE'',''HR_TEMPLATE_SEAL'')')
 ) v(table_name,constraint_name,extra)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO old_check FROM pg_constraint c
  WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF old_check IS NULL OR left(old_check,1)<>'(' THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,old_check,rec.extra);
 END LOOP;
 FOR rec IN SELECT conrelid::regclass::text AS table_name,conname AS constraint_name,
   substring(pg_get_constraintdef(oid) FROM 7) AS expression FROM pg_constraint
   WHERE (conrelid='cg19_upload_intent'::regclass AND conname='cg19_intent_owner_kind')
      OR (conrelid='cg19_stored_file'::regclass AND conname='cg19_file_owner_kind')
 LOOP
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (owner_kind=''CG19_HR_TEMPLATE_ASSET''))',rec.table_name,rec.constraint_name,rec.expression);
 END LOOP;
END; $migration$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_hr_asset_intent CHECK(
 (owner_kind='CG19_HR_TEMPLATE_ASSET' AND classification IN('HR_TEMPLATE_SIGNATURE','HR_TEMPLATE_SEAL') AND mime IN('image/jpeg','image/png') AND size_bytes BETWEEN 1 AND 2097152)
 OR (owner_kind<>'CG19_HR_TEMPLATE_ASSET' AND classification NOT IN('HR_TEMPLATE_SIGNATURE','HR_TEMPLATE_SEAL')));
ALTER TABLE cg19_document_event ADD COLUMN hr_template_asset boolean NOT NULL DEFAULT false;
DO $migration$
DECLARE old_check text;
BEGIN
 SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO old_check FROM pg_constraint c
 WHERE c.conrelid='cg19_document_event'::regclass AND c.conname='cg19_doc_event_source' AND c.contype='c';
 IF old_check IS NULL OR left(old_check,1)<>'(' THEN RAISE EXCEPTION 'Original document event source constraint missing'; END IF;
 EXECUTE 'ALTER TABLE cg19_document_event DROP CONSTRAINT cg19_doc_event_source';
 EXECUTE format('ALTER TABLE cg19_document_event ADD CONSTRAINT cg19_doc_event_source CHECK ((NOT hr_template_asset AND (%s)) OR (hr_template_asset AND num_nonnulls(case_id,registration_id,branch_id,health_provider_id,health_doctor_id)=0 AND intent_id IS NOT NULL AND document_id IS NULL AND file_id IS NULL))',old_check);
END; $migration$;
CREATE FUNCTION cg19_hr_asset_event_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.hr_template_asset AND NOT EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.intent_id
 AND i.owner_kind='CG19_HR_TEMPLATE_ASSET' AND i.requested_by=NEW.actor_id AND NEW.event_key IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN'))
 THEN RAISE EXCEPTION 'Original root template asset upload event required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_asset_event_guard BEFORE INSERT ON cg19_document_event FOR EACH ROW EXECUTE FUNCTION cg19_hr_asset_event_guard();
CREATE FUNCTION cg19_hr_asset_file_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.owner_kind='CG19_HR_TEMPLATE_ASSET' OR EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.id=NEW.upload_intent_id AND i.realm_id=NEW.realm_id AND i.owner_kind='CG19_HR_TEMPLATE_ASSET') THEN
  IF NOT EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.id=NEW.upload_intent_id AND i.realm_id=NEW.realm_id AND i.owner_kind='CG19_HR_TEMPLATE_ASSET' AND NEW.owner_kind=i.owner_kind
   AND i.status='VALIDATED' AND i.requested_by=NEW.created_by AND i.object_key=NEW.object_key AND i.mime=NEW.original_mime AND i.size_bytes=NEW.verified_size_bytes
   AND i.expected_sha256=NEW.verified_sha256 AND NEW.scan_status='CLEAN_VERIFIED' AND NEW.case_id IS NULL AND NEW.proposal_revision=1)
  THEN RAISE EXCEPTION 'Exact verified root template asset required'; END IF;
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_asset_file_guard BEFORE INSERT ON cg19_stored_file FOR EACH ROW EXECUTE FUNCTION cg19_hr_asset_file_guard();
ALTER TABLE cg19_document_template
 ADD COLUMN hr_signatory_name text CHECK(length(hr_signatory_name) BETWEEN 2 AND 100),
 ADD COLUMN hr_signature_file_ref uuid,
 ADD COLUMN hr_seal_file_ref uuid,
 ADD CONSTRAINT fk_cg19_hr_template_signature FOREIGN KEY(hr_signature_file_ref,realm_id) REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_hr_template_seal FOREIGN KEY(hr_seal_file_ref,realm_id) REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_hr_template_asset_presence CHECK(
  num_nonnulls(hr_signatory_name,hr_signature_file_ref,hr_seal_file_ref)=0
  OR (template_kind LIKE 'HR_%' AND num_nonnulls(hr_signatory_name,hr_signature_file_ref,hr_seal_file_ref)=3 AND hr_signature_file_ref<>hr_seal_file_ref));
CREATE FUNCTION cg19_hr_template_assets_ready(root uuid,signature uuid,seal uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT signature IS NOT NULL AND seal IS NOT NULL AND signature<>seal AND EXISTS(
  SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.realm_id=root AND f.id=signature AND f.owner_kind='CG19_HR_TEMPLATE_ASSET' AND i.owner_kind=f.owner_kind
   AND i.classification='HR_TEMPLATE_SIGNATURE' AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 ) AND EXISTS(
  SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.realm_id=root AND f.id=seal AND f.owner_kind='CG19_HR_TEMPLATE_ASSET' AND i.owner_kind=f.owner_kind
   AND i.classification='HR_TEMPLATE_SEAL' AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 )
$fn$;
CREATE FUNCTION cg19_hr_template_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.hr_signatory_name,NEW.hr_signature_file_ref,NEW.hr_seal_file_ref) IS DISTINCT FROM (OLD.hr_signatory_name,OLD.hr_signature_file_ref,OLD.hr_seal_file_ref)
 THEN RAISE EXCEPTION 'Approved HR template asset metadata cannot change'; END IF;
 IF TG_OP='INSERT' AND NEW.template_kind LIKE 'HR_%' AND (NEW.hr_signatory_name IS NULL OR NOT cg19_hr_template_assets_ready(NEW.realm_id,NEW.hr_signature_file_ref,NEW.hr_seal_file_ref))
 THEN RAISE EXCEPTION 'Approved template requires authorized scan-verified signatory assets'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_template_asset_guard BEFORE INSERT OR UPDATE ON cg19_document_template FOR EACH ROW EXECUTE FUNCTION cg19_hr_template_asset_guard();
CREATE FUNCTION cg10_hr_template_ready_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (TG_OP='INSERT' OR NEW.status IN('SUBMITTED','APPROVED')) AND NOT EXISTS(SELECT 1 FROM cg19_document_template t
 WHERE t.realm_id=NEW.root_realm_id AND t.id=NEW.template_id AND t.version=NEW.template_version AND t.status='APPROVED'
 AND t.hr_signatory_name IS NOT NULL AND cg19_hr_template_assets_ready(t.realm_id,t.hr_signature_file_ref,t.hr_seal_file_ref))
 THEN RAISE EXCEPTION 'Original authorized template assets unavailable'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg10_hr_template_ready_guard BEFORE INSERT OR UPDATE ON hr_document_request FOR EACH ROW EXECUTE FUNCTION cg10_hr_template_ready_guard();
