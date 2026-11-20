-- CG-14 US-003: audit original doctor and affiliated-center draft mutations.
-- Uses CG-14's existing idempotent health_network_command, not a second command
-- source or a cloned doctor identity. No review, publication or booking authority.
CREATE TABLE health_doctor_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  center_id uuid,
  actor_ref uuid NOT NULL,
  action_key text NOT NULL CHECK(action_key IN
    ('DOCTOR_DRAFT_CREATE','DOCTOR_DRAFT_UPDATE','DOCTOR_CENTER_PROPOSE')),
  record_version integer NOT NULL CHECK(record_version>0),
  command_id uuid NOT NULL UNIQUE REFERENCES health_network_command(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(root_realm_id,doctor_id)
    REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(root_realm_id,doctor_id,center_id)
    REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_doctor_event_audit
  ON health_doctor_event(root_realm_id,doctor_id,created_at DESC,id DESC);

-- Use the already deployed original healthcare append-only audit trigger.
CREATE TRIGGER health_doctor_event_write_once
 BEFORE UPDATE OR DELETE ON health_doctor_event
 FOR EACH ROW EXECUTE FUNCTION health_network_event_immutable();
