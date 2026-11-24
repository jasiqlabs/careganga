-- Require independently inspected transfer advice to match the pinned payroll recipient.
ALTER TABLE finance_voucher_payment_verification ADD COLUMN payroll_destination_fingerprint char(64)
 CHECK(payroll_destination_fingerprint IS NULL OR payroll_destination_fingerprint~'^[a-f0-9]{64}$');
CREATE FUNCTION cg09_guard_payroll_destination_verification() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE pinned char(64);
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.payroll_destination_fingerprint IS NOT NULL THEN RAISE EXCEPTION 'Independent review required' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT i.destination_fingerprint INTO pinned FROM payroll_payout_attempt t
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
 WHERE t.root_realm_id=NEW.root_realm_id AND t.voucher_ref=NEW.voucher_id;
 IF NEW.status='VERIFIED' AND pinned IS NOT NULL THEN
  IF NEW.payroll_destination_fingerprint IS DISTINCT FROM pinned THEN RAISE EXCEPTION 'Original recipient proof required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.payroll_destination_fingerprint IS NOT NULL THEN
  RAISE EXCEPTION 'Unexpected payroll recipient proof' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg09_payroll_destination_verify BEFORE INSERT OR UPDATE ON finance_voucher_payment_verification
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_payroll_destination_verification();
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
 EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal reversal ON reversal.root_realm_id=f.root_realm_id AND reversal.reversal_of_id=f.journal_id WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref) AS reversed
FROM payroll_payout_attempt t JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref
JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref;
