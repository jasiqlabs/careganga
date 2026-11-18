-- US-005: approved immutable revisions remain public while a center edits
-- the NEXT private draft. Withdrawal is a separate, auditable pointer change.
ALTER TABLE health_center_content_draft DROP CONSTRAINT health_center_content_draft_state_check;
ALTER TABLE health_center_content_draft ADD CONSTRAINT health_center_content_draft_state_check
 CHECK(state IN('DRAFT','SUBMITTED','RETURNED','APPROVED'));
ALTER TABLE health_center_content_publication
 ADD COLUMN withdrawn_at timestamptz;
CREATE INDEX ix_health_center_current_content
 ON health_center_content_publication(root_realm_id,center_id)
 WHERE withdrawn_at IS NULL;
-- A publication pointer must be rooted in the exact original approved case;
-- back-reference checked by the application transaction on every publication.
CREATE TABLE health_center_content_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action_key text NOT NULL CHECK(action_key IN
  ('DRAFT_SAVED','SUBMITTED','RETURNED','PUBLISHED','WITHDRAWN')),
 source_version integer NOT NULL CHECK(source_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_center_content_history
 ON health_center_content_event(root_realm_id,center_id,created_at DESC,id DESC);
CREATE TRIGGER cg14_center_content_event_frozen
 BEFORE UPDATE OR DELETE ON health_center_content_event
 FOR EACH ROW EXECUTE FUNCTION cg14_fee_event_append_only();
