-- Original CG19 communication transport, fixed system copy, no salary details or bearer link.
CREATE FUNCTION cg19_payroll_event_copy(k text) RETURNS TABLE(code text,subject text,body text) LANGUAGE sql IMMUTABLE AS $fn$
 SELECT v.code,v.subject,v.body FROM (VALUES
 ('GENERATED','CG-SAL-001','Private CareGanga payroll statement available','Your approved confidential salary statement is available. Sign in to the CareGanga employee portal or Internal Android app and open My Pay. Approval alone does not confirm disbursement.'),
 ('PAID','CG-SAL-002','Private CareGanga payroll payment update','Your salary payment was independently verified in the original finance records. Sign in to My Pay for the current confidential statement and payment status.'),
 ('FAILED','CG-SAL-003','Private CareGanga payroll status update','Your salary payment remains outstanding or has a verified failed transfer. Sign in to My Pay for the current status. Contact HR and Payroll through the official support channel.'),
 ('DELAYED','CG-SAL-003','Private CareGanga payroll status update','Your salary payment remains outstanding or has a verified failed transfer. Sign in to My Pay for the current status. Contact HR and Payroll through the official support channel.')
 ) v(kind,code,subject,body) WHERE v.kind=k
$fn$;
ALTER TABLE cg19_notification ADD COLUMN payroll_event_ref uuid;
ALTER TABLE cg19_notification ADD FOREIGN KEY(realm_id,payroll_event_ref) REFERENCES cg19_payroll_event_outbox(realm_id,id);
DO $migration$
DECLARE rec record;previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_message_template','cg19_message_template_kind_check','kind IN(''CG-SAL-001'',''CG-SAL-002'',''CG-SAL-003'')'),
 ('cg19_message_template','cg19_message_template_check','origin=''SYSTEM'' AND approved_by IS NULL AND kind IN(''CG-SAL-001'',''CG-SAL-002'',''CG-SAL-003'')'),
 ('cg19_notification','cg19_notification_source_kind_check','source_kind=''CG11_PAYROLL_EVENT'''),
 ('cg19_notification','cg19_notification_check','source_kind=''CG11_PAYROLL_EVENT'' AND payroll_event_ref=source_key AND num_nonnulls(decision_id,case_id,notice_id,cg15_appointment_event_id,cg16_lab_report_release_id,cg20_mis_run_ref,hr_document_ref,payroll_payslip_ref)=0')
 ) v(table_name,constraint_name,extra)
 LOOP
 SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
 IF previous IS NULL THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,previous,rec.extra);
 END LOOP;
END; $migration$;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_salary_event_only CHECK((source_kind='CG11_PAYROLL_EVENT' AND payroll_event_ref IS NOT NULL AND source_key=payroll_event_ref AND channel IN('EMAIL','IN_APP')) OR (source_kind<>'CG11_PAYROLL_EVENT' AND payroll_event_ref IS NULL));
CREATE UNIQUE INDEX ux_cg19_payroll_event_notification ON cg19_notification(realm_id,payroll_event_ref,recipient_id,channel) WHERE source_kind='CG11_PAYROLL_EVENT';
CREATE FUNCTION cg19_salary_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE k text;doc uuid;line uuid;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.source_kind='CG11_PAYROLL_EVENT' OR NEW.source_kind='CG11_PAYROLL_EVENT') AND
 (to_jsonb(NEW)-ARRAY['state','attempt_count','claim_token','claimed_until','due_at','provider_message_ref','provider_kind','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','attempt_count','claim_token','claimed_until','due_at','provider_message_ref','provider_kind','updated_at']) THEN RAISE EXCEPTION 'Original salary notice identity immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.source_kind='CG11_PAYROLL_EVENT' THEN
 SELECT event_kind,doc_ref,line_ref INTO k,doc,line FROM cg19_payroll_event_outbox WHERE realm_id=NEW.realm_id AND id=NEW.payroll_event_ref AND state='CAPTURED';
 IF NOT FOUND OR NEW.purpose<>'TRANSACTIONAL' OR NOT cg19_payroll_event_matches(NEW.realm_id,NEW.payroll_event_ref,NEW.recipient_id) OR
 (k='GENERATED' AND NOT EXISTS(SELECT 1 FROM cg19_payroll_payslip p WHERE p.root_realm_id=NEW.realm_id AND p.id=doc AND p.line_ref=line AND p.status='ISSUED')) OR
 NOT EXISTS(SELECT 1 FROM cg19_message_template t CROSS JOIN cg19_payroll_event_copy(k) fixed WHERE t.realm_id=NEW.realm_id AND t.id=NEW.template_id AND t.version=NEW.template_version AND t.kind=fixed.code AND t.channel=NEW.channel AND t.status='APPROVED' AND t.subject=fixed.subject AND t.body=fixed.body AND t.subject=NEW.subject_snapshot AND t.body=NEW.body_snapshot)
 THEN RAISE EXCEPTION 'Original salary notice source required'; END IF;
 END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_salary_event_notice_guard BEFORE INSERT OR UPDATE ON cg19_notification FOR EACH ROW EXECUTE FUNCTION cg19_salary_notice_guard();
