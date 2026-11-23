-- CG08 US002: existing original CG03 independent CSR_FUNDING_REVIEW.
-- Signed funding commitment is NOT a CG09 bank receipt or allocation.
-- Preserve all existing CG03/CG08 kinds, cases and original guards.
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT uq_cg19_funding_file_owner UNIQUE(id,realm_id,funding_proposal_id);

CREATE TABLE csr_funding_review_snapshot (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 proposal_id uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 evidence_file_id uuid NOT NULL,
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,proposal_id,source_version),
 UNIQUE(root_realm_id,submitted_by,request_key),
 UNIQUE(root_realm_id,id,proposal_id,source_version,source_digest),
 FOREIGN KEY(root_realm_id,proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(evidence_file_id,root_realm_id,proposal_id)
  REFERENCES cg19_stored_file(id,realm_id,funding_proposal_id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER csr_funding_review_snapshot_immutable
 BEFORE UPDATE OR DELETE ON csr_funding_review_snapshot FOR EACH ROW
 EXECUTE FUNCTION cg03_immutable();

ALTER TABLE cg03_case
 ADD COLUMN csr_funding_review_ref uuid,
 ADD COLUMN csr_funding_proposal_id uuid,
 ADD COLUMN csr_funding_source_version integer,
 ADD COLUMN csr_funding_source_digest char(64),
 ADD CONSTRAINT cg03_funding_review_exact_fk
  FOREIGN KEY(realm_id,csr_funding_review_ref,csr_funding_proposal_id,
   csr_funding_source_version,csr_funding_source_digest)
  REFERENCES csr_funding_review_snapshot(root_realm_id,id,proposal_id,
   source_version,source_digest) ON DELETE RESTRICT;

-- The existing case-kind constraints have already accumulated many modules.
-- Extend by OR without replacing any earlier original clauses.
DO $cg08fund$
DECLARE item record; previous text; forbidden_sources text; extra text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO forbidden_sources
 FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND (column_name LIKE 'membership_%' OR column_name LIKE 'volunteer_%'
   OR column_name LIKE 'hr_%' OR column_name LIKE 'health_%'
   OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%'
   OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%'
   OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%'
   OR column_name LIKE 'material_%' OR column_name LIKE 'adjustment_%'
   OR column_name LIKE 'inventory_%' OR column_name LIKE 'project_public_%'
   OR column_name LIKE 'event_public_%' OR column_name LIKE 'visit_review_%'
   OR column_name LIKE 'campaign_%' OR column_name IN(
     'csr_review_ref','csr_partner_id','csr_source_version','csr_source_digest'));
 extra:='case_kind=''CSR_FUNDING_REVIEW'' AND
   num_nonnulls(csr_funding_review_ref,csr_funding_proposal_id,
    csr_funding_source_version,csr_funding_source_digest)=4
   AND csr_funding_source_version=proposal_revision
   AND csr_funding_source_digest=proposal_digest
   AND target_account_id IS NULL AND target_role_id IS NULL
   AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF forbidden_sources IS NOT NULL THEN
  extra:=extra||' AND num_nonnulls('||forbidden_sources||')=0';
 END IF;
 FOR item IN SELECT * FROM (VALUES
  ('cg03_process','cg03_process_kind_finance','process_kind=''CSR_FUNDING_REVIEW'''),
  ('cg03_case','cg03_case_kind_finance','case_kind=''CSR_FUNDING_REVIEW'''),
  ('cg03_case','cg03_case_finance_source_disjoint',extra)
 ) v(tbl,cn,allowance) LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO previous FROM pg_constraint
   WHERE conrelid=item.tbl::regclass AND conname=item.cn AND contype='c';
  IF previous IS NULL THEN RAISE EXCEPTION 'Original CG03 guard missing: %',item.cn; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',item.tbl,item.cn);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
   item.tbl,item.cn,previous,item.allowance);
 END LOOP;
END $cg08fund$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_funding_review_disjoint CHECK (
 (case_kind='CSR_FUNDING_REVIEW' AND
   num_nonnulls(csr_funding_review_ref,csr_funding_proposal_id,
    csr_funding_source_version,csr_funding_source_digest)=4
   AND csr_funding_source_version=proposal_revision
   AND csr_funding_source_digest=proposal_digest)
 OR (case_kind<>'CSR_FUNDING_REVIEW' AND
   num_nonnulls(csr_funding_review_ref,csr_funding_proposal_id,
    csr_funding_source_version,csr_funding_source_digest)=0)
);
CREATE UNIQUE INDEX ux_cg03_funding_review_snapshot
 ON cg03_case(realm_id,csr_funding_review_ref)
 WHERE case_kind='CSR_FUNDING_REVIEW';
CREATE UNIQUE INDEX ux_cg03_funding_review_pending
 ON cg03_case(realm_id,csr_funding_proposal_id)
 WHERE case_kind='CSR_FUNDING_REVIEW' AND status IN
  ('SUBMITTED','IN_REVIEW','PENDING_OWNER','FINAL_APPROVED','OWNER_FAILED_RETRYABLE');

CREATE TABLE cg03_funding_process_current (
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg03_funding_process_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08fund$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
  WHERE p.realm_id=NEW.realm_id AND p.id=NEW.process_id
   AND p.process_kind='CSR_FUNDING_REVIEW' AND p.first_reviewer_capability IS NULL
   AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required
   AND (SELECT count(*) FROM cg03_process_step st WHERE st.process_id=p.id)=1
 ) THEN RAISE EXCEPTION 'Protected original funding review policy required'; END IF;
 RETURN NEW;
END; $cg08fund$;
CREATE TRIGGER cg03_funding_process_current_guard
 BEFORE INSERT OR UPDATE ON cg03_funding_process_current FOR EACH ROW
 EXECUTE FUNCTION cg03_funding_process_guard();

CREATE FUNCTION cg03_funding_case_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08fund$
BEGIN
 IF NEW.case_kind<>'CSR_FUNDING_REVIEW' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND
  (NEW.csr_funding_review_ref,NEW.csr_funding_proposal_id,
   NEW.csr_funding_source_version,NEW.csr_funding_source_digest,
   NEW.process_id,NEW.proposer_id,NEW.previous_case_id) IS DISTINCT FROM
  (OLD.csr_funding_review_ref,OLD.csr_funding_proposal_id,
   OLD.csr_funding_source_version,OLD.csr_funding_source_digest,
   OLD.process_id,OLD.proposer_id,OLD.previous_case_id)
 THEN RAISE EXCEPTION 'Original funding review identity is frozen'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(
  SELECT 1 FROM csr_funding_review_snapshot snap
  JOIN cg03_funding_process_current cur ON cur.realm_id=snap.root_realm_id
  JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id
  WHERE snap.root_realm_id=NEW.realm_id AND snap.id=NEW.csr_funding_review_ref
   AND snap.proposal_id=NEW.csr_funding_proposal_id
   AND snap.source_version=NEW.csr_funding_source_version
   AND snap.source_digest=NEW.csr_funding_source_digest
   AND snap.submitted_by=NEW.proposer_id
   AND p.id=NEW.process_id AND p.version=NEW.process_version
 ) THEN RAISE EXCEPTION 'Current original CG03 funding snapshot and policy required'; END IF;
 RETURN NEW;
END; $cg08fund$;
CREATE TRIGGER cg03_funding_case_write BEFORE INSERT OR UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_funding_case_guard();

CREATE FUNCTION cg03_funding_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08fund$
DECLARE c cg03_case%ROWTYPE;
BEGIN
 SELECT * INTO c FROM cg03_case WHERE realm_id=NEW.realm_id AND id=NEW.case_id;
 IF NOT FOUND OR c.case_kind<>'CSR_FUNDING_REVIEW' THEN RETURN NEW; END IF;
 IF NEW.actor_id=c.proposer_id OR NEW.step_ordinal<>1
  OR NEW.fresh_password_verified_at IS NULL
  OR NEW.accepted_case_revision<>c.revision
  OR NEW.expected_case_revision+1<>c.revision
  OR (NEW.action='APPROVE' AND c.status<>'PENDING_OWNER')
  OR (NEW.action='RETURN' AND c.status<>'RETURNED')
  OR (NEW.action='REJECT' AND c.status<>'REJECTED')
  OR NOT EXISTS(
   SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
   WHERE p.id=c.process_id AND p.realm_id=c.realm_id
    AND p.process_kind='CSR_FUNDING_REVIEW'
    AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required)
 THEN RAISE EXCEPTION 'Original independent funding reviewer decision required'; END IF;
 RETURN NEW;
END; $cg08fund$;
CREATE TRIGGER cg03_funding_decision_insert BEFORE INSERT ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_funding_decision_guard();

-- The original immutable command ledger also protects returned-source reopen.
ALTER TABLE csr_funding_command DROP CONSTRAINT csr_funding_command_action_check;
ALTER TABLE csr_funding_command ADD CONSTRAINT csr_funding_command_action_check
 CHECK(action IN('CREATE','EDIT','RESUME'));

-- Replace only the original CG08 funding draft guard: source identity remains
-- immutable, source terms freeze at submission, no direct approval bypass.
CREATE OR REPLACE FUNCTION cg08_funding_proposal_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg08fund$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm
  WHERE id=NEW.root_realm_id AND realm_key='FOUNDATION_ROOT')
 THEN RAISE EXCEPTION 'Foundation funding source required'; END IF;
 IF NEW.branch_ref IS NOT NULL AND NEW.status IN('DRAFT','SUBMITTED','APPROVED')
  AND NOT EXISTS(
  SELECT 1 FROM branch WHERE id=NEW.branch_ref
   AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE)
 THEN RAISE EXCEPTION 'Active original CG02 funding branch required'; END IF;
 IF NEW.csr_partner_id IS NOT NULL AND NEW.status IN('DRAFT','SUBMITTED','APPROVED')
  AND NOT EXISTS(
  SELECT 1 FROM csr_partner WHERE id=NEW.csr_partner_id
   AND root_realm_id=NEW.root_realm_id AND status='APPROVED'
   AND (branch_ref IS NULL OR branch_ref IS NOT DISTINCT FROM NEW.branch_ref)
   FOR SHARE)
 THEN RAISE EXCEPTION 'Original approved CSR funder required'; END IF;
 IF NEW.project_ref IS NOT NULL AND NEW.status IN('DRAFT','SUBMITTED','APPROVED')
  AND NOT (TG_OP='UPDATE' AND OLD.status='RETURNED' AND NEW.status='DRAFT')
  AND NOT EXISTS(
   SELECT 1 FROM project WHERE id=NEW.project_ref
    AND root_realm_id=NEW.root_realm_id AND status IN('PLANNED','ACTIVE')
    AND branch_ref IS NOT DISTINCT FROM NEW.branch_ref
    AND version=NEW.project_source_version FOR SHARE)
 THEN RAISE EXCEPTION 'Current original CG05 funding target required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1
  THEN RAISE EXCEPTION 'Funding starts as draft'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.version<>OLD.version+1 OR
  (NEW.id,NEW.root_realm_id,NEW.branch_ref,NEW.csr_partner_id,
   NEW.created_by,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.root_realm_id,OLD.branch_ref,OLD.csr_partner_id,
   OLD.created_by,OLD.created_at)
 THEN RAISE EXCEPTION 'Original funding identity/branch/revision cannot change'; END IF;
 IF NOT ((OLD.status='DRAFT' AND NEW.status IN('DRAFT','SUBMITTED'))
   OR (OLD.status='RETURNED' AND NEW.status='DRAFT')
   OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED')))
 THEN RAISE EXCEPTION 'Independent funding review is required'; END IF;
 IF NEW.status<>OLD.status AND
  (NEW.project_ref,NEW.project_source_version,NEW.purpose,NEW.fund_type,
   NEW.currency,NEW.requested_minor,NEW.csr_share_bps,NEW.foundation_share_bps,
   NEW.proposed_from,NEW.proposed_until,NEW.agreement_summary)
  IS DISTINCT FROM
  (OLD.project_ref,OLD.project_source_version,OLD.purpose,OLD.fund_type,
   OLD.currency,OLD.requested_minor,OLD.csr_share_bps,OLD.foundation_share_bps,
   OLD.proposed_from,OLD.proposed_until,OLD.agreement_summary)
 THEN RAISE EXCEPTION 'Funding terms are frozen on reviewer state transition'; END IF;
 RETURN NEW;
END; $cg08fund$;

-- PostgreSQL validates reviewer/case/evidence at commit, not merely via API.
CREATE FUNCTION cg08_funding_review_status_proof() RETURNS trigger LANGUAGE plpgsql AS $cg08fund$
BEGIN
 IF TG_OP<>'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status
  OR NEW.status NOT IN('SUBMITTED','APPROVED','RETURNED','REJECTED')
 THEN RETURN NULL; END IF;
 IF NEW.status='SUBMITTED' THEN
  IF NOT EXISTS(
   SELECT 1 FROM cg03_case c JOIN csr_funding_review_snapshot snap
    ON snap.root_realm_id=c.realm_id AND snap.id=c.csr_funding_review_ref
   JOIN cg19_stored_file f ON f.realm_id=snap.root_realm_id
    AND f.id=snap.evidence_file_id AND f.funding_proposal_id=snap.proposal_id
   JOIN cg19_upload_intent i ON i.realm_id=f.realm_id AND i.id=f.upload_intent_id
   WHERE c.realm_id=NEW.root_realm_id AND c.csr_funding_proposal_id=NEW.id
    AND c.case_kind='CSR_FUNDING_REVIEW' AND c.status='SUBMITTED'
    AND c.csr_funding_source_version=OLD.version
    AND c.csr_funding_source_digest=snap.source_digest
    AND snap.source_version=OLD.version AND snap.evidence_file_id=f.id
    AND f.proposal_revision=OLD.version
    AND f.owner_kind='CG08_FUNDING_AGREEMENT'
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND i.owner_kind='CG08_FUNDING_AGREEMENT'
    AND i.classification='CSR_FUNDING_AGREEMENT' AND i.status='VALIDATED'
  ) THEN RAISE EXCEPTION 'Original CG03 and CG19 signed funding review required'; END IF;
 ELSE
  IF NOT EXISTS(
   SELECT 1 FROM cg03_case c JOIN cg03_case_decision d
    ON d.realm_id=c.realm_id AND d.case_id=c.id
   WHERE c.realm_id=NEW.root_realm_id AND c.csr_funding_proposal_id=NEW.id
    AND c.case_kind='CSR_FUNDING_REVIEW'
    AND c.csr_funding_source_version+1=OLD.version
    AND d.actor_id<>c.proposer_id AND d.fresh_password_verified_at IS NOT NULL
    AND d.action=CASE NEW.status WHEN 'APPROVED' THEN 'APPROVE'
      WHEN 'RETURNED' THEN 'RETURN' ELSE 'REJECT' END
    AND c.status=CASE NEW.status WHEN 'APPROVED' THEN 'OWNER_COMPLETED'
      ELSE NEW.status END
  ) THEN RAISE EXCEPTION 'Original CG03 funding decision not independently proven'; END IF;
 END IF;
 RETURN NULL;
END; $cg08fund$;
CREATE CONSTRAINT TRIGGER cg08_funding_status_proof_after
 AFTER UPDATE ON csr_funding_proposal DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg08_funding_review_status_proof();
