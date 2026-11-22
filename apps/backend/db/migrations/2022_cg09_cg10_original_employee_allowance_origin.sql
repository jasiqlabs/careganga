-- CG10 US005: extend the original CG09 claim, not a second reimbursement ledger.
ALTER TABLE expense_claim ADD COLUMN source_kind text NOT NULL DEFAULT 'GENERAL',
 ADD COLUMN hr_employee_id uuid, ADD COLUMN hr_assignment_id uuid, ADD COLUMN hr_branch_id uuid,
 ADD CONSTRAINT cg09_claim_origin_shape CHECK(
  (source_kind='GENERAL' AND num_nonnulls(hr_employee_id,hr_assignment_id,hr_branch_id)=0) OR
  (source_kind='HR_ALLOWANCE' AND num_nonnulls(hr_employee_id,hr_assignment_id,hr_branch_id)=3)),
 ADD CONSTRAINT cg09_claim_hr_employee_fk FOREIGN KEY(root_realm_id,hr_employee_id) REFERENCES hr_employee(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg09_claim_hr_assignment_fk FOREIGN KEY(root_realm_id,hr_assignment_id) REFERENCES hr_employment_assignment(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg09_claim_hr_branch_fk FOREIGN KEY(hr_branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg09_claim_hr_own ON expense_claim(root_realm_id,requested_by,hr_assignment_id,created_at DESC,id DESC)
 WHERE source_kind='HR_ALLOWANCE';
CREATE FUNCTION cg09_claim_hr_origin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.source_kind,NEW.hr_employee_id,NEW.hr_assignment_id,NEW.hr_branch_id)
   IS DISTINCT FROM (OLD.source_kind,OLD.hr_employee_id,OLD.hr_assignment_id,OLD.hr_branch_id)
  THEN RAISE EXCEPTION 'Original claim origin cannot change' USING ERRCODE='P0919'; END IF;
  -- Historic approved/submitted claims remain finance-owned after an employee exits.
  IF NOT (OLD.status='DRAFT' AND NEW.status='SUBMITTED' OR OLD.status='RETURNED' AND NEW.status='DRAFT') THEN RETURN NEW; END IF;
 END IF;
 IF NEW.source_kind='HR_ALLOWANCE' THEN
  PERFORM 1 FROM hr_employee e JOIN hr_employee_application p ON p.id=e.application_id AND p.root_realm_id=e.root_realm_id AND p.state='ACTIVE'
   JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   JOIN account ac ON ac.id=e.account_ref AND ac.realm_id=e.root_realm_id AND ac.status='ACTIVE'
   WHERE e.root_realm_id=NEW.root_realm_id AND e.id=NEW.hr_employee_id AND e.account_ref=NEW.requested_by
    AND e.status IN('ACTIVE','PROBATION') AND a.id=NEW.hr_assignment_id AND a.branch_ref=NEW.hr_branch_id
    AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
   FOR SHARE OF e,p,a,b,ac;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current approved HR allowance source required' USING ERRCODE='P0919'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_claim_hr_origin BEFORE INSERT OR UPDATE ON expense_claim
 FOR EACH ROW EXECUTE FUNCTION cg09_claim_hr_origin_guard();
