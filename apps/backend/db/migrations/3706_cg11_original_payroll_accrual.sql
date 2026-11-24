-- CG11: one immutable link to the original CG09 balanced posting. No payroll ledger.
CREATE TABLE payroll_accrual(
 root_realm_id uuid NOT NULL,run_id uuid NOT NULL,decision_ref uuid NOT NULL,
 source_digest char(64) NOT NULL,request_digest char(64) NOT NULL,request_key uuid NOT NULL,
 journal_ref uuid NOT NULL,expense_ref uuid NOT NULL,payable_ref uuid NOT NULL,
 deduction_ref uuid,employer_ref uuid,statutory_ref uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,run_id),UNIQUE(root_realm_id,journal_ref),UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,run_id) REFERENCES payroll_run(root_realm_id,id),
 FOREIGN KEY(journal_ref,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(expense_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(payable_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(deduction_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(employer_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(statutory_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE FUNCTION cg11_guard_accrual() RETURNS trigger LANGUAGE plpgsql AS $cg11$
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
 IF EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=r.root_realm_id AND l.journal_id=NEW.journal_ref AND (l.branch_id IS DISTINCT FROM r.branch_ref OR NOT (l.account_id=ANY(array_remove(ARRAY[NEW.expense_ref,NEW.payable_ref,NEW.deduction_ref,NEW.employer_ref,NEW.statutory_ref],NULL)))))
 OR EXISTS(SELECT 1 FROM (VALUES (NEW.expense_ref,gross+employer,0::numeric,'EXPENSE'),(NEW.payable_ref,0::numeric,net,'LIABILITY'),(NEW.deduction_ref,0::numeric,deductions-statutory,'LIABILITY'),(NEW.employer_ref,0::numeric,employer,'LIABILITY'),(NEW.statutory_ref,0::numeric,statutory,'LIABILITY')) expected(ref,dr,cr,category)
 WHERE expected.ref IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM finance_account a JOIN account_group g ON g.root_realm_id=a.root_realm_id AND g.id=a.group_id WHERE a.root_realm_id=r.root_realm_id AND a.id=expected.ref AND a.account_kind='GENERAL' AND a.status='ACTIVE' AND g.category=expected.category)
 OR expected.dr<>(SELECT coalesce(sum(l.debit_minor),0) FROM journal_line l WHERE l.root_realm_id=r.root_realm_id AND l.journal_id=NEW.journal_ref AND l.account_id=expected.ref)
 OR expected.cr<>(SELECT coalesce(sum(l.credit_minor),0) FROM journal_line l WHERE l.root_realm_id=r.root_realm_id AND l.journal_id=NEW.journal_ref AND l.account_id=expected.ref)))
 THEN RAISE EXCEPTION 'Payroll accrual does not match original frozen obligations' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $cg11$;
CREATE TRIGGER cg11_accrual_guard BEFORE INSERT ON payroll_accrual FOR EACH ROW EXECUTE FUNCTION cg11_guard_accrual();
CREATE TRIGGER cg11_accrual_immutable BEFORE UPDATE OR DELETE ON payroll_accrual FOR EACH ROW EXECUTE FUNCTION cg11_audit_immutable();
