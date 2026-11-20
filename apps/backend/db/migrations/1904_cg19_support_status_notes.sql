-- CG-19 client support status-note acceptance:
-- Waiting-for-user, resolution and closure require a protected original
-- explanation. Private notes never enter public receipts or notification copy.
CREATE TABLE cg19_support_status_note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_account_id uuid NOT NULL,
  case_revision integer NOT NULL CHECK(case_revision>0),
  new_status text NOT NULL CHECK(new_status IN(
    'OPEN','ASSIGNED','IN_PROGRESS','WAITING_FOR_USER','ESCALATED',
    'REPLIED','RESOLVED','CLOSED')),
  note_digest char(64) NOT NULL CHECK(note_digest ~ '^[a-f0-9]{64}$'),
  note_encrypted bytea NOT NULL CHECK(length(note_encrypted)>40),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id,case_revision),
  FOREIGN KEY(case_id,realm_id)
    REFERENCES cg19_support_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_account_id,realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_support_status_note_case
  ON cg19_support_status_note(realm_id,case_id,case_revision DESC);
CREATE TRIGGER cg19_status_note_immutable
 BEFORE UPDATE OR DELETE ON cg19_support_status_note
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
COMMENT ON TABLE cg19_support_status_note IS
 'Immutable encrypted status explanations; visible only to current authorized Foundation support staff.';
