-- CG11 US002: first wizard stage; period draft is not a calculated run or a payment.
CREATE SEQUENCE cg11_payroll_run_seq;
CREATE TABLE payroll_run(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 branch_ref uuid,cycle text NOT NULL DEFAULT 'MONTHLY' CHECK(cycle='MONTHLY'),
 period_key text NOT NULL CHECK(period_key~'^[0-9]{4}-[0-9]{2}$'),period_from date NOT NULL,period_until date NOT NULL,
 fiscal_year_label text NOT NULL,tentative_payment_date date,
 kind text NOT NULL DEFAULT 'ORDINARY' CHECK(kind='ORDINARY'),
 run_number text NOT NULL UNIQUE DEFAULT ('CG-PAY-'||lpad(nextval('cg11_payroll_run_seq')::text,6,'0')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'),revision integer NOT NULL DEFAULT 1 CHECK(revision=1),
 creator uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,creator,request_key),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(creator,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(EXTRACT(DAY FROM period_from)=1 AND period_until=(period_from+interval '1 month')::date),
 CHECK(period_key=to_char(period_from,'YYYY-MM')),
 CHECK(fiscal_year_label=(EXTRACT(YEAR FROM period_from)::int-CASE WHEN EXTRACT(MONTH FROM period_from)<4 THEN 1 ELSE 0 END)::text||'-'||(EXTRACT(YEAR FROM period_from)::int+CASE WHEN EXTRACT(MONTH FROM period_from)<4 THEN 0 ELSE 1 END)::text),
 CHECK(tentative_payment_date IS NULL OR tentative_payment_date>=period_from)
);
CREATE UNIQUE INDEX ux_cg11_run_root_period ON payroll_run(root_realm_id,period_key,cycle) WHERE branch_ref IS NULL;
CREATE UNIQUE INDEX ux_cg11_run_branch_period ON payroll_run(root_realm_id,branch_ref,period_key,cycle) WHERE branch_ref IS NOT NULL;
CREATE INDEX ix_cg11_run_scope ON payroll_run(root_realm_id,period_from DESC,branch_ref,id);
-- Before importing a real attendance snapshot, only an immutable original period draft exists.
CREATE TRIGGER cg11_period_draft_immutable BEFORE UPDATE OR DELETE ON payroll_run FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
