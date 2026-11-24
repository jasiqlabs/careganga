-- Bind the matching positive credit to the original return correction; no
-- new payout can proceed merely because an offsetting journal was posted.
CREATE FUNCTION cg11_guard_return_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE expected record;
BEGIN
 SELECT rev.payroll_return_bank_reference AS ref,t.amount_minor AS amount,b.payment_account_ref AS bank
 INTO expected
 FROM finance_manual_journal_reversal rev JOIN finance_voucher_posting fp ON fp.root_realm_id=rev.root_realm_id AND fp.journal_id=rev.original_journal_id
 JOIN payroll_payout_attempt t ON t.root_realm_id=fp.root_realm_id AND t.voucher_ref=fp.voucher_id
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref
 WHERE rev.root_realm_id=NEW.root_realm_id AND rev.reversal_journal_id=NEW.journal_id AND rev.payroll_return_bank_reference IS NOT NULL;
 IF FOUND AND (NEW.bank_account_id<>expected.bank OR NEW.statement_amount_minor<>expected.amount OR NEW.posted_amount_minor<>expected.amount OR NEW.variance_minor<>0 OR upper(btrim(NEW.bank_item_ref))<>expected.ref) THEN
  RAISE EXCEPTION 'Return requires the exact original bank credit' USING ERRCODE='P0926';
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg11_guard_return_bank_match BEFORE INSERT ON finance_bank_reconciliation FOR EACH ROW EXECUTE FUNCTION cg11_guard_return_reconciliation();
CREATE OR REPLACE FUNCTION cg19_payroll_event_matches(root uuid,event uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM cg19_payroll_event_outbox o JOIN payroll_line l ON l.root_realm_id=o.realm_id AND l.id=o.line_ref
 JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 JOIN cg03_case c ON c.realm_id=r.root_realm_id AND c.id=r.approval_case_ref AND c.status='OWNER_COMPLETED' AND c.case_kind='PAYROLL_RUN_RELEASE'
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=r.approved_decision_ref AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>r.creator
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN account a ON a.realm_id=e.root_realm_id AND a.id=e.account_ref AND a.status='ACTIVE'
 LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
 LEFT JOIN LATERAL(SELECT coalesce(sum(x.paid_minor),0) paid,coalesce(bool_or(x.reversed OR (x.attempt_status='POSTED' AND x.paid_minor<>x.amount_minor)),false) invalid FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true
 WHERE o.realm_id=root AND o.id=event AND o.recipient_ref=recipient AND e.account_ref=recipient AND e.status IN('ACTIVE','PROBATION')
 AND (SELECT count(*) FROM hr_employment_assignment h JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
 WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date))=1
 AND ((o.event_kind='GENERATED' AND o.source_key=l.id)
 OR (o.event_kind='RESEND' AND o.support_case_ref=o.source_key AND EXISTS(SELECT 1 FROM cg19_support_case sc WHERE sc.realm_id=o.realm_id AND sc.id=o.support_case_ref AND sc.source_channel='FOUNDATION_PUBLIC' AND sc.status<>'CLOSED' AND sc.receipt_expires_at>now()))
 OR (o.event_kind='PAID' AND o.source_key=l.id AND l.net_minor>0 AND p.paid=l.net_minor AND NOT p.invalid)
 OR (o.event_kind='FAILED' AND p.paid<l.net_minor AND EXISTS(SELECT 1 FROM payroll_attempt_outcome x WHERE x.root_realm_id=o.realm_id AND x.item_ref=i.id AND x.id=o.source_key AND x.attempt_status IN('FAILED_VERIFIED','RETURNED_VERIFIED')))
 OR (o.event_kind='DELAYED' AND o.source_key=l.id AND l.entitlement_state='RELEASE_ELIGIBLE' AND p.paid<l.net_minor AND r.tentative_payment_date IS NOT NULL AND r.tentative_payment_date<(now() AT TIME ZONE 'Asia/Kolkata')::date)))
$fn$;

CREATE OR REPLACE FUNCTION cg19_payroll_finance_event(root uuid,voucher uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key)
 SELECT l.root_realm_id,l.id,e.account_ref,'PAID',l.id
 FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN LATERAL(SELECT coalesce(sum(x.paid_minor),0) paid,coalesce(bool_or(x.reversed OR (x.attempt_status='POSTED' AND x.paid_minor<>x.amount_minor)),false) invalid FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true
 WHERE t.root_realm_id=root AND t.voucher_ref=voucher AND l.net_minor>0 AND p.paid=l.net_minor AND NOT p.invalid ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM pg_notify('cg19_payroll_committed',root::text); END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION cg19_payroll_reconciled_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v uuid;
BEGIN
 IF NEW.status='VERIFIED' AND OLD.status IS DISTINCT FROM NEW.status THEN
 SELECT f.voucher_id INTO v FROM finance_voucher_posting f WHERE f.root_realm_id=NEW.root_realm_id AND f.journal_id=NEW.journal_id;
 IF v IS NOT NULL THEN PERFORM cg19_payroll_finance_event(NEW.root_realm_id,v); END IF;
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key)
 SELECT l.root_realm_id,l.id,e.account_ref,'FAILED',t.id FROM finance_manual_journal_reversal rev
 JOIN finance_voucher_posting fp ON fp.root_realm_id=rev.root_realm_id AND fp.journal_id=rev.original_journal_id
 JOIN payroll_payout_attempt t ON t.root_realm_id=fp.root_realm_id AND t.voucher_ref=fp.voucher_id
 JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 WHERE rev.root_realm_id=NEW.root_realm_id AND rev.reversal_journal_id=NEW.journal_id AND cg11_verified_bank_return(t.root_realm_id,t.id)
 ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM pg_notify('cg19_payroll_committed',NEW.root_realm_id::text); END IF;
 END IF;RETURN NEW;
END; $fn$;
