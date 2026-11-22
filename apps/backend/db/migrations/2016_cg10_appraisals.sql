-- CG10 US003 original B26 performance reviews, no payroll writes or invented score weights.
CREATE SEQUENCE hr_appraisal_number_seq;
CREATE TABLE hr_appraisal(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 reference text NOT NULL UNIQUE DEFAULT ('CG-HR-APR-'||lpad(nextval('hr_appraisal_number_seq')::text,6,'0')),
 employee_id uuid NOT NULL, assignment_id uuid NOT NULL,
 reviewer_employee_ref uuid NOT NULL, reviewer_account_ref uuid NOT NULL,
 period_start date NOT NULL, period_end date NOT NULL,
 goal_delivery_score smallint NOT NULL CHECK(goal_delivery_score BETWEEN 0 AND 100),
 competency_score smallint NOT NULL CHECK(competency_score BETWEEN 0 AND 100),
 attendance_conduct_score smallint NOT NULL CHECK(attendance_conduct_score BETWEEN 0 AND 100),
 feedback_ciphertext text NOT NULL, feedback_nonce text NOT NULL, feedback_tag text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','RELEASED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 request_key uuid NOT NULL, request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 last_command_key uuid NOT NULL, last_command_digest char(64) NOT NULL CHECK(last_command_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz,released_at timestamptz,
 CHECK(employee_id<>reviewer_employee_ref AND period_end>=period_start),
 CHECK((status='DRAFT' AND submitted_at IS NULL AND released_at IS NULL)
 OR (status='SUBMITTED' AND submitted_at IS NOT NULL AND released_at IS NULL)
 OR (status='RELEASED' AND submitted_at IS NOT NULL AND released_at IS NOT NULL)),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,reviewer_account_ref,request_key),
 UNIQUE(root_realm_id,employee_id,period_start,period_end),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(assignment_id,root_realm_id,employee_id) REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_employee_ref,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_appraisal_own ON hr_appraisal(root_realm_id,employee_id,period_end DESC,id);
CREATE INDEX ix_hr_appraisal_reviewer ON hr_appraisal(root_realm_id,reviewer_account_ref,status,period_end DESC,id);
CREATE FUNCTION cg10_appraisal_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Appraisal history cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.revision<>1 THEN RAISE EXCEPTION 'Appraisal starts as draft'; END IF;
  IF NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=NEW.root_realm_id
   AND e.id=NEW.reviewer_employee_ref AND e.account_ref=NEW.reviewer_account_ref AND e.status IN('ACTIVE','PROBATION'))
  THEN RAISE EXCEPTION 'Appraisal must have its actual reviewer account'; END IF;
  RETURN NEW;
 END IF;
 IF (NEW.id,NEW.root_realm_id,NEW.reference,NEW.employee_id,NEW.assignment_id,NEW.reviewer_employee_ref,
  NEW.reviewer_account_ref,NEW.period_start,NEW.period_end,NEW.request_key,NEW.request_digest,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.reference,OLD.employee_id,OLD.assignment_id,OLD.reviewer_employee_ref,
  OLD.reviewer_account_ref,OLD.period_start,OLD.period_end,OLD.request_key,OLD.request_digest,OLD.created_at)
 OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Appraisal source or revision changed'; END IF;
 IF OLD.status='RELEASED' OR (OLD.status='SUBMITTED' AND NEW.status<>'RELEASED')
 OR (OLD.status='DRAFT' AND NEW.status NOT IN('DRAFT','SUBMITTED')) THEN
  RAISE EXCEPTION 'Invalid appraisal state transition';
 END IF;
 IF OLD.status<>'DRAFT' OR NEW.status<>'DRAFT' THEN
  IF (NEW.goal_delivery_score,NEW.competency_score,NEW.attendance_conduct_score,NEW.feedback_ciphertext,
    NEW.feedback_nonce,NEW.feedback_tag) IS DISTINCT FROM
   (OLD.goal_delivery_score,OLD.competency_score,OLD.attendance_conduct_score,OLD.feedback_ciphertext,
    OLD.feedback_nonce,OLD.feedback_tag) THEN RAISE EXCEPTION 'Submitted scores and feedback are frozen'; END IF;
 END IF;
 IF OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
  RAISE EXCEPTION 'Original submission time is immutable';
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg10_appraisal_guard BEFORE INSERT OR UPDATE OR DELETE ON hr_appraisal
 FOR EACH ROW EXECUTE FUNCTION cg10_appraisal_guard();
ALTER TABLE hr_audit DROP CONSTRAINT hr_audit_action_check;
ALTER TABLE hr_audit ADD CONSTRAINT hr_audit_action_check CHECK(action IN(
 'DRAFT_CREATED','DRAFT_UPDATED','SUBMITTED','RETURNED','REJECTED','ACTIVATED','PENDING_ACCESS','ACCESS_CONFIRMED',
 'LEAVE_PRIVATE_READ','ATTENDANCE_CORRECTION_PRIVATE_READ','APPRAISAL_DRAFT_CREATED','APPRAISAL_DRAFT_UPDATED',
 'APPRAISAL_SUBMITTED','APPRAISAL_RELEASED','APPRAISAL_PRIVATE_READ'));
