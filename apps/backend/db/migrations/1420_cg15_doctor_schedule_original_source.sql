-- CG-15 US-001: original doctor-center weekly schedule and proposed exceptions.
-- No copied provider, doctor, patient, booking, finance or CG03 case master.
-- Root and exact doctor+center+association source are enforced in PostgreSQL.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE health_doctor_center
 ADD CONSTRAINT uq_cg14_doctor_center_full_schedule_identity
 UNIQUE(root_realm_id,doctor_id,center_id,id);

CREATE TABLE cg15_doctor_schedule(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 doctor_id uuid NOT NULL,
 center_id uuid NOT NULL,
 association_id uuid NOT NULL,
 consultation_mode text NOT NULL CHECK(consultation_mode IN('IN_PERSON','VIDEO')),
 time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 3 AND 64),
 status text NOT NULL CHECK(status IN('ACTIVE','SUSPENDED')),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483646),
 current_revision_id uuid NOT NULL,
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,id,doctor_id,center_id,association_id),
 UNIQUE(root_realm_id,association_id,consultation_mode),
 FOREIGN KEY(root_realm_id,doctor_id,center_id,association_id)
  REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_schedule_doctor_current
 ON cg15_doctor_schedule(root_realm_id,doctor_id,consultation_mode,status,center_id);

CREATE TABLE cg15_schedule_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no BETWEEN 1 AND 2147483646),
 slot_minutes smallint NOT NULL CHECK(slot_minutes BETWEEN 5 AND 180 AND slot_minutes%5=0),
 per_slot_capacity smallint NOT NULL DEFAULT 1 CHECK(per_slot_capacity=1),
 effective_from date NOT NULL,
 effective_until date,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 authored_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,schedule_id,id),
 UNIQUE(root_realm_id,schedule_id,revision_no),
 FOREIGN KEY(root_realm_id,schedule_id)
  REFERENCES cg15_doctor_schedule(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(authored_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(effective_until IS NULL OR effective_until>effective_from)
);
ALTER TABLE cg15_doctor_schedule
 ADD CONSTRAINT fk_cg15_schedule_current_exact_revision
 FOREIGN KEY(root_realm_id,id,current_revision_id)
 REFERENCES cg15_schedule_revision(root_realm_id,schedule_id,id)
 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE cg15_schedule_weekly_window(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 revision_id uuid NOT NULL,
 weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 open_local time NOT NULL,
 close_local time NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(open_local<close_local),
 CHECK(EXTRACT(SECOND FROM open_local)=0 AND EXTRACT(SECOND FROM close_local)=0),
 UNIQUE(root_realm_id,revision_id,weekday,open_local),
 FOREIGN KEY(root_realm_id,schedule_id,revision_id)
  REFERENCES cg15_schedule_revision(root_realm_id,schedule_id,id) ON DELETE RESTRICT
);
ALTER TABLE cg15_schedule_weekly_window
 ADD CONSTRAINT ex_cg15_weekly_window_no_overlap
 EXCLUDE USING gist (
  root_realm_id WITH =,
  revision_id WITH =,
  weekday WITH =,
  int4range(
   (EXTRACT(HOUR FROM open_local)::integer*60+EXTRACT(MINUTE FROM open_local)::integer),
   (EXTRACT(HOUR FROM close_local)::integer*60+EXTRACT(MINUTE FROM close_local)::integer),
   '[)') WITH &&
 );
CREATE INDEX ix_cg15_window_revision
 ON cg15_schedule_weekly_window(root_realm_id,revision_id,weekday,open_local);

CREATE TABLE cg15_schedule_exception(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 doctor_id uuid NOT NULL,
 center_id uuid NOT NULL,
 association_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('HOLIDAY','BLOCK','LEAVE')),
 state text NOT NULL CHECK(state IN('PENDING','ACTIVE','RETURNED','REJECTED','CANCELLED')),
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 240),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483646),
 proposed_by uuid NOT NULL,
 approved_case_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,schedule_id,doctor_id,center_id,association_id)
  REFERENCES cg15_doctor_schedule(root_realm_id,id,doctor_id,center_id,association_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(start_at<end_at),
 CHECK(kind<>'LEAVE' OR state<>'ACTIVE' OR approved_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg15_exception_active
 ON cg15_schedule_exception(root_realm_id,doctor_id,start_at,end_at)
 WHERE state='ACTIVE';
CREATE INDEX ix_cg15_exception_pending
 ON cg15_schedule_exception(root_realm_id,state,created_at DESC)
 WHERE state='PENDING';

CREATE TABLE cg15_schedule_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action_key text NOT NULL CHECK(action_key IN('SAVE_WEEK','PROPOSE_EXCEPTION','CANCEL_EXCEPTION')),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 result_ref uuid,
 result_version integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,action_key,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((result_ref IS NULL)=(result_version IS NULL)),
 CHECK(result_version IS NULL OR result_version BETWEEN 1 AND 2147483646)
);
CREATE TABLE cg15_schedule_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 revision_id uuid,
 exception_id uuid,
 actor_ref uuid NOT NULL,
 action_key text NOT NULL CHECK(action_key IN('SCHEDULE_CREATED','SCHEDULE_CHANGED',
  'EXCEPTION_PROPOSED','EXCEPTION_CANCELLED')),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,action_key,request_key),
 FOREIGN KEY(root_realm_id,schedule_id) REFERENCES cg15_doctor_schedule(root_realm_id,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,schedule_id,revision_id)
  REFERENCES cg15_schedule_revision(root_realm_id,schedule_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,exception_id)
  REFERENCES cg15_schedule_exception(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_schedule_event_history
 ON cg15_schedule_event(root_realm_id,schedule_id,created_at DESC,id);
CREATE FUNCTION cg15_schedule_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Historical healthcare schedule source cannot be changed';
END $$;
CREATE TRIGGER cg15_revision_frozen BEFORE UPDATE OR DELETE ON cg15_schedule_revision
 FOR EACH ROW EXECUTE FUNCTION cg15_schedule_source_immutable();
CREATE TRIGGER cg15_window_frozen BEFORE UPDATE OR DELETE ON cg15_schedule_weekly_window
 FOR EACH ROW EXECUTE FUNCTION cg15_schedule_source_immutable();
CREATE TRIGGER cg15_event_frozen BEFORE UPDATE OR DELETE ON cg15_schedule_event
 FOR EACH ROW EXECUTE FUNCTION cg15_schedule_source_immutable();
CREATE FUNCTION cg15_command_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR
  NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.actor_ref IS DISTINCT FROM OLD.actor_ref OR
  NEW.action_key IS DISTINCT FROM OLD.action_key OR
  NEW.request_key IS DISTINCT FROM OLD.request_key OR
  NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
  NEW.created_at IS DISTINCT FROM OLD.created_at OR
  OLD.result_ref IS NOT NULL OR NEW.result_ref IS NULL OR
  NEW.result_version IS NULL THEN
  RAISE EXCEPTION 'Healthcare schedule command cannot be rewritten';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg15_command_guard
 BEFORE UPDATE OR DELETE ON cg15_schedule_command
 FOR EACH ROW EXECUTE FUNCTION cg15_command_source_guard();
