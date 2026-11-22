-- US002: frozen original attendance correction and actual CG03 review.
-- Leave is never reversed by a punch correction.
ALTER TABLE hr_attendance_day DROP CONSTRAINT ck_hr_attendance_punch_or_leave;
ALTER TABLE hr_attendance_day ADD CONSTRAINT ck_hr_attendance_punch_or_leave CHECK(
 status IN('PRESENT','LATE','LEAVE','HALF_DAY_LEAVE','ABSENT','WEEKLY_OFF') AND (
 (status IN('PRESENT','LATE') AND checked_in_at IS NOT NULL AND (leave_half_days IS NULL OR leave_half_days=1))
 OR (status='LEAVE' AND leave_half_days IS NOT NULL AND leave_half_days=2 AND checked_in_at IS NULL AND checked_out_at IS NULL AND worked_minutes IS NULL)
 OR (status='HALF_DAY_LEAVE' AND leave_half_days IS NOT NULL AND leave_half_days=1 AND checked_in_at IS NULL AND checked_out_at IS NULL AND worked_minutes IS NULL)
 OR (status IN('ABSENT','WEEKLY_OFF') AND leave_request_id IS NULL AND leave_half_days IS NULL AND
     checked_in_at IS NULL AND checked_out_at IS NULL AND worked_minutes IS NULL)));

CREATE TABLE hr_attendance_change(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 attendance_day_id uuid NOT NULL,
 expected_version integer NOT NULL CHECK(expected_version>0),
 original_snapshot jsonb NOT NULL CHECK(jsonb_typeof(original_snapshot)='object'),
 proposed_snapshot jsonb NOT NULL CHECK(jsonb_typeof(proposed_snapshot)='object'),
 reason_ciphertext text NOT NULL,
 reason_nonce text NOT NULL,
 reason_tag text NOT NULL,
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 decision_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,source_digest),
 UNIQUE(root_realm_id,submitted_by,request_key),UNIQUE(root_realm_id,case_ref),
 FOREIGN KEY(attendance_day_id,root_realm_id,employee_id) REFERENCES hr_attendance_day(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_ref,case_ref,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
 CHECK((status='SUBMITTED' AND decision_ref IS NULL AND decided_at IS NULL) OR
  (status<>'SUBMITTED' AND case_ref IS NOT NULL AND decision_ref IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_hr_correction_applied_version ON hr_attendance_change(root_realm_id,attendance_day_id,expected_version)
 WHERE status='APPROVED';
CREATE INDEX ix_hr_correction_employee ON hr_attendance_change(root_realm_id,employee_id,submitted_at DESC,id DESC);
CREATE INDEX ix_hr_correction_review ON hr_attendance_change(root_realm_id,status,submitted_at DESC,id DESC);

ALTER TABLE cg03_case ADD COLUMN hr_attendance_change_id uuid,
 ADD COLUMN hr_attendance_change_digest char(64),
 ADD CONSTRAINT fk_cg03_hr_attendance_change_exact FOREIGN KEY(realm_id,hr_attendance_change_id,hr_attendance_change_digest)
 REFERENCES hr_attendance_change(root_realm_id,id,source_digest) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg03_hr_correction_source ON cg03_case(realm_id,hr_attendance_change_id) WHERE case_kind='ATTENDANCE_CORRECTION';
CREATE UNIQUE INDEX ux_cg03_hr_correction_process ON cg03_process(realm_id) WHERE process_kind='ATTENDANCE_CORRECTION';
CREATE INDEX ix_cg03_hr_correction_inbox ON cg03_case(realm_id,status,submitted_at DESC,id DESC) WHERE case_kind='ATTENDANCE_CORRECTION';
DO $migration$
DECLARE rec record; original_sql text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg03_process','cg03_process_kind_finance','process_kind = ''ATTENDANCE_CORRECTION'''),
 ('cg03_case','cg03_case_kind_finance','case_kind = ''ATTENDANCE_CORRECTION'''),
 ('cg03_case','cg03_case_finance_source_disjoint',
  'case_kind = ''ATTENDANCE_CORRECTION'' AND hr_attendance_change_id IS NOT NULL '||
  'AND hr_attendance_change_digest IS NOT NULL AND proposal_digest=hr_attendance_change_digest AND proposal_revision>0 '||
  'AND num_nonnulls(target_account_id,target_role_id,expected_access_version,expected_role_revision,'||
  'hr_application_id,hr_revision_id,hr_revision_no,hr_source_digest,hr_leave_request_id,hr_leave_source_digest,'||
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
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO original_sql
   FROM pg_constraint c WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF original_sql IS NULL OR left(original_sql,1)<>'(' THEN
   RAISE EXCEPTION 'Original approval constraint unavailable: %',rec.constraint_name;
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',
    rec.table_name,rec.constraint_name,original_sql,rec.additional);
 END LOOP;
END; $migration$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_hr_attendance_change_only_source CHECK(
 (case_kind='ATTENDANCE_CORRECTION' AND hr_attendance_change_id IS NOT NULL AND hr_attendance_change_digest IS NOT NULL
  AND proposal_digest=hr_attendance_change_digest)
 OR (case_kind<>'ATTENDANCE_CORRECTION' AND hr_attendance_change_id IS NULL AND hr_attendance_change_digest IS NULL));
CREATE FUNCTION cg03_hr_correction_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF (NEW.hr_attendance_change_id,NEW.hr_attendance_change_digest) IS DISTINCT FROM
    (OLD.hr_attendance_change_id,OLD.hr_attendance_change_digest) THEN
  RAISE EXCEPTION 'Original correction source cannot be changed';
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg03_hr_correction_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_hr_correction_frozen();
CREATE FUNCTION cg10_correction_frozen() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original attendance correction cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'SUBMITTED' OR NEW.case_ref IS NOT NULL OR NEW.decision_ref IS NOT NULL THEN
   RAISE EXCEPTION 'Correction must begin as a submission';
  END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['case_ref','status','decision_ref','decided_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['case_ref','status','decision_ref','decided_at']) THEN
  RAISE EXCEPTION 'Frozen correction evidence cannot be rewritten';
 END IF;
 IF OLD.status='SUBMITTED' AND OLD.case_ref IS NULL AND NEW.status='SUBMITTED'
 AND NEW.case_ref IS NOT NULL AND NEW.decision_ref IS NULL AND EXISTS(
  SELECT 1 FROM cg03_case c WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.case_ref AND c.case_kind='ATTENDANCE_CORRECTION'
   AND c.hr_attendance_change_id=NEW.id AND c.hr_attendance_change_digest=NEW.source_digest
   AND c.proposal_revision=NEW.expected_version AND c.proposer_id=NEW.submitted_by
 ) THEN RETURN NEW; END IF;
 IF OLD.status='SUBMITTED' AND OLD.case_ref IS NOT NULL AND NEW.case_ref=OLD.case_ref
  AND NEW.status IN('APPROVED','RETURNED','REJECTED') AND EXISTS(
   SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
   JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE'
   JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL
   JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected
   JOIN hr_employee e ON e.id=NEW.employee_id AND e.root_realm_id=NEW.root_realm_id
   WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.case_ref AND c.case_kind='ATTENDANCE_CORRECTION'
    AND c.hr_attendance_change_id=NEW.id AND c.hr_attendance_change_digest=NEW.source_digest AND d.id=NEW.decision_ref
    AND d.actor_id<>NEW.submitted_by AND d.actor_id IS DISTINCT FROM e.account_ref
    AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
    AND ((NEW.status='APPROVED' AND d.action='APPROVE' AND c.status='PENDING_OWNER')
     OR (NEW.status='RETURNED' AND d.action='RETURN' AND c.status='RETURNED')
     OR (NEW.status='REJECTED' AND d.action='REJECT' AND c.status='REJECTED'))
 ) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Original independent correction decision is required';
END; $fn$;
CREATE TRIGGER cg10_correction_frozen BEFORE INSERT OR UPDATE OR DELETE ON hr_attendance_change
 FOR EACH ROW EXECUTE FUNCTION cg10_correction_frozen();
CREATE FUNCTION cg10_correction_link_required() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM hr_attendance_change r JOIN cg03_case c
  ON c.id=r.case_ref AND c.realm_id=r.root_realm_id AND c.hr_attendance_change_id=r.id
  AND c.hr_attendance_change_digest=r.source_digest AND c.case_kind='ATTENDANCE_CORRECTION'
  AND c.proposer_id=r.submitted_by AND c.proposal_revision=r.expected_version
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.id)
 THEN RAISE EXCEPTION 'Original correction case required before commit'; END IF;
 RETURN NULL;
END; $fn$;
CREATE CONSTRAINT TRIGGER cg10_correction_link_required AFTER INSERT OR UPDATE ON hr_attendance_change
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg10_correction_link_required();
