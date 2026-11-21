-- CG19 US002 existing delivery system consumes ONLY original committed
-- CG16 released-report events. Neutral copy, no diagnosis, report value or URL.
-- This is NOT a 'delivered' claim; actual provider callbacks remain CG19-owned.
ALTER TABLE cg19_message_template DROP CONSTRAINT cg19_message_template_kind_check;
ALTER TABLE cg19_message_template
 ADD CONSTRAINT cg19_message_template_kind_check
 CHECK(kind IN('CG03_DECISION','NOTICE','CG15_APPOINTMENT','CG16_LAB_RELEASE'));
ALTER TABLE cg19_message_template DROP CONSTRAINT cg19_message_template_check;
ALTER TABLE cg19_message_template
 ADD CONSTRAINT cg19_message_template_check
 CHECK((origin='SYSTEM' AND approved_by IS NULL
  AND kind IN('CG03_DECISION','CG15_APPOINTMENT','CG16_LAB_RELEASE'))
  OR (origin='HUMAN' AND approved_by IS NOT NULL));
ALTER TABLE cg19_notification
 ADD COLUMN cg16_lab_report_release_id uuid;
ALTER TABLE cg19_notification
 ADD CONSTRAINT fk_cg19_lab_report_release
 FOREIGN KEY(realm_id,cg16_lab_report_release_id)
 REFERENCES cg16_lab_report_release(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE cg19_notification DROP CONSTRAINT cg19_notification_source_kind_check;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_notification_source_kind_check
 CHECK(source_kind IN('CG03_DECISION','NOTICE','CG15_APPOINTMENT','CG16_LAB_RELEASE'));
ALTER TABLE cg19_notification DROP CONSTRAINT cg19_notification_check;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_notification_check CHECK(
 (source_kind='CG03_DECISION' AND case_id IS NOT NULL
  AND decision_id=source_key AND notice_id IS NULL
  AND cg15_appointment_event_id IS NULL
  AND cg16_lab_report_release_id IS NULL)
 OR (source_kind='NOTICE' AND notice_id=source_key
  AND case_id IS NULL AND decision_id IS NULL
  AND cg15_appointment_event_id IS NULL
  AND cg16_lab_report_release_id IS NULL)
 OR (source_kind='CG15_APPOINTMENT' AND cg15_appointment_event_id=source_key
  AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL
  AND cg16_lab_report_release_id IS NULL)
 OR (source_kind='CG16_LAB_RELEASE'
  AND cg16_lab_report_release_id=source_key
  AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL
  AND cg15_appointment_event_id IS NULL)
);
CREATE TABLE cg19_lab_release_outbox(
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 release_ref uuid NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','CAPTURED')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 captured_at timestamptz,
 PRIMARY KEY(realm_id,release_ref),
 FOREIGN KEY(realm_id,release_ref)
 REFERENCES cg16_lab_report_release(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((state='PENDING' AND captured_at IS NULL)
   OR (state='CAPTURED' AND captured_at IS NOT NULL))
);
CREATE INDEX ix_cg19_lab_release_pending
 ON cg19_lab_release_outbox(realm_id,recorded_at,release_ref)
 WHERE state='PENDING';
CREATE FUNCTION cg19_lab_release_wakeup() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO cg19_lab_release_outbox(realm_id,release_ref)
 VALUES(NEW.root_realm_id,NEW.id) ON CONFLICT DO NOTHING;
 PERFORM pg_notify('cg19_lab_release_committed',NEW.root_realm_id::text);
 RETURN NEW;
END $$;
CREATE TRIGGER cg19_capture_actual_released_lab_report
 AFTER INSERT ON cg16_lab_report_release
 FOR EACH ROW EXECUTE FUNCTION cg19_lab_release_wakeup();
