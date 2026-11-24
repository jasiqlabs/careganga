-- Independently verified failed transfer is distinct from rejection of evidence.
ALTER TABLE finance_voucher_payment_verification ADD COLUMN payroll_failure_verified boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX ux_cg11_terminal_bank_reference ON finance_voucher_payment_verification(root_realm_id,bank_reference)
 WHERE method='BANK_STATEMENT' AND bank_reference IS NOT NULL AND (status IN('PENDING_REVIEW','VERIFIED') OR payroll_failure_verified);
CREATE UNIQUE INDEX ux_cg11_terminal_failed_voucher ON finance_voucher_payment_verification(root_realm_id,voucher_id) WHERE payroll_failure_verified;
CREATE OR REPLACE FUNCTION cg09_guard_payroll_destination_verification() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE pinned char(64);
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.payroll_destination_fingerprint IS NOT NULL OR NEW.payroll_failure_verified THEN RAISE EXCEPTION 'Independent review required' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM finance_voucher_payment_verification p WHERE p.root_realm_id=NEW.root_realm_id AND p.voucher_id=NEW.voucher_id AND p.payroll_failure_verified) THEN RAISE EXCEPTION 'Original failed transfer is terminal' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT i.destination_fingerprint INTO pinned FROM payroll_payout_attempt t
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
 WHERE t.root_realm_id=NEW.root_realm_id AND t.voucher_ref=NEW.voucher_id;
 IF NEW.payroll_failure_verified AND (NEW.status<>'REJECTED' OR pinned IS NULL OR NEW.method<>'BANK_STATEMENT') THEN RAISE EXCEPTION 'Verified original failed bank transfer required' USING ERRCODE='23514'; END IF;
 IF (NEW.status='VERIFIED' OR NEW.payroll_failure_verified) AND pinned IS NOT NULL THEN
  IF NEW.payroll_destination_fingerprint IS DISTINCT FROM pinned THEN RAISE EXCEPTION 'Original recipient proof required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.payroll_destination_fingerprint IS NOT NULL THEN
  RAISE EXCEPTION 'Unexpected payroll recipient proof' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $fn$;
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
 EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal reversal ON reversal.root_realm_id=f.root_realm_id AND reversal.reversal_of_id=f.journal_id WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref) AS reversed,
 CASE WHEN EXISTS(SELECT 1 FROM finance_voucher_payment_verification p WHERE p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref AND p.voucher_revision=v.version AND p.payroll_failure_verified AND p.payroll_destination_fingerprint=i.destination_fingerprint) THEN 'FAILED_VERIFIED' ELSE v.status END AS attempt_status
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
 IF EXISTS(SELECT 1 FROM payroll_attempt_outcome WHERE root_realm_id=NEW.root_realm_id AND item_ref=i.id AND (attempt_status NOT IN('POSTED','REJECTED','FAILED_VERIFIED') OR reversed OR (voucher_status='POSTED' AND paid_minor<>amount_minor)))
 OR paid+NEW.amount_minor>l.net_minor OR NOT EXISTS(SELECT 1 FROM finance_voucher v WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.voucher_ref AND v.status='DRAFT' AND v.version=1 AND v.voucher_type='PAYMENT' AND v.total_minor=NEW.amount_minor AND v.debit_account_id=a.payable_ref AND v.credit_account_id=b.payment_account_ref AND v.payment_account_id=b.payment_account_ref AND v.branch_id IS NOT DISTINCT FROM r.branch_ref)
 THEN RAISE EXCEPTION 'Original payout pending or remaining due exceeded' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
