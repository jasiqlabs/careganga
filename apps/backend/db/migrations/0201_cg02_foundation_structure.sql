-- CG-02 US-001: independent Foundation legal profile, geography and Foundation-wide committees.
-- No CG-03 approval, CG-19 files, branch or future employee/member/finance FK.
CREATE TABLE foundation_profile (
  root_realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
  legal_name text NOT NULL CHECK(char_length(btrim(legal_name)) BETWEEN 2 AND 180),
  official_contact text NOT NULL DEFAULT '' CHECK(char_length(official_contact) <= 180),
  postal_address text NOT NULL DEFAULT '' CHECK(char_length(postal_address) <= 700),
  legal_registration_ref text CHECK(legal_registration_ref IS NULL OR char_length(legal_registration_ref) <= 120),
  registration_authority text CHECK(registration_authority IS NULL OR char_length(registration_authority) <= 180),
  registration_date date,
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TABLE geography_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  level text NOT NULL CHECK(level IN ('STATE','DISTRICT','SUBDIVISION','BLOCK')),
  parent_area_id uuid,
  display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 2 AND 100),
  normalized_name text NOT NULL CHECK(normalized_name=lower(btrim(display_name))),
  code text CHECK(code IS NULL OR char_length(code)<=24),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,root_realm_id),
  FOREIGN KEY(parent_area_id,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK ((level='STATE' AND parent_area_id IS NULL) OR (level<>'STATE' AND parent_area_id IS NOT NULL)),
  CHECK(parent_area_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX ux_cg02_geography_root ON geography_area(root_realm_id,level,normalized_name)
  WHERE parent_area_id IS NULL;
CREATE UNIQUE INDEX ux_cg02_geography_child ON geography_area(root_realm_id,parent_area_id,level,normalized_name)
  WHERE parent_area_id IS NOT NULL;
CREATE INDEX ix_cg02_geography_parent ON geography_area(root_realm_id,parent_area_id,level,status,normalized_name,id);

CREATE TABLE department (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  scope_kind text NOT NULL DEFAULT 'FOUNDATION' CHECK(scope_kind='FOUNDATION'),
  kind text NOT NULL CHECK(kind IN ('DEPARTMENT','COMMITTEE')),
  name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 100),
  normalized_name text NOT NULL CHECK(normalized_name=lower(btrim(name))),
  description text NOT NULL DEFAULT '' CHECK(char_length(description)<=800),
  opening_date date,
  geography_area_id uuid,
  parent_department_id uuid,
  head_account_ref uuid,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,root_realm_id),
  FOREIGN KEY(geography_area_id,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(parent_department_id,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(head_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(parent_department_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX ux_cg02_department_foundation ON department(root_realm_id,kind,normalized_name);
CREATE INDEX ix_cg02_department_scope ON department(root_realm_id,kind,active,normalized_name,id);

CREATE TABLE department_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  department_id uuid NOT NULL,
  account_ref uuid NOT NULL,
  office_role text NOT NULL CHECK(char_length(btrim(office_role)) BETWEEN 2 AND 80),
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,
  created_by uuid NOT NULL,
  FOREIGN KEY(department_id,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(active_until IS NULL OR active_until >= active_from)
);
CREATE UNIQUE INDEX ux_cg02_active_participation ON department_participation(department_id,account_ref,office_role)
  WHERE active_until IS NULL;
CREATE INDEX ix_cg02_participation_current ON department_participation(root_realm_id,department_id,active_until);

CREATE TABLE foundation_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_ref uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('PROFILE_SAVE','AREA_CREATE','AREA_UPDATE','DEPARTMENT_CREATE','DEPARTMENT_UPDATE','PARTICIPANT_ADD','PARTICIPANT_END')),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  result_ref uuid,
  result_version integer CHECK(result_version IS NULL OR result_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,action,request_key),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((result_ref IS NULL AND result_version IS NULL) OR (result_ref IS NOT NULL AND result_version IS NOT NULL))
);

CREATE TABLE foundation_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_ref uuid NOT NULL,
  entity_kind text NOT NULL CHECK(entity_kind IN ('PROFILE','AREA','DEPARTMENT','PARTICIPANT')),
  entity_ref uuid NOT NULL,
  action text NOT NULL CHECK(char_length(action) BETWEEN 4 AND 60),
  version integer NOT NULL CHECK(version > 0),
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(safe_details)='object'),
  command_ref uuid NOT NULL UNIQUE REFERENCES foundation_command(id) ON DELETE RESTRICT,
  at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg02_event_root_time ON foundation_event(root_realm_id,at DESC,id DESC);
CREATE INDEX ix_cg02_event_entity ON foundation_event(root_realm_id,entity_kind,entity_ref,at DESC);
CREATE FUNCTION cg02_deny_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Foundation history is immutable'; END;
$$;
CREATE TRIGGER cg02_event_immutable BEFORE UPDATE OR DELETE ON foundation_event
  FOR EACH ROW EXECUTE FUNCTION cg02_deny_event_mutation();
