-- CG09 original bank funding and signing checks, independent of any external adapter.
-- Only independently verified incoming bank credits count; all posted outgoing
-- debits and outstanding requested/verified outgoing vouchers consume funds.
-- A ledger estimate is not an external bank balance or transfer authorization.
CREATE INDEX ix_cg11_bank_requested_funds ON finance_voucher(root_realm_id,payment_account_id,id)
 WHERE status IN('PAYMENT_REQUESTED','PAID_VERIFIED');
CREATE FUNCTION cg11_reconciled_bank_available(p_root uuid,p_account uuid,p_exclude uuid)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
 SELECT
 coalesce((SELECT sum(br.posted_amount_minor) FROM finance_bank_reconciliation br
 JOIN finance_reconciliation_decision d ON d.root_realm_id=br.root_realm_id AND d.reconciliation_id=br.id AND d.action='VERIFY'
 JOIN cg19_stored_file f ON f.realm_id=d.root_realm_id AND f.id=d.statement_file_id AND f.reconciliation_id=br.id AND f.revision=d.statement_file_version AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 JOIN cg19_upload_intent u ON u.realm_id=f.realm_id AND u.id=f.upload_intent_id AND u.status='VALIDATED'
 WHERE br.root_realm_id=p_root AND br.bank_account_id=p_account AND br.status='VERIFIED' AND br.variance_minor=0 AND br.posted_amount_minor>0),0)
 -coalesce((SELECT sum(l.credit_minor) FROM journal_line l JOIN journal j ON j.root_realm_id=l.root_realm_id AND j.id=l.journal_id AND j.status='POSTED' WHERE l.root_realm_id=p_root AND l.account_id=p_account),0)
 -coalesce((SELECT sum(v.total_minor) FROM finance_voucher v
 WHERE v.root_realm_id=p_root AND v.payment_account_id=p_account AND v.credit_account_id=p_account AND v.id<>p_exclude
 AND v.status IN('PAYMENT_REQUESTED','PAID_VERIFIED')
 AND NOT EXISTS(SELECT 1 FROM finance_voucher_payment_verification p WHERE p.root_realm_id=v.root_realm_id AND p.voucher_id=v.id AND p.voucher_revision=v.version AND p.payroll_failure_verified)),0)
$fn$;
CREATE FUNCTION cg11_guard_bank_release() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE b payroll_batch%ROWTYPE; t payroll_payout_attempt%ROWTYPE; signer uuid;
BEGIN
 IF OLD.status<>'APPROVED' OR NEW.status<>'PAYMENT_REQUESTED' THEN RETURN NEW; END IF;
 -- Serialize every original outgoing bank request on its genuine funding account;
 -- original journal posting also locks this account. No separate funds ledger.
 IF NEW.payment_account_id IS NOT NULL THEN
 PERFORM 1 FROM finance_account fa WHERE fa.root_realm_id=NEW.root_realm_id AND fa.id=NEW.payment_account_id AND fa.account_kind='BANK' FOR UPDATE;
 END IF;
 SELECT * INTO t FROM payroll_payout_attempt WHERE root_realm_id=NEW.root_realm_id AND voucher_ref=NEW.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT batch.* INTO b FROM payroll_batch_item i JOIN payroll_batch batch ON batch.root_realm_id=i.root_realm_id AND batch.id=i.batch_ref
 WHERE i.root_realm_id=t.root_realm_id AND i.id=t.item_ref;
 IF b.method<>'BANK' THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM finance_account a JOIN cash_bank_account c ON c.root_realm_id=a.root_realm_id AND c.account_id=a.id
 WHERE a.root_realm_id=t.root_realm_id AND a.id=b.payment_account_ref AND a.status='ACTIVE' AND c.status='ACTIVE' AND c.kind='BANK'
 AND (a.branch_id IS NULL OR a.branch_id=NEW.branch_id) AND NEW.payment_account_id=a.id AND NEW.credit_account_id=a.id)
 THEN RAISE EXCEPTION 'Original active bank account unavailable' USING ERRCODE='P0916'; END IF;
 SELECT d.actor_id INTO signer FROM cg03_case c
 JOIN cg03_finance_owner_effect e ON e.realm_id=c.realm_id AND e.case_id=c.id
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=e.final_decision_id
 JOIN account a ON a.realm_id=d.realm_id AND a.id=d.actor_id AND a.status='ACTIVE'
 WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.approval_case_id AND c.case_kind='FINANCE_VOUCHER' AND c.finance_voucher_id=NEW.id
 AND c.finance_voucher_revision=NEW.version AND c.status IN('PENDING_OWNER','OWNER_COMPLETED')
 AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>NEW.created_by
 AND EXISTS(SELECT 1 FROM account_role ar JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected
 WHERE ar.realm_id=a.realm_id AND ar.account_id=a.id AND ar.revoked_at IS NULL)
 FOR SHARE OF c,e,d,a;
 IF signer IS NULL THEN RAISE EXCEPTION 'Current independent payment signing authority required' USING ERRCODE='P0938'; END IF;
 IF cg11_reconciled_bank_available(NEW.root_realm_id,b.payment_account_ref,NEW.id)<NEW.total_minor
 THEN RAISE EXCEPTION 'Insufficient independently reconciled bank funds' USING ERRCODE='P0939'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_bank_release_guard BEFORE UPDATE ON finance_voucher FOR EACH ROW EXECUTE FUNCTION cg11_guard_bank_release();
