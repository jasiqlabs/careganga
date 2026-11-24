-- Each immutable payout attempt pins a payable-clearing distribution across
-- original frozen salary cost branches, with no new salary or payment ledger.
CREATE TABLE payroll_attempt_allocation(
 root_realm_id uuid NOT NULL,attempt_ref uuid NOT NULL,branch_ref uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),
 PRIMARY KEY(root_realm_id,attempt_ref,branch_ref),
 FOREIGN KEY(root_realm_id,attempt_ref) REFERENCES payroll_payout_attempt(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id)
);
CREATE TRIGGER cg11_attempt_allocation_immutable BEFORE UPDATE OR DELETE ON payroll_attempt_allocation FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE FUNCTION cg11_attempt_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Original attempt allocation is source-generated'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_attempt_allocation_source BEFORE INSERT ON payroll_attempt_allocation FOR EACH ROW EXECUTE FUNCTION cg11_attempt_allocation_guard();
CREATE FUNCTION cg11_pin_attempt_allocation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE total numeric;
BEGIN
 -- Original BEFORE trigger already locks the item and verifies remaining due.
 INSERT INTO payroll_attempt_allocation(root_realm_id,attempt_ref,branch_ref,amount_minor)
 WITH due AS(
  SELECT x.branch_ref,x.net-coalesce(p.paid,0) due,CASE WHEN x.branch_ref=l.branch_ref THEN 0 ELSE 1 END priority
  FROM payroll_batch_item i JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
  CROSS JOIN LATERAL cg11_frozen_branch_allocation(l.root_realm_id,l.id) x
  LEFT JOIN LATERAL(SELECT sum(a.amount_minor) paid FROM payroll_attempt_outcome o JOIN payroll_attempt_allocation a
    ON a.root_realm_id=o.root_realm_id AND a.attempt_ref=o.id
    WHERE o.root_realm_id=i.root_realm_id AND o.item_ref=i.id AND o.id<>NEW.id AND o.paid_minor=o.amount_minor AND a.branch_ref=x.branch_ref)p ON true
  WHERE i.root_realm_id=NEW.root_realm_id AND i.id=NEW.item_ref AND x.net>0
 ), split AS(
 SELECT d.branch_ref,least(d.due,greatest(NEW.amount_minor-coalesce(sum(d.due) OVER(ORDER BY d.priority,d.branch_ref ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0),0)) amount
 FROM due d WHERE d.due>0
 )
 SELECT NEW.root_realm_id,NEW.id,s.branch_ref,s.amount::bigint FROM split s WHERE s.amount>0;
 SELECT coalesce(sum(a.amount_minor),0) INTO total FROM payroll_attempt_allocation a WHERE a.root_realm_id=NEW.root_realm_id AND a.attempt_ref=NEW.id;
 IF total<>NEW.amount_minor THEN RAISE EXCEPTION 'Original branch payable allocation unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_pin_attempt_branch_allocation AFTER INSERT ON payroll_payout_attempt FOR EACH ROW EXECUTE FUNCTION cg11_pin_attempt_allocation();
CREATE FUNCTION cg11_payroll_posting_lines(p_root uuid,p_voucher uuid)
RETURNS TABLE(account_ref uuid,branch_ref uuid,dr numeric,cr numeric) LANGUAGE sql STABLE AS $fn$
 SELECT v.ref,a.branch_ref,v.dr,v.cr FROM payroll_payout_attempt t
 JOIN payroll_attempt_allocation a ON a.root_realm_id=t.root_realm_id AND a.attempt_ref=t.id
 JOIN finance_voucher f ON f.root_realm_id=t.root_realm_id AND f.id=t.voucher_ref
 CROSS JOIN LATERAL(VALUES(f.debit_account_id,a.amount_minor::numeric,0::numeric),(f.credit_account_id,0::numeric,a.amount_minor::numeric)) v(ref,dr,cr)
 WHERE t.root_realm_id=p_root AND t.voucher_ref=p_voucher ORDER BY a.branch_ref,v.ref
$fn$;
CREATE FUNCTION cg11_payroll_journal_matches(p_root uuid,p_voucher uuid,p_journal uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM payroll_payout_attempt t WHERE t.root_realm_id=p_root AND t.voucher_ref=p_voucher)
 AND EXISTS(SELECT 1 FROM cg11_payroll_posting_lines(p_root,p_voucher))
 AND NOT EXISTS(WITH expected AS(SELECT * FROM cg11_payroll_posting_lines(p_root,p_voucher)),
 actual AS(SELECT account_id,branch_id,debit_minor::numeric,credit_minor::numeric FROM journal_line WHERE root_realm_id=p_root AND journal_id=p_journal)
 (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual) UNION ALL (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected))
$fn$;
CREATE FUNCTION cg11_root_payroll_journal(p_root uuid,p_journal uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM finance_voucher_posting p JOIN payroll_payout_attempt t ON t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id
 JOIN finance_voucher v ON v.root_realm_id=p.root_realm_id AND v.id=p.voucher_id
 WHERE p.root_realm_id=p_root AND p.journal_id=p_journal AND v.branch_id IS NULL)
$fn$;
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
 UNION ALL SELECT 1 FROM finance_voucher_posting p JOIN payroll_payout_attempt t ON t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id WHERE p.root_realm_id=r AND p.journal_id=v_journal
 ) THEN
  RAISE EXCEPTION 'Finance journal branch and account scope do not match' USING ERRCODE='P0904';
 END IF;
 IF EXISTS(SELECT 1 FROM payroll_accrual a WHERE a.root_realm_id=r AND a.journal_ref=v_journal
 UNION ALL SELECT 1 FROM finance_voucher_posting p JOIN payroll_payout_attempt t ON t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id WHERE p.root_realm_id=r AND p.journal_id=v_journal)
 AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=r AND l.journal_id=v_journal GROUP BY l.branch_id HAVING sum(l.debit_minor)<>sum(l.credit_minor))
 THEN RAISE EXCEPTION 'Payroll branch posting must balance' USING ERRCODE='P0903'; END IF;
 IF line_count<2 OR total_debit<=0 OR total_debit<>total_credit THEN
   RAISE EXCEPTION 'Unbalanced posted journal' USING ERRCODE='P0903'; END IF;
 RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION cg09_guard_voucher_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y record;case_state text;
BEGIN
 SELECT fy.start_on,fy.end_on,fy.status INTO y FROM financial_year fy
 WHERE fy.id=NEW.financial_year_id AND fy.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Financial year is not available' USING ERRCODE='P0901';
 END IF;
 IF NEW.posting_date<y.start_on OR NEW.posting_date>y.end_on THEN
  RAISE EXCEPTION 'Voucher date is outside financial year' USING ERRCODE='P0911';
 END IF;
 IF NEW.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch
   WHERE id=NEW.branch_id AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND AND NEW.status IN('DRAFT','SUBMITTED','APPROVED','PAYMENT_REQUESTED') THEN
   RAISE EXCEPTION 'Voucher branch is not active' USING ERRCODE='P0904';
  END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR y.status<>'OPEN' THEN
   RAISE EXCEPTION 'New voucher must be a draft in an open year' USING ERRCODE='P0901';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.voucher_number IS DISTINCT FROM OLD.voucher_number OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Voucher source identity is immutable' USING ERRCODE='P0907';
 END IF;
 IF (OLD.status='DRAFT' OR OLD.status='RETURNED') AND NEW.status='DRAFT' THEN
  IF y.status<>'OPEN' OR NEW.version<>OLD.version+1 OR
    NEW.approval_case_id IS NOT NULL OR NEW.proof_file_id IS NOT NULL OR
    NEW.proof_file_revision IS NOT NULL THEN
   RAISE EXCEPTION 'Draft revision or correction is not current' USING ERRCODE='P0907';
  END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF y.status<>'OPEN' OR NEW.version<>OLD.version OR
   NEW.approval_case_id IS NULL OR NEW.proof_file_id IS NULL OR
   NEW.proof_file_revision IS NULL THEN
   RAISE EXCEPTION 'Submitted voucher needs real approval and evidence' USING ERRCODE='P0913';
  END IF;
  PERFORM 1 FROM cg03_case c
   JOIN cg19_stored_file f ON f.id=NEW.proof_file_id AND f.realm_id=NEW.root_realm_id
    AND f.voucher_id=NEW.id AND f.voucher_version=NEW.version
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.case_kind='FINANCE_VOUCHER' AND c.finance_voucher_id=NEW.id
    AND c.finance_voucher_revision=NEW.version AND
    c.finance_proof_file_id=f.id AND c.finance_proof_revision=f.revision
    AND c.status IN('SUBMITTED','IN_REVIEW') AND f.revision=NEW.proof_file_revision
    AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
    AND i.status='VALIDATED' FOR SHARE OF c,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Original review case or clean proof is missing' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF NEW.version<>OLD.version THEN
   RAISE EXCEPTION 'Submitted voucher version is immutable' USING ERRCODE='P0907';
  END IF;
  SELECT status INTO case_state FROM cg03_case
   WHERE id=NEW.approval_case_id AND realm_id=NEW.root_realm_id
    AND finance_voucher_id=NEW.id AND finance_voucher_revision=NEW.version
    AND case_kind='FINANCE_VOUCHER' FOR SHARE;
  IF NOT FOUND OR
    (NEW.status='RETURNED' AND case_state<>'RETURNED') OR
    (NEW.status='REJECTED' AND case_state<>'REJECTED') OR
    (NEW.status='APPROVED' AND case_state NOT IN('PENDING_OWNER','OWNER_COMPLETED')) THEN
   RAISE EXCEPTION 'Committed reviewer outcome is required' USING ERRCODE='P0913';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect effect
     JOIN cg03_case_decision d ON d.id=effect.final_decision_id
   WHERE effect.case_id=NEW.approval_case_id
    AND effect.realm_id=NEW.root_realm_id
    AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    FOR SHARE OF effect,d;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'Protected reviewer proof is unavailable' USING ERRCODE='P0913';
   END IF;
  END IF;
 ELSIF OLD.status='APPROVED' AND NEW.status='PAYMENT_REQUESTED' THEN
  IF NEW.voucher_type NOT IN('PAYMENT','CONTRA') OR y.status<>'OPEN' THEN
   RAISE EXCEPTION 'Payment request is not allowed' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status='PAYMENT_REQUESTED' AND NEW.status='PAID_VERIFIED' THEN
  PERFORM 1 FROM finance_voucher_payment_verification p
   WHERE p.voucher_id=NEW.id AND p.root_realm_id=NEW.root_realm_id
    AND p.voucher_revision=NEW.version AND p.status='VERIFIED' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Independent verified money source is required' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status IN('APPROVED','PAID_VERIFIED') AND NEW.status='POSTED' THEN
  IF (OLD.status='APPROVED' AND NEW.voucher_type IN('PAYMENT','CONTRA')) OR
     (OLD.status='PAID_VERIFIED' AND NEW.voucher_type NOT IN('PAYMENT','CONTRA')) OR
     y.status<>'OPEN' THEN
   RAISE EXCEPTION 'Voucher posting requires open year and correct payment stage'
     USING ERRCODE='P0901';
  END IF;
  PERFORM 1 FROM finance_voucher_posting p JOIN journal j
     ON j.id=p.journal_id AND j.root_realm_id=p.root_realm_id
   WHERE p.voucher_id=NEW.id AND p.root_realm_id=NEW.root_realm_id
    AND p.voucher_revision=NEW.version AND p.approval_case_id=NEW.approval_case_id
    AND j.posting_kind='VOUCHER' AND j.status='POSTED'
    AND j.source_ref=NEW.id AND j.immutable_payload_digest=p.original_digest
    AND j.financial_year_id=NEW.financial_year_id AND j.posting_date=NEW.posting_date
    AND (cg11_payroll_journal_matches(NEW.root_realm_id,NEW.id,j.id) OR (NOT EXISTS(SELECT 1 FROM payroll_payout_attempt t WHERE t.root_realm_id=NEW.root_realm_id AND t.voucher_ref=NEW.id) AND (
     SELECT count(*)=2 AND COALESCE(sum(l.debit_minor),0)=NEW.total_minor
      AND COALESCE(sum(l.credit_minor),0)=NEW.total_minor
      AND count(*) FILTER (WHERE l.account_id=NEW.debit_account_id
       AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
       AND l.debit_minor=NEW.total_minor AND l.credit_minor=0)=1
      AND count(*) FILTER (WHERE l.account_id=NEW.credit_account_id
       AND l.branch_id IS NOT DISTINCT FROM NEW.branch_id
       AND l.credit_minor=NEW.total_minor AND l.debit_minor=0)=1
     FROM journal_line l WHERE l.journal_id=j.id AND l.root_realm_id=NEW.root_realm_id
    )))
   FOR SHARE OF p,j;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Balanced original journal posting is required' USING ERRCODE='P0913';
  END IF;
 ELSE
  RAISE EXCEPTION 'Voucher workflow transition not permitted' USING ERRCODE='P0907';
 END IF;
 -- Once a draft is submitted, all financial facts and source refs are immutable.
 IF OLD.status NOT IN('DRAFT','RETURNED') AND
    (NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id OR
     NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
     NEW.voucher_type IS DISTINCT FROM OLD.voucher_type OR
     NEW.posting_date IS DISTINCT FROM OLD.posting_date OR
     NEW.payee_name IS DISTINCT FROM OLD.payee_name OR
     NEW.purpose IS DISTINCT FROM OLD.purpose OR
     NEW.gross_minor IS DISTINCT FROM OLD.gross_minor OR
     NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR
     NEW.charges_minor IS DISTINCT FROM OLD.charges_minor OR
     NEW.total_minor IS DISTINCT FROM OLD.total_minor OR
     NEW.debit_account_id IS DISTINCT FROM OLD.debit_account_id OR
     NEW.credit_account_id IS DISTINCT FROM OLD.credit_account_id OR
     NEW.payment_account_id IS DISTINCT FROM OLD.payment_account_id OR
     NEW.approval_case_id IS DISTINCT FROM OLD.approval_case_id OR
     NEW.proof_file_id IS DISTINCT FROM OLD.proof_file_id OR
     NEW.proof_file_revision IS DISTINCT FROM OLD.proof_file_revision OR
     NEW.version<>OLD.version) THEN
  IF NOT(OLD.status='DRAFT' AND NEW.status='SUBMITTED' AND
    NEW.financial_year_id IS NOT DISTINCT FROM OLD.financial_year_id AND
    NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id AND
    NEW.voucher_type IS NOT DISTINCT FROM OLD.voucher_type AND
    NEW.posting_date IS NOT DISTINCT FROM OLD.posting_date AND
    NEW.payee_name IS NOT DISTINCT FROM OLD.payee_name AND
    NEW.purpose IS NOT DISTINCT FROM OLD.purpose AND
    NEW.gross_minor IS NOT DISTINCT FROM OLD.gross_minor AND
    NEW.tax_minor IS NOT DISTINCT FROM OLD.tax_minor AND
    NEW.charges_minor IS NOT DISTINCT FROM OLD.charges_minor AND
    NEW.total_minor IS NOT DISTINCT FROM OLD.total_minor AND
    NEW.debit_account_id IS NOT DISTINCT FROM OLD.debit_account_id AND
    NEW.credit_account_id IS NOT DISTINCT FROM OLD.credit_account_id AND
    NEW.payment_account_id IS NOT DISTINCT FROM OLD.payment_account_id AND
    NEW.version=OLD.version) THEN
   RAISE EXCEPTION 'Frozen submitted voucher facts cannot change' USING ERRCODE='P0907';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION cg09_reconciliation_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_account_kind text; bank_line_count bigint; bank_amount bigint; source_year uuid;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Bank reconciliation source cannot be deleted' USING ERRCODE='P0926';
 END IF;
 IF TG_OP='INSERT' THEN
  SELECT a.account_kind INTO v_account_kind FROM finance_account a
   WHERE a.id=NEW.bank_account_id AND a.root_realm_id=NEW.root_realm_id FOR SHARE;
  IF NOT FOUND OR v_account_kind<>'BANK' THEN
   RAISE EXCEPTION 'An actual bank account is required' USING ERRCODE='P0926';
  END IF;
  SELECT j.financial_year_id,COUNT(l.id),COALESCE(SUM(l.debit_minor-l.credit_minor),0)
   INTO source_year,bank_line_count,bank_amount
   FROM journal j JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id
   WHERE j.id=NEW.journal_id AND j.root_realm_id=NEW.root_realm_id
    AND j.status='POSTED' AND l.account_id=NEW.bank_account_id
   GROUP BY j.id,j.financial_year_id;
  IF NOT FOUND OR (bank_line_count<>1 AND NOT cg11_root_payroll_journal(NEW.root_realm_id,NEW.journal_id)) OR source_year<>NEW.financial_year_id OR
     bank_amount<>NEW.posted_amount_minor OR
     NEW.variance_minor<>NEW.statement_amount_minor-bank_amount THEN
    RAISE EXCEPTION 'Bank reconciliation must match exactly one posted bank line' USING ERRCODE='P0926';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id OR
    NEW.journal_id IS DISTINCT FROM OLD.journal_id OR
    NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id OR
    NEW.statement_date IS DISTINCT FROM OLD.statement_date OR
    NEW.bank_item_ref IS DISTINCT FROM OLD.bank_item_ref OR
    NEW.statement_amount_minor<>OLD.statement_amount_minor OR
    NEW.posted_amount_minor<>OLD.posted_amount_minor OR
    NEW.variance_minor<>OLD.variance_minor OR
    NEW.recorded_by IS DISTINCT FROM OLD.recorded_by OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.content_digest IS DISTINCT FROM OLD.content_digest OR
    NEW.recorded_at IS DISTINCT FROM OLD.recorded_at OR
    OLD.status<>'PENDING' OR NEW.status NOT IN('VERIFIED','REJECTED') OR
    NEW.verified_by IS NULL OR NEW.verified_at IS NULL THEN
  RAISE EXCEPTION 'A bank statement match cannot be rewritten' USING ERRCODE='P0926';
 END IF;
 PERFORM 1 FROM finance_reconciliation_decision d
 WHERE d.reconciliation_id=NEW.id AND d.root_realm_id=NEW.root_realm_id
   AND d.actor_ref=NEW.verified_by AND
   ((NEW.status='VERIFIED' AND d.action='VERIFY' AND NEW.variance_minor=0)
     OR(NEW.status='REJECTED' AND d.action='REJECT'))
   AND d.original_digest=NEW.content_digest
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'An independent signed bank reconciliation decision is required'
   USING ERRCODE='P0926';
 END IF;
 RETURN NEW;
END; $$;
