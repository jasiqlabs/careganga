-- Original bank-return correction: independent protected reviewer, exact inverse of original
-- settled payroll journal, then verified matching positive bank reconciliation.
ALTER TABLE finance_manual_journal_reversal ADD COLUMN payroll_return_bank_reference text
 CHECK(payroll_return_bank_reference IS NULL OR payroll_return_bank_reference ~ '^[A-Z0-9 /._-]{6,64}$');
CREATE UNIQUE INDEX ux_cg11_original_return_reference ON finance_manual_journal_reversal(root_realm_id,payroll_return_bank_reference) WHERE payroll_return_bank_reference IS NOT NULL;
CREATE FUNCTION cg11_original_settled_bank_journal(p_root uuid,p_journal uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(
 SELECT 1 FROM finance_voucher_posting fp JOIN finance_voucher v ON v.root_realm_id=fp.root_realm_id AND v.id=fp.voucher_id AND v.version=fp.voucher_revision
 JOIN payroll_payout_attempt t ON t.root_realm_id=v.root_realm_id AND t.voucher_ref=v.id
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
 JOIN finance_voucher_payment_verification p ON p.root_realm_id=v.root_realm_id AND p.voucher_id=v.id AND p.voucher_revision=v.version
 JOIN finance_bank_reconciliation br ON br.root_realm_id=fp.root_realm_id AND br.journal_id=fp.journal_id
 JOIN finance_reconciliation_decision d ON d.root_realm_id=br.root_realm_id AND d.reconciliation_id=br.id AND d.action='VERIFY'
 WHERE fp.root_realm_id=p_root AND fp.journal_id=p_journal AND v.status='POSTED'
 AND p.status='VERIFIED' AND p.method='BANK_STATEMENT' AND p.amount_minor=t.amount_minor AND p.payroll_destination_fingerprint=i.destination_fingerprint
 AND br.bank_account_id=b.payment_account_ref AND br.status='VERIFIED' AND br.variance_minor=0
 AND br.statement_amount_minor=-t.amount_minor AND br.posted_amount_minor=-t.amount_minor AND upper(btrim(br.bank_item_ref))=p.bank_reference
 AND d.statement_file_id IS NOT NULL)
$fn$;
CREATE FUNCTION cg11_verified_bank_return(p_root uuid,p_attempt uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM payroll_payout_attempt t
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
 JOIN finance_voucher_posting fp ON fp.root_realm_id=t.root_realm_id AND fp.voucher_id=t.voucher_ref
 JOIN finance_manual_journal_reversal rev ON rev.root_realm_id=fp.root_realm_id AND rev.original_journal_id=fp.journal_id
 JOIN finance_bank_reconciliation br ON br.root_realm_id=rev.root_realm_id AND br.journal_id=rev.reversal_journal_id
 JOIN finance_reconciliation_decision d ON d.root_realm_id=br.root_realm_id AND d.reconciliation_id=br.id AND d.action='VERIFY'
 WHERE t.root_realm_id=p_root AND t.id=p_attempt AND rev.payroll_return_bank_reference IS NOT NULL
 AND br.status='VERIFIED' AND br.bank_account_id=b.payment_account_ref AND br.variance_minor=0
 AND br.statement_amount_minor=t.amount_minor AND br.posted_amount_minor=t.amount_minor
 AND upper(btrim(br.bank_item_ref))=rev.payroll_return_bank_reference AND d.statement_file_id IS NOT NULL
 AND cg11_original_settled_bank_journal(t.root_realm_id,fp.journal_id))
$fn$;

CREATE OR REPLACE FUNCTION cg09_verify_manual_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original record; changed record; o record; r record; mismatch integer;
BEGIN
 SELECT posting_kind,source_ref,immutable_source_event_key,created_by,
  immutable_payload_digest,status
  INTO original FROM journal
  WHERE id=NEW.original_journal_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 SELECT posting_kind,reversal_of_id,source_ref,created_by,status
  INTO changed FROM journal
  WHERE id=NEW.reversal_journal_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF original.status<>'POSTED' OR
  NOT ((original.posting_kind='GENERAL' AND original.source_ref=original.immutable_source_event_key AND NEW.payroll_return_bank_reference IS NULL)
   OR (original.posting_kind='VOUCHER' AND NEW.payroll_return_bank_reference IS NOT NULL
    AND cg11_original_settled_bank_journal(NEW.root_realm_id,NEW.original_journal_id)
    AND NOT EXISTS(SELECT 1 FROM finance_bank_reconciliation br WHERE br.root_realm_id=NEW.root_realm_id AND br.journal_id=NEW.original_journal_id AND upper(btrim(br.bank_item_ref))=NEW.payroll_return_bank_reference)))
  OR original.created_by=NEW.reviewer_id
  OR changed.posting_kind<>'REVERSAL' OR changed.status<>'POSTED'
  OR changed.reversal_of_id<>NEW.original_journal_id
  OR changed.source_ref<>NEW.original_journal_id
  OR changed.created_by<>NEW.reviewer_id
  OR NEW.password_verified_at>NEW.created_at+interval '1 minute'
  OR NEW.password_verified_at<NEW.created_at-interval '5 minutes' THEN
  RAISE EXCEPTION 'Original manual journal and distinct reviewer proof required'
   USING ERRCODE='P0929';
 END IF;
 -- Compare actual reversal balances BY account and real branch and number of
 -- lines; aggregate equality rejects hidden positive or negative extra legs.
 WITH prior AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS debits,SUM(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.original_journal_id GROUP BY account_id,branch_id
 ), after AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS debits,SUM(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.reversal_journal_id GROUP BY account_id,branch_id
 )
 SELECT COUNT(*) INTO mismatch FROM prior p FULL OUTER JOIN after a
  ON a.account_id=p.account_id
  AND a.branch_id IS NOT DISTINCT FROM p.branch_id
 WHERE p.account_id IS NULL OR a.account_id IS NULL OR p.n<>a.n
  OR p.debits<>a.credits OR p.credits<>a.debits;
 IF mismatch<>0 THEN
  RAISE EXCEPTION 'A correction must reverse the exact original double entry'
   USING ERRCODE='P0929';
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION cg11_root_payroll_journal(p_root uuid,p_journal uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM finance_voucher_posting p JOIN payroll_payout_attempt t ON t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id
 JOIN finance_voucher v ON v.root_realm_id=p.root_realm_id AND v.id=p.voucher_id
 WHERE p.root_realm_id=p_root AND v.branch_id IS NULL AND (p.journal_id=p_journal OR EXISTS(SELECT 1 FROM finance_manual_journal_reversal rev WHERE rev.root_realm_id=p.root_realm_id AND rev.original_journal_id=p.journal_id AND rev.reversal_journal_id=p_journal AND rev.payroll_return_bank_reference IS NOT NULL)))
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
 UNION ALL SELECT 1 FROM finance_manual_journal_reversal rev WHERE rev.root_realm_id=r AND rev.reversal_journal_id=v_journal AND rev.payroll_return_bank_reference IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Finance journal branch and account scope do not match' USING ERRCODE='P0904';
 END IF;
 IF EXISTS(SELECT 1 FROM payroll_accrual a WHERE a.root_realm_id=r AND a.journal_ref=v_journal
 UNION ALL SELECT 1 FROM finance_voucher_posting p JOIN payroll_payout_attempt t ON t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id WHERE p.root_realm_id=r AND p.journal_id=v_journal
 UNION ALL SELECT 1 FROM finance_manual_journal_reversal rev WHERE rev.root_realm_id=r AND rev.reversal_journal_id=v_journal AND rev.payroll_return_bank_reference IS NOT NULL)
 AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=r AND l.journal_id=v_journal GROUP BY l.branch_id HAVING sum(l.debit_minor)<>sum(l.credit_minor))
 THEN RAISE EXCEPTION 'Payroll branch posting must balance' USING ERRCODE='P0903'; END IF;
 IF line_count<2 OR total_debit<=0 OR total_debit<>total_credit THEN
   RAISE EXCEPTION 'Unbalanced posted journal' USING ERRCODE='P0903'; END IF;
 RETURN NULL;
END; $$;

CREATE OR REPLACE VIEW payroll_attempt_outcome AS
SELECT t.*,v.status AS voucher_status,v.voucher_number,v.version AS voucher_version,
 CASE WHEN v.status='POSTED' AND EXISTS(SELECT 1 FROM finance_voucher_payment_verification p
 WHERE p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref AND p.voucher_revision=v.version AND p.status='VERIFIED' AND p.amount_minor=t.amount_minor
 AND ((b.method='CASH' AND p.method='CASH_RECEIPT') OR (b.method='BANK' AND p.method='BANK_STATEMENT' AND p.payroll_destination_fingerprint=i.destination_fingerprint AND EXISTS(
 SELECT 1 FROM finance_voucher_posting fp JOIN finance_bank_reconciliation br ON br.root_realm_id=fp.root_realm_id AND br.journal_id=fp.journal_id
 WHERE fp.root_realm_id=t.root_realm_id AND fp.voucher_id=t.voucher_ref AND fp.voucher_revision=v.version
 AND br.bank_account_id=b.payment_account_ref AND br.status='VERIFIED' AND br.variance_minor=0
 AND br.statement_amount_minor=-t.amount_minor AND br.posted_amount_minor=-t.amount_minor
 AND upper(btrim(br.bank_item_ref))=p.bank_reference))))
 AND EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal j ON j.root_realm_id=f.root_realm_id AND j.id=f.journal_id
 WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref AND f.voucher_revision=v.version AND j.source_ref=v.id AND j.status='POSTED'
 AND NOT EXISTS(SELECT 1 FROM journal reversal WHERE reversal.root_realm_id=j.root_realm_id AND reversal.reversal_of_id=j.id))
 THEN t.amount_minor ELSE 0 END AS paid_minor,
 EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal reversal ON reversal.root_realm_id=f.root_realm_id AND reversal.reversal_of_id=f.journal_id WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref) AND NOT cg11_verified_bank_return(t.root_realm_id,t.id) AS reversed,
 CASE WHEN cg11_verified_bank_return(t.root_realm_id,t.id) THEN 'RETURNED_VERIFIED' WHEN EXISTS(SELECT 1 FROM finance_voucher_payment_verification p WHERE p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref AND p.voucher_revision=v.version AND p.payroll_failure_verified AND p.payroll_destination_fingerprint=i.destination_fingerprint) THEN 'FAILED_VERIFIED' ELSE v.status END AS attempt_status
FROM payroll_payout_attempt t JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref
JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref;

CREATE OR REPLACE FUNCTION cg11_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
DECLARE i payroll_batch_item%ROWTYPE;b payroll_batch%ROWTYPE;l payroll_line%ROWTYPE;a payroll_accrual%ROWTYPE;r payroll_run%ROWTYPE; paid numeric;
BEGIN
 SELECT * INTO i FROM payroll_batch_item WHERE root_realm_id=NEW.root_realm_id AND id=NEW.item_ref FOR UPDATE;
 SELECT * INTO b FROM payroll_batch WHERE root_realm_id=NEW.root_realm_id AND id=i.batch_ref;
 SELECT * INTO l FROM payroll_line WHERE root_realm_id=NEW.root_realm_id AND id=i.line_ref;
 SELECT * INTO a FROM payroll_accrual WHERE root_realm_id=NEW.root_realm_id AND run_id=b.run_id;
 SELECT * INTO r FROM payroll_run WHERE root_realm_id=NEW.root_realm_id AND id=b.run_id;
 SELECT coalesce(sum(paid_minor),0) INTO paid FROM payroll_attempt_outcome WHERE root_realm_id=NEW.root_realm_id AND item_ref=i.id;
 IF EXISTS(SELECT 1 FROM payroll_attempt_outcome WHERE root_realm_id=NEW.root_realm_id AND item_ref=i.id AND (attempt_status NOT IN('POSTED','REJECTED','FAILED_VERIFIED','RETURNED_VERIFIED') OR reversed OR (attempt_status='POSTED' AND paid_minor<>amount_minor)))
 OR paid+NEW.amount_minor>l.net_minor OR NOT EXISTS(SELECT 1 FROM finance_voucher v WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.voucher_ref AND v.status='DRAFT' AND v.version=1 AND v.voucher_type='PAYMENT' AND v.total_minor=NEW.amount_minor AND v.debit_account_id=a.payable_ref AND v.credit_account_id=b.payment_account_ref AND v.payment_account_id=b.payment_account_ref AND v.branch_id IS NOT DISTINCT FROM r.branch_ref)
 THEN RAISE EXCEPTION 'Original payout pending or remaining due exceeded' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
