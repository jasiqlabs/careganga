-- CG-04 US-001: root-wide subscription tier catalogue. No application,
-- financial posting, identity or approval shadow master.
CREATE TABLE membership_tier (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 plan_code text NOT NULL DEFAULT ('MEM-'||upper(replace(gen_random_uuid()::text,'-',''))) CHECK(plan_code ~ '^MEM-[0-9A-F]{32}$'),
 normalized_name text NOT NULL CHECK(char_length(normalized_name) BETWEEN 2 AND 100),
 status text NOT NULL CHECK(status IN ('DRAFT','ACTIVE','INACTIVE')),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,plan_code),UNIQUE(root_realm_id,normalized_name),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE membership_tier_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 tier_id uuid NOT NULL,
 version_no integer NOT NULL CHECK(version_no>0),
 status text NOT NULL CHECK(status IN ('DRAFT','ACTIVE','INACTIVE')),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 100),
 normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))) STORED,
 category text NOT NULL CHECK(category IN ('ANNUAL','LIFETIME','HONORARY','STUDENT','OTHER')),
 fee_minor bigint NOT NULL CHECK(fee_minor BETWEEN 0 AND 999999999999999),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 duration_unit text NOT NULL CHECK(duration_unit IN ('DAY','MONTH','YEAR','LIFETIME')),
 duration_count integer NOT NULL CHECK(duration_count BETWEEN 1 AND 3650),
 description text NOT NULL CHECK(char_length(description)<=2000),
 benefits jsonb NOT NULL CHECK(jsonb_typeof(benefits)='array' AND jsonb_array_length(benefits)<=20),
 icon text NOT NULL CHECK(icon IN ('CARD','STAR','HEART','CROWN','GRADUATION','SHIELD','USERS')),
 color text NOT NULL CHECK(color IN ('BLUE','GREEN','AMBER','PURPLE','TEAL','ROSE','SLATE')),
 display_order integer NOT NULL CHECK(display_order BETWEEN 0 AND 9999),
 actor_ref uuid NOT NULL,
 effective_from timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,tier_id,version_no),
 UNIQUE(root_realm_id,tier_id,version_no,status,normalized_name),
 FOREIGN KEY(root_realm_id,tier_id) REFERENCES membership_tier(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='ACTIVE')=(published_at IS NOT NULL)),
 CHECK(duration_unit<>'LIFETIME' OR duration_count=1),
 CHECK(category<>'LIFETIME' OR duration_unit='LIFETIME')
);
ALTER TABLE membership_tier ADD CONSTRAINT fk_cg04_tier_current_version
 FOREIGN KEY(root_realm_id,id,version,status,normalized_name)
 REFERENCES membership_tier_version(root_realm_id,tier_id,version_no,status,normalized_name)
 DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE membership_tier_command (
 root_realm_id uuid NOT NULL,
 request_key uuid NOT NULL,
 actor_ref uuid NOT NULL,
 tier_id uuid NOT NULL,
 result_version integer NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN ('CREATE','EDIT')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),UNIQUE(root_realm_id,tier_id,result_version),
 FOREIGN KEY(root_realm_id,tier_id,result_version) REFERENCES membership_tier_version(root_realm_id,tier_id,version_no) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg04_tier_scope ON membership_tier(root_realm_id,status,normalized_name,id);
CREATE INDEX ix_cg04_tier_version_display ON membership_tier_version(root_realm_id,status,display_order,tier_id);
CREATE FUNCTION cg04_tier_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Membership plan history cannot be changed'; END; $$;
CREATE TRIGGER cg04_tier_versions_immutable BEFORE UPDATE OR DELETE ON membership_tier_version FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE TRIGGER cg04_tier_commands_immutable BEFORE UPDATE OR DELETE ON membership_tier_command FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE FUNCTION cg04_tier_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership plan history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Invalid starting plan revision'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.plan_code,NEW.created_by,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.plan_code,OLD.created_by,OLD.created_at)
  THEN RAISE EXCEPTION 'Invalid membership plan revision'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_tier_guard BEFORE INSERT OR UPDATE OR DELETE ON membership_tier FOR EACH ROW EXECUTE FUNCTION cg04_tier_revision_guard();
CREATE FUNCTION cg04_tier_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_tier t WHERE t.root_realm_id=NEW.root_realm_id AND t.id=NEW.tier_id AND t.version=NEW.version_no AND t.status=NEW.status FOR SHARE)
  THEN RAISE EXCEPTION 'Membership plan version must match its current revision'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.benefits) b WHERE jsonb_typeof(b)<>'string' OR char_length(btrim(b#>>'{}')) NOT BETWEEN 1 AND 200)
  THEN RAISE EXCEPTION 'Invalid membership plan benefit'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_tier_version_insert BEFORE INSERT ON membership_tier_version FOR EACH ROW EXECUTE FUNCTION cg04_tier_version_guard();
