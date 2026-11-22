-- Real HR dispatch through original CG19 notifications/delivery_attempt/receipt;
-- acknowledgement is an immutable recipient action, not an inferred delivery.
ALTER TABLE cg19_notification ADD COLUMN hr_document_ref uuid;
ALTER TABLE cg19_notification ADD CONSTRAINT fk_cg19_hr_notification_doc
 FOREIGN KEY(hr_document_ref,realm_id) REFERENCES cg19_generated_document(id,realm_id) ON DELETE RESTRICT;
DO $migration$
DECLARE rec record;previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_message_template','cg19_message_template_kind_check','kind=''CG10_DOCUMENT_READY'''),
 ('cg19_message_template','cg19_message_template_check','origin=''SYSTEM'' AND approved_by IS NULL AND kind=''CG10_DOCUMENT_READY'''),
 ('cg19_notification','cg19_notification_source_kind_check','source_kind=''CG10_DOCUMENT_READY'''),
 ('cg19_notification','cg19_notification_check','source_kind=''CG10_DOCUMENT_READY'' AND hr_document_ref IS NOT NULL AND hr_document_ref=source_key AND num_nonnulls(decision_id,case_id,notice_id,cg15_appointment_event_id,cg16_lab_report_release_id,cg20_mis_run_ref)=0'),
 ('cg19_document_event','cg19_document_event_event_key_check','event_key=''ACKNOWLEDGED''')
 ) v(table_name,constraint_name,extra)
 LOOP
  SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c
   WHERE c.conrelid=rec.table_name::regclass AND c.conname=rec.constraint_name AND c.contype='c';
  IF previous IS NULL OR left(previous,1)<>'(' THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.table_name,rec.constraint_name,previous,rec.extra);
 END LOOP;
END; $migration$;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_hr_document_notification_only CHECK(
 (source_kind='CG10_DOCUMENT_READY' AND hr_document_ref IS NOT NULL AND source_key=hr_document_ref)
 OR (source_kind<>'CG10_DOCUMENT_READY' AND hr_document_ref IS NULL));
CREATE UNIQUE INDEX ux_cg19_hr_doc_dispatch ON cg19_notification(realm_id,hr_document_ref,recipient_id,channel) WHERE source_kind='CG10_DOCUMENT_READY';
CREATE UNIQUE INDEX ux_cg19_hr_acknowledgement ON cg19_document_event(realm_id,document_id,actor_id) WHERE event_key='ACKNOWLEDGED';
CREATE FUNCTION cg19_hr_document_notice_matches(root uuid,doc uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM cg19_generated_document d JOIN hr_document_request h ON h.root_realm_id=d.realm_id AND h.case_ref=d.case_id AND h.source_digest=d.source_sha256
 JOIN hr_employee e ON e.root_realm_id=h.root_realm_id AND e.id=h.employee_id
 JOIN account a ON a.realm_id=e.root_realm_id AND a.id=e.account_ref AND a.status='ACTIVE'
 WHERE d.realm_id=root AND d.id=doc AND d.state='ISSUED' AND d.revoked_at IS NULL AND h.status='APPROVED'
  AND e.account_ref=recipient AND e.status IN('ACTIVE','PROBATION') AND EXISTS(SELECT 1 FROM hr_employment_assignment ea
   WHERE ea.root_realm_id=e.root_realm_id AND ea.employee_id=e.id AND ea.valid_from<=CURRENT_DATE AND ea.valid_to IS NULL))
$fn$;
CREATE FUNCTION cg19_hr_document_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.hr_document_ref,NEW.source_kind,NEW.source_key,NEW.recipient_id,NEW.realm_id,NEW.channel,NEW.template_id,NEW.template_version,NEW.subject_snapshot,NEW.body_snapshot)
  IS DISTINCT FROM (OLD.hr_document_ref,OLD.source_kind,OLD.source_key,OLD.recipient_id,OLD.realm_id,OLD.channel,OLD.template_id,OLD.template_version,OLD.subject_snapshot,OLD.body_snapshot)
  AND (OLD.source_kind='CG10_DOCUMENT_READY' OR NEW.source_kind='CG10_DOCUMENT_READY')
 THEN RAISE EXCEPTION 'Original HR dispatch identity is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.source_kind='CG10_DOCUMENT_READY' AND
  (NOT cg19_hr_document_notice_matches(NEW.realm_id,NEW.hr_document_ref,NEW.recipient_id)
   OR NOT EXISTS(SELECT 1 FROM cg19_message_template t WHERE t.realm_id=NEW.realm_id AND t.id=NEW.template_id AND t.version=NEW.template_version
    AND t.kind='CG10_DOCUMENT_READY' AND t.channel=NEW.channel AND t.status='APPROVED' AND t.subject=NEW.subject_snapshot AND t.body=NEW.body_snapshot))
 THEN RAISE EXCEPTION 'Original issued document recipient required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_document_notice_guard BEFORE INSERT OR UPDATE ON cg19_notification FOR EACH ROW EXECUTE FUNCTION cg19_hr_document_notice_guard();
CREATE FUNCTION cg19_hr_document_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.event_key='ACKNOWLEDGED' AND (NEW.document_id IS NULL OR NEW.file_id IS NOT NULL OR NEW.intent_id IS NOT NULL
  OR NOT cg19_hr_document_notice_matches(NEW.realm_id,NEW.document_id,NEW.actor_id)
  OR NOT EXISTS(SELECT 1 FROM cg19_generated_document d WHERE d.id=NEW.document_id AND d.realm_id=NEW.realm_id AND d.case_id=NEW.case_id))
 THEN RAISE EXCEPTION 'Actual recipient acknowledgement required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE TRIGGER cg19_hr_document_receipt_guard BEFORE INSERT ON cg19_document_event FOR EACH ROW EXECUTE FUNCTION cg19_hr_document_receipt_guard();
