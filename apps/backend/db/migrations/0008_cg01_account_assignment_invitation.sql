-- CG-01/US-003: direct Admin account creation, role/status transactions and idempotency.
ALTER TABLE account ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision > 0);
CREATE INDEX ix_cg01_account_realm_status_name
  ON account(realm_id,status,display_name,id);

CREATE TABLE account_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('CREATE','ASSIGN','REVOKE','STATUS')),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  target_account_id uuid REFERENCES account(id) ON DELETE RESTRICT,
  result_revision integer CHECK (result_revision IS NULL OR result_revision > 0),
  result_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_account_id,action,request_key),
  CHECK (
    (target_account_id IS NULL AND result_revision IS NULL AND result_status IS NULL)
    OR (target_account_id IS NOT NULL AND result_revision IS NOT NULL AND result_status IS NOT NULL)
  )
);
CREATE INDEX ix_cg01_account_command_actor_created
  ON account_command(actor_account_id,created_at DESC);
