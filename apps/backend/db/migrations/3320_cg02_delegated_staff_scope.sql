-- CG-MB-001 | Greenfield CG-02 source owner for delegated Foundation branch/area access.
-- Roles/capabilities remain CG-01; healthcare center affiliation remains CG-14.
-- This table never grants Foundation-wide authority, even for a STATE area.
CREATE TABLE cg02_staff_scope_assignment(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 account_ref uuid NOT NULL,
 scope_kind text NOT NULL CHECK(scope_kind IN('BRANCH','AREA')),
 branch_ref uuid,
 area_ref uuid,
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 6 AND 500),
 granted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 granted_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 ended_by uuid,
 end_request_key uuid,
 source_version integer NOT NULL DEFAULT 1 CHECK(source_version IN(1,2)),
 UNIQUE(id,root_realm_id),
 UNIQUE(root_realm_id,granted_by,request_key),
 FOREIGN KEY(account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(granted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(area_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((scope_kind='BRANCH' AND branch_ref IS NOT NULL AND area_ref IS NULL)
    OR (scope_kind='AREA' AND branch_ref IS NULL AND area_ref IS NOT NULL)),
 CHECK((ended_at IS NULL AND ended_by IS NULL AND end_request_key IS NULL AND source_version=1)
    OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND end_request_key IS NOT NULL
      AND ended_at>=granted_at AND source_version=2))
);
CREATE UNIQUE INDEX ux_cg02_active_staff_scope
 ON cg02_staff_scope_assignment(root_realm_id,account_ref,scope_kind,
   COALESCE(branch_ref,area_ref)) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX ux_cg02_staff_scope_end_key
 ON cg02_staff_scope_assignment(root_realm_id,ended_by,end_request_key)
 WHERE ended_at IS NOT NULL;
CREATE INDEX ix_cg02_staff_scope_current
 ON cg02_staff_scope_assignment(root_realm_id,account_ref,scope_kind,branch_ref,area_ref)
 WHERE ended_at IS NULL;
CREATE INDEX ix_cg02_staff_scope_history
 ON cg02_staff_scope_assignment(root_realm_id,account_ref,granted_at DESC,id DESC);

-- One closed scope event cannot be edited, reopened or silently reassigned.
CREATE FUNCTION cg02_staff_scope_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Delegated branch/area access history is immutable';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.account_ref IS DISTINCT FROM OLD.account_ref
  OR NEW.scope_kind IS DISTINCT FROM OLD.scope_kind
  OR NEW.branch_ref IS DISTINCT FROM OLD.branch_ref
  OR NEW.area_ref IS DISTINCT FROM OLD.area_ref
  OR NEW.reason IS DISTINCT FROM OLD.reason
  OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
  OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
  OR NEW.request_key IS DISTINCT FROM OLD.request_key
  OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
  OR OLD.ended_at IS NOT NULL
  OR NEW.ended_at IS NULL OR NEW.ended_by IS NULL OR NEW.end_request_key IS NULL
  OR NEW.source_version<>2 THEN
  RAISE EXCEPTION 'Delegated branch/area access cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg02_staff_scope_no_retarget
 BEFORE UPDATE OR DELETE ON cg02_staff_scope_assignment
 FOR EACH ROW EXECUTE FUNCTION cg02_staff_scope_immutable();
