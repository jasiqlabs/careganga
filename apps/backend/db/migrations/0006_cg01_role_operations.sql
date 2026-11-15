-- CG-01 owned bounded mutation retry state. No role content, client secrets or future-module records.
CREATE TABLE role_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('CREATE','EDIT','COPY','RETIRE')),
  request_key uuid NOT NULL,
  role_id uuid REFERENCES role(id) ON DELETE RESTRICT,
  result_revision integer CHECK (result_revision IS NULL OR result_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_account_id,action,request_key),
  CHECK ((role_id IS NULL AND result_revision IS NULL)
     OR (role_id IS NOT NULL AND result_revision IS NOT NULL))
);
CREATE INDEX ix_cg01_role_command_actor_created ON role_command(actor_account_id,created_at DESC);
ALTER TABLE role ADD CONSTRAINT ck_cg01_role_name_length
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 80);
ALTER TABLE role ADD CONSTRAINT ck_cg01_role_description_length
  CHECK (char_length(description) <= 350);
ALTER TABLE role ADD CONSTRAINT ck_cg01_role_normalized_name
  CHECK (normalized_name = lower(btrim(name)));
-- All role reads and writes still verify current Foundation realm on the server.
