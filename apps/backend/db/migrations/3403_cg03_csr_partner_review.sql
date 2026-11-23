-- CG08 US001: actual original CG03 CSR_PARTNER_REVIEW, protected evidence
-- and revision-exact partner lifecycle. No second approval table, public claim
-- or finance receipt is created.
CREATE TABLE csr_partner_review_snapshot (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 evidence_file_id uuid NOT NULL,
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,partner_id,source_version),
 UNIQUE(root_realm_id,submitted_by,request_key),
 UNIQUE(root_realm_id,id,partner_id,source_version,source_digest),
 FOREIGN KEY(root_realm_id,partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(evidence_file_id,root_realm_id,partner_id)
   REFERENCES cg19_stored_file(id,realm_id,csr_partner_id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER csr_partner_snapshot_immutable BEFORE UPDATE OR DELETE ON csr_partner_review_snapshot
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();

ALTER TABLE cg03_case
 ADD COLUMN csr_review_ref uuid,
 ADD COLUMN csr_partner_id uuid,
 ADD COLUMN csr_source_version integer,
 ADD COLUMN csr_source_digest char(64),
 ADD CONSTRAINT fk_cg03_csr_review_exact
  FOREIGN KEY(realm_id,csr_review_ref,csr_partner_id,csr_source_version,csr_source_digest)
  REFERENCES csr_partner_review_snapshot(root_realm_id,id,partner_id,source_version,source_digest) ON DELETE RESTRICT;

-- Extend the original reviewed allowed process/case kinds without weakening
-- the original kind-specific invariant of any existing module.
DO $cg08$
DECLARE rec record; old_check text; extra text; existing_sources text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO existing_sources
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
  OR column_name LIKE 'campaign_%');
 extra:='case_kind=''CSR_PARTNER_REVIEW'' AND
  num_nonnulls(csr_review_ref,csr_partner_id,csr_source_version,csr_source_digest)=4
  AND csr_source_version=proposal_revision AND csr_source_digest=proposal_digest
  AND target_account_id IS NULL AND target_role_id IS NULL
  AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF existing_sources IS NOT NULL THEN
  extra:=extra||' AND num_nonnulls('||existing_sources||')=0';
 END IF;
 FOR rec IN SELECT * FROM (VALUES
  ('cg03_process','cg03_process_kind_finance','process_kind=''CSR_PARTNER_REVIEW'''),
  ('cg03_case','cg03_case_kind_finance','case_kind=''CSR_PARTNER_REVIEW'''),
  ('cg03_case','cg03_case_finance_source_disjoint',extra)
 ) x(tbl,cn,added) LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO old_check FROM pg_constraint
   WHERE conrelid=rec.tbl::regclass AND conname=rec.cn AND contype='c';
  IF old_check IS NULL THEN RAISE EXCEPTION 'Original CG03 policy guard missing: %',rec.cn; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.tbl,rec.cn);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
   rec.tbl,rec.cn,old_check,rec.added);
 END LOOP;
END $cg08$;

ALTER TABLE cg03_case ADD CONSTRAINT cg03_csr_source_disjoint CHECK(
 (case_kind='CSR_PARTNER_REVIEW' AND
  num_nonnulls(csr_review_ref,csr_partner_id,csr_source_version,csr_source_digest)=4
  AND csr_source_version=proposal_revision AND csr_source_digest=proposal_digest)
 OR (case_kind<>'CSR_PARTNER_REVIEW' AND
  num_nonnulls(csr_review_ref,csr_partner_id,csr_source_version,csr_source_digest)=0));
CREATE UNIQUE INDEX ux_cg03_csr_case_snapshot ON cg03_case(realm_id,csr_review_ref)
 WHERE case_kind='CSR_PARTNER_REVIEW';
CREATE UNIQUE INDEX ux_cg03_csr_case_pending ON cg03_case(realm_id,csr_partner_id)
 WHERE case_kind='CSR_PARTNER_REVIEW' AND status IN
 ('SUBMITTED','IN_REVIEW','PENDING_OWNER','FINAL_APPROVED','OWNER_FAILED_RETRYABLE');

CREATE TABLE cg03_csr_process_current (
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg03_csr_process_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
  WHERE p.realm_id=NEW.realm_id AND p.id=NEW.process_id
   AND p.process_kind='CSR_PARTNER_REVIEW' AND p.first_reviewer_capability IS NULL
   AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required
   AND (SELECT count(*) FROM cg03_process_step st WHERE st.process_id=p.id)=1
 ) THEN RAISE EXCEPTION 'Original protected CSR review policy required'; END IF;
 RETURN NEW;
END; $cg08$;
CREATE TRIGGER cg03_csr_process_current_guard BEFORE INSERT OR UPDATE ON cg03_csr_process_current
 FOR EACH ROW EXECUTE FUNCTION cg03_csr_process_guard();

CREATE FUNCTION cg03_csr_case_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF NEW.case_kind<>'CSR_PARTNER_REVIEW' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND
  (NEW.csr_review_ref,NEW.csr_partner_id,NEW.csr_source_version,NEW.csr_source_digest,
   NEW.process_id,NEW.proposer_id,NEW.previous_case_id) IS DISTINCT FROM
  (OLD.csr_review_ref,OLD.csr_partner_id,OLD.csr_source_version,OLD.csr_source_digest,
   OLD.process_id,OLD.proposer_id,OLD.previous_case_id)
 THEN RAISE EXCEPTION 'CSR review source and process are frozen'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(
  SELECT 1 FROM csr_partner_review_snapshot r
  JOIN cg03_csr_process_current cur ON cur.realm_id=r.root_realm_id
  JOIN cg03_process p ON p.realm_id=cur.realm_id AND p.id=cur.process_id
  WHERE r.root_realm_id=NEW.realm_id AND r.id=NEW.csr_review_ref
    AND r.partner_id=NEW.csr_partner_id AND r.source_version=NEW.csr_source_version
    AND r.source_digest=NEW.csr_source_digest AND r.submitted_by=NEW.proposer_id
    AND p.id=NEW.process_id AND p.version=NEW.process_version
 ) THEN RAISE EXCEPTION 'Current CSR source and protected policy required'; END IF;
 RETURN NEW;
END; $cg08$;
CREATE TRIGGER cg03_csr_case_write BEFORE INSERT OR UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_csr_case_guard();

CREATE FUNCTION cg03_csr_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
DECLARE c cg03_case%ROWTYPE;
BEGIN
 SELECT * INTO c FROM cg03_case WHERE realm_id=NEW.realm_id AND id=NEW.case_id;
 IF NOT FOUND OR c.case_kind<>'CSR_PARTNER_REVIEW' THEN RETURN NEW; END IF;
 IF NEW.actor_id=c.proposer_id OR NEW.step_ordinal<>1
   OR NEW.fresh_password_verified_at IS NULL
   OR NEW.accepted_case_revision<>c.revision
   OR NEW.expected_case_revision+1<>c.revision
   OR (NEW.action='APPROVE' AND c.status<>'PENDING_OWNER')
   OR (NEW.action='RETURN' AND c.status<>'RETURNED')
   OR (NEW.action='REJECT' AND c.status<>'REJECTED')
   OR NOT EXISTS(
    SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
    WHERE p.id=c.process_id AND p.realm_id=c.realm_id AND p.process_kind='CSR_PARTNER_REVIEW'
     AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required)
 THEN RAISE EXCEPTION 'Original independent CSR decision required'; END IF;
 RETURN NEW;
END; $cg08$;
CREATE TRIGGER cg03_csr_decision_insert BEFORE INSERT ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_csr_decision_guard();

-- The first greenfield CG08 draft guard deliberately refuses any approval;
-- replace it only with an original CG03 proof-bound transition. Never change
-- private original partner identity/branch during a decision.
CREATE OR REPLACE FUNCTION cg08_partner_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm WHERE id=NEW.root_realm_id AND realm_key='FOUNDATION_ROOT') THEN
  RAISE EXCEPTION 'CSR partner requires a real Foundation root'; END IF;
 IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM branch WHERE id=NEW.branch_ref AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE)
 THEN RAISE EXCEPTION 'Original active CSR branch required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 THEN RAISE EXCEPTION 'CSR partner starts as draft'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.version<>OLD.version+1 OR
  (NEW.id,NEW.root_realm_id,NEW.branch_ref,NEW.created_by,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.root_realm_id,OLD.branch_ref,OLD.created_by,OLD.created_at)
 THEN RAISE EXCEPTION 'CSR partner original source/branch/version cannot change'; END IF;
 IF NOT ((OLD.status='DRAFT' AND NEW.status IN('DRAFT','INACTIVE','SUBMITTED'))
  OR (OLD.status='RETURNED' AND NEW.status IN('DRAFT','INACTIVE'))
  OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED','RETURNED','REJECTED')))
 THEN RAISE EXCEPTION 'Unapproved CSR state transition'; END IF;
 IF NEW.status IN('SUBMITTED','APPROVED','RETURNED','REJECTED') AND
  (NEW.legal_name,NEW.registration_reference,NEW.contact_name,NEW.contact_email,
   NEW.contact_mobile,NEW.support_summary) IS DISTINCT FROM
  (OLD.legal_name,OLD.registration_reference,OLD.contact_name,OLD.contact_email,
   OLD.contact_mobile,OLD.support_summary)
 THEN RAISE EXCEPTION 'Protected CSR approval cannot edit original agreement source'; END IF;
 RETURN NEW;
END; $cg08$;

CREATE FUNCTION cg08_partner_status_proof() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF TG_OP<>'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN
  ('SUBMITTED','APPROVED','RETURNED','REJECTED') THEN RETURN NULL; END IF;
 IF NEW.status='SUBMITTED' THEN
  IF NOT EXISTS(
   SELECT 1 FROM cg03_case c JOIN csr_partner_review_snapshot r
    ON r.root_realm_id=c.realm_id AND r.id=c.csr_review_ref
   JOIN cg19_stored_file f ON f.realm_id=r.root_realm_id
    AND f.id=r.evidence_file_id AND f.csr_partner_id=r.partner_id
   JOIN cg19_upload_intent i ON i.realm_id=f.realm_id AND i.id=f.upload_intent_id
   WHERE c.realm_id=NEW.root_realm_id AND c.csr_partner_id=NEW.id
    AND c.case_kind='CSR_PARTNER_REVIEW' AND c.status='SUBMITTED'
    AND c.csr_source_version=OLD.version AND c.csr_source_digest=r.source_digest
    AND r.evidence_file_id=f.id AND f.proposal_revision=OLD.version
    AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED'
    AND f.revoked_at IS NULL AND i.owner_kind='CG08_CSR_AGREEMENT'
    AND i.classification='CSR_AGREEMENT' AND i.status='VALIDATED'
   ) THEN RAISE EXCEPTION 'CSR submission requires original verified CG03/CG19 proof'; END IF;
 ELSE
  IF NOT EXISTS(
   SELECT 1 FROM cg03_case c JOIN cg03_case_decision d
     ON d.realm_id=c.realm_id AND d.case_id=c.id
   WHERE c.realm_id=NEW.root_realm_id AND c.csr_partner_id=NEW.id
    AND c.case_kind='CSR_PARTNER_REVIEW' AND c.csr_source_version+1=OLD.version
    AND d.fresh_password_verified_at IS NOT NULL
    AND d.action=CASE NEW.status WHEN 'APPROVED' THEN 'APPROVE'
      WHEN 'RETURNED' THEN 'RETURN' ELSE 'REJECT' END
    AND c.status=CASE NEW.status WHEN 'APPROVED' THEN 'OWNER_COMPLETED' ELSE NEW.status END
  ) THEN RAISE EXCEPTION 'CSR decision requires original CG03 signed reviewer proof'; END IF;
 END IF;
 RETURN NULL;
END; $cg08$;
CREATE CONSTRAINT TRIGGER cg08_partner_status_proof_after
 AFTER UPDATE ON csr_partner DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg08_partner_status_proof();
