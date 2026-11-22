-- CG07 US001 / CG19 ORIGINAL private file authority.
-- Extend the already deployed CG19 upload/scan/file tables; NEVER create a
-- second blob store or declare upload success from an object URL.
-- The upload is tied to an immutable campaign revision. The next draft revision
-- may cite a previously verified image; a revoked proof can never be submitted.
ALTER TABLE cg19_upload_intent
 ADD COLUMN campaign_id uuid,
 ADD COLUMN campaign_media_rights_confirmed boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT fk_cg19_campaign_intent_revision
  FOREIGN KEY(realm_id,campaign_id,proposal_revision)
  REFERENCES campaign_revision(root_realm_id,campaign_id,revision_no) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_campaign_intent_revision UNIQUE(id,realm_id,campaign_id,proposal_revision),
 ADD CONSTRAINT cg19_campaign_intent_disjoint CHECK(
  (owner_kind='CG07_CAMPAIGN' AND campaign_id IS NOT NULL AND campaign_media_rights_confirmed)
  OR (owner_kind<>'CG07_CAMPAIGN' AND campaign_id IS NULL AND NOT campaign_media_rights_confirmed));

ALTER TABLE cg19_stored_file
 ADD COLUMN campaign_id uuid,
 ADD CONSTRAINT fk_cg19_campaign_file_revision
  FOREIGN KEY(realm_id,campaign_id,proposal_revision)
  REFERENCES campaign_revision(root_realm_id,campaign_id,revision_no) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_campaign_file_intent
  FOREIGN KEY(upload_intent_id,realm_id,campaign_id,proposal_revision)
  REFERENCES cg19_upload_intent(id,realm_id,campaign_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_campaign_file_disjoint CHECK(
  (owner_kind='CG07_CAMPAIGN' AND campaign_id IS NOT NULL
    AND original_mime IN('image/jpeg','image/png','image/webp','application/pdf'))
  OR (owner_kind<>'CG07_CAMPAIGN' AND campaign_id IS NULL));

-- Preserve all original CG19 owner kinds/CASE/branch/status checks and add just
-- the original campaign media route. Abort migration if an expected guard moved.
DO $cg07$
DECLARE rec record; old_check text; extra text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) AS guards(table_name,constraint_name,kind)
 LOOP
  SELECT pg_get_expr(c.conbin,c.conrelid) INTO old_check FROM pg_constraint c
  WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF old_check IS NULL THEN RAISE EXCEPTION 'Original CG19 owner guard unavailable: %',rec.constraint_name; END IF;
  IF rec.kind='OWNER' THEN
   extra:='owner_kind=''CG07_CAMPAIGN''';
  ELSIF rec.kind='CLASS' THEN
   extra:='owner_kind=''CG07_CAMPAIGN'' AND ((classification=''CAMPAIGN_COVER'' AND mime IN(''image/jpeg'',''image/png'')) OR (classification=''CAMPAIGN_BANNER'' AND mime IN(''image/jpeg'',''image/png'',''image/webp'')) OR (classification=''CAMPAIGN_DOCUMENT'' AND mime IN(''image/jpeg'',''image/png'',''image/webp'',''application/pdf'')))';
  ELSE
   extra:='owner_kind=''CG07_CAMPAIGN'' AND campaign_id IS NOT NULL
     AND num_nonnulls(case_id,registration_id,registration_draft_version,
       branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version,
       reconciliation_id,health_provider_id,health_center_id,health_doctor_id,
       health_source_version,support_case_id,hr_application_id,hr_source_version,
       inventory_receipt_id,inventory_operation_id,project_id,activity_id,visit_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
    rec.table_name,rec.constraint_name,old_check,extra);
 END LOOP;
END $cg07$;

CREATE INDEX ix_cg19_campaign_verified_media
 ON cg19_stored_file(realm_id,campaign_id,proposal_revision,created_at DESC,id)
 WHERE owner_kind='CG07_CAMPAIGN' AND revoked_at IS NULL;

CREATE FUNCTION cg19_campaign_media_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN
  RAISE EXCEPTION 'Original campaign file ownership cannot change';
 END IF;
 IF TG_TABLE_NAME='cg19_upload_intent' THEN
  IF NEW.campaign_media_rights_confirmed IS DISTINCT FROM OLD.campaign_media_rights_confirmed THEN
   RAISE EXCEPTION 'Original campaign file consent cannot be changed';
  END IF;
 END IF;
 RETURN NEW;
END $cg07$;
CREATE TRIGGER cg19_campaign_intent_identity BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_campaign_media_identity_immutable();
CREATE TRIGGER cg19_campaign_file_identity BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_campaign_media_identity_immutable();

ALTER TABLE cg19_upload_intent ADD CONSTRAINT uq_cg19_campaign_intent_owner UNIQUE(id,realm_id,campaign_id);

CREATE TABLE cg19_campaign_media_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 campaign_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 intent_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,campaign_id) REFERENCES campaign(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id,campaign_id)
 REFERENCES cg19_upload_intent(id,realm_id,campaign_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg19_campaign_event_immutable BEFORE UPDATE OR DELETE ON cg19_campaign_media_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();

-- The original campaign revision freezes only verified CG19-owned files.
-- The scan and consent must still be current when the campaign is submitted
-- or approved, even if proof was revoked after the author saved their draft.
CREATE FUNCTION cg07_campaign_media_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
DECLARE cover text; banner text; supporting jsonb; document_ref text; proof_count integer;
BEGIN
 IF NEW.source_status NOT IN('SUBMITTED','APPROVED') THEN RETURN NULL; END IF;
 SELECT step5_media_refs->>'coverRef',step5_media_refs->>'fileRef',
    COALESCE(step5_media_refs->'supportingFileRefs','[]'::jsonb)
 INTO cover,banner,supporting FROM campaign_revision
 WHERE root_realm_id=NEW.root_realm_id
  AND campaign_id=NEW.id AND revision_no=NEW.current_revision;
 IF supporting IS NULL OR jsonb_typeof(supporting)<>'array'
  OR jsonb_array_length(supporting)>6
 THEN RAISE EXCEPTION 'Campaign supporting document proof shape is invalid'; END IF;
 IF cover IS NOT NULL AND cover<>'' THEN
  SELECT count(*) INTO proof_count FROM cg19_stored_file f
  JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.realm_id=NEW.root_realm_id AND f.campaign_id=NEW.id
    AND f.id=cover::uuid AND f.proposal_revision<=NEW.current_revision
    AND f.owner_kind='CG07_CAMPAIGN'
    AND f.original_mime IN('image/jpeg','image/png')
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND i.owner_kind='CG07_CAMPAIGN' AND i.campaign_media_rights_confirmed
    AND i.status='VALIDATED' AND i.classification='CAMPAIGN_COVER'
    AND i.campaign_id=NEW.id;
  IF proof_count<>1 THEN RAISE EXCEPTION 'Original campaign cover proof is no longer verified'; END IF;
 END IF;
 IF banner IS NOT NULL AND banner<>'' THEN
  SELECT count(*) INTO proof_count FROM cg19_stored_file f
  JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.realm_id=NEW.root_realm_id AND f.campaign_id=NEW.id
    AND f.id=banner::uuid AND f.proposal_revision<=NEW.current_revision
    AND f.owner_kind='CG07_CAMPAIGN'
    AND f.original_mime IN('image/jpeg','image/png','image/webp')
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND i.owner_kind='CG07_CAMPAIGN' AND i.campaign_media_rights_confirmed
    AND i.status='VALIDATED' AND i.classification='CAMPAIGN_BANNER'
    AND i.campaign_id=NEW.id;
  IF proof_count<>1 THEN RAISE EXCEPTION 'Original campaign banner proof is no longer verified'; END IF;
 END IF;
 FOR document_ref IN SELECT jsonb_array_elements_text(supporting) LOOP
  SELECT count(*) INTO proof_count FROM cg19_stored_file f
  JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.realm_id=NEW.root_realm_id AND f.campaign_id=NEW.id
    AND f.id=document_ref::uuid AND f.proposal_revision<=NEW.current_revision
    AND f.owner_kind='CG07_CAMPAIGN'
    AND f.original_mime IN('image/jpeg','image/png','image/webp','application/pdf')
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND i.owner_kind='CG07_CAMPAIGN' AND i.campaign_media_rights_confirmed
    AND i.status='VALIDATED' AND i.classification='CAMPAIGN_DOCUMENT'
    AND i.campaign_id=NEW.id;
  IF proof_count<>1 THEN RAISE EXCEPTION 'Original campaign supporting document proof is no longer verified'; END IF;
 END LOOP;
 RETURN NULL;
END $cg07$;
CREATE CONSTRAINT TRIGGER cg07_campaign_media_proof_after
 AFTER UPDATE ON campaign DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_media_proof_guard();
