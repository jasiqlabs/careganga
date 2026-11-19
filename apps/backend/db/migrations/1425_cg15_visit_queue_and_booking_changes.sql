-- CG-15 US-006/007: original center queue and atomic booking change history.
-- Patient clinical details never flow into the receptionist's display token.
CREATE TABLE cg15_visit_queue(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL,
 center_id uuid NOT NULL,
 queue_local_date date NOT NULL,
 queue_sequence integer NOT NULL CHECK(queue_sequence BETWEEN 1 AND 999999),
 queue_token text NOT NULL CHECK(queue_token ~ '^Q[0-9]{1,6}$'),
 state text NOT NULL DEFAULT 'ARRIVED'
   CHECK(state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED','NO_SHOW')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 checked_in_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 actor_account_id uuid NOT NULL,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,appointment_id),
 UNIQUE(root_realm_id,center_id,queue_local_date,queue_sequence),
 UNIQUE(root_realm_id,center_id,queue_local_date,queue_token),
 FOREIGN KEY(root_realm_id,appointment_id)
   REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
   REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_queue_center_day ON cg15_visit_queue
 (root_realm_id,center_id,queue_local_date,state,queue_sequence);

CREATE TABLE cg15_visit_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 visit_id uuid NOT NULL,
 appointment_id uuid NOT NULL,
 prior_revision integer NOT NULL CHECK(prior_revision>=0),
 next_revision integer NOT NULL CHECK(next_revision>0),
 prior_state text,
 next_state text NOT NULL
  CHECK(next_state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED','NO_SHOW')),
 actor_account_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,visit_id,next_revision),
 UNIQUE(root_realm_id,appointment_id,request_key),
 FOREIGN KEY(root_realm_id,visit_id)
  REFERENCES cg15_visit_queue(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,appointment_id)
  REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_visit_events ON cg15_visit_event
 (root_realm_id,visit_id,created_at,id);
CREATE FUNCTION cg15_visit_event_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Patient visit events are immutable';
END $$;
CREATE TRIGGER cg15_visit_event_immutable BEFORE UPDATE OR DELETE ON cg15_visit_event
 FOR EACH ROW EXECUTE FUNCTION cg15_visit_event_frozen();

-- New approval for a reschedule becomes the current reservation; old accepted
-- appointment terms remain in the append-only cg15_appointment_event snapshot.
-- No separate cash refund table or duplicate CG14 doctor/fee master.
),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,visit_id,next_revision),
 UNIQUE(root_realm_id,appointment_id,request_key),
 FOREIGN KEY(root_realm_id,visit_id)
  REFERENCES cg15_visit_queue(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,appointment_id)
  REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_visit_events ON cg15_visit_event
 (root_realm_id,visit_id,created_at,id);
CREATE FUNCTION cg15_visit_event_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Patient visit events are immutable';
END $$;
CREATE TRIGGER cg15_visit_event_immutable BEFORE UPDATE OR DELETE ON cg15_visit_event
 FOR EACH ROW EXECUTE FUNCTION cg15_visit_event_frozen();

-- New approval for a reschedule becomes the current reservation; old accepted
-- appointment terms remain in the append-only cg15_appointment_event snapshot.
-- No separate cash refund table or duplicate CG14 doctor/fee master.
