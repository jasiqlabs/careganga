-- Original CG03 approval for CG11 effective payroll sources, not a second approvals engine.
CREATE TABLE payroll_review_snapshot(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 source_kind text NOT NULL CHECK(source_kind IN('POLICY','COMPENSATION','PAYOUT')),
 policy_ref uuid,compensation_ref uuid,payout_ref uuid,source_revision integer NOT NULL CHECK(source_revision=1),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 submitted_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id,source_revision,source_digest),UNIQUE(root_realm_id,policy_ref),UNIQUE(root_realm_id,compensation_ref),UNIQUE(root_realm_id,payout_ref),
 FOREIGN KEY(root_realm_id,policy_ref) REFERENCES payroll_policy(root_realm_id,id),
 FOREIGN KEY(root_realm_id,compensation_ref) REFERENCES employee_compensation(root_realm_id,id),
 FOREIGN KEY(root_realm_id,payout_ref) REFERENCES employee_payout_instruction(root_realm_id,id),
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(((source_kind='POLICY' AND policy_ref IS NOT NULL AND compensation_ref IS NULL AND payout_ref IS NULL)
 OR (source_kind='COMPENSATION' AND compensation_ref IS NOT NULL AND policy_ref IS NULL AND payout_ref IS NULL)
 OR (source_kind='PAYOUT' AND payout_ref IS NOT NULL AND policy_ref IS NULL AND compensation_ref IS NULL)) IS TRUE)
);
CREATE TRIGGER cg11_review_snapshot_immutable BEFORE UPDATE OR DELETE ON payroll_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
ALTER TABLE cg03_case ADD COLUMN payroll_review_ref uuid,ADD COLUMN payroll_source_revision integer,ADD COLUMN payroll_source_digest char(64),
 ADD CONSTRAINT fk_cg03_payroll_exact FOREIGN KEY(realm_id,payroll_review_ref,payroll_source_revision,payroll_source_digest)
 REFERENCES payroll_review_snapshot(root_realm_id,id,source_revision,source_digest);
CREATE UNIQUE INDEX ux_cg03_payroll_review ON cg03_case(realm_id,payroll_review_ref) WHERE case_kind='PAYROLL_COMPENSATION_REVIEW';
DO $cg11$
DECLARE rec record; original text; source_guard text; other_cols text;
BEGIN
 SELECT string_agg(format('%I IS NULL',column_name),' AND ' ORDER BY ordinal_position) INTO other_cols
 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN('id','realm_id','case_number','process_id','process_version','proposer_id','target_account_id','target_role_id','account_name_snapshot','role_name_snapshot','expected_access_version','expected_role_revision','proposal_revision','proposal_digest','request_digest','request_key','previous_case_id','status','current_step','revision','submitted_at','updated_at','case_kind','payroll_review_ref','payroll_source_revision','payroll_source_digest');
 source_guard:='case_kind=''PAYROLL_COMPENSATION_REVIEW'' AND num_nonnulls(payroll_review_ref,payroll_source_revision,payroll_source_digest)=3 AND payroll_source_revision=proposal_revision AND payroll_source_digest=proposal_digest AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF other_cols IS NOT NULL THEN source_guard:=source_guard||' AND ('||other_cols||')'; END IF;
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind=''PAYROLL_COMPENSATION_REVIEW'''),
 ('cg03_case','cg03_case_kind_finance','case_kind=''PAYROLL_COMPENSATION_REVIEW'''),
 ('cg03_case','cg03_case_finance_source_disjoint',source_guard)) AS v(t,n,g)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
  IF original IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint unavailable: %',rec.n; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,original,rec.g);
 END LOOP;
END; $cg11$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_payroll_review_disjoint CHECK(
 ((case_kind='PAYROLL_COMPENSATION_REVIEW' AND num_nonnulls(payroll_review_ref,payroll_source_revision,payroll_source_digest)=3 AND payroll_source_revision=proposal_revision AND payroll_source_digest=proposal_digest)
 OR (case_kind<>'PAYROLL_COMPENSATION_REVIEW' AND num_nonnulls(payroll_review_ref,payroll_source_revision,payroll_source_digest)=0)) IS TRUE);
CREATE FUNCTION cg11_payroll_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF (NEW.payroll_review_ref,NEW.payroll_source_revision,NEW.payroll_source_digest) IS DISTINCT FROM (OLD.payroll_review_ref,OLD.payroll_source_revision,OLD.payroll_source_digest) THEN RAISE EXCEPTION 'Frozen payroll review cannot change'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_payroll_case_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg11_payroll_case_frozen();
CREATE TABLE cg03_payroll_review_process_current(realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id));
CREATE FUNCTION cg11_require_original_review() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF NEW.status IN('SUBMITTED','APPROVED','RETURNED','REJECTED') AND NOT EXISTS(
 SELECT 1 FROM cg03_case c JOIN payroll_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_review_ref
 WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.approval_case_ref AND c.case_kind='PAYROLL_COMPENSATION_REVIEW' AND c.proposal_revision=1
 AND ((TG_TABLE_NAME='payroll_policy' AND s.policy_ref=NEW.id) OR (TG_TABLE_NAME='employee_compensation' AND s.compensation_ref=NEW.id) OR (TG_TABLE_NAME='employee_payout_instruction' AND s.payout_ref=NEW.id))
 AND s.submitted_by=c.proposer_id AND s.submitted_by=NEW.created_by
 AND ((NEW.status='SUBMITTED' AND c.status='SUBMITTED') OR (NEW.status='APPROVED' AND c.status='PENDING_OWNER') OR (NEW.status='RETURNED' AND c.status='RETURNED') OR (NEW.status='REJECTED' AND c.status='REJECTED'))
 AND (NEW.status='SUBMITTED' OR EXISTS(SELECT 1 FROM cg03_case_decision d WHERE d.realm_id=c.realm_id AND d.case_id=c.id AND d.actor_id<>c.proposer_id AND d.actor_id<>NEW.created_by AND d.fresh_password_verified_at IS NOT NULL AND d.action=CASE NEW.status WHEN 'APPROVED' THEN 'APPROVE' WHEN 'RETURNED' THEN 'RETURN' ELSE 'REJECT' END))
 ) THEN RAISE EXCEPTION 'Original independent payroll decision required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_policy_original_review BEFORE UPDATE ON payroll_policy FOR EACH ROW EXECUTE FUNCTION cg11_require_original_review();
CREATE TRIGGER cg11_compensation_original_review BEFORE UPDATE ON employee_compensation FOR EACH ROW EXECUTE FUNCTION cg11_require_original_review();
CREATE TRIGGER cg11_payout_original_review BEFORE UPDATE ON employee_payout_instruction FOR EACH ROW EXECUTE FUNCTION cg11_require_original_review();
