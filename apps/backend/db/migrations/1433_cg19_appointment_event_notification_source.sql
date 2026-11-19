-- CG19 owns communication source capture and transport.
-- CG15 original immutable appointment events are the only event authority.
-- Additive V1: no patient note, phone, file URI, diagnosis or direct transport.
ALTER TABLE cg19_message_template
 DROP CONSTRAINT cg19_message_template_kind_check;
ALTER TABLE cg19_message_template
 ADD CONSTRAINT cg19_message_template_kind_check
 CHECK(kind IN ('CG03_DECISION','NOTICE','CG15_APPOINTMENT'));
ALTER TABLE cg19_message_template
 DROP CONSTRAINT cg19_message_template_check;
ALTER TABLE cg19_message_template
 ADD CONSTRAINT cg19_message_template_check
 CHECK((origin='SYSTEM' AND approved_by IS NULL
   AND kind IN ('CG03_DECISION','CG15_APPOINTMENT'))
   OR (origin='HUMAN' AND approved_by IS NOT NULL));

ALTER TABLE cg19_notification
 ADD COLUMN cg15_appointment_event_id uuid;
ALTER TABLE cg19_notification
 ADD CONSTRAINT fk_cg19_appointment_event
 FOREIGN KEY(realm_id,cg15_appointment_event_id)
 REFERENCES cg15_appointment_event(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE cg19_notification
 DROP CONSTRAINT cg19_notification_source_kind_check;
ALTER TABLE cg19_notification
 ADD CONSTRAINT cg19_notification_source_kind_check
 CHECK(source_kind IN ('CG03_DECISION','NOTICE','CG15_APPOINTMENT'));
ALTER TABLE cg19_notification
 DROP CONSTRAINT cg19_notification_check;
ALTER TABLE cg19_notification
 ADD CONSTRAINT cg19_notification_check CHECK(
  (source_kind='CG03_DECISION' AND case_id IS NOT NULL
   AND decision_id=source_key AND notice_id IS NULL
   AND cg15_appointment_event_id IS NULL)
  OR (source_kind='NOTICE' AND notice_id=source_key
   AND case_id IS NULL AND decision_id IS NULL
   AND cg15_appointment_event_id IS NULL)
  OR (source_kind='CG15_APPOINTMENT'
   AND cg15_appointment_event_id=source_key
   AND decision_id IS NULL AND case_id IS NULL AND notice_id IS NULL)
 );

-- The outbox is written in the SAME transaction as the immutable CG15
-- event, so a later-committing earlier-timestamp event is never skipped.
CREATE TABLE cg19_appointment_event_outbox(
 realm_id uuid NOT NULL,
 event_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','CAPTURED')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 captured_at timestamptz,
 PRIMARY KEY(realm_id,event_id),
 FOREIGN KEY(realm_id,event_id)
  REFERENCES cg15_appointment_event(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((state='PENDING' AND captured_at IS NULL)
   OR (state='CAPTURED' AND captured_at IS NOT NULL))
);
CREATE INDEX ix_cg19_appointment_event_outbox_pending
 ON cg19_appointment_event_outbox(realm_id,recorded_at,event_id)
 WHERE state='PENDING';
COMMENT ON TABLE cg19_appointment_event_outbox IS
 'Due-only original committed CG15 events; provider transport is owned by existing CG19';


CREATE FUNCTION cg19_appointment_event_wakeup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO cg19_appointment_event_outbox(realm_id,event_id)
 VALUES(NEW.root_realm_id,NEW.id) ON CONFLICT DO NOTHING;
 PERFORM pg_notify('cg19_appointment_committed',NEW.root_realm_id::text);
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_wake_on_cg15_appointment_event
 AFTER INSERT ON cg15_appointment_event FOR EACH ROW
 EXECUTE FUNCTION cg19_appointment_event_wakeup();
