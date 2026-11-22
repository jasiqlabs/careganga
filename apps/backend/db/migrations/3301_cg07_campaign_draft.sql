-- CG-07 US-001 campaign draft: after CG05 3101 and CG04 3220 to preserve fresh migration dependency order.
-- No CG-03 approval, CG-18 publication, CG-09 receipt/payment or CG-19 file may be inferred.
CREATE SEQUENCE cg07_campaign_business_sequence;
CREATE TABLE campaign(
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 code_norm text NOT NULL DEFAULT ('CG-CAMP-'||lpad(nextval('cg07_campaign_business_sequence')::text,8,'0')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 category text NOT NULL DEFAULT 'GENERAL' CHECK(length(btrim(category)) BETWEEN 2 AND 80),
 branch_ref uuid,
 project_source_ref uuid,
 event_source_ref uuid,
 goal_minor bigint CHECK(goal_minor IS NULL OR goal_minor BETWEEN 1 AND 99999999999999),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 start_at date,
 end_at date,
 source_status text NOT NULL DEFAULT 'DRAFT'
  CHECK(source_status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','PUBLISHED','PAUSED','CLOSED','WITHDRAWN')),
 current_revision integer NOT NULL DEFAULT 1 CHECK(current_revision>0),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,code_norm),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_source_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(end_at IS NULL OR start_at IS NULL OR end_at>=start_at),
 CHECK(event_source_ref IS NULL OR project_source_ref IS NOT NULL)
);
CREATE INDEX ix_cg07_campaign_scope ON campaign(root_realm_id,branch_ref,source_status,updated_at DESC,id);
CREATE INDEX ix_cg07_campaign_owner ON campaign(root_realm_id,created_by,updated_at DESC,id);

CREATE TABLE campaign_revision(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 immutable_digest char(64) NOT NULL CHECK(immutable_digest~'^[a-f0-9]{64}$'),
 step1_basic jsonb NOT NULL CHECK(jsonb_typeof(step1_basic)='object'),
 step2_project_and_geo jsonb NOT NULL CHECK(jsonb_typeof(step2_project_and_geo)='object'),
 step3_team jsonb NOT NULL CHECK(jsonb_typeof(step3_team)='object'),
 step4_budget_targets jsonb NOT NULL CHECK(jsonb_typeof(step4_budget_targets)='object'),
 step5_media_refs jsonb NOT NULL CHECK(jsonb_typeof(step5_media_refs)='object'),
 step6_summary jsonb NOT NULL CHECK(jsonb_typeof(step6_summary)='object'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,campaign_id,revision_no),
 FOREIGN KEY(root_realm_id,campaign_id) REFERENCES campaign(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg07_campaign_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 RAISE EXCEPTION 'Original campaign revisions are immutable';
END; $cg07$;
CREATE TRIGGER cg07_campaign_revision_immutable BEFORE UPDATE OR DELETE ON campaign_revision
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_revision_immutable();

CREATE TABLE campaign_status_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision>0),
 digest char(64) NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),
 request_key uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN('CREATE_DRAFT','SAVE_DRAFT')),
 prior_status text,
 resulting_status text NOT NULL,
 resulting_version integer NOT NULL CHECK(resulting_version>0),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(root_realm_id,campaign_id) REFERENCES campaign(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg07_campaign_events ON campaign_status_event(root_realm_id,campaign_id,at DESC,id DESC);
CREATE FUNCTION cg07_campaign_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 RAISE EXCEPTION 'Original campaign event cannot be changed';
END; $cg07$;
CREATE TRIGGER cg07_campaign_event_immutable BEFORE UPDATE OR DELETE ON campaign_status_event
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_event_immutable();
