-- The original CG-19 messaging owner receives one protected CG-20 report
-- event per immutable run, not an attachment or a second delivery service.
-- Apply after 2001 and 2002. Existing notification workflows are preserved.
ALTER TABLE cg19_message_template DROP CONSTRAINT cg19_message_template_kind_check;
ALTER TABLE cg19_message_template ADD CONSTRAINT cg19_message_template_kind_check
 CHECK(kind IN('CG03_DECISION','NOTICE','CG15_APPOINTMENT',
               'CG16_LAB_RELEASE','CG20_MIS_REPORT'));
ALTER TABLE cg19_message_template DROP CONSTRAINT cg19_message_template_check;
ALTER TABLE cg19_message_template ADD CONSTRAINT cg19_message_template_check
 CHECK((origin='SYSTEM' AND approved_by IS NULL
  AND kind IN('CG03_DECISION','CG15_APPOINTMENT',
               'CG16_LAB_RELEASE','CG20_MIS_REPORT'))
  OR (origin='HUMAN' AND approved_by IS NOT NULL));
ALTER TABLE cg19_notification ADD COLUMN cg20_mis_run_ref uuid;
ALTER TABLE cg19_notification ADD CONSTRAINT fk_cg19_cg20_report_notice
 FOREIGN KEY(realm_id,cg20_mis_run_ref)
 REFERENCES cg20_report_run(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE cg19_notification DROP CONSTRAINT cg19_notification_source_kind_check;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_notification_source_kind_check
 CHECK(source_kind IN('CG03_DECISION','NOTICE','CG15_APPOINTMENT',
                      'CG16_LAB_RELEASE','CG20_MIS_REPORT'));
ALTER TABLE cg19_notification DROP CONSTRAINT cg19_notification_check;
ALTER TABLE cg19_notification ADD CONSTRAINT cg19_notification_check CHECK(
 (source_kind='CG03_DECISION' AND case_id IS NOT NULL
  AND decision_id=source_key AND notice_id IS NULL
  AND cg15_appointment_event_id IS NULL
  AND cg16_lab_report_release_id IS NULL AND cg20_mis_run_ref IS NULL)
 OR (source_kind='NOTICE' AND notice_id=source_key
  AND case_id IS NULL AND decision_id IS NULL
  AND cg15_appointment_event_id IS NULL
  AND cg16_lab_report_release_id IS NULL AND cg20_mis_run_ref IS NULL)
 OR (source_kind='CG15_APPOINTMENT' AND cg15_appointment_event_id=source_key
  AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL
  AND cg16_lab_report_release_id IS NULL AND cg20_mis_run_ref IS NULL)
 OR (source_kind='CG16_LAB_RELEASE'
  AND cg16_lab_report_release_id=source_key
  AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL
  AND cg15_appointment_event_id IS NULL AND cg20_mis_run_ref IS NULL)
 OR (source_kind='CG20_MIS_REPORT' AND cg20_mis_run_ref=source_key
  AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL
  AND cg15_appointment_event_id IS NULL AND cg16_lab_report_release_id IS NULL)
);
CREATE INDEX ix_cg19_cg20_report_inbox
 ON cg19_notification(realm_id,recipient_id,created_at DESC)
 WHERE source_kind='CG20_MIS_REPORT';
