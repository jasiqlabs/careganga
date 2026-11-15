-- CG-01 security/DB review: bounded, on-demand cleanup of aged authentication throttle entries.
-- The CG-01 application does not run an idle periodic worker or provider scan.
-- Date-leading index supports deleting only a small batch of expired buckets.
CREATE INDEX ix_cg01_auth_throttle_age
  ON auth_login_attempt(window_started_at,key_digest);
