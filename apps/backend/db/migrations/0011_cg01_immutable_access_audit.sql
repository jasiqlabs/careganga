-- CG-01 audit is write-once. Original records remain in their owning table.
-- This migration is additive; it never rewrites prior migration checksums.
CREATE FUNCTION cg01_deny_access_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CG-01 access audit history is immutable';
END;
$$;
CREATE TRIGGER cg01_access_audit_immutable BEFORE UPDATE OR DELETE ON access_audit
  FOR EACH ROW EXECUTE FUNCTION cg01_deny_access_audit_mutation();
