-- Frozen attendance/compensation branch allocation, including adjustments.
-- Bonus/arrears belong to the final frozen assignment; additional deductions
-- consume positive branch net in anchor-first, stable branch order. Statutory
-- withholding is a subset of deductions, allocated in the same order.
CREATE FUNCTION cg11_frozen_branch_allocation(p_root uuid,p_line uuid)
RETURNS TABLE(branch_ref uuid,gross numeric,deductions numeric,net numeric,employer numeric,statutory numeric)
LANGUAGE sql STABLE AS $fn$
 WITH original AS (
  SELECT l.* FROM payroll_line l WHERE l.root_realm_id=p_root AND l.id=p_line
 ), raw AS (
  SELECT (v->>'branchRef')::uuid branch_ref,
   (v->>'baseMinor')::numeric+(v->>'allowanceMinor')::numeric gross,
   (v->>'deductionMinor')::numeric deductions,(v->>'employerMinor')::numeric employer
  FROM original o CROSS JOIN LATERAL jsonb_array_elements(o.source_snapshot->'amounts'->'allocation') v
  UNION ALL SELECT o.branch_ref,0::numeric,0::numeric,0::numeric FROM original o
 ), grouped AS (
  SELECT raw.branch_ref,sum(raw.gross) gross,sum(raw.deductions) deductions,sum(raw.employer) employer FROM raw GROUP BY raw.branch_ref
 ), added AS (
  SELECT g.branch_ref,g.gross+CASE WHEN g.branch_ref=o.branch_ref THEN o.bonus_minor+o.arrears_minor ELSE 0 END gross,
   g.deductions,g.employer,o.deduction_minor-(SELECT sum(deductions) FROM grouped) extra,o.statutory_minor,
   CASE WHEN g.branch_ref=o.branch_ref THEN 0 ELSE 1 END priority FROM grouped g CROSS JOIN original o
 ), extra AS (
  SELECT a.*,least(a.gross-a.deductions,greatest(a.extra-coalesce(sum(a.gross-a.deductions) OVER(ORDER BY a.priority,a.branch_ref ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0),0)) additional FROM added a
 ), classified AS (
  SELECT x.branch_ref,x.gross,x.deductions+x.additional deductions,x.gross-x.deductions-x.additional net,x.employer,x.statutory_minor,x.priority FROM extra x
 )
 SELECT c.branch_ref,c.gross,c.deductions,c.net,c.employer,
 least(c.deductions,greatest(c.statutory_minor-coalesce(sum(c.deductions) OVER(ORDER BY c.priority,c.branch_ref ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0),0)) statutory
 FROM classified c ORDER BY c.branch_ref
$fn$;
CREATE FUNCTION cg11_accrual_expected(p_root uuid,p_run uuid,p_expense uuid,p_payable uuid,p_deduction uuid,p_employer uuid,p_statutory uuid)
RETURNS TABLE(account_ref uuid,branch_ref uuid,dr numeric,cr numeric) LANGUAGE sql STABLE AS $fn$
 WITH totals AS (
 SELECT a.branch_ref,sum(a.gross) gross,sum(a.deductions) deductions,sum(a.net) net,sum(a.employer) employer,sum(a.statutory) statutory
 FROM payroll_line l CROSS JOIN LATERAL cg11_frozen_branch_allocation(l.root_realm_id,l.id) a
 WHERE l.root_realm_id=p_root AND l.run_id=p_run GROUP BY a.branch_ref
 )
 SELECT v.ref,t.branch_ref,v.dr,v.cr FROM totals t CROSS JOIN LATERAL (VALUES
 (p_expense,t.gross+t.employer,0::numeric),(p_payable,0::numeric,t.net),(p_deduction,0::numeric,t.deductions-t.statutory),
 (p_employer,0::numeric,t.employer),(p_statutory,0::numeric,t.statutory)) v(ref,dr,cr)
 WHERE v.ref IS NOT NULL AND (v.dr>0 OR v.cr>0)
 ORDER BY t.branch_ref,v.ref
$fn$;
CREATE OR REPLACE FUNCTION cg11_guard_accrual() RETURNS trigger LANGUAGE plpgsql AS $cg11$
DECLARE r payroll_run%ROWTYPE; gross numeric; net numeric; deductions numeric; employer numeric; statutory numeric;
BEGIN
 SELECT * INTO r FROM payroll_run WHERE root_realm_id=NEW.root_realm_id AND id=NEW.run_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'APPROVED_FROZEN' OR r.approved_decision_ref IS DISTINCT FROM NEW.decision_ref OR r.snapshot_digest IS DISTINCT FROM NEW.source_digest OR NOT EXISTS(
 SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
 WHERE c.realm_id=r.root_realm_id AND c.id=r.approval_case_ref AND c.status='OWNER_COMPLETED' AND c.case_kind='PAYROLL_RUN_RELEASE'
 AND d.id=NEW.decision_ref AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>r.creator)
 THEN RAISE EXCEPTION 'Original payroll approval required' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(gross_minor),0),coalesce(sum(net_minor),0),coalesce(sum(deduction_minor),0),coalesce(sum(employer_minor),0),coalesce(sum(statutory_minor),0)
 INTO gross,net,deductions,employer,statutory FROM payroll_line WHERE root_realm_id=r.root_realm_id AND run_id=r.id;
 IF gross+employer<=0 OR (SELECT count(DISTINCT v) FROM unnest(ARRAY[NEW.expense_ref,NEW.payable_ref,NEW.deduction_ref,NEW.employer_ref,NEW.statutory_ref]) v WHERE v IS NOT NULL)<>num_nonnulls(NEW.expense_ref,NEW.payable_ref,NEW.deduction_ref,NEW.employer_ref,NEW.statutory_ref)
 OR (deductions-statutory>0)<>(NEW.deduction_ref IS NOT NULL) OR (employer>0)<>(NEW.employer_ref IS NOT NULL) OR (statutory>0)<>(NEW.statutory_ref IS NOT NULL)
 THEN RAISE EXCEPTION 'Invalid payroll account classification' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM journal j JOIN financial_year y ON y.id=j.financial_year_id AND y.root_realm_id=j.root_realm_id
 WHERE j.id=NEW.journal_ref AND j.root_realm_id=r.root_realm_id AND j.source_ref=r.id AND j.immutable_source_event_key=NEW.decision_ref AND j.immutable_payload_digest=NEW.request_digest AND j.posting_kind='GENERAL' AND j.posting_date=r.period_until-1 AND y.status='OPEN')
 THEN RAISE EXCEPTION 'Original CG09 accrual required' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_line l CROSS JOIN LATERAL (
 SELECT coalesce(sum(x.gross),0) gross,coalesce(sum(x.deductions),0) deductions,coalesce(sum(x.net),0) net,coalesce(sum(x.employer),0) employer,coalesce(sum(x.statutory),0) statutory,
 count(*) n,coalesce(bool_or(x.gross<0 OR x.deductions<0 OR x.net<0 OR x.employer<0 OR x.statutory<0 OR x.statutory>x.deductions OR (r.branch_ref IS NOT NULL AND x.branch_ref<>r.branch_ref)),true) invalid
 FROM cg11_frozen_branch_allocation(l.root_realm_id,l.id) x) a
 WHERE l.root_realm_id=r.root_realm_id AND l.run_id=r.id AND (a.n=0 OR a.invalid OR (a.gross,a.deductions,a.net,a.employer,a.statutory) IS DISTINCT FROM (l.gross_minor::numeric,l.deduction_minor::numeric,l.net_minor::numeric,l.employer_minor::numeric,l.statutory_minor::numeric)))
 OR EXISTS(SELECT 1 FROM (VALUES(NEW.expense_ref,'EXPENSE'),(NEW.payable_ref,'LIABILITY'),(NEW.deduction_ref,'LIABILITY'),(NEW.employer_ref,'LIABILITY'),(NEW.statutory_ref,'LIABILITY')) x(ref,category)
 WHERE x.ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_account a JOIN account_group g ON g.root_realm_id=a.root_realm_id AND g.id=a.group_id WHERE a.root_realm_id=r.root_realm_id AND a.id=x.ref AND a.account_kind='GENERAL' AND a.status='ACTIVE' AND g.category=x.category AND (a.branch_id IS NULL OR a.branch_id=r.branch_ref)))
 OR EXISTS(WITH expected AS (SELECT * FROM cg11_accrual_expected(r.root_realm_id,r.id,NEW.expense_ref,NEW.payable_ref,NEW.deduction_ref,NEW.employer_ref,NEW.statutory_ref)),
 actual AS(SELECT account_id,branch_id,debit_minor::numeric,credit_minor::numeric FROM journal_line WHERE root_realm_id=r.root_realm_id AND journal_id=NEW.journal_ref)
 (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected))
 THEN RAISE EXCEPTION 'Payroll accrual does not match original frozen branch obligations' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE OR REPLACE FUNCTION cg09_check_balanced_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_journal uuid; r uuid; line_count int; total_debit numeric; total_credit numeric;
BEGIN
 IF TG_TABLE_NAME='journal' THEN
  v_journal:=NEW.id;
 ELSE
  v_journal:=NEW.journal_id;
 END IF;
 r:=NEW.root_realm_id;
 SELECT count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0)
 INTO line_count,total_debit,total_credit
 FROM journal_line WHERE journal_id=v_journal AND root_realm_id=r;
 IF NOT EXISTS (
   SELECT 1 FROM journal j JOIN financial_year fy
    ON fy.id=j.financial_year_id AND fy.root_realm_id=j.root_realm_id
   WHERE j.id=v_journal AND j.root_realm_id=r
    AND j.posting_date BETWEEN fy.start_on AND fy.end_on
 ) THEN RAISE EXCEPTION 'Posting date outside financial year' USING ERRCODE='P0901'; END IF;
 IF EXISTS (
   SELECT 1 FROM journal_line l JOIN finance_account a
    ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id
   WHERE l.journal_id=v_journal AND l.root_realm_id=r
    AND (a.scope_kind='BRANCH' AND a.branch_id IS DISTINCT FROM l.branch_id)
 ) OR (SELECT count(DISTINCT l.branch_id) FROM journal_line l
        WHERE l.journal_id=v_journal AND l.root_realm_id=r)>1 AND NOT EXISTS(
  SELECT 1 FROM payroll_accrual a WHERE a.root_realm_id=r AND a.journal_ref=v_journal
 ) THEN
  RAISE EXCEPTION 'Finance journal branch and account scope do not match' USING ERRCODE='P0904';
 END IF;
 IF EXISTS(SELECT 1 FROM payroll_accrual a WHERE a.root_realm_id=r AND a.journal_ref=v_journal)
 AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=r AND l.journal_id=v_journal GROUP BY l.branch_id HAVING sum(l.debit_minor)<>sum(l.credit_minor))
 THEN RAISE EXCEPTION 'Payroll branch posting must balance' USING ERRCODE='P0903'; END IF;
 IF line_count<2 OR total_debit<=0 OR total_debit<>total_credit THEN
   RAISE EXCEPTION 'Unbalanced posted journal' USING ERRCODE='P0903'; END IF;
 RETURN NULL;
END; $$;
