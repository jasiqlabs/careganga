-- CG-05 US-001. One operational project master, no financial or public shadow ledger.
CREATE TABLE project (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 code_norm text NOT NULL CHECK(code_norm ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 2 AND 160),
 category text NOT NULL CHECK(char_length(btrim(category)) BETWEEN 1 AND 80),
 summary text NOT NULL DEFAULT '' CHECK(char_length(summary)<=500),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=4000),
 status text NOT NULL CHECK(status IN ('DRAFT','PLANNED','ACTIVE','ON_HOLD','COMPLETED','CANCELLED')),
 priority text NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
 owner_account_ref uuid NOT NULL,
 scope_kind text NOT NULL CHECK(scope_kind IN ('FOUNDATION','BRANCH')),
 branch_ref uuid,
 state_ref uuid,
 district_ref uuid,
 location_label text NOT NULL DEFAULT '' CHECK(char_length(location_label)<=250),
 funding_source text NOT NULL DEFAULT '' CHECK(char_length(funding_source)<=160),
 planned_start date,
 planned_end date,
 planned_budget_minor bigint CHECK(planned_budget_minor BETWEEN 0 AND 999999999999999),
 completed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,code_norm),
 FOREIGN KEY(owner_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((scope_kind='FOUNDATION')=(branch_ref IS NULL)),
 CHECK(district_ref IS NULL OR state_ref IS NOT NULL),
 CHECK(planned_end IS NULL OR planned_start IS NULL OR planned_end>=planned_start),
 CHECK((status='COMPLETED')=(completed_at IS NOT NULL))
);
CREATE INDEX ix_cg05_project_scope ON project(root_realm_id,branch_ref,status,updated_at DESC,id DESC);
CREATE INDEX ix_cg05_project_owner ON project(root_realm_id,owner_account_ref,updated_at DESC,id DESC);
CREATE INDEX ix_cg05_project_category ON project(root_realm_id,category,status);
CREATE TABLE project_branch_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 project_id uuid NOT NULL,
 branch_ref uuid,
 valid_from timestamptz NOT NULL,
 valid_to timestamptz,
 change_key uuid NOT NULL,
 changed_by uuid NOT NULL,
 UNIQUE(root_realm_id,change_key),
 FOREIGN KEY(root_realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(valid_to IS NULL OR valid_to>valid_from)
);
CREATE UNIQUE INDEX ux_cg05_project_current_branch ON project_branch_history(root_realm_id,project_id) WHERE valid_to IS NULL;
CREATE INDEX ix_cg05_project_branch_history ON project_branch_history(root_realm_id,project_id,valid_from DESC);
-- Serialize interval changes on the real parent. No extension or overlapping effective intervals.
CREATE FUNCTION cg05_guard_project_branch_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Project branch history is immutable'; END IF;
 PERFORM 1 FROM project WHERE root_realm_id=NEW.root_realm_id AND id=NEW.project_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF OLD.valid_to IS NOT NULL OR NEW.valid_to IS NULL OR
   (to_jsonb(NEW)-'valid_to') IS DISTINCT FROM (to_jsonb(OLD)-'valid_to') THEN
   RAISE EXCEPTION 'Only closing an open project branch interval is permitted';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM project_branch_history h WHERE h.root_realm_id=NEW.root_realm_id AND h.project_id=NEW.project_id AND h.id<>NEW.id
  AND tstzrange(h.valid_from,h.valid_to,'[)') && tstzrange(NEW.valid_from,NEW.valid_to,'[)')) THEN
  RAISE EXCEPTION 'Project branch history intervals overlap';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_project_branch_interval BEFORE INSERT OR UPDATE OR DELETE ON project_branch_history FOR EACH ROW EXECUTE FUNCTION cg05_guard_project_branch_history();
CREATE TABLE project_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 project_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN ('CREATE','EDIT','STATUS','BRANCH_MOVE')),
 result_version integer NOT NULL CHECK(result_version>0),
 prior_status text,
 resulting_status text NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=500),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,project_id,result_version),
 FOREIGN KEY(root_realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg05_project_events ON project_event(root_realm_id,project_id,occurred_at DESC);
CREATE FUNCTION cg05_immutable_project_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Project event history is immutable'; END $$;
CREATE TRIGGER cg05_project_event_immutable BEFORE UPDATE OR DELETE ON project_event FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();
