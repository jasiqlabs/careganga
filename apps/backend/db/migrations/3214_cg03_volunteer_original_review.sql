-- CG-04 US-003 CG03 original volunteer approval: full independent source/revision and verified CG19 ID.
-- Reuses the existing CG03 one-step protected reviewer/case/decision authority, no new approval engine.
CREATE TABLE volunteer_review_snapshot(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL,application_version integer NOT NULL CHECK(application_version>1),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 submitted_by uuid NOT NULL,request_key uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,application_id,application_version),
 UNIQUE(root_realm_id,id,application_id,application_version,source_digest),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES volunteer_application(root_realm_id,id),
 FOREIGN KEY(root_realm_id,request_key) REFERENCES volunteer_application_command(root_realm_id,request_key) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg04_volunteer_review_snapshot_immutable BEFORE UPDATE OR DELETE ON volunteer_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE TABLE volunteer_review_file(
 root_realm_id uuid NOT NULL,snapshot_id uuid NOT NULL,application_id uuid NOT NULL,
 file_id uuid NOT NULL,file_version integer NOT NULL CHECK(file_version>0),
 source_version integer NOT NULL CHECK(source_version>0),
 classification text NOT NULL,sha256 char(64) NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 PRIMARY KEY(root_realm_id,snapshot_id,file_id),
 FOREIGN KEY(root_realm_id,snapshot_id) REFERENCES volunteer_review_snapshot(root_realm_id,id),
 FOREIGN KEY(root_realm_id,file_id,application_id,source_version) REFERENCES cg19_volunteer_private_file(realm_id,id,application_id,application_version)
);
CREATE TRIGGER cg04_volunteer_review_file_immutable BEFORE UPDATE OR DELETE ON volunteer_review_file FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
ALTER TABLE cg03_case ADD COLUMN volunteer_review_ref uuid,ADD COLUMN volunteer_application_id uuid,
 ADD COLUMN volunteer_application_version integer,ADD COLUMN volunteer_review_digest char(64),
 ADD CONSTRAINT fk_cg03_volunteer_exact FOREIGN KEY(realm_id,volunteer_review_ref,volunteer_application_id,volunteer_application_version,volunteer_review_digest)
 REFERENCES volunteer_review_snapshot(root_realm_id,id,application_id,application_version,source_digest);
DO $cg04$
DECLARE rec record; old_expr text; guard_sql text; other_cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO other_cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case' AND
 (column_name LIKE 'membership_%' OR column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%' OR column_name LIKE 'material_%' OR column_name LIKE 'adjustment_%' OR column_name LIKE 'inventory_%' OR column_name LIKE 'project_public_%' OR column_name LIKE 'event_public_%' OR column_name LIKE 'visit_review_%');
 guard_sql:='case_kind=''VOLUNTEER_APPLICATION'' AND num_nonnulls(volunteer_review_ref,volunteer_application_id,volunteer_application_version,volunteer_review_digest)=4 AND volunteer_application_version=proposal_revision AND volunteer_review_digest=proposal_digest AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF other_cols IS NOT NULL THEN guard_sql:=guard_sql||' AND num_nonnulls('||other_cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES ('cg03_process','cg03_process_kind_finance','process_kind=''VOLUNTEER_APPLICATION'''),('cg03_case','cg03_case_kind_finance','case_kind=''VOLUNTEER_APPLICATION'''),('cg03_case','cg03_case_finance_source_disjoint',guard_sql)) v(t,n,predicate)
 LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO old_expr FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
  IF old_expr IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint absent: %',rec.n; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s OR (%s)) IS TRUE)',rec.t,rec.n,old_expr,rec.predicate);
 END LOOP;
END; $cg04$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_volunteer_case_disjoint CHECK(
 (case_kind='VOLUNTEER_APPLICATION' AND num_nonnulls(volunteer_review_ref,volunteer_application_id,volunteer_application_version,volunteer_review_digest)=4
 AND volunteer_application_version=proposal_revision AND volunteer_review_digest=proposal_digest)
 OR (case_kind<>'VOLUNTEER_APPLICATION' AND num_nonnulls(volunteer_review_ref,volunteer_application_id,volunteer_application_version,volunteer_review_digest)=0));
CREATE UNIQUE INDEX ux_cg03_volunteer_case_snapshot ON cg03_case(realm_id,volunteer_review_ref) WHERE case_kind='VOLUNTEER_APPLICATION';
CREATE UNIQUE INDEX ux_cg03_volunteer_case_active ON cg03_case(realm_id,volunteer_application_id) WHERE case_kind='VOLUNTEER_APPLICATION' AND status IN('SUBMITTED','IN_REVIEW','PENDING_OWNER','FINAL_APPROVED','OWNER_FAILED_RETRYABLE');
CREATE TABLE cg03_volunteer_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
);
CREATE FUNCTION cg03_volunteer_process_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cg03_process p WHERE p.id=NEW.process_id AND p.realm_id=NEW.realm_id AND p.process_kind='VOLUNTEER_APPLICATION' AND p.first_reviewer_capability IS NULL
 AND (SELECT count(*) FROM cg03_process_step s WHERE s.process_id=p.id)=1
 AND EXISTS(SELECT 1 FROM cg03_process_step s WHERE s.process_id=p.id AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required))
 THEN RAISE EXCEPTION 'Original volunteer review route is invalid'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_volunteer_process_current_write BEFORE INSERT OR UPDATE ON cg03_volunteer_process_current FOR EACH ROW EXECUTE FUNCTION cg03_volunteer_process_guard();
CREATE FUNCTION cg03_volunteer_case_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.volunteer_review_ref,NEW.volunteer_application_id,NEW.volunteer_application_version,NEW.volunteer_review_digest) IS DISTINCT FROM
     (OLD.volunteer_review_ref,OLD.volunteer_application_id,OLD.volunteer_application_version,OLD.volunteer_review_digest)
   THEN RAISE EXCEPTION 'Frozen volunteer review source cannot change'; END IF;
 ELSE
  IF NEW.case_kind='VOLUNTEER_APPLICATION' AND NOT EXISTS(
   SELECT 1 FROM volunteer_review_snapshot s JOIN volunteer_application a ON a.root_realm_id=s.root_realm_id AND a.id=s.application_id
    JOIN cg03_volunteer_process_current cur ON cur.realm_id=s.root_realm_id AND cur.process_id=NEW.process_id
    JOIN cg03_process p ON p.realm_id=cur.realm_id AND p.id=cur.process_id
    WHERE s.root_realm_id=NEW.realm_id AND s.id=NEW.volunteer_review_ref AND s.submitted_by=NEW.proposer_id
    AND a.version=s.application_version AND a.status='SUBMITTED' AND a.submitted_digest=s.source_digest
    AND p.process_kind='VOLUNTEER_APPLICATION' AND p.version=NEW.process_version
    AND NEW.current_step=1 AND NEW.status='SUBMITTED' AND NEW.revision=1)
   THEN RAISE EXCEPTION 'Original current volunteer review is required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_volunteer_case_write BEFORE INSERT OR UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_volunteer_case_guard();
-- Extend the draft guard only for the actual submission/review transitions.
-- The existing draft checks remain authoritative for editing a returned draft.
CREATE OR REPLACE FUNCTION cg04_volunteer_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Volunteer application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid volunteer application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR NOT ((OLD.status IN('DRAFT','RETURNED') AND NEW.status IN('DRAFT','CANCELLED','SUBMITTED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED')))
   THEN RAISE EXCEPTION 'Invalid volunteer application revision'; END IF;
  IF NEW.status IN('SUBMITTED','RETURNED','REJECTED','CANCELLED')
   AND (to_jsonb(NEW)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest')
   THEN RAISE EXCEPTION 'A review transition cannot change the accepted applicant source'; END IF;
  IF OLD.status='SUBMITTED' AND (NEW.submitted_digest,NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_digest,OLD.submitted_at)
   THEN RAISE EXCEPTION 'Original submitted snapshot is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN RAISE EXCEPTION 'Invalid Foundation volunteer scope'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN
   RAISE EXCEPTION 'Wrong Foundation volunteer scope'; END IF;
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
   AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
   AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
  THEN RAISE EXCEPTION 'Verified applicant contact required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id
   WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.status='ACTIVE' AND s.level='STATE'
    AND d.id=NEW.district_ref AND d.status='ACTIVE' AND d.level='DISTRICT' FOR SHARE OF s,d)
  THEN RAISE EXCEPTION 'Choose real current state and district'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id
   AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE)
  THEN RAISE EXCEPTION 'Choose a current Foundation branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM department d WHERE d.id=NEW.department_ref AND d.root_realm_id=NEW.root_realm_id
   AND d.active AND d.kind='DEPARTMENT' AND
   ((d.scope_kind='FOUNDATION' AND (NEW.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch_department_link l WHERE l.root_realm_id=NEW.root_realm_id AND l.branch_id=NEW.branch_ref
      AND l.foundation_department_id=d.id AND l.ended_at IS NULL)))
    OR (d.scope_kind='BRANCH' AND d.branch_id=NEW.branch_ref))
   FOR SHARE)
  THEN RAISE EXCEPTION 'Choose an eligible current Foundation department'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION cg04_volunteer_command_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id AND a.applicant_account_ref=NEW.actor_ref AND a.version=NEW.result_version
 AND ((NEW.action='CREATE' AND a.version=1 AND a.status='DRAFT') OR (NEW.action='EDIT' AND a.version>1 AND a.status='DRAFT') OR (NEW.action='CANCEL' AND a.version>1 AND a.status='CANCELLED') OR (NEW.action='SUBMIT' AND a.status='SUBMITTED' AND a.version>1)))
 THEN RAISE EXCEPTION 'Application command must match original applicant and revision'; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION cg04_volunteer_command_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN('RETURNED','REJECTED') THEN
  IF NOT EXISTS(SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
   WHERE c.realm_id=NEW.root_realm_id AND c.case_kind='VOLUNTEER_APPLICATION' AND c.volunteer_application_id=NEW.id
   AND c.volunteer_application_version=NEW.version-1 AND c.volunteer_review_digest=NEW.submitted_digest AND d.actor_id<>NEW.applicant_account_ref
   AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
   AND ((NEW.status='RETURNED' AND c.status='RETURNED' AND d.action='RETURN') OR (NEW.status='REJECTED' AND c.status='REJECTED' AND d.action='REJECT')))
   THEN RAISE EXCEPTION 'Application state requires original protected CG03 decision'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM volunteer_application_command c WHERE c.root_realm_id=NEW.root_realm_id AND c.application_id=NEW.id AND c.result_version=NEW.version AND c.actor_ref=NEW.applicant_account_ref) THEN RAISE EXCEPTION 'Original applicant command required'; END IF;
  IF NEW.status='SUBMITTED' AND NOT EXISTS(SELECT 1 FROM volunteer_review_snapshot s JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.volunteer_review_ref=s.id JOIN volunteer_application_command cmd ON cmd.root_realm_id=s.root_realm_id AND cmd.request_key=s.request_key
    JOIN volunteer_review_file f ON f.root_realm_id=s.root_realm_id AND f.snapshot_id=s.id
    JOIN cg19_volunteer_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id
    WHERE s.root_realm_id=NEW.root_realm_id AND s.application_id=NEW.id AND s.application_version=NEW.version AND s.source_digest=NEW.submitted_digest AND s.submitted_by=NEW.applicant_account_ref
    AND cmd.application_id=NEW.id AND cmd.result_version=NEW.version AND cmd.action='SUBMIT' AND c.case_kind='VOLUNTEER_APPLICATION'
    AND f.application_id=NEW.id AND f.classification='VOLUNTEER_IDENTITY_PROOF' AND doc.classification=f.classification AND doc.sha256=f.sha256 AND doc.revision=f.file_version AND doc.revoked_at IS NULL)
    THEN RAISE EXCEPTION 'Submission requires original protected evidence and review case'; END IF;
 END IF;
 RETURN NULL;
END; $$;

CREATE FUNCTION cg04_volunteer_snapshot_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id
   AND a.applicant_account_ref=NEW.submitted_by AND a.status='SUBMITTED' AND a.version=NEW.application_version AND a.submitted_digest=NEW.source_digest
   AND to_jsonb(a)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest'=NEW.source_snapshot->'record')
 OR jsonb_typeof(NEW.source_snapshot->'files') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Frozen volunteer snapshot must match original submitted applicant'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_snapshot_insert BEFORE INSERT ON volunteer_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_snapshot_insert_guard();
CREATE FUNCTION cg04_volunteer_review_file_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_review_snapshot s JOIN cg19_volunteer_private_file d ON d.realm_id=s.root_realm_id AND d.application_id=s.application_id
   WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.snapshot_id AND s.application_id=NEW.application_id
   AND d.id=NEW.file_id AND d.application_version=NEW.source_version AND d.revision=NEW.file_version AND d.classification=NEW.classification AND d.sha256=NEW.sha256
   AND d.scan_status='CLEAN_VERIFIED' AND d.revoked_at IS NULL AND d.application_version<s.application_version)
 THEN RAISE EXCEPTION 'Review proof must match original private verified file'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_review_file_insert BEFORE INSERT ON volunteer_review_file FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_review_file_insert_guard();

CREATE FUNCTION cg03_volunteer_previous_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest record;
BEGIN
 IF NEW.case_kind<>'VOLUNTEER_APPLICATION' THEN RETURN NEW; END IF;
 SELECT id,status,volunteer_application_version INTO latest FROM cg03_case
 WHERE realm_id=NEW.realm_id AND case_kind='VOLUNTEER_APPLICATION' AND volunteer_application_id=NEW.volunteer_application_id
 ORDER BY volunteer_application_version DESC LIMIT 1;
 IF FOUND THEN
  IF NEW.previous_case_id IS DISTINCT FROM latest.id OR latest.status<>'RETURNED' OR latest.volunteer_application_version>=NEW.volunteer_application_version
  THEN RAISE EXCEPTION 'Volunteer correction requires the original returned case'; END IF;
 ELSIF NEW.previous_case_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid volunteer case predecessor'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_volunteer_previous_insert BEFORE INSERT ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_volunteer_previous_guard();

CREATE FUNCTION cg03_volunteer_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
 SELECT * INTO c FROM cg03_case WHERE realm_id=NEW.realm_id AND id=NEW.case_id;
 IF NOT FOUND OR c.case_kind<>'VOLUNTEER_APPLICATION' THEN RETURN NEW; END IF;
 IF NEW.actor_id=c.proposer_id OR NEW.step_ordinal<>1 OR c.current_step<>1 OR NEW.fresh_password_verified_at IS NULL
   OR NEW.accepted_case_revision<>c.revision OR NEW.expected_case_revision+1<>NEW.accepted_case_revision
   OR NOT EXISTS(SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
    WHERE p.realm_id=c.realm_id AND p.id=c.process_id AND p.process_kind='VOLUNTEER_APPLICATION'
    AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required)
   OR NOT EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
    JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.is_protected AND r.active
    WHERE a.id=NEW.actor_id AND a.realm_id=NEW.realm_id AND a.status='ACTIVE')
   OR NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=c.realm_id AND a.id=c.volunteer_application_id
    AND a.status='SUBMITTED' AND a.version=c.volunteer_application_version AND a.submitted_digest=c.volunteer_review_digest)
   OR NOT ((NEW.action='APPROVE' AND c.status='PENDING_OWNER') OR (NEW.action='RETURN' AND c.status='RETURNED') OR (NEW.action='REJECT' AND c.status='REJECTED'))
  THEN RAISE EXCEPTION 'Invalid protected volunteer review decision'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_volunteer_decision_insert BEFORE INSERT ON cg03_case_decision FOR EACH ROW EXECUTE FUNCTION cg03_volunteer_decision_guard();
