-- First-install editorial release authorization, distinct from staff CG03 decisions.
-- No account impersonation, no fabricated approval case, no migration of existing content.
CREATE TABLE cms_release_install(
 foundation_root_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 release_key text NOT NULL CHECK(release_key='CAREGANGA_INITIAL_EDITORIAL_V1'),
 installed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER cg18_release_install_immutable BEFORE UPDATE OR DELETE ON cms_release_install
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
ALTER TABLE cms_page ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE cms_page ADD COLUMN release_baseline boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT cg18_page_creator_provenance CHECK((created_by IS NULL)=release_baseline);
ALTER TABLE cms_page_revision ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE cms_page_revision ADD COLUMN release_baseline boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT cg18_revision_creator_provenance CHECK(
 (created_by IS NULL)=release_baseline AND
 (NOT release_baseline OR (revision_no=1 AND status='DRAFT' AND approval_case_ref IS NULL)));
ALTER TABLE cms_publication ALTER COLUMN created_by DROP NOT NULL,
 ALTER COLUMN cg03_final_decision_ref DROP NOT NULL;
ALTER TABLE cms_publication ADD COLUMN release_baseline boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT cg18_publication_provenance CHECK(
 (release_baseline AND created_by IS NULL AND cg03_final_decision_ref IS NULL AND state<>'SCHEDULED')
 OR (NOT release_baseline AND created_by IS NOT NULL AND cg03_final_decision_ref IS NOT NULL));
CREATE UNIQUE INDEX ux_cg18_release_publication_once ON cms_publication(foundation_root_id,page_id) WHERE release_baseline;
ALTER TABLE cms_navigation_revision ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE cms_navigation_revision ADD COLUMN release_baseline boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT cg18_navigation_creator_provenance CHECK(
 (created_by IS NULL)=release_baseline AND
 (NOT release_baseline OR (status='DRAFT' AND cg03_decision_ref IS NULL AND effective_at IS NULL)));
-- Seed construction is transactional. Once the baseline publication is inserted,
-- its exact revision/sections and navigation must not be editable, even via SQL
-- paths that previously allowed ordinary drafts. Normal draft triggers remain.
CREATE FUNCTION cg18_release_frozen_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ref uuid; root uuid;
BEGIN
 IF TG_TABLE_NAME='cms_page_revision' THEN
  ref:=OLD.id; root:=OLD.foundation_root_id;
  IF OLD.release_baseline THEN RAISE EXCEPTION 'Release revision is immutable' USING ERRCODE='P1831'; END IF;
  IF TG_OP='UPDATE' AND NEW.release_baseline IS DISTINCT FROM OLD.release_baseline THEN RAISE EXCEPTION 'Release provenance cannot change' USING ERRCODE='P1831'; END IF;
 ELSIF TG_TABLE_NAME='cms_navigation_revision' THEN
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF OLD.release_baseline OR (TG_OP='UPDATE' AND NEW.release_baseline IS DISTINCT FROM OLD.release_baseline) THEN RAISE EXCEPTION 'Release navigation is immutable' USING ERRCODE='P1835'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 ELSE
  IF TG_OP='INSERT' THEN ref:=NEW.page_revision_id; root:=NEW.foundation_root_id;
  ELSE ref:=OLD.page_revision_id; root:=OLD.foundation_root_id; END IF;
  IF EXISTS(SELECT 1 FROM cms_page_revision v WHERE v.foundation_root_id=root AND v.id=ref AND v.release_baseline AND (EXISTS(SELECT 1 FROM cms_publication pub WHERE pub.foundation_root_id=root AND pub.page_revision_id=ref AND pub.release_baseline) OR EXISTS(SELECT 1 FROM cms_release_install i WHERE i.foundation_root_id=root)))
  THEN RAISE EXCEPTION 'Release content is immutable' USING ERRCODE='P1831'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER cg18_release_revision_guard BEFORE UPDATE OR DELETE ON cms_page_revision
 FOR EACH ROW EXECUTE FUNCTION cg18_release_frozen_guard();
CREATE TRIGGER cg18_release_section_guard BEFORE INSERT OR UPDATE OR DELETE ON cms_section_revision
 FOR EACH ROW EXECUTE FUNCTION cg18_release_frozen_guard();
CREATE TRIGGER cg18_release_asset_guard BEFORE INSERT OR UPDATE OR DELETE ON cms_asset_placement
 FOR EACH ROW EXECUTE FUNCTION cg18_release_frozen_guard();
CREATE TRIGGER cg18_release_nav_guard BEFORE UPDATE OR DELETE ON cms_navigation_revision
 FOR EACH ROW EXECUTE FUNCTION cg18_release_frozen_guard();
CREATE FUNCTION cg18_release_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.release_baseline IS DISTINCT FROM OLD.release_baseline THEN RAISE EXCEPTION 'Publication provenance cannot change'; END IF;
  IF OLD.release_baseline AND (NEW.foundation_root_id,NEW.page_id,NEW.page_revision_id,NEW.source_content_digest,NEW.publication_key,NEW.effective_at)
    IS DISTINCT FROM (OLD.foundation_root_id,OLD.page_id,OLD.page_revision_id,OLD.source_content_digest,OLD.publication_key,OLD.effective_at)
   THEN RAISE EXCEPTION 'Release publication source cannot change'; END IF;
  IF OLD.release_baseline AND OLD.state<>'EFFECTIVE' AND NEW.state='EFFECTIVE'
   THEN RAISE EXCEPTION 'Withdrawn or superseded release cannot be restored'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.release_baseline THEN
  IF NEW.state<>'EFFECTIVE' OR NOT EXISTS(
   SELECT 1 FROM cms_page_revision v JOIN cms_page p ON p.id=v.page_id AND p.foundation_root_id=v.foundation_root_id
   WHERE v.id=NEW.page_revision_id AND v.page_id=NEW.page_id AND v.foundation_root_id=NEW.foundation_root_id
    AND v.release_baseline AND p.release_baseline AND p.archived_at IS NULL AND v.content_digest=NEW.source_content_digest
    AND p.slug IN ('home','about','healthcare','contact','collaboration','our-impact','gallery','80g'))
   OR EXISTS(SELECT 1 FROM cms_publication WHERE foundation_root_id=NEW.foundation_root_id AND page_id=NEW.page_id)
   OR EXISTS(SELECT 1 FROM cms_asset_placement WHERE foundation_root_id=NEW.foundation_root_id AND page_revision_id=NEW.page_revision_id)
   THEN RAISE EXCEPTION 'Invalid first-install editorial release'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg18_release_publication_guard BEFORE INSERT OR UPDATE ON cms_publication
 FOR EACH ROW EXECUTE FUNCTION cg18_release_publication_guard();

-- Fixed build-bundled illustrations are not CG19 uploads. Do not counterfeit
-- an object-store generation, malware-scan proof, or human media approval.
CREATE TABLE cms_release_asset(
 foundation_root_id uuid NOT NULL,
 page_revision_id uuid NOT NULL,
 asset_key text NOT NULL,
 role text NOT NULL,
 sort_order smallint NOT NULL,
 PRIMARY KEY(foundation_root_id,page_revision_id,role,sort_order),
 FOREIGN KEY(foundation_root_id,page_revision_id) REFERENCES cms_page_revision(foundation_root_id,id) ON DELETE RESTRICT,
 CHECK((asset_key,role,sort_order) IN (
 ('community-illustration-hero','HERO',0),('riverbank-community','ABOUT',20),
 ('community-planning','PROMO',30),('flood-relief','FEATURE',0),
 ('community-education','FEATURE',1),('community-healthcare','FEATURE',2),
 ('healthcare-hero','HERO',0),
 ('healthcare-poly-clinic','FEATURE',0),
 ('healthcare-diagnostic-centre','FEATURE',1),
 ('healthcare-dental-clinic','FEATURE',2),
 ('healthcare-medical-laboratory','FEATURE',3),
 ('healthcare-hospital-nursing','FEATURE',4),
 ('healthcare-retail-pharmacy','FEATURE',5),
 ('healthcare-orthopedic-centre','FEATURE',6),
 ('healthcare-homoeopathy-centre','FEATURE',7),
 ('healthcare-ayurvedic-centre','FEATURE',8)))
);
CREATE TRIGGER cg18_release_asset_freeze BEFORE INSERT OR UPDATE OR DELETE ON cms_release_asset
 FOR EACH ROW EXECUTE FUNCTION cg18_release_frozen_guard();
CREATE TRIGGER cg18_release_asset_draft_guard BEFORE INSERT OR UPDATE OR DELETE ON cms_release_asset
 FOR EACH ROW EXECUTE FUNCTION cg18_guard_revision_mutation();
CREATE FUNCTION cg18_release_asset_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cms_page_revision v JOIN cms_page p ON p.id=v.page_id AND p.foundation_root_id=v.foundation_root_id
  WHERE v.id=NEW.page_revision_id AND v.foundation_root_id=NEW.foundation_root_id AND p.release_baseline AND ((p.slug='home' AND NEW.asset_key NOT LIKE 'healthcare-%') OR (p.slug='healthcare' AND NEW.asset_key LIKE 'healthcare-%')))
 THEN RAISE EXCEPTION 'Bundled asset must belong to its original editorial page'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg18_release_asset_scope_guard BEFORE INSERT OR UPDATE ON cms_release_asset
 FOR EACH ROW EXECUTE FUNCTION cg18_release_asset_scope();
