-- CG-01 owns permission storage; later modules may register typed capabilities.
-- Grammar is namespace.action, but runtime allow-list and effective grants remain default-deny.
-- No future capability rows are seeded by this migration.
ALTER TABLE role_grant DROP CONSTRAINT role_grant_capability_key_check;
ALTER TABLE role_grant ADD CONSTRAINT role_grant_capability_key_check
  CHECK (capability_key ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$');
