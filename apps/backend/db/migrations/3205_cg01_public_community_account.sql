-- Original CG-01 community signup role. This is an account, NOT a second
-- identity table and NOT any Foundation staff capability or protected admin.
-- Root is provisioned after migrations on fresh installations, so install a
-- root-insert trigger plus backfill for already provisioned deployments.
CREATE FUNCTION cg01_ensure_community_public_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_key='FOUNDATION_ROOT' THEN
  INSERT INTO role(realm_id,name,normalized_name,description,is_protected,active)
  VALUES(NEW.id,'CareGanga Community Applicant','careganga community applicant',
   'Public community applicant sign-in; no Foundation staff actions',false,true)
  ON CONFLICT(realm_id,normalized_name) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg01_root_community_public_role
 AFTER INSERT ON access_realm FOR EACH ROW
 EXECUTE FUNCTION cg01_ensure_community_public_role();

INSERT INTO role(realm_id,name,normalized_name,description,is_protected,active)
 SELECT id,'CareGanga Community Applicant','careganga community applicant',
 'Public community applicant sign-in; no Foundation staff actions',false,true
 FROM access_realm WHERE realm_key='FOUNDATION_ROOT'
 ON CONFLICT(realm_id,normalized_name) DO NOTHING;

-- No role grant, role activation/edit or name rewrite may ever turn this
-- special no-staff-role into privilege for all publicly registered accounts.
CREATE FUNCTION cg01_community_public_role_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.normalized_name='careganga community applicant' THEN
   RAISE EXCEPTION 'Public community applicant role cannot be deleted';
  END IF;
  RETURN OLD;
 END IF;
 IF OLD.normalized_name='careganga community applicant' OR NEW.normalized_name='careganga community applicant' THEN
  RAISE EXCEPTION 'Public community applicant role cannot be edited';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg01_community_public_role_frozen BEFORE UPDATE OR DELETE
 ON role FOR EACH ROW EXECUTE FUNCTION cg01_community_public_role_immutable();

CREATE FUNCTION cg01_community_public_role_no_grant() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM role WHERE id=NEW.role_id
    AND normalized_name='careganga community applicant') THEN
  RAISE EXCEPTION 'Public community applicant accounts cannot receive staff capability grants';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg01_community_public_role_grant_denied
 BEFORE INSERT OR UPDATE ON role_grant FOR EACH ROW
 EXECUTE FUNCTION cg01_community_public_role_no_grant();


-- Reuse the existing CG01 public registration command and credential store.
DO $cg04$
BEGIN
 IF EXISTS(SELECT 1 FROM role r WHERE r.normalized_name='careganga community applicant'
   AND (r.is_protected OR NOT r.active OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id)))
 THEN RAISE EXCEPTION 'Public applicant role must be an active no-grant identity'; END IF;
END; $cg04$;
