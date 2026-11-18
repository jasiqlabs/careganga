-- CG-14 US-004: bounded anonymous directory ingress throttle.
-- The digest is a keyed server HMAC of the transport socket or a signed
-- gateway-confirmed client address, never raw IP/PII or an XFF header.
-- This is not an approval/identity record; expiry can safely delete rows.
CREATE TABLE health_public_request_bucket(
 bucket_digest char(64) PRIMARY KEY
   CHECK(bucket_digest ~ '^[0-9a-f]{64}$'),
 window_started_at timestamptz NOT NULL,
 attempt_count integer NOT NULL CHECK(attempt_count BETWEEN 1 AND 2147483647)
);
CREATE INDEX ix_health_public_request_bucket_expiry
 ON health_public_request_bucket(window_started_at,bucket_digest);
