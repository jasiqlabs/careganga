-- Original CG03 run approval. An exact calculated revision is bound to one original case.
CREATE TABLE payroll_run_review_snapshot(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,run_id uuid NOT NULL,
 source_revision integer NOT NULL,source_digest char(64) NOT NULL,submitted_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id,source_revision,source_digest),UNIQUE(root_realm_id,run_id,source_revision),
 FOREIGN KEY(root_realm_id,run_id,source_revision,source_digest) REFERENCES payroll_run_revision(root_realm_id,run_id,revision,source_digest),
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg11_run_review_snapshot_immutable BEFORE UPDATE OR DELETE ON payroll_run_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
ALTER TABLE cg03_case ADD COLUMN payroll_run_review_ref uuid,ADD COLUMN payroll_run_revision integer,ADD COLUMN payroll_run_digest char(64),
 ADD CONSTRAINT fk_cg03_payroll_run_review FOREIGN KEY(realm_id,payroll_run_review_ref,payroll_run_revision,payroll_run_digest)
 REFERENCES payroll_run_review_snapshot(root_realm_id,id,source_revision,source_digest);
CREATE UNIQUE INDEX ux_cg03_payroll_run_review ON cg03_case(realm_id,payroll_run_review_ref) WHERE case_kind='PAYROLL_RUN_RELEASE';
DO $cg11$
DECLARE rec record; original text; source_guard text; other_cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO other_cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN('id','realm_id','case_number','process_id','process_version','proposer_id','target_account_id','target_role_id','account_name_snapshot','role_name_snapshot','expected_access_version','expected_role_revision','proposal_revision','proposal_digest','request_digest','request_key','previous_case_id','status','current_step','revision','submitted_at','updated_at','case_kind','payroll_run_review_ref','payroll_run_revision','payroll_run_digest');
 source_guard:='case_kind=''PAYROLL_RUN_RELEASE'' AND num_nonnulls(payroll_run_review_ref,payroll_run_revision,payroll_run_digest)=3 AND payroll_run_revision=proposal_revision AND payroll_run_digest=proposal_digest AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF other_cols IS NOT NULL THEN source_guard:=source_guard||' AND num_nonnulls('||other_cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind=''PAYROLL_RUN_RELEASE'''),
 ('cg03_case','cg03_case_kind_finance','case_kind=''PAYROLL_RUN_RELEASE'''),
 ('cg03_case','cg03_case_finance_source_disjoint',source_guard)) v(t,n,g)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
  IF original IS NULL THEN RAISE EXCEPTION 'Original approval constraint missing'; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,original,rec.g);
 END LOOP;
END; $cg11$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_run_review_disjoint CHECK(((case_kind='PAYROLL_RUN_RELEASE' AND num_nonnulls(payroll_run_review_ref,payroll_run_revision,payroll_run_digest)=3 AND payroll_run_revision=proposal_revision AND payroll_run_digest=proposal_digest) OR (case_kind<>'PAYROLL_RUN_RELEASE' AND num_nonnulls(payroll_run_review_ref,payroll_run_revision,payroll_run_digest)=0)) IS TRUE);
CREATE FUNCTION cg11_run_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF (NEW.payroll_run_review_ref,NEW.payroll_run_revision,NEW.payroll_run_digest) IS DISTINCT FROM (OLD.payroll_run_review_ref,OLD.payroll_run_revision,OLD.payroll_run_digest) THEN RAISE EXCEPTION 'Frozen run case cannot change'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_run_case_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg11_run_case_frozen();
CREATE TABLE cg03_payroll_run_process_current(realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id));
CREATE FUNCTION cg11_run_original_review() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF NEW.status IN('SUBMITTED','APPROVED_FROZEN','RETURNED','REJECTED') AND NOT EXISTS(
  SELECT 1 FROM cg03_case c JOIN payroll_run_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_run_review_ref
  WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.approval_case_ref AND c.case_kind='PAYROLL_RUN_RELEASE' AND s.run_id=NEW.id AND s.source_digest=NEW.snapshot_digest AND s.submitted_by=c.proposer_id
  AND ((NEW.status='SUBMITTED' AND c.status='SUBMITTED' AND s.source_revision=OLD.revision AND NEW.approved_decision_ref IS NULL)
   OR (NEW.status<>'SUBMITTED' AND OLD.approval_case_ref=c.id AND OLD.revision=s.source_revision+1 AND EXISTS(
     SELECT 1 FROM cg03_case_decision d WHERE d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=NEW.approved_decision_ref AND d.actor_id<>c.proposer_id AND d.actor_id<>NEW.creator AND d.fresh_password_verified_at IS NOT NULL
     AND ((NEW.status='APPROVED_FROZEN' AND c.status='PENDING_OWNER' AND d.action='APPROVE') OR (NEW.status='RETURNED' AND c.status='RETURNED' AND d.action='RETURN') OR (NEW.status='REJECTED' AND c.status='REJECTED' AND d.action='REJECT')))))
 ) THEN RAISE EXCEPTION 'Original independent payroll run decision required' USING ERRCODE='23514'; END IF;
 IF NEW.status='APPROVED_FROZEN' AND NOT EXISTS(SELECT 1 FROM payroll_line WHERE root_realm_id=NEW.root_realm_id AND run_id=NEW.id) THEN RAISE EXCEPTION 'No frozen payroll entitlement'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_run_original_review BEFORE UPDATE ON payroll_run FOR EACH ROW EXECUTE FUNCTION cg11_run_original_review();
CREATE FUNCTION cg11_line_original_review() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM payroll_run r JOIN cg03_case c ON c.realm_id=r.root_realm_id AND c.id=r.approval_case_ref AND c.case_kind='PAYROLL_RUN_RELEASE' AND c.status='PENDING_OWNER'
 JOIN payroll_run_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_run_review_ref AND s.run_id=r.id AND s.source_revision=NEW.source_revision AND s.source_digest=r.snapshot_digest
 JOIN payroll_run_revision v ON v.root_realm_id=s.root_realm_id AND v.run_id=s.run_id AND v.revision=s.source_revision AND v.source_digest=s.source_digest
 CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'lines') l
 WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.run_id AND r.status='SUBMITTED' AND r.period_key=NEW.period_key
 AND l->>'employeeRef'=NEW.employee_ref::text AND l->>'branchRef'=NEW.branch_ref::text AND l->>'status'='CALCULATED'
 AND l=NEW.source_snapshot AND (l->'amounts'->>'baseMinor')::bigint=NEW.base_minor
 AND (l->'amounts'->>'allowanceMinor')::bigint+(l->'amounts'->>'bonusMinor')::bigint=NEW.allowance_minor
 AND (l->'amounts'->>'deductionMinor')::bigint=NEW.deduction_minor AND (l->'amounts'->>'grossMinor')::bigint=NEW.gross_minor
 AND (l->'amounts'->>'netMinor')::bigint=NEW.net_minor AND (l->'amounts'->>'employerMinor')::bigint=NEW.employer_minor AND (l->'amounts'->>'statutoryMinor')::bigint=NEW.statutory_minor
 AND EXISTS(SELECT 1 FROM cg03_case_decision d WHERE d.realm_id=c.realm_id AND d.case_id=c.id AND d.action='APPROVE' AND d.actor_id<>c.proposer_id AND d.actor_id<>r.creator AND d.fresh_password_verified_at IS NOT NULL)
 ) THEN RAISE EXCEPTION 'Original approved run line required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_line_original_review BEFORE INSERT ON payroll_line FOR EACH ROW EXECUTE FUNCTION cg11_line_original_review();
