-- CG-04 US003: original CG03 approved, CG19 verified volunteer → exactly one active identity/affiliation.
-- All source references belong to existing CG01/CG02/CG03/CG19; no automatic role or CG05 assignment.
CREATE FUNCTION cg04_volunteer_approved_source(root uuid,app uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
 SELECT 1 FROM volunteer_application a
 JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.volunteer_application_id=a.id
 JOIN volunteer_review_snapshot snap ON snap.root_realm_id=c.realm_id AND snap.id=c.volunteer_review_ref
 JOIN cg03_case_decision decision ON decision.realm_id=c.realm_id AND decision.case_id=c.id
 JOIN account reviewer ON reviewer.realm_id=decision.realm_id AND reviewer.id=decision.actor_id AND reviewer.status='ACTIVE'
 JOIN account_role ar ON ar.realm_id=reviewer.realm_id AND ar.account_id=reviewer.id AND ar.revoked_at IS NULL
 JOIN role role_current ON role_current.realm_id=ar.realm_id AND role_current.id=ar.role_id AND role_current.active AND role_current.is_protected
 JOIN cg03_process process ON process.realm_id=c.realm_id AND process.id=c.process_id AND process.process_kind='VOLUNTEER_APPLICATION'
 JOIN cg03_process_step step ON step.process_id=process.id AND step.ordinal=1
  AND step.capability_key='approvals.review' AND step.protected_root_required
 JOIN department dept ON dept.root_realm_id=a.root_realm_id AND dept.id=a.department_ref
 JOIN account applicant ON applicant.realm_id=a.root_realm_id AND applicant.id=a.applicant_account_ref
 WHERE a.root_realm_id=root AND a.id=app AND a.status='SUBMITTED'
  AND c.case_kind='VOLUNTEER_APPLICATION' AND c.status='PENDING_OWNER'
  AND c.volunteer_application_version=a.version AND c.volunteer_review_digest=a.submitted_digest
  AND snap.application_id=a.id AND snap.application_version=a.version AND snap.source_digest=a.submitted_digest
  AND decision.action='APPROVE' AND decision.actor_id<>a.applicant_account_ref
  AND decision.accepted_case_revision=c.revision AND decision.step_ordinal=1
  AND decision.fresh_password_verified_at IS NOT NULL
  AND applicant.status='ACTIVE' AND applicant.contact_phone_verified_at IS NOT NULL
  AND applicant.contact_phone=a.contact_mobile AND applicant.normalized_email IS NOT DISTINCT FROM a.contact_email
  AND dept.active AND dept.kind='DEPARTMENT'
  AND ((dept.scope_kind='FOUNDATION' AND (a.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch_department_link l WHERE l.root_realm_id=root AND l.branch_id=a.branch_ref
      AND l.foundation_department_id=dept.id AND l.ended_at IS NULL)))
   OR (dept.scope_kind='BRANCH' AND dept.branch_id=a.branch_ref))
  AND (a.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=root AND b.id=a.branch_ref AND b.status='ACTIVE'))
  AND EXISTS(SELECT 1 FROM volunteer_review_file f
   JOIN cg19_volunteer_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id AND doc.application_id=f.application_id
   WHERE f.root_realm_id=root AND f.snapshot_id=c.volunteer_review_ref AND f.application_id=a.id
   AND f.classification='VOLUNTEER_IDENTITY_PROOF' AND doc.classification=f.classification
   AND doc.sha256=f.sha256 AND doc.revision=f.file_version AND doc.revoked_at IS NULL AND doc.scan_status='CLEAN_VERIFIED')
  AND NOT EXISTS(SELECT 1 FROM volunteer_review_file f
    JOIN cg19_volunteer_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id AND doc.application_id=f.application_id
    WHERE f.root_realm_id=root AND f.snapshot_id=c.volunteer_review_ref AND
      (doc.revoked_at IS NOT NULL OR doc.sha256<>f.sha256 OR doc.revision<>f.file_version OR doc.scan_status<>'CLEAN_VERIFIED'))
 );
$$;
CREATE FUNCTION cg04_volunteer_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'A completed volunteer identity must be retained'; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Protected volunteer profile changes require original verified review'; END IF;
 IF NEW.version<>1 OR NEW.status<>'ACTIVE'
  OR NOT cg04_volunteer_approved_source(NEW.root_realm_id,NEW.original_application_id)
  OR NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.original_application_id
   AND a.applicant_account_ref=NEW.account_ref AND (a.first_name||' '||a.last_name)=NEW.display_name
   AND a.department_ref=NEW.department_ref AND a.branch_ref IS NOT DISTINCT FROM NEW.branch_ref
   AND a.availability=NEW.availability AND a.skills=NEW.skills)
 THEN RAISE EXCEPTION 'Verified independent volunteer approval is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON volunteer
 FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_insert_guard();

CREATE FUNCTION cg04_volunteer_affiliation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original volunteer branch/department history must be retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to<=OLD.effective_from
   OR (NEW.root_realm_id,NEW.id,NEW.volunteer_id,NEW.branch_ref,NEW.department_ref,NEW.actor_ref,NEW.reason,NEW.effective_from)
    IS DISTINCT FROM
      (OLD.root_realm_id,OLD.id,OLD.volunteer_id,OLD.branch_ref,OLD.department_ref,OLD.actor_ref,OLD.reason,OLD.effective_from)
  THEN RAISE EXCEPTION 'Original affiliation source cannot be rewritten'; END IF;
 ELSE
  IF NEW.effective_to IS NOT NULL OR NEW.reason<>'APPROVED_VOLUNTEER'
   OR NOT EXISTS(SELECT 1 FROM volunteer v
    JOIN volunteer_application a ON a.root_realm_id=v.root_realm_id AND a.id=v.original_application_id
    WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.volunteer_id
     AND v.branch_ref IS NOT DISTINCT FROM NEW.branch_ref
     AND v.department_ref=NEW.department_ref AND a.applicant_account_ref=NEW.actor_ref)
  THEN RAISE EXCEPTION 'Original verified volunteer affiliation required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_affiliation_guard BEFORE INSERT OR UPDATE OR DELETE ON volunteer_affiliation_history
 FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_affiliation_guard();

CREATE FUNCTION cg04_volunteer_effect_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT cg04_volunteer_approved_source(NEW.root_realm_id,NEW.application_id)
  OR NOT EXISTS(SELECT 1 FROM volunteer_application app
    JOIN cg03_case c ON c.realm_id=app.root_realm_id AND c.volunteer_application_id=app.id
    JOIN cg03_case_decision decision ON decision.realm_id=c.realm_id AND decision.case_id=c.id
    JOIN volunteer v ON v.root_realm_id=app.root_realm_id AND v.original_application_id=app.id
    JOIN volunteer_affiliation_history affiliation ON affiliation.root_realm_id=v.root_realm_id
      AND affiliation.volunteer_id=v.id AND affiliation.effective_to IS NULL
    WHERE app.root_realm_id=NEW.root_realm_id AND app.id=NEW.application_id
      AND c.id=NEW.case_id AND decision.id=NEW.decision_id AND decision.action='APPROVE'
      AND decision.accepted_case_revision=c.revision AND c.volunteer_review_digest=NEW.source_digest
      AND v.id=NEW.volunteer_id AND NEW.actor_ref=app.applicant_account_ref
      AND affiliation.actor_ref=app.applicant_account_ref
      AND affiliation.department_ref=app.department_ref
      AND affiliation.branch_ref IS NOT DISTINCT FROM app.branch_ref)
 THEN RAISE EXCEPTION 'Volunteer activation effect requires exact original approval and affiliation'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_effect_insert_guard BEFORE INSERT ON volunteer_approval_effect
 FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_effect_guard();

CREATE FUNCTION cg04_volunteer_completed_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_approval_effect effect
  JOIN volunteer_application app ON app.root_realm_id=effect.root_realm_id AND app.id=effect.application_id
  JOIN cg03_case review ON review.realm_id=effect.root_realm_id AND review.id=effect.case_id
  WHERE effect.root_realm_id=NEW.root_realm_id AND effect.volunteer_id=NEW.id
    AND app.status='APPROVED' AND review.status='OWNER_COMPLETED')
 THEN RAISE EXCEPTION 'Volunteer requires a completed original protected review'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_volunteer_approved_at_commit AFTER INSERT ON volunteer
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_completed_guard();

CREATE OR REPLACE FUNCTION cg04_volunteer_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Volunteer application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid volunteer application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR NOT ((OLD.status IN('DRAFT','RETURNED') AND NEW.status IN('DRAFT','CANCELLED','SUBMITTED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED')))
   THEN RAISE EXCEPTION 'Invalid volunteer application revision'; END IF;
  IF NEW.status IN('SUBMITTED','RETURNED','REJECTED','CANCELLED','APPROVED')
   AND (to_jsonb(NEW)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest')
   THEN RAISE EXCEPTION 'A review transition cannot change the accepted applicant source'; END IF;
  IF OLD.status='SUBMITTED' AND (NEW.submitted_digest,NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_digest,OLD.submitted_at)
   THEN RAISE EXCEPTION 'Original submitted snapshot is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN RAISE EXCEPTION 'Invalid Foundation volunteer scope'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN
   RAISE EXCEPTION 'Wrong Foundation volunteer scope'; END IF;
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
   AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
   AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
  THEN RAISE EXCEPTION 'Verified applicant contact required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id
   WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.status='ACTIVE' AND s.level='STATE'
    AND d.id=NEW.district_ref AND d.status='ACTIVE' AND d.level='DISTRICT' FOR SHARE OF s,d)
  THEN RAISE EXCEPTION 'Choose real current state and district'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id
   AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE)
  THEN RAISE EXCEPTION 'Choose a current Foundation branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM department d WHERE d.id=NEW.department_ref AND d.root_realm_id=NEW.root_realm_id
   AND d.active AND d.kind='DEPARTMENT' AND
   ((d.scope_kind='FOUNDATION' AND (NEW.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch_department_link l WHERE l.root_realm_id=NEW.root_realm_id AND l.branch_id=NEW.branch_ref
      AND l.foundation_department_id=d.id AND l.ended_at IS NULL)))
    OR (d.scope_kind='BRANCH' AND d.branch_id=NEW.branch_ref))
   FOR SHARE)
  THEN RAISE EXCEPTION 'Choose an eligible current Foundation department'; END IF;
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION cg04_volunteer_command_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='APPROVED' THEN
  IF NOT EXISTS(SELECT 1 FROM volunteer_approval_effect effect JOIN cg03_case review
   ON review.realm_id=effect.root_realm_id AND review.id=effect.case_id
   WHERE effect.root_realm_id=NEW.root_realm_id AND effect.application_id=NEW.id
    AND review.status='OWNER_COMPLETED' AND review.case_kind='VOLUNTEER_APPLICATION'
    AND review.volunteer_review_digest=NEW.submitted_digest
    AND effect.actor_ref=NEW.applicant_account_ref)
  THEN RAISE EXCEPTION 'Approved volunteer requires the actual independent effect'; END IF;
 ELSIF NEW.status IN('RETURNED','REJECTED') THEN
  IF NOT EXISTS(SELECT 1 FROM cg03_case review JOIN cg03_case_decision decision
   ON decision.realm_id=review.realm_id AND decision.case_id=review.id
   WHERE review.realm_id=NEW.root_realm_id AND review.case_kind='VOLUNTEER_APPLICATION'
   AND review.volunteer_application_id=NEW.id AND review.volunteer_application_version=NEW.version-1
   AND review.volunteer_review_digest=NEW.submitted_digest
   AND decision.actor_id<>NEW.applicant_account_ref AND decision.fresh_password_verified_at IS NOT NULL
   AND decision.accepted_case_revision=review.revision AND
     ((NEW.status='RETURNED' AND review.status='RETURNED' AND decision.action='RETURN')
      OR (NEW.status='REJECTED' AND review.status='REJECTED' AND decision.action='REJECT')))
  THEN RAISE EXCEPTION 'Volunteer return or rejection requires original protected decision'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM volunteer_application_command command
   WHERE command.root_realm_id=NEW.root_realm_id AND command.application_id=NEW.id
     AND command.result_version=NEW.version AND command.actor_ref=NEW.applicant_account_ref)
  THEN RAISE EXCEPTION 'A source-owner volunteer applicant command is required'; END IF;
  IF NEW.status='SUBMITTED' AND NOT EXISTS(SELECT 1 FROM volunteer_review_snapshot snapshot
   JOIN cg03_case review ON review.realm_id=snapshot.root_realm_id AND review.volunteer_review_ref=snapshot.id
   JOIN volunteer_application_command command ON command.root_realm_id=snapshot.root_realm_id AND command.request_key=snapshot.request_key
   JOIN volunteer_review_file proof ON proof.root_realm_id=snapshot.root_realm_id AND proof.snapshot_id=snapshot.id
   JOIN cg19_volunteer_private_file file ON file.realm_id=proof.root_realm_id AND file.id=proof.file_id
   WHERE snapshot.root_realm_id=NEW.root_realm_id AND snapshot.application_id=NEW.id
     AND snapshot.application_version=NEW.version AND snapshot.source_digest=NEW.submitted_digest
     AND command.application_id=NEW.id AND command.action='SUBMIT' AND command.result_version=NEW.version
     AND review.case_kind='VOLUNTEER_APPLICATION' AND review.volunteer_application_id=NEW.id
     AND proof.classification='VOLUNTEER_IDENTITY_PROOF'
     AND file.revision=proof.file_version AND file.sha256=proof.sha256 AND file.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'Original verified volunteer identity and review case required'; END IF;
 END IF;
 RETURN NULL;
END; $$;
