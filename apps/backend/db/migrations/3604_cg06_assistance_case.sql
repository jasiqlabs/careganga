-- CG06 US002: original assistance request and immutable approved source.
-- CG03 owns the approval; CG12 and CG09 own stock and money.
CREATE SEQUENCE cg06_assistance_number_seq;
CREATE TABLE assistance_case(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 branch_ref uuid,
 beneficiary_id uuid NOT NULL,
 beneficiary_revision integer NOT NULL CHECK(beneficiary_revision>0),
 reference text NOT NULL DEFAULT ('AID-'||lpad(nextval('cg06_assistance_number_seq')::text,8,'0')),
 category text NOT NULL CHECK(length(btrim(category)) BETWEEN 2 AND 60),
 kind text NOT NULL CHECK(kind IN('MATERIAL','FINANCIAL')),
 item_ref uuid,location_ref uuid,unit_code text,qty_scale smallint,
 requested_qty numeric(18,3),requested_minor bigint,
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 requested_on date NOT NULL, responsible_ref uuid NOT NULL,
 project_ref uuid,activity_ref uuid,visit_ref uuid,campaign_ref uuid,
 created_by uuid NOT NULL,request_key uuid NOT NULL,source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN('DRAFT','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 3),
 approval_case_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,source_digest),UNIQUE(root_realm_id,reference),UNIQUE(root_realm_id,created_by,request_key),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(responsible_ref,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(root_realm_id,item_ref,unit_code,qty_scale) REFERENCES inventory_item(root_realm_id,id,unit_code,qty_scale),
 FOREIGN KEY(root_realm_id,location_ref) REFERENCES inventory_location(root_realm_id,id),
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id),
 FOREIGN KEY(root_realm_id,activity_ref) REFERENCES project_activity(root_realm_id,id),
 FOREIGN KEY(root_realm_id,visit_ref) REFERENCES field_visit(root_realm_id,id),
 FOREIGN KEY(root_realm_id,campaign_ref) REFERENCES campaign(root_realm_id,id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 CHECK((kind='MATERIAL' AND num_nonnulls(item_ref,location_ref,unit_code,qty_scale,requested_qty)=5 AND requested_qty>0 AND requested_qty=round(requested_qty,qty_scale) AND requested_minor IS NULL)
 OR (kind='FINANCIAL' AND num_nonnulls(item_ref,location_ref,unit_code,qty_scale,requested_qty)=0 AND requested_minor IS NOT NULL AND requested_minor BETWEEN 1 AND 99999999999999)),
 CHECK((state='DRAFT' AND revision=1 AND approval_case_ref IS NULL) OR (state='SUBMITTED' AND revision=2 AND approval_case_ref IS NOT NULL) OR (state IN('APPROVED','RETURNED','REJECTED') AND revision=3 AND approval_case_ref IS NOT NULL))
);
CREATE INDEX ix_cg06_aid_beneficiary ON assistance_case(root_realm_id,beneficiary_id,created_at DESC,id DESC);
CREATE INDEX ix_cg06_aid_branch ON assistance_case(root_realm_id,branch_ref,state,requested_on,id);
CREATE FUNCTION cg06_aid_frozen() RETURNS trigger LANGUAGE plpgsql AS $aid$
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['state','revision','approval_case_ref','updated_at'])=(to_jsonb(OLD)-ARRAY['state','revision','approval_case_ref','updated_at'])
 AND NEW.revision=OLD.revision+1 AND ((OLD.state='DRAFT' AND NEW.state='SUBMITTED') OR (OLD.state='SUBMITTED' AND NEW.state IN('APPROVED','RETURNED','REJECTED') AND NEW.approval_case_ref=OLD.approval_case_ref)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Original assistance request is immutable';
END; $aid$;
CREATE TRIGGER cg06_aid_frozen BEFORE UPDATE OR DELETE ON assistance_case FOR EACH ROW EXECUTE FUNCTION cg06_aid_frozen();
CREATE TABLE assistance_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,assistance_id uuid NOT NULL,actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,action text NOT NULL CHECK(action IN('REQUESTED','SUBMITTED','APPROVED','RETURNED','REJECTED')),
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 source_revision integer NOT NULL CHECK(source_revision BETWEEN 1 AND 3),
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),UNIQUE(root_realm_id,assistance_id,source_revision),
 FOREIGN KEY(root_realm_id,assistance_id) REFERENCES assistance_case(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg06_aid_event_immutable BEFORE UPDATE OR DELETE ON assistance_event FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();
ALTER TABLE cg03_case ADD COLUMN assistance_review_ref uuid,ADD COLUMN assistance_source_digest char(64),
 ADD CONSTRAINT fk_cg03_assistance_exact FOREIGN KEY(realm_id,assistance_review_ref,assistance_source_digest) REFERENCES assistance_case(root_realm_id,id,source_digest);
CREATE UNIQUE INDEX ux_cg03_assistance_case ON cg03_case(realm_id,assistance_review_ref) WHERE case_kind='ASSISTANCE_REVIEW';
DO $aid$
DECLARE rec record; original text; source_guard text;
BEGIN
 source_guard:='case_kind=''ASSISTANCE_REVIEW'' AND assistance_review_ref IS NOT NULL AND assistance_source_digest=proposal_digest AND proposal_revision=2 AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind=''ASSISTANCE_REVIEW'''),
 ('cg03_case','cg03_case_kind_finance','case_kind=''ASSISTANCE_REVIEW'''),
 ('cg03_case','cg03_case_finance_source_disjoint',source_guard)) AS v(t,n,g)
 LOOP
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
 IF original IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint unavailable: %',rec.n; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,original,rec.g);
 END LOOP;
END; $aid$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_assistance_disjoint CHECK(
 ((case_kind='ASSISTANCE_REVIEW' AND num_nonnulls(assistance_review_ref,assistance_source_digest)=2 AND proposal_revision=2 AND proposal_digest=assistance_source_digest)
 OR (case_kind<>'ASSISTANCE_REVIEW' AND num_nonnulls(assistance_review_ref,assistance_source_digest)=0)) IS TRUE);
CREATE FUNCTION cg06_assistance_approval_frozen() RETURNS trigger LANGUAGE plpgsql AS $aid$
BEGIN
 IF (NEW.assistance_review_ref,NEW.assistance_source_digest) IS DISTINCT FROM (OLD.assistance_review_ref,OLD.assistance_source_digest) THEN RAISE EXCEPTION 'Assistance approval source cannot change'; END IF;
 RETURN NEW;
END; $aid$;
CREATE TRIGGER cg06_assistance_approval_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg06_assistance_approval_frozen();
CREATE TABLE cg03_assistance_process_current(realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id));
