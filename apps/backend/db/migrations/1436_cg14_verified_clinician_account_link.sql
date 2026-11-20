-- CG14 original verified doctor identity -> actual CG01 account.
-- A Foundation reviewer can ONLY propose; the recipient authenticates and
-- accepts personally before any clinician-authorized CG15 operation.
-- No phone/name match, no automatic assignment, no new patient identity.
CREATE TABLE health_doctor_account_link(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 doctor_id uuid NOT NULL,
 account_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'PENDING'
  CHECK(status IN('PENDING','ACTIVE','REVOKED')),
 proposed_by uuid NOT NULL,
 proposed_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz,
 revoked_at timestamptz,
 revoked_by uuid,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,doctor_id)
  REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(revoked_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='PENDING' AND accepted_at IS NULL AND revoked_at IS NULL)
  OR (status='ACTIVE' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
  OR (status='REVOKED' AND revoked_at IS NOT NULL)),
 CHECK(revoked_at IS NULL OR revoked_at>=proposed_at),
 CHECK(accepted_at IS NULL OR accepted_at>=proposed_at),
 CHECK(proposed_by<>account_id)
);
-- One actual current professional for each login and one current login for
-- each doctor. Revoked history remains immutable; new proposal is new row.
CREATE UNIQUE INDEX ux_health_doctor_current_account
 ON health_doctor_account_link(root_realm_id,doctor_id)
 WHERE status IN('PENDING','ACTIVE');
CREATE UNIQUE INDEX ux_health_account_current_doctor
 ON health_doctor_account_link(root_realm_id,account_id)
 WHERE status IN('PENDING','ACTIVE');
CREATE INDEX ix_health_clinician_account_lookup
 ON health_doctor_account_link(root_realm_id,account_id,doctor_id)
 WHERE status='ACTIVE';
CREATE TABLE health_doctor_account_link_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 link_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN('PROPOSED','ACCEPTED','REVOKED')),
 actor_account_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,link_id,action),
 FOREIGN KEY(root_realm_id,link_id)
  REFERENCES health_doctor_account_link(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION health_doctor_account_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Doctor account approval events cannot be rewritten';
END; $$;
CREATE TRIGGER health_doctor_account_event_immutable_guard
 BEFORE UPDATE OR DELETE ON health_doctor_account_link_event
 FOR EACH ROW EXECUTE FUNCTION health_doctor_account_event_immutable();
COMMENT ON TABLE health_doctor_account_link IS
 'Verified doctor to clinician login; active only after independent Foundation proposal and own-account password acceptance';
