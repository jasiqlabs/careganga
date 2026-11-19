-- CG-15 US-004: in-person consultations only. CG17 owns all money, CG19 PDFs.
-- CRITICAL: physical PostgreSQL migration, EXPLAIN, two-session race & restore NOT_RUN.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE cg15_consultation_hold (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 doctor_id uuid NOT NULL,
 center_id uuid NOT NULL,
 association_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 schedule_revision_id uuid NOT NULL,
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 3 AND 64),
 fee_minor bigint NOT NULL CHECK(fee_minor BETWEEN 0 AND 10000000000),
 fee_version integer NOT NULL CHECK(fee_version>0),
 status text NOT NULL DEFAULT 'HELD'
   CHECK(status IN('HELD','CONSUMED','EXPIRED','CANCELLED')),
 expires_at timestamptz NOT NULL,
 created_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,created_by_account,request_key),
 UNIQUE(root_realm_id,id,patient_id,doctor_id,center_id,association_id),
 CHECK(end_at>start_at),
 CHECK(expires_at>created_at),
 FOREIGN KEY(root_realm_id,patient_id) REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,doctor_id,center_id,association_id)
   REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,schedule_id,doctor_id,center_id,association_id)
   REFERENCES cg15_doctor_schedule(root_realm_id,id,doctor_id,center_id,association_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,schedule_id,schedule_revision_id)
   REFERENCES cg15_schedule_revision(root_realm_id,schedule_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_holds_due ON cg15_consultation_hold(root_realm_id,expires_at,id)
 WHERE status='HELD';

CREATE TABLE cg15_doctor_reservation (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 hold_id uuid,
 doctor_id uuid NOT NULL,
 center_id uuid NOT NULL,
 association_id uuid NOT NULL,
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('HELD','CONFIRMED','EXPIRED','RELEASED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,hold_id),
 UNIQUE(root_realm_id,id,doctor_id,center_id,association_id),
 CHECK(end_at>start_at),
 FOREIGN KEY(root_realm_id,hold_id) REFERENCES cg15_consultation_hold(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,doctor_id,center_id,association_id)
  REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id) ON DELETE RESTRICT
);
ALTER TABLE cg15_doctor_reservation ADD CONSTRAINT cg15_global_doctor_time_nonoverlap
 EXCLUDE USING gist (
 root_realm_id WITH =, doctor_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&
 ) WHERE(status IN ('HELD','CONFIRMED'));
CREATE INDEX ix_cg15_reservation_doctor_time ON cg15_doctor_reservation
 (root_realm_id,doctor_id,start_at,end_at) WHERE status IN('HELD','CONFIRMED');

CREATE TABLE cg15_consultation_appointment (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 booking_display_id text NOT NULL CHECK(booking_display_id ~ '^CGA-[A-F0-9]{16}$'),
 patient_id uuid NOT NULL,
 doctor_id uuid NOT NULL,
 center_id uuid NOT NULL,
 association_id uuid NOT NULL,
 hold_id uuid NOT NULL,
 reservation_id uuid NOT NULL,
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 time_zone text NOT NULL,
 patient_display_name text NOT NULL CHECK(length(patient_display_name) BETWEEN 3 AND 205),
 doctor_name text NOT NULL CHECK(length(doctor_name) BETWEEN 2 AND 160),
 center_name text NOT NULL CHECK(length(center_name) BETWEEN 2 AND 160),
 center_address text NOT NULL CHECK(length(center_address) BETWEEN 5 AND 500),
 fee_minor bigint NOT NULL CHECK(fee_minor BETWEEN 0 AND 10000000000),
 fee_version integer NOT NULL CHECK(fee_version>0),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 booking_state text NOT NULL DEFAULT 'CONFIRMED'
  CHECK(booking_state IN('CONFIRMED','ARRIVED','WAITING','IN_CONSULTATION','COMPLETED','NO_SHOW','CANCELLED')),
 collection_state text NOT NULL DEFAULT 'DUE_AT_CENTER'
  CHECK(collection_state IN('DUE_AT_CENTER','NOT_COLLECTIBLE')),
 payment_mode text NOT NULL DEFAULT 'PAY_AT_CENTER' CHECK(payment_mode='PAY_AT_CENTER'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 terms_revision integer NOT NULL DEFAULT 1 CHECK(terms_revision>0),
 created_by_account uuid NOT NULL,
 confirmation_key uuid NOT NULL,
 confirmation_digest char(64) NOT NULL CHECK(confirmation_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,booking_display_id),
 UNIQUE(root_realm_id,hold_id),
 UNIQUE(root_realm_id,reservation_id),
 UNIQUE(root_realm_id,created_by_account,confirmation_key),
 CHECK(end_at>start_at),
 CHECK((booking_state='CANCELLED' AND collection_state='NOT_COLLECTIBLE') OR
  (booking_state<>'CANCELLED' AND collection_state='DUE_AT_CENTER')),
 FOREIGN KEY(root_realm_id,patient_id) REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,doctor_id,center_id,association_id)
   REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id) ON DELETE RESTRICT,
 -- Original hold proves the patient only; current doctor/center may change
 -- atomically with a new globally nonoverlapping reservation on reschedule.
 FOREIGN KEY(root_realm_id,hold_id) REFERENCES cg15_consultation_hold(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reservation_id,doctor_id,center_id,association_id)
  REFERENCES cg15_doctor_reservation(root_realm_id,id,doctor_id,center_id,association_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_appointment_my ON cg15_consultation_appointment
 (root_realm_id,patient_id,created_at DESC,id DESC);
CREATE INDEX ix_cg15_appointment_center ON cg15_consultation_appointment
 (root_realm_id,center_id,start_at,id);

CREATE TABLE cg15_appointment_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL,
 prior_revision integer NOT NULL CHECK(prior_revision>=0),
 new_revision integer NOT NULL CHECK(new_revision>0),
 action text NOT NULL CHECK(action IN
 ('CONFIRMED','CHECKED_IN','WAITING','IN_CONSULTATION','COMPLETED','NO_SHOW','CANCELLED','RESCHEDULED')),
 prior_snapshot jsonb,
 new_snapshot jsonb NOT NULL,
 actor_account_id uuid NOT NULL,
 request_key uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,appointment_id,new_revision),
 UNIQUE(root_realm_id,appointment_id,action,request_key),
 FOREIGN KEY(root_realm_id,appointment_id) REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_appointment_event_recent ON cg15_appointment_event
 (root_realm_id,appointment_id,occurred_at,id);
CREATE FUNCTION cg15_appointment_event_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Appointment audit is append only';
END; $;
CREATE TRIGGER cg15_appointment_event_immutable BEFORE UPDATE OR DELETE
 ON cg15_appointment_event FOR EACH ROW EXECUTE FUNCTION cg15_appointment_event_frozen();
