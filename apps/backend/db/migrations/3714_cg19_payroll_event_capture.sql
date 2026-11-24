-- Capture only committed original payroll approval and original verified financial outcomes.
CREATE TABLE cg19_payroll_event_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),realm_id uuid NOT NULL,line_ref uuid NOT NULL,
 recipient_ref uuid,event_kind text NOT NULL CHECK(event_kind IN('GENERATED','PAID','FAILED','DELAYED')),
 source_key uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),due_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','CAPTURED','SUPPRESSED','FAILED')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
 claim_token uuid,claimed_until timestamptz,doc_ref uuid,
 UNIQUE(realm_id,id),UNIQUE(realm_id,event_kind,source_key),
 FOREIGN KEY(realm_id,line_ref) REFERENCES payroll_line(root_realm_id,id),
 FOREIGN KEY(recipient_ref,realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(realm_id,doc_ref) REFERENCES cg19_payroll_payslip(root_realm_id,id),
 CHECK((claim_token IS NULL)=(claimed_until IS NULL)),CHECK(state='PENDING' OR claim_token IS NULL),
 CHECK(doc_ref IS NULL OR (state='CAPTURED' AND event_kind='GENERATED'))
);
CREATE INDEX ix_cg19_payroll_event_due ON cg19_payroll_event_outbox(due_at,id) WHERE state='PENDING';
CREATE FUNCTION cg19_payroll_event_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original payroll event retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','due_at','attempt_count','claim_token','claimed_until','doc_ref']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','due_at','attempt_count','claim_token','claimed_until','doc_ref']) OR OLD.state<>'PENDING' OR NEW.attempt_count<OLD.attempt_count THEN RAISE EXCEPTION 'Original payroll event immutable'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_payroll_event_immutable BEFORE UPDATE OR DELETE ON cg19_payroll_event_outbox FOR EACH ROW EXECUTE FUNCTION cg19_payroll_event_guard();
CREATE FUNCTION cg19_payroll_event_matches(root uuid,event uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM cg19_payroll_event_outbox o JOIN payroll_line l ON l.root_realm_id=o.realm_id AND l.id=o.line_ref
 JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 JOIN cg03_case c ON c.realm_id=r.root_realm_id AND c.id=r.approval_case_ref AND c.status='OWNER_COMPLETED' AND c.case_kind='PAYROLL_RUN_RELEASE'
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=r.approved_decision_ref AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>r.creator
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN account a ON a.realm_id=e.root_realm_id AND a.id=e.account_ref AND a.status='ACTIVE'
 LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
 LEFT JOIN LATERAL(SELECT coalesce(sum(x.paid_minor),0) paid,coalesce(bool_or(x.reversed OR (x.voucher_status='POSTED' AND x.paid_minor<>x.amount_minor)),false) invalid FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true
 WHERE o.realm_id=root AND o.id=event AND o.recipient_ref=recipient AND e.account_ref=recipient AND e.status IN('ACTIVE','PROBATION')
 AND (SELECT count(*) FROM hr_employment_assignment h JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
 WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date))=1
 AND ((o.event_kind='GENERATED' AND o.source_key=l.id)
 OR (o.event_kind='PAID' AND o.source_key=l.id AND l.net_minor>0 AND p.paid=l.net_minor AND NOT p.invalid)
 OR (o.event_kind='FAILED' AND p.paid<l.net_minor AND EXISTS(SELECT 1 FROM payroll_attempt_outcome x WHERE x.root_realm_id=o.realm_id AND x.item_ref=i.id AND x.id=o.source_key AND x.attempt_status='FAILED_VERIFIED'))
 OR (o.event_kind='DELAYED' AND o.source_key=l.id AND l.entitlement_state='RELEASE_ELIGIBLE' AND p.paid<l.net_minor AND r.tentative_payment_date IS NOT NULL AND r.tentative_payment_date<(now() AT TIME ZONE 'Asia/Kolkata')::date)))
$fn$;
CREATE FUNCTION cg19_payroll_run_events() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.status='APPROVED_FROZEN' AND OLD.status IS DISTINCT FROM NEW.status THEN
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key)
 SELECT l.root_realm_id,l.id,e.account_ref,'GENERATED',l.id FROM payroll_line l JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 WHERE l.root_realm_id=NEW.root_realm_id AND l.run_id=NEW.id ON CONFLICT DO NOTHING;
 IF NEW.tentative_payment_date IS NOT NULL THEN
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key,due_at)
 SELECT l.root_realm_id,l.id,e.account_ref,'DELAYED',l.id,greatest(now(),(NEW.tentative_payment_date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')
 FROM payroll_line l JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 WHERE l.root_realm_id=NEW.root_realm_id AND l.run_id=NEW.id AND l.entitlement_state='RELEASE_ELIGIBLE' AND l.net_minor>0 ON CONFLICT DO NOTHING;
 END IF;
 PERFORM pg_notify('cg19_payroll_committed',NEW.root_realm_id::text);
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_payroll_run_capture AFTER UPDATE ON payroll_run FOR EACH ROW EXECUTE FUNCTION cg19_payroll_run_events();
CREATE FUNCTION cg19_payroll_finance_event(root uuid,voucher uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key)
 SELECT l.root_realm_id,l.id,e.account_ref,'PAID',l.id
 FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
 JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN LATERAL(SELECT coalesce(sum(x.paid_minor),0) paid,coalesce(bool_or(x.reversed OR (x.voucher_status='POSTED' AND x.paid_minor<>x.amount_minor)),false) invalid FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true
 WHERE t.root_realm_id=root AND t.voucher_ref=voucher AND l.net_minor>0 AND p.paid=l.net_minor AND NOT p.invalid ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM pg_notify('cg19_payroll_committed',root::text); END IF;
END; $fn$;
CREATE FUNCTION cg19_payroll_posted_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN IF NEW.status='POSTED' AND OLD.status IS DISTINCT FROM NEW.status THEN PERFORM cg19_payroll_finance_event(NEW.root_realm_id,NEW.id); END IF;RETURN NEW;END; $fn$;
CREATE TRIGGER cg19_payroll_voucher_posted AFTER UPDATE ON finance_voucher FOR EACH ROW EXECUTE FUNCTION cg19_payroll_posted_capture();
CREATE FUNCTION cg19_payroll_reconciled_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v uuid;
BEGIN IF NEW.status='VERIFIED' AND OLD.status IS DISTINCT FROM NEW.status THEN
 SELECT f.voucher_id INTO v FROM finance_voucher_posting f WHERE f.root_realm_id=NEW.root_realm_id AND f.journal_id=NEW.journal_id;
 IF v IS NOT NULL THEN PERFORM cg19_payroll_finance_event(NEW.root_realm_id,v); END IF;
 END IF;RETURN NEW;END; $fn$;
CREATE TRIGGER cg19_payroll_bank_reconciled AFTER UPDATE ON finance_bank_reconciliation FOR EACH ROW EXECUTE FUNCTION cg19_payroll_reconciled_capture();
CREATE FUNCTION cg19_payroll_failed_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN IF NEW.payroll_failure_verified AND NOT OLD.payroll_failure_verified THEN
 INSERT INTO cg19_payroll_event_outbox(realm_id,line_ref,recipient_ref,event_kind,source_key)
 SELECT l.root_realm_id,l.id,e.account_ref,'FAILED',t.id FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 WHERE t.root_realm_id=NEW.root_realm_id AND t.voucher_ref=NEW.voucher_id ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM pg_notify('cg19_payroll_committed',NEW.root_realm_id::text); END IF;
 END IF;RETURN NEW;END; $fn$;
CREATE TRIGGER cg19_payroll_bank_failed AFTER UPDATE ON finance_voucher_payment_verification FOR EACH ROW EXECUTE FUNCTION cg19_payroll_failed_capture();
