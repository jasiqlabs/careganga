-- CG-02 US-002: immutable operating-branch event history with source command replay.
-- Additive for new branch-domain changes; do not mutate CG-02 US-001 histories.
ALTER TABLE branch_operation_command
  DROP CONSTRAINT IF EXISTS branch_operation_command_action_check;
ALTER TABLE branch_operation_command ADD CONSTRAINT cg02_branch_operation_action CHECK(action IN(
  'SUBMIT','ACTIVATE','UPDATE_BRANCH','CHANGE_BRANCH_STATUS',
  'CREATE_BRANCH_DEPARTMENT','UPDATE_BRANCH_DEPARTMENT',
  'LINK_DEPARTMENT','UNLINK_DEPARTMENT',
  'ASSIGN_BRANCH_PARTICIPANT','END_BRANCH_PARTICIPANT'
));
CREATE TABLE branch_operation_event(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_ref uuid NOT NULL,
  entity_kind text NOT NULL CHECK(entity_kind IN('BRANCH','DEPARTMENT','PARTICIPANT','LINK')),
  entity_ref uuid NOT NULL,
  action text NOT NULL,
  version integer NOT NULL CHECK(version>0),
  command_ref uuid NOT NULL UNIQUE REFERENCES branch_operation_command(id) ON DELETE RESTRICT,
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(safe_details)='object'),
  at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg02_branch_ops_by_entity
  ON branch_operation_event(root_realm_id,entity_kind,entity_ref,at DESC,id DESC);
CREATE TRIGGER cg02_branch_ops_event_immutable
  BEFORE UPDATE OR DELETE ON branch_operation_event FOR EACH ROW
  EXECUTE FUNCTION cg02_registration_revision_immutable();
