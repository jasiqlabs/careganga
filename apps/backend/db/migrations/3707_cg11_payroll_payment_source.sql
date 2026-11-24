-- CG11 payout source references only. CG09 owns voucher, verified proof and journal.
CREATE TABLE payroll_batch(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,run_id uuid NOT NULL,
 payment_account_ref uuid NOT NULL,method text NOT NULL CHECK(method IN('BANK','CASH')),
 created_by uuid NOT NULL,request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,run_id),UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,run_id) REFERENCES payroll_accrual(root_realm_id,run_id),
 FOREIGN KEY(payment_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TABLE payroll_batch_item(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,batch_ref uuid NOT NULL,line_ref uuid NOT NULL,
 destination_ref uuid,destination_revision integer,destination_fingerprint char(64),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,line_ref),
 FOREIGN KEY(root_realm_id,batch_ref) REFERENCES payroll_batch(root_realm_id,id),
 FOREIGN KEY(root_realm_id,line_ref) REFERENCES payroll_line(root_realm_id,id),
 FOREIGN KEY(root_realm_id,destination_ref) REFERENCES employee_payout_instruction(root_realm_id,id),
 CHECK(num_nonnulls(destination_ref,destination_revision,destination_fingerprint) IN(0,3))
);
CREATE TABLE payroll_payout_attempt(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,item_ref uuid NOT NULL,
 voucher_ref uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),request_key uuid NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,voucher_ref),UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,item_ref) REFERENCES payroll_batch_item(root_realm_id,id),
 FOREIGN KEY(voucher_ref,root_realm_id) REFERENCES finance_voucher(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE INDEX ix_cg11_attempt_item ON payroll_payout_attempt(root_realm_id,item_ref,created_at,id);
CREATE TRIGGER cg11_batch_immutable BEFORE UPDATE OR DELETE ON payroll_batch FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE TRIGGER cg11_batch_item_immutable BEFORE UPDATE OR DELETE ON payroll_batch_item FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
CREATE TRIGGER cg11_attempt_immutable BEFORE UPDATE OR DELETE ON payroll_payout_attempt FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
-- Every balance derives from current original CG09 verified payment and linked posting.
CREATE VIEW payroll_attempt_outcome AS
SELECT t.*,v.status AS voucher_status,v.voucher_number,v.version AS voucher_version,
 CASE WHEN v.status='POSTED' AND EXISTS(SELECT 1 FROM finance_voucher_payment_verification p
 WHERE p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref AND p.voucher_revision=v.version AND p.status='VERIFIED' AND p.amount_minor=t.amount_minor)
 AND EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal j ON j.root_realm_id=f.root_realm_id AND j.id=f.journal_id
 WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref AND f.voucher_revision=v.version AND j.source_ref=v.id
 AND NOT EXISTS(SELECT 1 FROM journal reversal WHERE reversal.root_realm_id=j.root_realm_id AND reversal.reversal_of_id=j.id))
 THEN t.amount_minor ELSE 0 END AS paid_minor,
 EXISTS(SELECT 1 FROM finance_voucher_posting f JOIN journal reversal ON reversal.root_realm_id=f.root_realm_id AND reversal.reversal_of_id=f.journal_id WHERE f.root_realm_id=t.root_realm_id AND f.voucher_id=t.voucher_ref) AS reversed
FROM payroll_payout_attempt t JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref;
CREATE FUNCTION cg11_batch_item_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
DECLARE b payroll_batch%ROWTYPE;l payroll_line%ROWTYPE;
BEGIN
 SELECT * INTO b FROM payroll_batch WHERE root_realm_id=NEW.root_realm_id AND id=NEW.batch_ref;
 SELECT * INTO l FROM payroll_line WHERE root_realm_id=NEW.root_realm_id AND id=NEW.line_ref;
 IF l.run_id IS DISTINCT FROM b.run_id OR l.entitlement_state<>'RELEASE_ELIGIBLE' OR l.net_minor<=0 OR
 (b.method='BANK' AND NOT EXISTS(SELECT 1 FROM employee_payout_instruction_effective p WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.destination_ref AND p.employee_ref=l.employee_ref AND p.revision=NEW.destination_revision AND p.destination_fingerprint=NEW.destination_fingerprint AND p.status='APPROVED' AND p.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (p.effective_until IS NULL OR p.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date))) OR
 (b.method='CASH' AND NEW.destination_ref IS NOT NULL)
 THEN RAISE EXCEPTION 'Original eligible payroll entitlement and destination required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_batch_item_check BEFORE INSERT ON payroll_batch_item FOR EACH ROW EXECUTE FUNCTION cg11_batch_item_guard();
CREATE FUNCTION cg11_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $cg11$
DECLARE i payroll_batch_item%ROWTYPE;b payroll_batch%ROWTYPE;l payroll_line%ROWTYPE;a payroll_accrual%ROWTYPE;r payroll_run%ROWTYPE; paid numeric;
BEGIN
 SELECT * INTO i FROM payroll_batch_item WHERE root_realm_id=NEW.root_realm_id AND id=NEW.item_ref FOR UPDATE;
 SELECT * INTO b FROM payroll_batch WHERE root_realm_id=NEW.root_realm_id AND id=i.batch_ref;
 SELECT * INTO l FROM payroll_line WHERE root_realm_id=NEW.root_realm_id AND id=i.line_ref;
 SELECT * INTO a FROM payroll_accrual WHERE root_realm_id=NEW.root_realm_id AND run_id=b.run_id;
 SELECT * INTO r FROM payroll_run WHERE root_realm_id=NEW.root_realm_id AND id=b.run_id;
 SELECT coalesce(sum(paid_minor),0) INTO paid FROM payroll_attempt_outcome WHERE root_realm_id=NEW.root_realm_id AND item_ref=i.id;
 IF EXISTS(SELECT 1 FROM payroll_attempt_outcome WHERE root_realm_id=NEW.root_realm_id AND item_ref=i.id AND (voucher_status NOT IN('POSTED','REJECTED') OR reversed OR (voucher_status='POSTED' AND paid_minor<>amount_minor)))
 OR paid+NEW.amount_minor>l.net_minor OR NOT EXISTS(SELECT 1 FROM finance_voucher v WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.voucher_ref AND v.status='DRAFT' AND v.version=1 AND v.voucher_type='PAYMENT' AND v.total_minor=NEW.amount_minor AND v.debit_account_id=a.payable_ref AND v.credit_account_id=b.payment_account_ref AND v.payment_account_id=b.payment_account_ref AND v.branch_id IS NOT DISTINCT FROM r.branch_ref)
 THEN RAISE EXCEPTION 'Original payout pending or remaining due exceeded' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_attempt_check BEFORE INSERT ON payroll_payout_attempt FOR EACH ROW EXECUTE FUNCTION cg11_attempt_guard();
-- Block generic finance editing or changed destinations before a new payment request.
CREATE FUNCTION cg11_guard_bound_voucher() RETURNS trigger LANGUAGE plpgsql AS $cg11$
DECLARE i payroll_batch_item%ROWTYPE;b payroll_batch%ROWTYPE;l payroll_line%ROWTYPE;
BEGIN
 SELECT item.* INTO i FROM payroll_payout_attempt t JOIN payroll_batch_item item ON item.root_realm_id=t.root_realm_id AND item.id=t.item_ref WHERE t.root_realm_id=OLD.root_realm_id AND t.voucher_ref=OLD.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NEW.version<>OLD.version OR (to_jsonb(NEW)-ARRAY['status','approval_case_id','proof_file_id','proof_file_revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','approval_case_id','proof_file_id','proof_file_revision','updated_at'])
 THEN RAISE EXCEPTION 'Payroll voucher financial source cannot change' USING ERRCODE='23514'; END IF;
 IF NEW.status='PAYMENT_REQUESTED' AND OLD.status='APPROVED' THEN
 SELECT * INTO b FROM payroll_batch WHERE root_realm_id=i.root_realm_id AND id=i.batch_ref;
 SELECT * INTO l FROM payroll_line WHERE root_realm_id=i.root_realm_id AND id=i.line_ref;
 PERFORM 1 FROM hr_employee WHERE root_realm_id=l.root_realm_id AND id=l.employee_ref FOR UPDATE;
 IF b.method='BANK' AND NOT EXISTS(SELECT 1 FROM employee_payout_instruction_effective p WHERE p.root_realm_id=i.root_realm_id AND p.id=i.destination_ref AND p.employee_ref=l.employee_ref AND p.status='APPROVED' AND p.revision=i.destination_revision AND p.destination_fingerprint=i.destination_fingerprint AND p.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (p.effective_until IS NULL OR p.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date))
 THEN RAISE EXCEPTION 'Pinned employee destination changed' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cash_bank_account c JOIN finance_account f ON f.root_realm_id=c.root_realm_id AND f.id=c.account_id WHERE c.root_realm_id=b.root_realm_id AND c.account_id=b.payment_account_ref AND c.status='ACTIVE' AND f.status='ACTIVE' AND f.account_kind=b.method)
 THEN RAISE EXCEPTION 'Original payout account unavailable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_bound_voucher_guard BEFORE UPDATE ON finance_voucher FOR EACH ROW EXECUTE FUNCTION cg11_guard_bound_voucher();
