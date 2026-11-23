-- CG07 US001 security owner guard: no source may become verified/public/paid
-- from a direct status flip. This deferred check requires original immutable
-- CG07 revision/events and genuine CG03 protected case/decision proof.
CREATE FUNCTION cg07_campaign_status_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
DECLARE expected_action text; current_digest char(64);
BEGIN
 SELECT immutable_digest INTO current_digest FROM campaign_revision
 WHERE root_realm_id=NEW.root_realm_id AND campaign_id=NEW.id AND revision_no=NEW.current_revision;
 IF current_digest IS NULL THEN
  RAISE EXCEPTION 'Campaign current original revision is unavailable';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.source_status<>'DRAFT' OR NEW.version<>1 OR NEW.current_revision<>1 OR
   NOT EXISTS(SELECT 1 FROM campaign_status_event e
    WHERE e.root_realm_id=NEW.root_realm_id AND e.campaign_id=NEW.id
     AND e.operation='CREATE_DRAFT' AND e.source_revision=NEW.current_revision
     AND e.digest=current_digest AND e.resulting_version=NEW.version
     AND e.resulting_status='DRAFT' AND e.prior_status IS NULL
     AND e.actor_ref=NEW.created_by)
  THEN RAISE EXCEPTION 'Campaign creation must be an original draft revision'; END IF;
  RETURN NULL;
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.id IS DISTINCT FROM OLD.id OR NEW.code_norm IS DISTINCT FROM OLD.code_norm OR
  NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
  NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Campaign source identity/version is immutable';
 END IF;
 IF (OLD.source_status='DRAFT' AND NEW.source_status='DRAFT') OR
    (OLD.source_status='RETURNED' AND NEW.source_status='DRAFT') THEN
  expected_action:='SAVE_DRAFT';
  IF NEW.current_revision<>OLD.current_revision+1 THEN
   RAISE EXCEPTION 'Campaign draft edit must create a new immutable revision'; END IF;
 ELSIF OLD.source_status='DRAFT' AND NEW.source_status='SUBMITTED' THEN
  expected_action:='SUBMIT';
  IF NEW.current_revision<>OLD.current_revision OR
   NOT EXISTS(SELECT 1 FROM cg03_case c JOIN campaign_review_snapshot s
     ON s.root_realm_id=c.realm_id AND s.id=c.campaign_review_ref
    WHERE c.realm_id=NEW.root_realm_id AND c.campaign_id=NEW.id
     AND c.case_kind='CAMPAIGN_LAUNCH' AND c.status='SUBMITTED'
     AND c.campaign_source_revision=NEW.current_revision AND c.campaign_source_digest=current_digest
     AND c.campaign_source_revision=s.source_revision AND c.campaign_source_digest=s.source_digest)
  THEN RAISE EXCEPTION 'Campaign submission requires original CG03 source case'; END IF;
 ELSIF OLD.source_status='SUBMITTED' AND NEW.source_status IN('APPROVED','RETURNED','REJECTED') THEN
  expected_action:=CASE NEW.source_status WHEN 'APPROVED' THEN 'REVIEW_APPROVE'
   WHEN 'RETURNED' THEN 'REVIEW_RETURN' ELSE 'REVIEW_REJECT' END;
  IF NEW.current_revision<>OLD.current_revision OR
   NOT EXISTS(SELECT 1 FROM cg03_case c JOIN cg03_case_decision d
      ON d.realm_id=c.realm_id AND d.case_id=c.id
    WHERE c.realm_id=NEW.root_realm_id AND c.campaign_id=NEW.id
     AND c.case_kind='CAMPAIGN_LAUNCH'
     AND c.campaign_source_revision=NEW.current_revision AND c.campaign_source_digest=current_digest
     AND d.action=CASE NEW.source_status WHEN 'APPROVED' THEN 'APPROVE'
       WHEN 'RETURNED' THEN 'RETURN' ELSE 'REJECT' END
     AND d.fresh_password_verified_at IS NOT NULL
     AND c.status=CASE NEW.source_status WHEN 'APPROVED' THEN 'OWNER_COMPLETED'
       ELSE NEW.source_status END)
  THEN RAISE EXCEPTION 'Campaign status requires verified CG03 decision'; END IF;
  IF (NEW.title,NEW.category,NEW.branch_ref,NEW.project_source_ref,NEW.event_source_ref,
      NEW.volunteer_source_ref,NEW.goal_minor,NEW.currency,NEW.start_at,NEW.end_at) IS DISTINCT FROM
     (OLD.title,OLD.category,OLD.branch_ref,OLD.project_source_ref,OLD.event_source_ref,
      OLD.volunteer_source_ref,OLD.goal_minor,OLD.currency,OLD.start_at,OLD.end_at)
  THEN RAISE EXCEPTION 'Protected campaign decision cannot rewrite approved source'; END IF;
 ELSE
  RAISE EXCEPTION 'Campaign lifecycle change has no original owner route';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM campaign_status_event e
   WHERE e.root_realm_id=NEW.root_realm_id AND e.campaign_id=NEW.id
    AND e.operation=expected_action AND e.source_revision=NEW.current_revision
    AND e.digest=current_digest AND e.resulting_version=NEW.version
    AND e.prior_status IS NOT DISTINCT FROM OLD.source_status
    AND e.resulting_status=NEW.source_status)
 THEN RAISE EXCEPTION 'Campaign state must have one matching immutable owner event'; END IF;
 RETURN NULL;
END; $cg07$;
CREATE CONSTRAINT TRIGGER cg07_campaign_status_proof_after
 AFTER INSERT OR UPDATE ON campaign DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_status_proof_guard();

-- CG07 3301 deliberately blocks every non-draft write until the owner review
-- and deferred CG03 evidence guard are both installed. Keeping that trigger
-- would make every genuine DRAFT -> SUBMITTED transaction fail at runtime.
-- Replace (not bypass) the temporary guard only after the new proof guard is
-- successfully defined in this same migration transaction.
DROP TRIGGER cg07_campaign_draft_only ON campaign;
DROP FUNCTION cg07_campaign_draft_only();

