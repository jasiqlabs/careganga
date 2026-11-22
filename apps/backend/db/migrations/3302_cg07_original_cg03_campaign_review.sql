-- CG07 US001: use the ORIGINAL CG03 process/case/decision tables for
-- CAMPAIGN_LAUNCH. A protected review is not a CG18 publication or donation.
-- This migration runs only after 3301 and the original CG03 case variants.
ALTER TABLE campaign_revision
 ADD CONSTRAINT uq_cg07_revision_review_source UNIQUE(root_realm_id,campaign_id,revision_no,immutable_digest);
CREATE TABLE campaign_review_snapshot(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision>0),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[0-9a-f]{64}$'),
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,campaign_id,source_revision),
 UNIQUE(root_realm_id,submitted_by,request_key),
 UNIQUE(root_realm_id,id,campaign_id,source_revision,source_digest),
 FOREIGN KEY(root_realm_id,campaign_id,source_revision,source_digest)
  REFERENCES campaign_revision(root_realm_id,campaign_id,revision_no,immutable_digest) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg07_review_snapshot_immutable BEFORE UPDATE OR DELETE ON campaign_review_snapshot
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();

ALTER TABLE campaign_status_event DROP CONSTRAINT campaign_status_event_operation_check;
ALTER TABLE campaign_status_event ADD CONSTRAINT cg07_campaign_event_operation_check
 CHECK(operation IN('CREATE_DRAFT','SAVE_DRAFT','SUBMIT','REVIEW_APPROVE','REVIEW_RETURN','REVIEW_REJECT'));

ALTER TABLE cg03_case ADD COLUMN campaign_review_ref uuid,
 ADD COLUMN campaign_id uuid,
 ADD COLUMN campaign_source_revision integer,
 ADD COLUMN campaign_source_digest char(64),
 ADD CONSTRAINT fk_cg03_campaign_exact
 FOREIGN KEY(realm_id,campaign_review_ref,campaign_id,campaign_source_revision,campaign_source_digest)
 REFERENCES campaign_review_snapshot(root_realm_id,id,campaign_id,source_revision,source_digest) ON DELETE RESTRICT;

DO $cg07$
DECLARE rec record; original_check text; campaign_guard text; source_columns text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO source_columns
 FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND (column_name LIKE 'membership_%' OR column_name LIKE 'volunteer_%' OR
      column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR
      column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR
      column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR
      column_name LIKE 'finance_%' OR column_name LIKE 'material_%' OR
      column_name LIKE 'adjustment_%' OR column_name LIKE 'inventory_%' OR
      column_name LIKE 'project_public_%' OR column_name LIKE 'event_public_%' OR
      column_name LIKE 'visit_review_%');
 campaign_guard:='case_kind=''CAMPAIGN_LAUNCH'' AND
  num_nonnulls(campaign_review_ref,campaign_id,campaign_source_revision,campaign_source_digest)=4
  AND campaign_source_revision=proposal_revision AND campaign_source_digest=proposal_digest
  AND target_account_id IS NULL AND target_role_id IS NULL
  AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF source_columns IS NOT NULL THEN
   campaign_guard:=campaign_guard||' AND num_nonnulls('||source_columns||')=0';
 END IF;
 FOR rec IN SELECT * FROM (VALUES
  ('cg03_process','cg03_process_kind_finance','process_kind=''CAMPAIGN_LAUNCH'''),
  ('cg03_case','cg03_case_kind_finance','case_kind=''CAMPAIGN_LAUNCH'''),
  ('cg03_case','cg03_case_finance_source_disjoint',campaign_guard)) v(t,n,extra)
 LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO original_check FROM pg_constraint
   WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
  IF original_check IS NULL THEN RAISE EXCEPTION 'Original CG03 check missing: %',rec.n; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s OR (%s)) IS TRUE)',
   rec.t,rec.n,original_check,rec.extra);
 END LOOP;
END; $cg07$;

ALTER TABLE cg03_case ADD CONSTRAINT cg03_campaign_source_disjoint CHECK(
 (case_kind='CAMPAIGN_LAUNCH' AND
  num_nonnulls(campaign_review_ref,campaign_id,campaign_source_revision,campaign_source_digest)=4
  AND campaign_source_revision=proposal_revision AND campaign_source_digest=proposal_digest)
 OR (case_kind<>'CAMPAIGN_LAUNCH' AND
  num_nonnulls(campaign_review_ref,campaign_id,campaign_source_revision,campaign_source_digest)=0));
CREATE UNIQUE INDEX ux_cg03_campaign_exact ON cg03_case(realm_id,campaign_review_ref)
 WHERE case_kind='CAMPAIGN_LAUNCH';
CREATE UNIQUE INDEX ux_cg03_campaign_pending ON cg03_case(realm_id,campaign_id)
 WHERE case_kind='CAMPAIGN_LAUNCH' AND status IN('SUBMITTED','IN_REVIEW','PENDING_OWNER','FINAL_APPROVED','OWNER_FAILED_RETRYABLE');

CREATE TABLE cg03_campaign_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg03_campaign_process_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
  WHERE p.realm_id=NEW.realm_id AND p.id=NEW.process_id
   AND p.process_kind='CAMPAIGN_LAUNCH' AND p.first_reviewer_capability IS NULL
   AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required
   AND (SELECT count(*) FROM cg03_process_step ss WHERE ss.process_id=p.id)=1)
 THEN RAISE EXCEPTION 'Original protected campaign review policy required'; END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg03_campaign_current_write BEFORE INSERT OR UPDATE ON cg03_campaign_process_current
 FOR EACH ROW EXECUTE FUNCTION cg03_campaign_process_guard();

CREATE FUNCTION cg03_campaign_case_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NEW.case_kind<>'CAMPAIGN_LAUNCH' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND
  (NEW.campaign_review_ref,NEW.campaign_id,NEW.campaign_source_revision,NEW.campaign_source_digest,
   NEW.process_id,NEW.proposer_id,NEW.previous_case_id) IS DISTINCT FROM
  (OLD.campaign_review_ref,OLD.campaign_id,OLD.campaign_source_revision,OLD.campaign_source_digest,
   OLD.process_id,OLD.proposer_id,OLD.previous_case_id)
 THEN RAISE EXCEPTION 'Original campaign review source is frozen'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(
  SELECT 1 FROM campaign_review_snapshot s
   JOIN cg03_campaign_process_current cur ON cur.realm_id=s.root_realm_id
   JOIN cg03_process p ON p.realm_id=cur.realm_id AND p.id=cur.process_id
  WHERE s.root_realm_id=NEW.realm_id AND s.id=NEW.campaign_review_ref
   AND s.campaign_id=NEW.campaign_id AND s.source_revision=NEW.campaign_source_revision
   AND s.source_digest=NEW.campaign_source_digest
   AND s.submitted_by=NEW.proposer_id AND p.id=NEW.process_id
   AND p.version=NEW.process_version AND p.process_kind='CAMPAIGN_LAUNCH'
 ) THEN RAISE EXCEPTION 'Verified campaign source and CG03 policy required'; END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg03_campaign_case_write BEFORE INSERT OR UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_campaign_case_guard();

CREATE FUNCTION cg03_campaign_review_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
DECLARE c cg03_case%ROWTYPE;
BEGIN
 SELECT * INTO c FROM cg03_case WHERE realm_id=NEW.realm_id AND id=NEW.case_id;
 IF NOT FOUND OR c.case_kind<>'CAMPAIGN_LAUNCH' THEN RETURN NEW; END IF;
 IF NEW.actor_id=c.proposer_id OR NEW.step_ordinal<>1
  OR NEW.fresh_password_verified_at IS NULL
  OR NEW.accepted_case_revision<>c.revision OR NEW.expected_case_revision+1<>c.revision
  OR (NEW.action='APPROVE' AND c.status<>'PENDING_OWNER')
  OR (NEW.action='RETURN' AND c.status<>'RETURNED')
  OR (NEW.action='REJECT' AND c.status<>'REJECTED')
  OR NOT EXISTS(
   SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
   WHERE p.id=c.process_id AND p.realm_id=c.realm_id
    AND p.process_kind='CAMPAIGN_LAUNCH' AND s.ordinal=1
    AND s.capability_key='approvals.review' AND s.protected_root_required)
 THEN RAISE EXCEPTION 'Original protected campaign review decision required'; END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg03_campaign_decision_insert BEFORE INSERT ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_campaign_review_decision_guard();
