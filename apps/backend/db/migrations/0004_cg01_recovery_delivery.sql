-- On-demand CG-01 password-reset OTP delivery only; independent of ordinary notices.
ALTER TABLE auth_challenge ADD COLUMN delivery_status text NOT NULL DEFAULT 'PENDING'
 CHECK (delivery_status IN ('PENDING','CLAIMED','PROVIDER_ACCEPTED','UNKNOWN','UNAVAILABLE'));
ALTER TABLE auth_challenge ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0
 CHECK (delivery_attempts BETWEEN 0 AND 1);
ALTER TABLE auth_challenge ADD COLUMN provider_accepted_at timestamptz;
CREATE INDEX ix_cg01_recovery_active ON auth_challenge(account_id,expires_at)
 WHERE kind='RECOVERY' AND consumed_at IS NULL;
