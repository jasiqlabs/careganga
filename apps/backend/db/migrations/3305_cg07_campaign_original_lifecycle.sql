-- US001 original A12 active/complete/cancelled and QA05/07/12 withdrawal:
-- only a current authorized original CG07 owner may drive these operations.
-- CG18 effective CMS remains separate. A paused or cancelled campaign cannot
-- appear publicly, even when its original CG18 page remains published.
ALTER TABLE campaign_status_event DROP CONSTRAINT cg07_campaign_event_operation_check;
ALTER TABLE campaign_status_event ADD CONSTRAINT cg07_campaign_event_operation_check CHECK(
 operation IN('CREATE_DRAFT','SAVE_DRAFT','SUBMIT','REVIEW_APPROVE','REVIEW_RETURN',
  'REVIEW_REJECT','CANCEL_DRAFT','PAUSE','RESUME','CLOSE','WITHDRAW'));

-- Preserve original approved CG03 proof and immutable revision/event checks,
-- extending only the existing root-scoped lifecycle statuses.
CREATE OR REPLACE FUNCTION cg07_campaign_status_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
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
  expected_action:='REVIEW_'||(CASE NEW.source_status WHEN 'APPROVED' THEN 'APPROVE'
   WHEN 'RETURNED' THEN 'RETURN' ELSE 'REJECT' END);
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
 ELSIF (OLD.source_status='DRAFT' AND NEW.source_status='WITHDRAWN')
   OR (OLD.source_status='RETURNED' AND NEW.source_status='WITHDRAWN')
   OR (OLD.source_status='APPROVED' AND NEW.source_status IN('PAUSED','CLOSED','WITHDRAWN'))
   OR (OLD.source_status='PAUSED' AND NEW.source_status IN('APPROVED','CLOSED','WITHDRAWN'))
 THEN
  IF NEW.current_revision<>OLD.current_revision OR
   (NEW.title,NEW.category,NEW.branch_ref,NEW.project_source_ref,NEW.event_source_ref,
    NEW.volunteer_source_ref,NEW.goal_minor,NEW.currency,NEW.start_at,NEW.end_at)
   IS DISTINCT FROM
   (OLD.title,OLD.category,OLD.branch_ref,OLD.project_source_ref,OLD.event_source_ref,
    OLD.volunteer_source_ref,OLD.goal_minor,OLD.currency,OLD.start_at,OLD.end_at)
  THEN RAISE EXCEPTION 'Campaign lifecycle cannot rewrite original frozen source'; END IF;
  expected_action:=CASE
   WHEN OLD.source_status IN('DRAFT','RETURNED') THEN 'CANCEL_DRAFT'
   WHEN NEW.source_status='PAUSED' THEN 'PAUSE'
   WHEN NEW.source_status='APPROVED' THEN 'RESUME'
   WHEN NEW.source_status='CLOSED' THEN 'CLOSE'
   ELSE 'WITHDRAW' END;
  IF expected_action='RESUME' AND
   (NEW.end_at IS NULL OR NEW.end_at<(now() AT TIME ZONE 'Asia/Kolkata')::date OR
    NOT EXISTS(SELECT 1 FROM cg03_case c JOIN cg03_case_decision d
      ON d.realm_id=c.realm_id AND d.case_id=c.id
     WHERE c.realm_id=NEW.root_realm_id AND c.campaign_id=NEW.id
       AND c.case_kind='CAMPAIGN_LAUNCH' AND c.status='OWNER_COMPLETED'
       AND c.campaign_source_revision=NEW.current_revision
       AND c.campaign_source_digest=current_digest
       AND d.action='APPROVE' AND d.actor_id<>c.proposer_id
       AND d.fresh_password_verified_at IS NOT NULL))
  THEN RAISE EXCEPTION 'Resuming requires original current independent approval and valid campaign period'; END IF;
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
