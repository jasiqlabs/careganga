-- Original CG-01 patient signup role. This is an account, NOT a second
-- identity table and NOT any Foundation staff capability or protected admin.
-- Root is provisioned after migrations on fresh installations, so install a
-- root-insert trigger plus backfill for already provisioned deployments.
CREATE FUNCTION cg01_ensure_patient_public_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_key='FOUNDATION_ROOT' THEN
  INSERT INTO role(realm_id,name,normalized_name,description,is_protected,active)
  VALUES(NEW.id,'CareGanga Patient','careganga patient',
   'Public patient sign-in; no Foundation staff actions',false,true)
  ON CONFLICT(realm_id,normalized_name) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg01_root_patient_public_role
 AFTER INSERT ON access_realm FOR EACH ROW
 EXECUTE FUNCTION cg01_ensure_patient_public_role();

INSERT INTO role(realm_id,name,normalized_name,description,is_protected,active)
 SELECT id,'CareGanga Patient','careganga patient',
 'Public patient sign-in; no Foundation staff actions',false,true
 FROM access_realm WHERE realm_key='FOUNDATION_ROOT'
 ON CONFLICT(realm_id,normalized_name) DO NOTHING;

-- No role grant, role activation/edit or name rewrite may ever turn this
-- special no-staff-role into privilege for all publicly registered accounts.
CREATE FUNCTION cg01_patient_public_role_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.normalized_name='careganga patient' OR NEW.normalized_name='careganga patient' THEN
  RAISE EXCEPTION 'Public patient role cannot be edited';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg01_patient_public_role_frozen BEFORE UPDATE OR DELETE
 ON role FOR EACH ROW EXECUTE FUNCTION cg01_patient_public_role_immutable();

CREATE FUNCTION cg01_patient_public_role_no_grant() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM role WHERE id=NEW.role_id
    AND normalized_name='careganga patient') THEN
  RAISE EXCEPTION 'Public patient accounts cannot receive staff capability grants';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg01_patient_public_role_grant_denied
 BEFORE INSERT OR UPDATE ON role_grant FOR EACH ROW
 EXECUTE FUNCTION cg01_patient_public_role_no_grant();

-- Prevent an attacker from providing any other role ID to the public
-- registration source. The CG01 service always resolves by protected name.

CREATE TABLE cg01_public_patient_signup_command(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 account_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg01_public_signup_account
 ON cg01_public_patient_signup_command(root_realm_id,account_id)
 WHERE account_id IS NOT NULL;

DO $cg01$
BEGIN
 IF EXISTS(
  SELECT 1 FROM role r
  WHERE r.normalized_name='careganga patient'
   AND (r.is_protected OR NOT r.active OR
    EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id))
 ) THEN
  RAISE EXCEPTION 'Public patient role requires an active no-grant identity';
 END IF;
END $cg01$;
