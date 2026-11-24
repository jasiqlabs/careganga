-- CG11: actual bank settlement requires the exact original CG09 verified reconciliation, not only voucher proof or ACK.
-- Cash retains original independently verified receipt and posted journal.
CREATE OR REPLACE VIEW payroll_attempt_outcome AS
SELECT t.*,v.status AS voucher_status,v.voucher_number,v.version AS voucher_version,
 CASE WHEN v.status='POSTED' AND EXISTS(SELECT 1 FROM finance_voucher_payment_verification p
 WHERE p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref AND p.voucher_revision=v.version AND p.status='VERIFIED' AND p.amount_minor=t.amount_minor
 AND ((b.method='CASH' AND p.method='CASH_RECEIPT') OR (b.method='BANK' AND p.method='BANK_STATEMENT' AND EXISTS(
 SELECT 1 FROM finance_voucher_posting fp JOIN finance_bank_reconciliation br ON br.root_realm_id=fp.root_realm_id AND br.journal_id=fp.journal_id
 WHERE fp.root_realm_id=t.root_realm_id AND fp.voucher_id=t.voucher_ref AND fp.voucher_revision=v.version
 AND br.bank_account_id=b.payment_account_ref AND br.status='VERIFIED' AND br.variance_minor=0
 AND br.statement_amount_minor=-t.amount_minor AND br.posted_amount_minor=-t.amount_minor
 AND upper(btrim(br.bank_item_ref))=p.bank_reference))))
 AND EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal j ON j.root_realm_id=f.root_realm_id AND j.id=f.journal_id
 WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref AND f.voucher_revision=v.version AND j.source_ref=v.id AND j.status='POSTED'
 AND NOT EXISTS(SELECT 1 FROM journal reversal WHERE reversal.root_realm_id=j.root_realm_id AND reversal.reversal_of_id=j.id))
 THEN t.amount_minor ELSE 0 END AS paid_minor,
 EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal reversal ON reversal.root_realm_id=f.root_realm_id AND reversal.reversal_of_id=f.journal_id WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref) AS reversed
FROM payroll_payout_attempt t JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref
JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref;
