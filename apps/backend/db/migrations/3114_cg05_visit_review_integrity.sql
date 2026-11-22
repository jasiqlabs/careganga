-- Review state is not an arbitrary boolean on the visit record. Tie it to the
-- original CG03 snapshot and actual decision; check at commit in the same transaction.
CREATE FUNCTION cg05_visit_review_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_kind='SUBMIT_REVIEW' THEN
  IF NEW.resulting_status<>'PENDING_APPROVAL' OR NOT EXISTS(
   SELECT 1 FROM field_visit_review_snapshot s JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.visit_review_ref=s.id
   WHERE s.root_realm_id=NEW.root_realm_id AND s.visit_id=NEW.visit_id AND s.visit_version=NEW.result_version
     AND s.request_key=NEW.event_key AND s.source_digest=NEW.payload_digest AND s.submitted_by=NEW.actor_account_ref
     AND c.case_kind='FIELD_VISIT_REVIEW') THEN RAISE EXCEPTION 'Visit submission requires original review case'; END IF;
 ELSIF NEW.event_kind='REVIEW_DECISION' THEN
  IF NOT EXISTS(SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
   JOIN cg03_process_step step ON step.process_id=c.process_id AND step.ordinal=d.step_ordinal
   JOIN field_visit v ON v.root_realm_id=c.realm_id AND v.id=c.visit_review_id
   WHERE c.realm_id=NEW.root_realm_id AND c.case_kind='FIELD_VISIT_REVIEW' AND c.visit_review_id=NEW.visit_id
    AND d.step_ordinal=c.current_step AND d.actor_id<>c.proposer_id AND d.actor_id<>v.actor_account_ref
    AND (NOT step.protected_root_required OR d.fresh_password_verified_at IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM cg03_case_decision earlier WHERE earlier.realm_id=c.realm_id AND earlier.case_id=c.id AND earlier.step_ordinal<d.step_ordinal AND earlier.actor_id=d.actor_id)
    AND (d.step_ordinal=1 OR EXISTS(SELECT 1 FROM cg03_case_decision earlier WHERE earlier.realm_id=c.realm_id AND earlier.case_id=c.id AND earlier.step_ordinal=1 AND earlier.action IN('APPROVE','FORWARD')))
    AND c.visit_review_version=NEW.result_version-1 AND d.request_key=NEW.event_key AND d.actor_id=NEW.actor_account_ref
    AND d.request_digest=NEW.payload_digest
    AND ((d.action='APPROVE' AND step.protected_root_required AND step.capability_key='approvals.review' AND NEW.resulting_status='COMPLETED' AND c.status='OWNER_COMPLETED')
      OR(d.action='RETURN' AND NEW.resulting_status='RETURNED' AND c.status='RETURNED')
      OR(d.action='REJECT' AND NEW.resulting_status='REJECTED' AND c.status='REJECTED'))) THEN
    RAISE EXCEPTION 'Visit approval requires matching original CG03 decision'; END IF;
 ELSIF NEW.resulting_status IN('PENDING_APPROVAL','COMPLETED','RETURNED','REJECTED') AND NEW.prior_status IS DISTINCT FROM NEW.resulting_status THEN
  RAISE EXCEPTION 'Visit review transition requires original review event';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cg05_visit_review_event_at_commit AFTER INSERT ON field_visit_event
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg05_visit_review_event_guard();
