-- CG04 US003-QA11/12: genuine verified volunteer origin for CG05 tasks and visits.
-- Extends existing task ACCOUNT identity (does not create another role/master).
-- Historical assignment events remain immutable; current access is rechecked at action time.
CREATE FUNCTION cg04_current_volunteer(root uuid,volunteer_ref uuid,account_ref uuid,project_branch uuid)
 RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM volunteer v
 JOIN volunteer_application app ON app.root_realm_id=v.root_realm_id AND app.id=v.original_application_id AND app.status='APPROVED'
 JOIN volunteer_approval_effect effect ON effect.root_realm_id=v.root_realm_id AND effect.volunteer_id=v.id AND effect.application_id=app.id
 JOIN cg03_case review ON review.realm_id=effect.root_realm_id AND review.id=effect.case_id
  AND review.case_kind='VOLUNTEER_APPLICATION' AND review.status='OWNER_COMPLETED'
 JOIN account person ON person.realm_id=v.root_realm_id AND person.id=v.account_ref
  AND person.status='ACTIVE' AND person.contact_phone_verified_at IS NOT NULL
  AND person.contact_phone=app.contact_mobile AND person.normalized_email IS NOT DISTINCT FROM app.contact_email
 JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref AND d.active AND d.kind='DEPARTMENT'
 JOIN volunteer_affiliation_history affiliation ON affiliation.root_realm_id=v.root_realm_id
  AND affiliation.volunteer_id=v.id AND affiliation.effective_to IS NULL
  AND affiliation.branch_ref IS NOT DISTINCT FROM v.branch_ref AND affiliation.department_ref=v.department_ref
 WHERE v.root_realm_id=root AND v.id=volunteer_ref AND v.account_ref=account_ref AND v.status='ACTIVE'
  AND v.branch_ref IS NOT DISTINCT FROM project_branch
  AND (v.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=root AND b.id=v.branch_ref AND b.status='ACTIVE'))
  AND ((d.scope_kind='FOUNDATION' AND (v.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch_department_link link WHERE link.root_realm_id=root AND link.branch_id=v.branch_ref
      AND link.foundation_department_id=d.id AND link.ended_at IS NULL)))
    OR (d.scope_kind='BRANCH' AND d.branch_id=v.branch_ref))
  AND EXISTS(SELECT 1 FROM cg19_volunteer_private_file proof
    JOIN volunteer_review_file frozen ON frozen.root_realm_id=proof.realm_id AND frozen.file_id=proof.id
    JOIN cg03_case original ON original.realm_id=frozen.root_realm_id AND original.volunteer_review_ref=frozen.snapshot_id
      AND original.id=review.id
    WHERE proof.realm_id=root AND proof.application_id=app.id
      AND frozen.classification='VOLUNTEER_IDENTITY_PROOF' AND proof.scan_status='CLEAN_VERIFIED'
      AND proof.revoked_at IS NULL AND proof.revision=frozen.file_version AND proof.sha256=frozen.sha256));
 $$;

ALTER TABLE project_task ADD COLUMN assignee_volunteer_ref uuid;
ALTER TABLE project_task ADD CONSTRAINT fk_cg04_task_volunteer
 FOREIGN KEY(root_realm_id,assignee_volunteer_ref) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE project_task ADD CONSTRAINT ck_cg04_task_volunteer_origin
 CHECK(assignee_volunteer_ref IS NULL OR (assignee_kind='ACCOUNT' AND assignee_account_ref IS NOT NULL AND assignee_employee_ref IS NULL));
CREATE INDEX ix_cg04_task_volunteer ON project_task(root_realm_id,assignee_volunteer_ref,status,id)
 WHERE assignee_volunteer_ref IS NOT NULL;

ALTER TABLE project_task_event ADD COLUMN assignee_volunteer_ref uuid;
ALTER TABLE project_task_event ADD CONSTRAINT fk_cg04_task_event_volunteer
 FOREIGN KEY(root_realm_id,assignee_volunteer_ref) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE project_task_event ADD CONSTRAINT ck_cg04_task_event_volunteer_origin
 CHECK(assignee_volunteer_ref IS NULL OR (assignee_kind='ACCOUNT' AND assignee_account_ref IS NOT NULL AND assignee_employee_ref IS NULL));

CREATE FUNCTION cg04_task_volunteer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.assignee_volunteer_ref IS NOT NULL AND NEW.status NOT IN('CANCELLED','COMPLETED')
  AND NOT cg04_current_volunteer(NEW.root_realm_id,NEW.assignee_volunteer_ref,NEW.assignee_account_ref,NEW.assignee_branch_ref)
 THEN RAISE EXCEPTION 'Current approved volunteer affiliation required for task assignment'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_task_volunteer_guard BEFORE INSERT OR UPDATE ON project_task
 FOR EACH ROW EXECUTE FUNCTION cg04_task_volunteer_guard();

CREATE FUNCTION cg04_task_volunteer_event_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM project_task_event e
   WHERE e.root_realm_id=NEW.root_realm_id AND e.task_id=NEW.id AND e.result_version=NEW.version
   AND e.assignee_volunteer_ref IS NOT DISTINCT FROM NEW.assignee_volunteer_ref)
 THEN RAISE EXCEPTION 'Task volunteer assignment must match its immutable original event'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_task_volunteer_event_at_commit AFTER INSERT OR UPDATE ON project_task
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_task_volunteer_event_match();

ALTER TABLE field_visit ADD COLUMN actor_volunteer_ref uuid;
ALTER TABLE field_visit ADD CONSTRAINT fk_cg04_visit_volunteer
 FOREIGN KEY(root_realm_id,actor_volunteer_ref) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE field_visit ADD CONSTRAINT ck_cg04_visit_volunteer_origin
 CHECK(actor_volunteer_ref IS NULL OR actor_employee_ref IS NULL);
CREATE INDEX ix_cg04_visit_volunteer ON field_visit(root_realm_id,actor_volunteer_ref,status,id)
 WHERE actor_volunteer_ref IS NOT NULL;
ALTER TABLE field_visit_event ADD COLUMN actor_volunteer_ref uuid;
ALTER TABLE field_visit_event ADD CONSTRAINT fk_cg04_visit_event_volunteer
 FOREIGN KEY(root_realm_id,actor_volunteer_ref) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT;

CREATE FUNCTION cg04_visit_volunteer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assigned record;
BEGIN
 IF TG_OP='UPDATE' AND OLD.started_at IS NOT NULL
   AND NEW.actor_volunteer_ref IS DISTINCT FROM OLD.actor_volunteer_ref
 THEN RAISE EXCEPTION 'Accepted field visit volunteer assignment is immutable'; END IF;
 IF NEW.actor_volunteer_ref IS NOT NULL AND NEW.status NOT IN('CANCELLED','COMPLETED','REJECTED')
  AND NOT cg04_current_volunteer(NEW.root_realm_id,NEW.actor_volunteer_ref,NEW.actor_account_ref,NEW.branch_ref)
 THEN RAISE EXCEPTION 'Current approved volunteer affiliation required for field visit'; END IF;
 IF NEW.task_id IS NOT NULL THEN
  SELECT t.assignee_volunteer_ref,t.assignee_account_ref INTO assigned
  FROM project_task t WHERE t.root_realm_id=NEW.root_realm_id
   AND t.project_id=NEW.project_id AND t.id=NEW.task_id;
  IF FOUND AND (assigned.assignee_volunteer_ref IS DISTINCT FROM NEW.actor_volunteer_ref
     OR (NEW.actor_volunteer_ref IS NOT NULL AND assigned.assignee_account_ref<>NEW.actor_account_ref))
  THEN RAISE EXCEPTION 'Visit volunteer assignment must match original task assignment'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_visit_volunteer_guard BEFORE INSERT OR UPDATE ON field_visit
 FOR EACH ROW EXECUTE FUNCTION cg04_visit_volunteer_guard();

CREATE FUNCTION cg04_visit_volunteer_event_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM field_visit_event e WHERE e.root_realm_id=NEW.root_realm_id
   AND e.visit_id=NEW.id AND e.result_version=NEW.version
   AND e.actor_volunteer_ref IS NOT DISTINCT FROM NEW.actor_volunteer_ref)
 THEN RAISE EXCEPTION 'Visit volunteer source must match its immutable original event'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_visit_volunteer_event_at_commit AFTER INSERT OR UPDATE ON field_visit
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_visit_volunteer_event_match();
