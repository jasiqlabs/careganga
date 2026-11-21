-- CG10 US001: classified employee contact/bank data separate from every
-- ordinary staff list, self-profile, approval case, audit and public media.
-- Stored ciphertext only. Runtime key lives in deployment secret configuration.
CREATE TABLE hr_application_private (
 application_id uuid NOT NULL,
 root_realm_id uuid NOT NULL,
 payload_ciphertext text NOT NULL CHECK(length(payload_ciphertext) BETWEEN 1 AND 8192),
 payload_nonce char(16) NOT NULL CHECK(payload_nonce ~ '^[A-Za-z0-9_-]{16}$'),
 payload_tag char(22) NOT NULL CHECK(payload_tag ~ '^[A-Za-z0-9_-]{22}$'),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 record_version integer NOT NULL DEFAULT 1 CHECK(record_version BETWEEN 1 AND 2147483647),
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),
 FOREIGN KEY(application_id,root_realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE hr_private_access_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 application_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN('PRIVATE_READ','PRIVATE_WRITE')),
 record_version integer NOT NULL CHECK(record_version>0),
 happened_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(application_id,root_realm_id)
  REFERENCES hr_employee_application(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_private_access_audit
 ON hr_private_access_audit(root_realm_id,application_id,happened_at DESC,id DESC);
CREATE TRIGGER cg10_private_access_event_frozen
 BEFORE UPDATE OR DELETE ON hr_private_access_audit
 FOR EACH ROW EXECUTE FUNCTION cg10_revision_immutable();
