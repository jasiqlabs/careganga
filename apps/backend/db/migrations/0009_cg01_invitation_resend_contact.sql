-- CG-01 US-003: original Add Staff phone (unverified) and bounded manual resend.
-- No partner/employee/branch/medical schema is imported.
ALTER TABLE account ADD COLUMN contact_phone text;
ALTER TABLE account ADD CONSTRAINT ck_cg01_phone_format
  CHECK(contact_phone IS NULL OR contact_phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE account_command DROP CONSTRAINT account_command_action_check;
ALTER TABLE account_command ADD CONSTRAINT account_command_action_check
  CHECK(action IN ('INVITE','RESEND','ASSIGN','REVOKE','STATUS'));
