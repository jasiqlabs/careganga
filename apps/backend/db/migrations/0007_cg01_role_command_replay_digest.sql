-- Disallow reusing an idempotency key for a different command body.
ALTER TABLE role_command ADD COLUMN request_digest char(64) NOT NULL
  CHECK(request_digest ~ '^[0-9a-f]{64}$');
