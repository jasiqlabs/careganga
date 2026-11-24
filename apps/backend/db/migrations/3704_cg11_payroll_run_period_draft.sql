-- CG11 US002: first wizard stage; period draft is not a calculated run or a payment.
CREATE SEQUENCE cg11_payroll_run_seq;
CREATE TABLE payroll_run(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 branch_ref uuid,cycle text NOT NULL DEFAULT 'MONTHLY' CHECK(cycle='MONTHLY'),
 period_key text NOT NULL CHECK(period_key~'^[0-9]{4}-[0-9]{2}$'),period_from date NOT NULL,period_until date NOT NULL,
 fiscal_year_label text NOT NULL,tentative_payment_date date,
 kind text NOT NULL DEFAULT 'ORDINARY' CHECK(kind='ORDINARY'),
 run_number text NOT NULL UNIQUE DEFAULT ('CG-PAY-'||lpad(nextval('cg11_payroll_run_seq')::text,6,'0')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ATTENDANCE_IMPORTED','CALCULATED','SUBMITTED','APPROVED_FROZEN','RETURNED','REJECTED')),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 creator uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 snapshot_digest char(64),approval_case_ref uuid,approved_decision_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,creator,request_key),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(approval_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(approved_decision_ref,approval_case_ref,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id),
 FOREIGN KEY(creator,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(EXTRACT(DAY FROM period_from)=1 AND period_until=(period_from+interval '1 month')::date),
 CHECK(period_key=to_char(period_from,'YYYY-MM')),
 CHECK(fiscal_year_label=(EXTRACT(YEAR FROM period_from)::int-CASE WHEN EXTRACT(MONTH FROM period_from)<4 THEN 1 ELSE 0 END)::text||'-'||(EXTRACT(YEAR FROM period_from)::int+CASE WHEN EXTRACT(MONTH FROM period_from)<4 THEN 0 ELSE 1 END)::text),
 CHECK(tentative_payment_date IS NULL OR tentative_payment_date>=period_from)
);
CREATE UNIQUE INDEX ux_cg11_run_root_period ON payroll_run(root_realm_id,period_key,cycle) WHERE branch_ref IS NULL;
CREATE UNIQUE INDEX ux_cg11_run_branch_period ON payroll_run(root_realm_id,branch_ref,period_key,cycle) WHERE branch_ref IS NOT NULL;
CREATE INDEX ix_cg11_run_scope ON payroll_run(root_realm_id,period_from DESC,branch_ref,id);
-- Every source revision is append-only; the run row is a guarded pointer.
CREATE TABLE payroll_run_revision(
 root_realm_id uuid NOT NULL,run_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>1),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,run_id,revision),UNIQUE(root_realm_id,run_id,revision,source_digest),
 FOREIGN KEY(root_realm_id,run_id) REFERENCES payroll_run(root_realm_id,id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TABLE payroll_run_command(
 root_realm_id uuid NOT NULL,actor_ref uuid NOT NULL,request_key uuid NOT NULL,run_id uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 accepted_revision integer NOT NULL,
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(root_realm_id,run_id,accepted_revision) REFERENCES payroll_run_revision(root_realm_id,run_id,revision),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TABLE payroll_line(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,run_id uuid NOT NULL,source_revision integer NOT NULL,
 employee_ref uuid NOT NULL,period_key text NOT NULL,branch_ref uuid NOT NULL,
 entitlement_state text NOT NULL CHECK(entitlement_state IN('RELEASE_ELIGIBLE','HELD')),
 base_minor bigint NOT NULL CHECK(base_minor>=0),allowance_minor bigint NOT NULL CHECK(allowance_minor>=0),
 bonus_minor bigint NOT NULL CHECK(bonus_minor>=0),arrears_minor bigint NOT NULL CHECK(arrears_minor>=0),
 deduction_minor bigint NOT NULL CHECK(deduction_minor>=0),gross_minor bigint NOT NULL CHECK(gross_minor=base_minor+allowance_minor+bonus_minor+arrears_minor),
 net_minor bigint NOT NULL CHECK(net_minor=gross_minor-deduction_minor AND net_minor>=0),
 employer_minor bigint NOT NULL CHECK(employer_minor>=0),statutory_minor bigint NOT NULL CHECK(statutory_minor BETWEEN 0 AND deduction_minor),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,run_id,employee_ref),
 UNIQUE(root_realm_id,employee_ref,period_key),
 FOREIGN KEY(root_realm_id,run_id,source_revision) REFERENCES payroll_run_revision(root_realm_id,run_id,revision),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id)
);
CREATE TRIGGER cg11_run_revision_immutable BEFORE UPDATE OR DELETE ON payroll_run_revision FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE TRIGGER cg11_run_command_immutable BEFORE UPDATE OR DELETE ON payroll_run_command FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE TRIGGER cg11_line_immutable BEFORE UPDATE OR DELETE ON payroll_line FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE FUNCTION cg11_run_transition() RETURNS trigger LANGUAGE plpgsql AS $cg11$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payroll run is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.revision<>1 OR num_nonnulls(NEW.snapshot_digest,NEW.approval_case_ref,NEW.approved_decision_ref)<>0 THEN RAISE EXCEPTION 'New payroll run must be a draft'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['status','revision','snapshot_digest','approval_case_ref','approved_decision_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','snapshot_digest','approval_case_ref','approved_decision_ref']) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Invalid payroll revision'; END IF;
 IF NOT ((OLD.status IN('DRAFT','ATTENDANCE_IMPORTED','CALCULATED','RETURNED') AND NEW.status='ATTENDANCE_IMPORTED')
 OR (OLD.status IN('ATTENDANCE_IMPORTED','CALCULATED') AND NEW.status IN('ATTENDANCE_IMPORTED','CALCULATED'))
 OR (OLD.status='CALCULATED' AND NEW.status='SUBMITTED')
 OR (OLD.status='SUBMITTED' AND NEW.status IN('APPROVED_FROZEN','RETURNED','REJECTED'))) THEN RAISE EXCEPTION 'Invalid payroll transition'; END IF;
 IF NEW.status IN('ATTENDANCE_IMPORTED','CALCULATED') AND NOT EXISTS(SELECT 1 FROM payroll_run_revision s WHERE s.root_realm_id=NEW.root_realm_id AND s.run_id=NEW.id AND s.revision=NEW.revision AND s.source_digest=NEW.snapshot_digest) THEN RAISE EXCEPTION 'Original payroll revision required'; END IF;
 IF NEW.status IN('ATTENDANCE_IMPORTED','CALCULATED') AND num_nonnulls(NEW.approval_case_ref,NEW.approved_decision_ref)<>0 THEN RAISE EXCEPTION 'Draft cannot be approved'; END IF;
 IF NEW.status IN('SUBMITTED','APPROVED_FROZEN','RETURNED','REJECTED') AND NEW.snapshot_digest IS DISTINCT FROM OLD.snapshot_digest THEN RAISE EXCEPTION 'Frozen payroll digest cannot change'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_run_transition BEFORE INSERT OR UPDATE OR DELETE ON payroll_run FOR EACH ROW EXECUTE FUNCTION cg11_run_transition();


-- Late attendance is a separate reviewed source adjustment for a later run.
CREATE TABLE payroll_adjustment(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,
 original_line_ref uuid NOT NULL,target_run_ref uuid NOT NULL,employee_ref uuid NOT NULL,
 correction_digest char(64) NOT NULL CHECK(correction_digest~'^[a-f0-9]{64}$'),
 source_key char(64) NOT NULL CHECK(source_key~'^[a-f0-9]{64}$'),
 delta_minor bigint NOT NULL CHECK(delta_minor<>0),source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 2 AND 100),created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,source_key),UNIQUE(root_realm_id,id,original_line_ref,correction_digest),
 FOREIGN KEY(root_realm_id,original_line_ref) REFERENCES payroll_line(root_realm_id,id),
 FOREIGN KEY(root_realm_id,target_run_ref) REFERENCES payroll_run(root_realm_id,id),
 FOREIGN KEY(root_realm_id,employee_ref) REFERENCES hr_employee(root_realm_id,id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE INDEX ix_cg11_adjustment_original ON payroll_adjustment(root_realm_id,original_line_ref,created_at,id);
CREATE INDEX ix_cg11_adjustment_target ON payroll_adjustment(root_realm_id,target_run_ref,employee_ref,id);
CREATE TRIGGER cg11_late_adjustment_immutable BEFORE UPDATE OR DELETE ON payroll_adjustment FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();

CREATE TABLE payroll_adjustment_consumption(
 root_realm_id uuid NOT NULL,adjustment_ref uuid NOT NULL,original_line_ref uuid NOT NULL,correction_digest char(64) NOT NULL,
 target_run_ref uuid NOT NULL,decision_ref uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,adjustment_ref),UNIQUE(root_realm_id,original_line_ref,correction_digest),
 FOREIGN KEY(root_realm_id,adjustment_ref,original_line_ref,correction_digest) REFERENCES payroll_adjustment(root_realm_id,id,original_line_ref,correction_digest),
 FOREIGN KEY(root_realm_id,target_run_ref) REFERENCES payroll_run(root_realm_id,id)
);
CREATE TRIGGER cg11_adjustment_consumption_immutable BEFORE UPDATE OR DELETE ON payroll_adjustment_consumption FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
