-- Greenfield CG-01 simple credentials. Run against a clean disposable database before client delivery.
-- No production accounts exist; new credential creation requires mobile.
ALTER TABLE account ADD COLUMN normalized_mobile text;
ALTER TABLE account ALTER COLUMN normalized_email DROP NOT NULL;
ALTER TABLE account ADD CONSTRAINT ck_cg01_normalized_mobile
  CHECK (normalized_mobile IS NULL OR normalized_mobile ~ '^[6-9][0-9]{9}$');
ALTER TABLE account ADD CONSTRAINT ck_cg01_email_normalization_optional
  CHECK (normalized_email IS NULL OR normalized_email = lower(trim(normalized_email)));
ALTER TABLE account ALTER COLUMN normalized_mobile SET NOT NULL;
CREATE UNIQUE INDEX ux_cg01_login_mobile ON account(normalized_mobile);
CREATE UNIQUE INDEX ux_cg01_login_email_ci ON account(lower(normalized_email))
  WHERE normalized_email IS NOT NULL;
ALTER TABLE account ADD COLUMN recovery_contact_changed_at timestamptz;
-- No assertion of contact verification just because a contact was saved.
-- Changes to either recovery address enter a 24-hour recovery hold.
CREATE FUNCTION cg01_recovery_contact_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.normalized_mobile IS DISTINCT FROM OLD.normalized_mobile
    OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email THEN
    NEW.recovery_contact_changed_at = now();
    NEW.email_verified_at = NULL;
    NEW.contact_phone_verified_at = NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cg01_recovery_contact_changed_before_update
BEFORE UPDATE OF normalized_mobile,normalized_email ON account
FOR EACH ROW EXECUTE FUNCTION cg01_recovery_contact_changed();
ALTER TABLE auth_session ADD COLUMN password_authenticated_at timestamptz;
-- auth_challenge.delivery_status already exists in migration 0004: reuse it unchanged.
ALTER TABLE auth_challenge ADD COLUMN delivery_channel text
  CHECK(delivery_channel IS NULL OR delivery_channel IN ('email','sms'));
-- New password-based login may not claim authenticator assurance.
