-- CG05 US004: private visits use the genuine project and optional same-project task.
-- Actual check-in/out and consent provenance are immutable; no route, public GPS or synthetic volunteers.
CREATE SEQUENCE cg05_visit_public_sequence;
CREATE TABLE field_visit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 visit_code text NOT NULL DEFAULT ('VIS-'||nextval('cg05_visit_public_sequence')::text),
 project_id uuid NOT NULL,
 task_id uuid,
 actor_account_ref uuid NOT NULL,
 actor_employee_ref uuid,
 actor_branch_ref uuid,
 branch_ref uuid,
 state_ref uuid,
 district_ref uuid,
 visit_kind text NOT NULL CHECK(char_length(btrim(visit_kind)) BETWEEN 1 AND 80),
 location_label_private text NOT NULL CHECK(char_length(btrim(location_label_private)) BETWEEN 2 AND 250),
 planned_at timestamptz NOT NULL,
 purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 2 AND 500),
 report_text text NOT NULL DEFAULT '' CHECK(char_length(report_text)<=4000),
 started_at timestamptz,
 completed_at timestamptz,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PLANNED','IN_PROGRESS','PENDING_PROOF','PENDING_APPROVAL','RETURNED','REJECTED','COMPLETED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,visit_code),
 FOREIGN KEY(root_realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_id,task_id) REFERENCES project_task(root_realm_id,project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,actor_employee_ref) REFERENCES hr_employee(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 CHECK(district_ref IS NULL OR state_ref IS NOT NULL),
 CHECK((actor_employee_ref IS NULL)=(actor_branch_ref IS NULL)),
 CHECK(completed_at IS NULL OR (started_at IS NOT NULL AND completed_at>=started_at)),
 CHECK(((status IN('DRAFT','PLANNED') AND started_at IS NULL AND completed_at IS NULL)
 OR (status='IN_PROGRESS' AND started_at IS NOT NULL AND completed_at IS NULL)
 OR (status IN('PENDING_PROOF','PENDING_APPROVAL','RETURNED','REJECTED','COMPLETED') AND started_at IS NOT NULL AND completed_at IS NOT NULL)
 OR status='CANCELLED') IS TRUE)
);
CREATE INDEX ix_cg05_visit_scope ON field_visit(root_realm_id,branch_ref,status,planned_at DESC,id DESC);
CREATE INDEX ix_cg05_visit_project ON field_visit(root_realm_id,project_id,status,planned_at DESC,id DESC);
CREATE INDEX ix_cg05_visit_actor ON field_visit(root_realm_id,actor_account_ref,status,planned_at DESC,id DESC);
CREATE INDEX ix_cg05_visit_task ON field_visit(root_realm_id,project_id,task_id) WHERE task_id IS NOT NULL;

CREATE TABLE field_visit_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 visit_id uuid NOT NULL,
 event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 event_kind text NOT NULL CHECK(event_kind IN('CREATE','EDIT','CHECK_IN','CHECK_OUT','SUBMIT_REVIEW','REVIEW_DECISION','CANCEL')),
 actor_account_ref uuid NOT NULL,
 prior_status text CHECK(prior_status IN('DRAFT','PLANNED','IN_PROGRESS','PENDING_PROOF','PENDING_APPROVAL','RETURNED','REJECTED','COMPLETED','CANCELLED')),
 resulting_status text NOT NULL CHECK(resulting_status IN('DRAFT','PLANNED','IN_PROGRESS','PENDING_PROOF','PENDING_APPROVAL','RETURNED','REJECTED','COMPLETED','CANCELLED')),
 result_version integer NOT NULL CHECK(result_version>0),
 reason_private text NOT NULL DEFAULT '' CHECK(char_length(reason_private)<=500),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 UNIQUE(root_realm_id,visit_id,result_version),
 UNIQUE(root_realm_id,visit_id,result_version,event_key,event_kind,actor_account_ref),
 FOREIGN KEY(root_realm_id,visit_id) REFERENCES field_visit(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((event_kind='CREATE')=(prior_status IS NULL))
);
CREATE INDEX ix_cg05_visit_event ON field_visit_event(root_realm_id,visit_id,result_version DESC);
CREATE TRIGGER cg05_visit_event_immutable BEFORE UPDATE OR DELETE ON field_visit_event FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();

CREATE TABLE visit_checkin_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 visit_id uuid NOT NULL,
 event_key uuid NOT NULL,
 result_version integer NOT NULL CHECK(result_version>1),
 kind text NOT NULL CHECK(kind IN('CHECK_IN','CHECK_OUT')),
 actor_account_ref uuid NOT NULL,
 latitude double precision,
 longitude double precision,
 accuracy_m double precision,
 recorded_at timestamptz NOT NULL,
 device_recorded_at timestamptz,
 location_provenance text NOT NULL CHECK(location_provenance IN('DEVICE_GPS','MANUAL_ENTERED','UNAVAILABLE','REJECTED')),
 consent_state text NOT NULL CHECK(consent_state IN('GRANTED','DENIED','NOT_REQUESTED','MANUAL_DECLARED')),
 UNIQUE(root_realm_id,event_key),
 UNIQUE(root_realm_id,visit_id,kind),
 FOREIGN KEY(root_realm_id,visit_id,result_version,event_key,kind,actor_account_ref)
  REFERENCES field_visit_event(root_realm_id,visit_id,result_version,event_key,event_kind,actor_account_ref) ON DELETE RESTRICT,
 CHECK(((location_provenance='DEVICE_GPS' AND consent_state='GRANTED' AND latitude BETWEEN -90 AND 90
       AND longitude BETWEEN -180 AND 180 AND accuracy_m BETWEEN 0.1 AND 1000 AND device_recorded_at IS NOT NULL
       AND device_recorded_at BETWEEN recorded_at-interval '5 minutes' AND recorded_at+interval '1 minute')
 OR (location_provenance='MANUAL_ENTERED' AND consent_state='MANUAL_DECLARED' AND latitude BETWEEN -90 AND 90
       AND longitude BETWEEN -180 AND 180 AND accuracy_m IS NULL AND device_recorded_at IS NULL)
 OR (location_provenance IN('UNAVAILABLE','REJECTED') AND consent_state IN('GRANTED','DENIED','NOT_REQUESTED')
       AND latitude IS NULL AND longitude IS NULL AND accuracy_m IS NULL AND device_recorded_at IS NULL)) IS TRUE)
);
CREATE TRIGGER cg05_checkin_immutable BEFORE UPDATE OR DELETE ON visit_checkin_event FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();

CREATE TABLE visit_comment_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 visit_id uuid NOT NULL,
 event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 actor_account_ref uuid NOT NULL,
 body_private text NOT NULL CHECK(char_length(btrim(body_private)) BETWEEN 1 AND 2000),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 FOREIGN KEY(root_realm_id,visit_id) REFERENCES field_visit(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg05_visit_comments ON visit_comment_event(root_realm_id,visit_id,occurred_at DESC,id);
CREATE TRIGGER cg05_visit_comment_immutable BEFORE UPDATE OR DELETE ON visit_comment_event FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();

CREATE FUNCTION cg05_visit_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; t record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Visit history must remain available'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.status NOT IN('DRAFT','PLANNED') THEN RAISE EXCEPTION 'Invalid initial visit state'; END IF;
 ELSE
  IF (NEW.id,NEW.root_realm_id,NEW.project_id,NEW.visit_code,NEW.created_by,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.project_id,OLD.visit_code,OLD.created_by,OLD.created_at)
     OR NEW.version<>OLD.version+1 OR OLD.status IN('COMPLETED','REJECTED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid visit revision';
  END IF;
  IF OLD.started_at IS NOT NULL AND
     (NEW.started_at,NEW.actor_account_ref,NEW.actor_employee_ref,NEW.actor_branch_ref,NEW.task_id,NEW.branch_ref,NEW.state_ref,NEW.district_ref,NEW.visit_kind,NEW.location_label_private,NEW.planned_at,NEW.purpose)
     IS DISTINCT FROM
     (OLD.started_at,OLD.actor_account_ref,OLD.actor_employee_ref,OLD.actor_branch_ref,OLD.task_id,OLD.branch_ref,OLD.state_ref,OLD.district_ref,OLD.visit_kind,OLD.location_label_private,OLD.planned_at,OLD.purpose) THEN
    RAISE EXCEPTION 'Accepted check-in and visit assignment are immutable';
  END IF;
  IF OLD.status='PENDING_APPROVAL' AND NEW.report_text IS DISTINCT FROM OLD.report_text THEN
   RAISE EXCEPTION 'Submitted report is frozen until returned for correction';
  END IF;
  IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Accepted checkout is immutable';
  END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN('PLANNED','IN_PROGRESS','CANCELLED'))
    OR (OLD.status='PLANNED' AND NEW.status IN('IN_PROGRESS','CANCELLED'))
    OR (OLD.status='IN_PROGRESS' AND NEW.status IN('PENDING_PROOF','CANCELLED'))
    OR (OLD.status IN('PENDING_PROOF','RETURNED') AND NEW.status IN('PENDING_APPROVAL','CANCELLED'))
    OR (OLD.status='PENDING_APPROVAL' AND NEW.status IN('RETURNED','REJECTED','COMPLETED','PENDING_PROOF'))) THEN
    RAISE EXCEPTION 'Invalid visit transition';
  END IF;
 END IF;
 SELECT branch_ref,status,planned_start,planned_end INTO p FROM project WHERE root_realm_id=NEW.root_realm_id AND id=NEW.project_id FOR SHARE;
 IF NOT FOUND OR (NEW.status<>'CANCELLED' AND (p.branch_ref IS DISTINCT FROM NEW.branch_ref OR p.status IN('COMPLETED','CANCELLED'))) THEN
   RAISE EXCEPTION 'Visit requires current project scope';
 END IF;
 IF NEW.status<>'CANCELLED' AND ((p.planned_start IS NOT NULL AND (NEW.planned_at AT TIME ZONE 'Asia/Kolkata')::date<p.planned_start)
  OR (p.planned_end IS NOT NULL AND (NEW.planned_at AT TIME ZONE 'Asia/Kolkata')::date>p.planned_end)) THEN
   RAISE EXCEPTION 'Visit outside current project dates';
 END IF;
 IF NEW.actor_employee_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=NEW.root_realm_id AND e.id=NEW.actor_employee_ref AND e.account_ref=NEW.actor_account_ref FOR SHARE) THEN
   RAISE EXCEPTION 'Visit employee must match original account';
 END IF;
 IF NEW.task_id IS NOT NULL AND NEW.status NOT IN('CANCELLED','COMPLETED','REJECTED','RETURNED','PENDING_APPROVAL') THEN
  SELECT assignee_account_ref,status INTO t FROM project_task WHERE root_realm_id=NEW.root_realm_id AND project_id=NEW.project_id AND id=NEW.task_id FOR SHARE;
  IF NOT FOUND OR t.assignee_account_ref IS DISTINCT FROM NEW.actor_account_ref OR (t.status NOT IN('ASSIGNED','IN_PROGRESS') AND NOT (NEW.completed_at IS NOT NULL AND t.status='COMPLETED')) THEN
   RAISE EXCEPTION 'Visit requires current original task assignment';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_visit_guard BEFORE INSERT OR UPDATE OR DELETE ON field_visit FOR EACH ROW EXECUTE FUNCTION cg05_visit_write_guard();

CREATE FUNCTION cg05_visit_event_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v field_visit%ROWTYPE; previous_status text;
BEGIN
 SELECT * INTO v FROM field_visit WHERE root_realm_id=NEW.root_realm_id AND id=NEW.visit_id FOR SHARE;
 IF NOT FOUND OR v.version<>NEW.result_version OR v.status<>NEW.resulting_status THEN
  RAISE EXCEPTION 'Visit event must match current revision';
 END IF;
 IF NEW.result_version=1 THEN
  IF NEW.event_kind<>'CREATE' OR NEW.prior_status IS NOT NULL THEN RAISE EXCEPTION 'Invalid initial visit event'; END IF;
 ELSE
  SELECT resulting_status INTO previous_status FROM field_visit_event
   WHERE root_realm_id=NEW.root_realm_id AND visit_id=NEW.visit_id AND result_version=NEW.result_version-1;
  IF NOT FOUND OR NEW.event_kind='CREATE' OR NEW.prior_status IS DISTINCT FROM previous_status THEN
   RAISE EXCEPTION 'Visit event must follow preceding revision';
  END IF;
 END IF;
 IF NEW.event_kind IN('CHECK_IN','CHECK_OUT') AND NEW.actor_account_ref<>v.actor_account_ref THEN
   RAISE EXCEPTION 'Only assigned actor may record visit capture';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_visit_event_insert BEFORE INSERT ON field_visit_event FOR EACH ROW EXECUTE FUNCTION cg05_visit_event_insert_guard();

CREATE FUNCTION cg05_visit_capture_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v field_visit%ROWTYPE; first_capture visit_checkin_event%ROWTYPE;
BEGIN
 SELECT * INTO v FROM field_visit WHERE root_realm_id=NEW.root_realm_id AND id=NEW.visit_id FOR SHARE;
 IF NOT FOUND OR v.version<>NEW.result_version OR v.actor_account_ref<>NEW.actor_account_ref THEN
  RAISE EXCEPTION 'Visit capture must match current assigned revision';
 END IF;
 IF NEW.kind='CHECK_IN' THEN
  IF v.status<>'IN_PROGRESS' OR v.started_at IS DISTINCT FROM NEW.recorded_at THEN RAISE EXCEPTION 'Invalid check-in'; END IF;
 ELSE
  SELECT * INTO first_capture FROM visit_checkin_event WHERE root_realm_id=NEW.root_realm_id AND visit_id=NEW.visit_id AND kind='CHECK_IN';
  IF NOT FOUND OR v.status<>'PENDING_PROOF' OR v.completed_at IS DISTINCT FROM NEW.recorded_at
    OR NEW.recorded_at<first_capture.recorded_at OR NEW.actor_account_ref<>first_capture.actor_account_ref
    OR (NEW.device_recorded_at IS NOT NULL AND first_capture.device_recorded_at IS NOT NULL AND NEW.device_recorded_at<first_capture.device_recorded_at) THEN
   RAISE EXCEPTION 'Check out requires original check in and chronological timestamps';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_visit_capture_insert BEFORE INSERT ON visit_checkin_event FOR EACH ROW EXECUTE FUNCTION cg05_visit_capture_guard();

CREATE FUNCTION cg05_visit_event_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM field_visit_event e WHERE e.root_realm_id=NEW.root_realm_id AND e.visit_id=NEW.id AND e.result_version=NEW.version AND e.resulting_status=NEW.status) THEN
   RAISE EXCEPTION 'Visit revision requires matching immutable event';
 END IF;
 IF NEW.started_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM visit_checkin_event e WHERE e.root_realm_id=NEW.root_realm_id AND e.visit_id=NEW.id AND e.kind='CHECK_IN' AND e.recorded_at=NEW.started_at) THEN
   RAISE EXCEPTION 'Visit start requires accepted check-in event';
 END IF;
 IF NEW.completed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM visit_checkin_event e WHERE e.root_realm_id=NEW.root_realm_id AND e.visit_id=NEW.id AND e.kind='CHECK_OUT' AND e.recorded_at=NEW.completed_at) THEN
   RAISE EXCEPTION 'Visit completion requires accepted check-out event';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cg05_visit_event_at_commit AFTER INSERT OR UPDATE ON field_visit
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg05_visit_event_match();
