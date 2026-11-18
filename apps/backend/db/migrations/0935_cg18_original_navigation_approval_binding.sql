-- CG18 US001: three independent desired navigation flags are versioned with the
-- HOME draft and covered by its *same actual CG03 CMS_PUBLICATION case*.
-- One approval covers the exact original page+navigation digest; no shadow
-- CG03 process, standalone toggle authorization, or fake CG04 Join route.
ALTER TABLE cms_navigation_revision
 ADD COLUMN home_revision_id uuid NOT NULL,
 ADD CONSTRAINT fk_cg18_navigation_home_source
  FOREIGN KEY(foundation_root_id,home_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg18_navigation_home_source
  UNIQUE(foundation_root_id,home_revision_id);
CREATE INDEX ix_cg18_navigation_current
 ON cms_navigation_revision(foundation_root_id,revision_no DESC);
CREATE FUNCTION cg18_guard_navigation_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual record;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT p.kind,v.content_digest INTO actual
   FROM cms_page_revision v JOIN cms_page p
    ON p.id=v.page_id AND p.foundation_root_id=v.foundation_root_id
   WHERE v.id=NEW.home_revision_id AND v.foundation_root_id=NEW.foundation_root_id
   FOR SHARE OF p,v;
  IF NOT FOUND OR actual.kind<>'HOME' OR
    actual.content_digest IS DISTINCT FROM NEW.source_digest OR
    NEW.status<>'DRAFT' OR NEW.cg03_decision_ref IS NOT NULL OR
    NEW.effective_at IS NOT NULL THEN
   RAISE EXCEPTION 'Navigation must start as original Home draft'
    USING ERRCODE='P1835';
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' OR
    NEW.foundation_root_id IS DISTINCT FROM OLD.foundation_root_id OR
    NEW.home_revision_id IS DISTINCT FROM OLD.home_revision_id OR
    NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
    NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'Approved navigation evidence cannot change'
   USING ERRCODE='P1835';
 END IF;
 IF OLD.status='DRAFT' THEN
  IF NEW.status NOT IN('DRAFT','SUBMITTED') OR
    (NEW.status='SUBMITTED' AND
      (NEW.cg03_decision_ref IS NOT NULL OR NEW.effective_at IS NOT NULL)) THEN
   RAISE EXCEPTION 'Navigation requires original submission'
    USING ERRCODE='P1835';
  END IF;
  SELECT v.content_digest INTO actual FROM cms_page_revision v
   WHERE v.id=NEW.home_revision_id AND v.foundation_root_id=NEW.foundation_root_id
   FOR SHARE;
  IF NOT FOUND OR actual.content_digest IS DISTINCT FROM NEW.source_digest THEN
   RAISE EXCEPTION 'Navigation and page must share one reviewed digest'
    USING ERRCODE='P1835';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.status='SUBMITTED' AND NEW.status='APPROVED' AND
    NEW.source_digest=OLD.source_digest AND
    NEW.login_desired=OLD.login_desired AND
    NEW.member_join_desired=OLD.member_join_desired AND
    NEW.volunteer_join_desired=OLD.volunteer_join_desired AND
    NEW.cg03_decision_ref IS NOT NULL AND NEW.effective_at IS NOT NULL THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Submitted or approved navigation is immutable'
  USING ERRCODE='P1835';
END; $$;
CREATE TRIGGER cg18_navigation_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cms_navigation_revision
 FOR EACH ROW EXECUTE FUNCTION cg18_guard_navigation_source();
ALTER TABLE cms_navigation_revision ADD CONSTRAINT fk_cg18_navigation_cg03_decision
 FOREIGN KEY(cg03_decision_ref)
 REFERENCES cg03_case_decision(id) ON DELETE RESTRICT;
