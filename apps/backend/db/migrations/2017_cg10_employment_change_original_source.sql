-- US003: original effective employment change; no payroll or alternate approval master.
CREATE SEQUENCE hr_employment_change_seq;
CREATE TABLE hr_employment_change(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 reference text NOT NULL UNIQUE DEFAULT ('CG-HR-CHG-'||lpad(nextval('hr_employment_change_seq')::text,6,'0')),
 employee_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('TRANSFER','PROMOTION','DEPUTATION','RESIGNATION','EXIT')),
 prior_assignment_id uuid NOT NULL, prior_assignment_version integer NOT NULL CHECK(prior_assignment_version>0),
 prior_employee_version integer NOT NULL CHECK(prior_employee_version>0),
 proposed_branch_ref uuid, proposed_department_ref uuid, proposed_manager_ref uuid,
 proposed_designation text CHECK(length(btrim(proposed_designation)) BETWEEN 2 AND 120),
 target_account_ref uuid, expected_access_version bigint,
 proposed_role_ref uuid, expected_role_revision integer,
 effective_date date NOT NULL, last_working_date date,
 private_ciphertext text NOT NULL, private_nonce text NOT NULL, private_tag text NOT NULL,
 created_by uuid NOT NULL,
 request_key uuid NOT NULL, request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 last_command_key uuid NOT NULL,last_command_digest char(64) NOT NULL CHECK(last_command_digest ~ '^[0-9a-f]{64}$'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','WITHDRAWN','APPROVED_PENDING_EFFECT','APPLIED')),
 case_ref uuid,decision_ref uuid,cancel_event_ref uuid,new_assignment_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,applied_at timestamptz,
 CHECK(proposed_manager_ref IS NULL OR proposed_manager_ref<>employee_id),
 CHECK((target_account_ref IS NULL AND expected_access_version IS NULL AND proposed_role_ref IS NULL AND expected_role_revision IS NULL)
  OR (target_account_ref IS NOT NULL AND expected_access_version IS NOT NULL AND expected_access_version>0
   AND ((kind IN('RESIGNATION','EXIT') AND proposed_role_ref IS NULL AND expected_role_revision IS NULL)
   OR (kind IN('TRANSFER','PROMOTION','DEPUTATION') AND proposed_role_ref IS NOT NULL AND expected_role_revision IS NOT NULL AND expected_role_revision>0)))),
 CHECK((kind IN('TRANSFER','PROMOTION','DEPUTATION') AND proposed_branch_ref IS NOT NULL AND proposed_designation IS NOT NULL AND last_working_date IS NULL)
  OR (kind IN('RESIGNATION','EXIT') AND proposed_branch_ref IS NULL AND proposed_department_ref IS NULL
   AND proposed_manager_ref IS NULL AND proposed_designation IS NULL AND last_working_date IS NOT NULL AND last_working_date<effective_date)),
 CHECK((status='DRAFT' AND case_ref IS NULL AND decision_ref IS NULL AND cancel_event_ref IS NULL AND decided_at IS NULL AND applied_at IS NULL AND new_assignment_ref IS NULL)
  OR (status='SUBMITTED' AND case_ref IS NOT NULL AND decision_ref IS NULL AND cancel_event_ref IS NULL AND decided_at IS NULL AND applied_at IS NULL AND new_assignment_ref IS NULL)
  OR (status IN('RETURNED','REJECTED','APPROVED_PENDING_EFFECT') AND case_ref IS NOT NULL AND decision_ref IS NOT NULL
   AND cancel_event_ref IS NULL AND decided_at IS NOT NULL AND applied_at IS NULL AND new_assignment_ref IS NULL)
  OR (status='WITHDRAWN' AND case_ref IS NOT NULL AND decision_ref IS NULL AND cancel_event_ref IS NOT NULL AND decided_at IS NOT NULL AND applied_at IS NULL AND new_assignment_ref IS NULL)
  OR (status='APPLIED' AND case_ref IS NOT NULL AND decision_ref IS NOT NULL AND cancel_event_ref IS NULL AND decided_at IS NOT NULL AND applied_at IS NOT NULL
   AND ((kind IN('TRANSFER','PROMOTION','DEPUTATION') AND new_assignment_ref IS NOT NULL) OR (kind IN('RESIGNATION','EXIT') AND new_assignment_ref IS NULL)))),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,source_digest,revision),
 UNIQUE(root_realm_id,created_by,request_key),UNIQUE(root_realm_id,case_ref),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(prior_assignment_id,root_realm_id,employee_id) REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(new_assignment_ref,root_realm_id,employee_id) REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_department_ref,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_manager_ref,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(target_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_role_ref,root_realm_id) REFERENCES role(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_ref,case_ref,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(cancel_event_ref,case_ref,root_realm_id) REFERENCES cg03_case_event(id,case_id,realm_id) ON DELETE RESTRICT
);
-- One pending/approved effective operation per employee at once, to keep exit/transfer ordering deterministic.
CREATE UNIQUE INDEX ux_hr_change_one_inflight ON hr_employment_change(root_realm_id,employee_id)
 WHERE status IN('SUBMITTED','APPROVED_PENDING_EFFECT');
CREATE INDEX ix_hr_change_due ON hr_employment_change(effective_date,root_realm_id,id) WHERE status='APPROVED_PENDING_EFFECT';
CREATE INDEX ix_hr_change_employee_history ON hr_employment_change(root_realm_id,employee_id,created_at DESC,id);
CREATE INDEX ix_hr_change_creator_history ON hr_employment_change(root_realm_id,created_by,created_at DESC,id);
ALTER TABLE cg03_case ADD COLUMN hr_employment_change_id uuid,
 ADD COLUMN hr_employment_change_digest char(64),
 ADD CONSTRAINT fk_cg03_hr_employment_change_exact FOREIGN KEY(realm_id,hr_employment_change_id,hr_employment_change_digest,proposal_revision)
 REFERENCES hr_employment_change(root_realm_id,id,source_digest,revision) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_hr_employment_change_source ON cg03_case(realm_id,hr_employment_change_id)
 WHERE case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW');
CREATE UNIQUE INDEX ux_cg03_hr_employment_change_process ON cg03_process(realm_id,process_kind)
 WHERE process_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW');
CREATE INDEX ix_cg03_hr_employment_change_inbox ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id)
 WHERE case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW');

-- Preserve all previously delivered CG03 case families and their disjoint source constraints.
DO $migration$
DECLARE rec record; previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind IN (''HR_TRANSFER_PROMOTION'',''HR_EXIT_REVIEW'')'),
 ('cg03_case','cg03_case_kind_finance','case_kind IN (''HR_TRANSFER_PROMOTION'',''HR_EXIT_REVIEW'')'),
 ('cg03_case','cg03_case_status_check','status=''CANCELLED'' AND case_kind IN (''HR_TRANSFER_PROMOTION'',''HR_EXIT_REVIEW'')'),
 ('cg03_case','cg03_case_finance_source_disjoint',
  'case_kind IN (''HR_TRANSFER_PROMOTION'',''HR_EXIT_REVIEW'') AND hr_employment_change_id IS NOT NULL '||
  'AND hr_employment_change_digest IS NOT NULL AND proposal_digest=hr_employment_change_digest AND proposal_revision>0 '||
  'AND num_nonnulls(target_account_id,target_role_id,expected_access_version,expected_role_revision,'||
  'hr_application_id,hr_revision_id,hr_revision_no,hr_source_digest,hr_leave_request_id,hr_leave_source_digest,'||
  'hr_attendance_change_id,hr_attendance_change_digest,'||
  'health_provider_id,health_center_id,health_provider_revision_id,health_center_revision_id,'||
  'health_doctor_id,health_doctor_revision_id,health_content_revision_id,health_erp_revision_id,'||
  'health_revision_no,health_source_digest,cg15_exception_id,cg15_exception_revision,cg15_exception_digest,'||
  'cg16_price_id,cg16_price_version,cg16_price_digest,cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest,'||
  'cms_page_id,cms_page_revision_id,cms_revision_no,cms_content_digest,branch_source_ref,branch_source_revision,branch_source_digest,'||
  'finance_voucher_id,finance_voucher_revision,finance_voucher_digest,finance_proof_file_id,finance_proof_revision,'||
  'finance_claim_id,finance_claim_revision,finance_claim_digest,finance_claim_bill_id,finance_claim_bill_version,'||
  'finance_invoice_id,finance_invoice_revision,finance_invoice_digest,finance_budget_id,finance_budget_revision,finance_budget_digest)=0')
 ) v(table_name,constraint_name,additional)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c
   WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF previous IS NULL OR left(previous,1)<>'(' THEN RAISE EXCEPTION 'Original case constraint missing: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,previous,rec.additional);
 END LOOP;
END; $migration$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_hr_employment_change_only_source CHECK(
 (case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND hr_employment_change_id IS NOT NULL
  AND hr_employment_change_digest IS NOT NULL AND proposal_digest=hr_employment_change_digest)
 OR (case_kind NOT IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND hr_employment_change_id IS NULL AND hr_employment_change_digest IS NULL));
CREATE FUNCTION cg03_hr_employment_change_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (NEW.hr_employment_change_id,NEW.hr_employment_change_digest) IS DISTINCT FROM
  (OLD.hr_employment_change_id,OLD.hr_employment_change_digest) THEN RAISE EXCEPTION 'Original employment change proof cannot change'; END IF;
 IF OLD.case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND OLD.status='CANCELLED' AND NEW.status<>OLD.status
 THEN RAISE EXCEPTION 'Withdrawn employment case is terminal'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg03_hr_employment_change_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_hr_employment_change_frozen();

CREATE OR REPLACE FUNCTION cg03_leave_cancel_event_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.action='CANCELLED' AND NOT EXISTS(
  SELECT 1 FROM cg03_case c WHERE c.id=NEW.case_id AND c.realm_id=NEW.realm_id
   AND c.case_kind IN('LEAVE_REQUEST','HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND c.status='CANCELLED' AND c.proposer_id=NEW.actor_id
 ) THEN RAISE EXCEPTION 'Original own pending HR cancellation required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE OR REPLACE FUNCTION cg03_leave_cancel_effect_required() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.case_kind='LEAVE_REQUEST' AND NEW.status='CANCELLED' AND NOT EXISTS(
  SELECT 1 FROM hr_leave_request r JOIN cg03_case_event ev ON ev.id=r.cancel_event_ref AND ev.case_id=r.case_ref AND ev.realm_id=r.root_realm_id
   WHERE r.root_realm_id=NEW.realm_id AND r.id=NEW.hr_leave_request_id AND r.case_ref=NEW.id
   AND r.source_digest=NEW.hr_leave_source_digest AND r.status='CANCELLED' AND ev.action='CANCELLED' AND ev.actor_id=NEW.proposer_id
 ) THEN RAISE EXCEPTION 'Original leave cancellation source effect required'; END IF;
 IF NEW.case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND NEW.status='CANCELLED' AND NOT EXISTS(
  SELECT 1 FROM hr_employment_change r JOIN cg03_case_event ev ON ev.id=r.cancel_event_ref AND ev.case_id=r.case_ref AND ev.realm_id=r.root_realm_id
   WHERE r.root_realm_id=NEW.realm_id AND r.id=NEW.hr_employment_change_id AND r.case_ref=NEW.id
   AND r.source_digest=NEW.hr_employment_change_digest AND r.status='WITHDRAWN' AND ev.action='CANCELLED' AND ev.actor_id=NEW.proposer_id
 ) THEN RAISE EXCEPTION 'Original employment withdrawal source effect required'; END IF;
 RETURN NULL;
END; $fn$;

-- CG01 owns the actual role/session effect receipt.
CREATE TABLE cg01_hr_employment_effect(
 realm_id uuid NOT NULL,change_ref uuid NOT NULL,source_digest char(64) NOT NULL,source_revision integer NOT NULL,
 case_ref uuid NOT NULL,decision_ref uuid NOT NULL,target_account_ref uuid NOT NULL,approved_role_ref uuid,
 approved_role_revision integer,prior_access_version bigint NOT NULL,resulting_access_version bigint NOT NULL,
 reviewer_ref uuid NOT NULL,effect_kind text NOT NULL CHECK(effect_kind IN('EXIT','REASSIGN')),applied_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,change_ref),UNIQUE(realm_id,case_ref),UNIQUE(realm_id,decision_ref),
 CHECK(resulting_access_version=prior_access_version+1),
 CHECK((effect_kind='EXIT' AND approved_role_ref IS NULL AND approved_role_revision IS NULL)
  OR (effect_kind='REASSIGN' AND approved_role_ref IS NOT NULL AND approved_role_revision IS NOT NULL)),
 FOREIGN KEY(realm_id,change_ref,source_digest,source_revision) REFERENCES hr_employment_change(root_realm_id,id,source_digest,revision) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_ref,case_ref,realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(target_account_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_role_ref,realm_id) REFERENCES role(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg01_hr_employment_effect_immutable BEFORE UPDATE OR DELETE ON cg01_hr_employment_effect
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();

CREATE FUNCTION cg10_employment_change_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Employment change history cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.revision<>1 THEN RAISE EXCEPTION 'Employment change starts as draft'; END IF;
  RETURN NEW;
 END IF;
 IF (NEW.id,NEW.root_realm_id,NEW.reference,NEW.employee_id,NEW.kind,NEW.created_by,NEW.request_key,NEW.request_digest,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.reference,OLD.employee_id,OLD.kind,OLD.created_by,OLD.request_key,OLD.request_digest,OLD.created_at)
 THEN RAISE EXCEPTION 'Original employment change identity cannot change'; END IF;
 IF OLD.status='DRAFT' AND NEW.status='DRAFT' AND NEW.revision=OLD.revision+1 THEN RETURN NEW; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','case_ref','decision_ref','cancel_event_ref','new_assignment_ref','decided_at','applied_at','updated_at','last_command_key','last_command_digest'])
 IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','case_ref','decision_ref','cancel_event_ref','new_assignment_ref','decided_at','applied_at','updated_at','last_command_key','last_command_digest'])
 THEN RAISE EXCEPTION 'Submitted employment change evidence is frozen'; END IF;
 IF OLD.status='DRAFT' AND NEW.status='SUBMITTED' AND EXISTS(
  SELECT 1 FROM cg03_case c WHERE c.id=NEW.case_ref AND c.realm_id=NEW.root_realm_id AND c.hr_employment_change_id=NEW.id
   AND c.hr_employment_change_digest=NEW.source_digest AND c.proposal_revision=NEW.revision AND c.proposer_id=NEW.created_by
   AND c.status='SUBMITTED' AND c.case_kind=CASE WHEN NEW.kind IN('RESIGNATION','EXIT') THEN 'HR_EXIT_REVIEW' ELSE 'HR_TRANSFER_PROMOTION' END
 ) THEN RETURN NEW; END IF;
 IF NEW.case_ref IS DISTINCT FROM OLD.case_ref THEN RAISE EXCEPTION 'Original case cannot change'; END IF;
 IF OLD.status='SUBMITTED' AND NEW.status='WITHDRAWN' AND EXISTS(
  SELECT 1 FROM cg03_case c JOIN cg03_case_event ev ON ev.case_id=c.id AND ev.realm_id=c.realm_id
   WHERE c.id=NEW.case_ref AND c.realm_id=NEW.root_realm_id AND c.status='CANCELLED'
    AND c.hr_employment_change_id=NEW.id AND ev.id=NEW.cancel_event_ref AND ev.actor_id=NEW.created_by AND ev.action='CANCELLED'
 ) THEN RETURN NEW; END IF;
 IF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED_PENDING_EFFECT') AND EXISTS(
  SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
   JOIN hr_employee e ON e.id=NEW.employee_id AND e.root_realm_id=NEW.root_realm_id
   JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE'
   JOIN account_role ar ON ar.account_id=d.actor_id AND ar.realm_id=d.realm_id AND ar.revoked_at IS NULL
   JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected
   WHERE c.id=NEW.case_ref AND c.realm_id=NEW.root_realm_id AND c.hr_employment_change_id=NEW.id
    AND c.hr_employment_change_digest=NEW.source_digest AND c.proposal_revision=NEW.revision
    AND d.id=NEW.decision_ref AND d.actor_id<>NEW.created_by AND d.actor_id IS DISTINCT FROM e.account_ref
    AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
    AND ((NEW.status='APPROVED_PENDING_EFFECT' AND d.action='APPROVE' AND c.status='PENDING_OWNER')
     OR (NEW.status='RETURNED' AND d.action='RETURN' AND c.status='RETURNED')
     OR (NEW.status='REJECTED' AND d.action='REJECT' AND c.status='REJECTED'))
 ) THEN RETURN NEW; END IF;
 IF OLD.status='APPROVED_PENDING_EFFECT' AND NEW.status='APPLIED' AND NEW.decision_ref=OLD.decision_ref
  AND NEW.decided_at=OLD.decided_at AND NEW.effective_date<=CURRENT_DATE
  AND (NEW.target_account_ref IS NULL OR EXISTS(SELECT 1 FROM cg01_hr_employment_effect eff
   WHERE eff.realm_id=NEW.root_realm_id AND eff.change_ref=NEW.id AND eff.source_digest=NEW.source_digest
    AND eff.source_revision=NEW.revision AND eff.case_ref=NEW.case_ref AND eff.decision_ref=NEW.decision_ref
    AND eff.target_account_ref=NEW.target_account_ref AND eff.prior_access_version=NEW.expected_access_version
    AND eff.approved_role_ref IS NOT DISTINCT FROM NEW.proposed_role_ref
    AND eff.approved_role_revision IS NOT DISTINCT FROM NEW.expected_role_revision))
  AND EXISTS(
   SELECT 1 FROM hr_employment_assignment prior JOIN hr_employee e ON e.id=NEW.employee_id AND e.root_realm_id=NEW.root_realm_id
    WHERE prior.id=NEW.prior_assignment_id AND prior.root_realm_id=NEW.root_realm_id AND prior.employee_id=e.id
    AND prior.valid_to=NEW.effective_date AND prior.assignment_version=NEW.prior_assignment_version+1
    AND e.status_version=NEW.prior_employee_version+1 AND (
     (NEW.kind IN('RESIGNATION','EXIT') AND e.status='EXITED' AND NOT EXISTS(SELECT 1 FROM hr_employment_assignment a
       WHERE a.root_realm_id=e.root_realm_id AND a.employee_id=e.id AND a.valid_to IS NULL))
     OR (NEW.kind IN('TRANSFER','PROMOTION','DEPUTATION') AND e.status IN('ACTIVE','PROBATION') AND EXISTS(
      SELECT 1 FROM hr_employment_assignment a WHERE a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
      AND a.id=NEW.new_assignment_ref AND a.valid_from=NEW.effective_date AND a.valid_to IS NULL
      AND a.branch_ref=NEW.proposed_branch_ref AND a.department_ref IS NOT DISTINCT FROM NEW.proposed_department_ref
      AND a.manager_employee_ref IS NOT DISTINCT FROM NEW.proposed_manager_ref AND a.designation=NEW.proposed_designation)))
  ) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Matching original employment decision/effect required';
END; $fn$;
CREATE TRIGGER cg10_employment_change_guard BEFORE INSERT OR UPDATE OR DELETE ON hr_employment_change
 FOR EACH ROW EXECUTE FUNCTION cg10_employment_change_guard();

-- All assignment writers serialize on the real employee; no overlapping historical intervals.
CREATE INDEX ix_hr_assignment_employee_range ON hr_employment_assignment(root_realm_id,employee_id,valid_from,valid_to);
CREATE FUNCTION cg10_assignment_no_overlap() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 PERFORM id FROM hr_employee WHERE root_realm_id=NEW.root_realm_id AND id=NEW.employee_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM hr_employment_assignment a WHERE a.root_realm_id=NEW.root_realm_id
  AND a.employee_id=NEW.employee_id AND a.id<>NEW.id
  AND daterange(a.valid_from,a.valid_to,'[)') && daterange(NEW.valid_from,NEW.valid_to,'[)'))
 THEN RAISE EXCEPTION 'Employee assignment intervals overlap'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg10_assignment_no_overlap BEFORE INSERT OR UPDATE OF valid_from,valid_to,employee_id,root_realm_id
 ON hr_employment_assignment FOR EACH ROW EXECUTE FUNCTION cg10_assignment_no_overlap();

-- Clearance entries represent HR evidence only; money stays not verified until true finance/payroll owners exist.
CREATE TABLE hr_exit_clearance(
 root_realm_id uuid NOT NULL,change_id uuid NOT NULL,
 clearance_kind text NOT NULL CHECK(clearance_kind IN('HR','ASSETS','HANDOVER')),
 verified_by uuid NOT NULL, evidence_note_ciphertext text NOT NULL, evidence_note_nonce text NOT NULL,evidence_note_tag text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,change_id,clearance_kind),
 FOREIGN KEY(root_realm_id,change_id) REFERENCES hr_employment_change(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg10_exit_clearance_immutable BEFORE UPDATE OR DELETE ON hr_exit_clearance FOR EACH ROW EXECUTE FUNCTION cg03_immutable();

ALTER TABLE hr_audit DROP CONSTRAINT hr_audit_action_check;
ALTER TABLE hr_audit ADD CONSTRAINT hr_audit_action_check CHECK(action IN(
 'DRAFT_CREATED','DRAFT_UPDATED','SUBMITTED','RETURNED','REJECTED','ACTIVATED','PENDING_ACCESS','ACCESS_CONFIRMED',
 'LEAVE_PRIVATE_READ','ATTENDANCE_CORRECTION_PRIVATE_READ','APPRAISAL_DRAFT_CREATED','APPRAISAL_DRAFT_UPDATED',
 'APPRAISAL_SUBMITTED','APPRAISAL_RELEASED','APPRAISAL_PRIVATE_READ','EMPLOYMENT_CHANGE_PRIVATE_READ',
 'EMPLOYMENT_CHANGE_DRAFT','EMPLOYMENT_CHANGE_EDITED','EMPLOYMENT_CHANGE_SUBMITTED','EMPLOYMENT_CHANGE_APPROVED',
 'EMPLOYMENT_CHANGE_RETURNED','EMPLOYMENT_CHANGE_REJECTED','EMPLOYMENT_CHANGE_WITHDRAWN','EMPLOYMENT_CHANGE_APPLIED','EXIT_CLEARANCE_RECORDED'));
