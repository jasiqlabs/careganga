-- CG05 US003 one operational source for activities and Foundation events.
-- No separate foundation_event, ticketing, campaign, file or finance master.
CREATE SEQUENCE cg05_activity_public_sequence;
CREATE TABLE project_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 activity_code text NOT NULL DEFAULT ('ACT-'||nextval('cg05_activity_public_sequence')::text),
 project_id uuid,
 kind text NOT NULL CHECK(kind IN('ACTIVITY','EVENT')),
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 2 AND 160),
 category text NOT NULL CHECK(char_length(btrim(category)) BETWEEN 1 AND 80),
 activity_type text NOT NULL CHECK(char_length(btrim(activity_type)) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=4000),
 program_label text NOT NULL DEFAULT '' CHECK(char_length(program_label)<=160),
 branch_ref uuid,
 state_ref uuid,
 district_ref uuid,
 venue_label text NOT NULL CHECK(char_length(btrim(venue_label)) BETWEEN 2 AND 250),
 owner_account_ref uuid NOT NULL,
 scheduled_start timestamptz NOT NULL,
 scheduled_end timestamptz NOT NULL,
 actual_start timestamptz,
 actual_end timestamptz,
 outcome text NOT NULL DEFAULT '' CHECK(char_length(outcome)<=2000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,activity_code),
 FOREIGN KEY(root_realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(district_ref IS NULL OR state_ref IS NOT NULL),
 CHECK(scheduled_end>=scheduled_start),
 CHECK(actual_end IS NULL OR (actual_start IS NOT NULL AND actual_end>=actual_start)),
 CHECK(((status IN('DRAFT','SCHEDULED') AND actual_start IS NULL AND actual_end IS NULL)
 OR (status='ONGOING' AND actual_start IS NOT NULL AND actual_end IS NULL)
 OR (status='COMPLETED' AND actual_start IS NOT NULL AND actual_end IS NOT NULL)
 OR (status='CANCELLED' AND actual_end IS NULL)) IS TRUE)
);
CREATE INDEX ix_cg05_activity_scope ON project_activity(root_realm_id,branch_ref,status,scheduled_start,id);
CREATE INDEX ix_cg05_activity_project ON project_activity(root_realm_id,project_id,scheduled_start,id);
CREATE INDEX ix_cg05_activity_owner ON project_activity(root_realm_id,owner_account_ref,status,scheduled_start,id);
CREATE INDEX ix_cg05_activity_category ON project_activity(root_realm_id,kind,category,status);
CREATE TABLE project_activity_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 activity_id uuid NOT NULL,
 event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN('CREATE','EDIT','STATUS')),
 actor_ref uuid NOT NULL,
 owner_account_ref uuid NOT NULL,
 prior_status text CHECK(prior_status IN('DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED')),
 resulting_status text NOT NULL CHECK(resulting_status IN('DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED')),
 result_version integer NOT NULL CHECK(result_version>0),
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=500),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 UNIQUE(root_realm_id,activity_id,result_version),
 FOREIGN KEY(root_realm_id,activity_id) REFERENCES project_activity(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((action='CREATE')=(prior_status IS NULL))
);
CREATE INDEX ix_cg05_activity_event ON project_activity_event(root_realm_id,activity_id,result_version DESC);
CREATE TRIGGER cg05_activity_event_immutable BEFORE UPDATE OR DELETE ON project_activity_event
 FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();
CREATE FUNCTION cg05_activity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Activity history is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.status NOT IN('DRAFT','SCHEDULED') THEN RAISE EXCEPTION 'Invalid initial activity state'; END IF;
 ELSE
  IF (NEW.id,NEW.root_realm_id,NEW.activity_code,NEW.created_by,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.activity_code,OLD.created_by,OLD.created_at)
   OR NEW.version<>OLD.version+1 OR OLD.status IN('COMPLETED','CANCELLED') THEN
   RAISE EXCEPTION 'Invalid activity revision';
  END IF;
  IF NEW.status<>OLD.status AND NOT (
   OLD.status='DRAFT' AND NEW.status IN('SCHEDULED','CANCELLED')
   OR OLD.status='SCHEDULED' AND NEW.status IN('ONGOING','CANCELLED')
   OR OLD.status='ONGOING' AND NEW.status IN('COMPLETED','CANCELLED')) THEN
   RAISE EXCEPTION 'Invalid activity transition';
  END IF;
 END IF;
 IF NEW.project_id IS NOT NULL THEN
  SELECT branch_ref,status,planned_start,planned_end INTO p FROM project
   WHERE root_realm_id=NEW.root_realm_id AND id=NEW.project_id FOR SHARE;
  IF NOT FOUND OR p.branch_ref IS DISTINCT FROM NEW.branch_ref
   OR (NEW.status NOT IN('CANCELLED') AND p.status IN('COMPLETED','CANCELLED'))
   OR (p.planned_start IS NOT NULL AND (NEW.scheduled_start AT TIME ZONE 'Asia/Kolkata')::date<p.planned_start)
   OR (p.planned_end IS NOT NULL AND (NEW.scheduled_end AT TIME ZONE 'Asia/Kolkata')::date>p.planned_end) THEN
    RAISE EXCEPTION 'Activity must use the current project scope and schedule';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_activity_write_guard BEFORE INSERT OR UPDATE OR DELETE ON project_activity
 FOR EACH ROW EXECUTE FUNCTION cg05_activity_guard();
CREATE FUNCTION cg05_activity_event_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM project_activity_event e WHERE e.root_realm_id=NEW.root_realm_id
  AND e.activity_id=NEW.id AND e.result_version=NEW.version AND e.resulting_status=NEW.status
  AND e.owner_account_ref=NEW.owner_account_ref) THEN
  RAISE EXCEPTION 'Activity revision requires an immutable matching event';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cg05_activity_event_at_commit AFTER INSERT OR UPDATE ON project_activity
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg05_activity_event_match();
