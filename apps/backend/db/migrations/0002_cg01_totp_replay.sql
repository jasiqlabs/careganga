-- A successful privileged MFA code is single-use across the accepted time window.
ALTER TABLE identity_credential
  ADD COLUMN last_totp_counter bigint NOT NULL DEFAULT -1 CHECK (last_totp_counter >= -1);
