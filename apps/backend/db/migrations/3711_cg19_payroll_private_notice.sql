-- Original CG19 outbox, not a second email queue. Generic portal notice only.
ALTER TABLE cg19_notification ADD COLUMN payroll_payslip_ref uuid;
ALTER TABLE cg19_notification ADD FOREIGN KEY(realm_id,payroll_payslip_ref) REFERENCES cg19_payroll_payslip(root_realm_id,id) ON DELETE RESTRICT;
DO $migration$
DECLARE rec record;previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_message_template','cg19_message_template_kind_check','kind=''CG11_PAYSLIP_READY'''),
 ('cg19_message_template','cg19_message_template_check','origin=''SYSTEM'' AND approved_by IS NULL AND kind=''CG11_PAYSLIP_READY'''),
 ('cg19_notification','cg19_notification_source_kind_check','source_kind=''CG11_PAYSLIP_READY'''),
 ('cg19_notification','cg19_notification_check','source_kind=''CG11_PAYSLIP_READY'' AND payroll_payslip_ref IS NOT NULL AND payroll_payslip_ref=source_key AND num_nonnulls(decision_id,case_id,notice_id,cg15_appointment_event_id,cg16_lab_report_release_id,cg20_mis_run_ref,hr_document_ref)=0')
 ) v(table_name,constraint_name,extra)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c
   WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF previous IS NULL THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,previous,rec.extra);
 END LOOP;
END; $migration$;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_payroll_notice_only CHECK((source_kind='CG11_PAYSLIP_READY' AND payroll_payslip_ref IS NOT NULL AND payroll_payslip_ref=source_key AND channel='EMAIL') OR (source_kind<>'CG11_PAYSLIP_READY' AND payroll_payslip_ref IS NULL));
CREATE UNIQUE INDEX ux_cg19_payroll_notice ON cg19_notification(realm_id,payroll_payslip_ref,recipient_id,channel) WHERE source_kind='CG11_PAYSLIP_READY';
CREATE FUNCTION cg19_payroll_notice_matches(root uuid,doc uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM cg19_payroll_payslip d JOIN payroll_line l ON l.root_realm_id=d.root_realm_id AND l.id=d.line_ref
 JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN account a ON a.realm_id=e.root_realm_id AND a.id=e.account_ref AND a.status='ACTIVE'
 WHERE d.root_realm_id=root AND d.id=doc AND d.status='ISSUED' AND e.account_ref=recipient AND e.status IN('ACTIVE','PROBATION')
 AND (SELECT count(*) FROM hr_employment_assignment h JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
 WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date))=1)
$fn$;
CREATE FUNCTION cg19_guard_payroll_notice() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.source_kind='CG11_PAYSLIP_READY' OR NEW.source_kind='CG11_PAYSLIP_READY') AND
 (NEW.payroll_payslip_ref,NEW.source_kind,NEW.source_key,NEW.recipient_id,NEW.realm_id,NEW.channel,NEW.template_id,NEW.template_version,NEW.subject_snapshot,NEW.body_snapshot,NEW.purpose)
 IS DISTINCT FROM (OLD.payroll_payslip_ref,OLD.source_kind,OLD.source_key,OLD.recipient_id,OLD.realm_id,OLD.channel,OLD.template_id,OLD.template_version,OLD.subject_snapshot,OLD.body_snapshot,OLD.purpose)
 THEN RAISE EXCEPTION 'Original payroll notification identity is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.source_kind='CG11_PAYSLIP_READY' AND
 (NOT cg19_payroll_notice_matches(NEW.realm_id,NEW.payroll_payslip_ref,NEW.recipient_id) OR NEW.purpose<>'TRANSACTIONAL' OR
 NEW.subject_snapshot<>'Your private CareGanga document is available' OR NEW.body_snapshot<>'Sign in to the CareGanga employee portal or Internal Android app and open My Pay to view the current confidential salary statement. This notice does not confirm payment.' OR
 NOT EXISTS(SELECT 1 FROM cg19_message_template t WHERE t.realm_id=NEW.realm_id AND t.id=NEW.template_id AND t.version=NEW.template_version AND t.kind='CG11_PAYSLIP_READY' AND t.channel=NEW.channel AND t.status='APPROVED' AND t.subject=NEW.subject_snapshot AND t.body=NEW.body_snapshot))
 THEN RAISE EXCEPTION 'Original issued payroll document recipient required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_payroll_notice_guard BEFORE INSERT OR UPDATE ON cg19_notification FOR EACH ROW EXECUTE FUNCTION cg19_guard_payroll_notice();
