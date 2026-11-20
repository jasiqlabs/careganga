-- CG-19 client Master Email v2.0: real transactional email templates may be
-- longer than generic 480-character in-app notices. Lift the body limit ONLY
-- on EMAIL. Existing SMS/IN_APP notice and service rules stay at 480; SMS
-- provider's effective 160-character/Unicode safety limit remains unchanged.
-- This does not approve, attach or send any of the 52 SOURCE_DRAFT templates.
ALTER TABLE cg19_message_template
 DROP CONSTRAINT cg19_message_template_body_check;
ALTER TABLE cg19_message_template
 ADD CONSTRAINT cg19_message_template_body_check
 CHECK(
   (channel='EMAIL' AND length(body) BETWEEN 8 AND 12000)
   OR (channel IN('IN_APP','SMS') AND length(body) BETWEEN 8 AND 480)
 );
ALTER TABLE cg19_notification
 DROP CONSTRAINT cg19_notification_body_snapshot_check;
ALTER TABLE cg19_notification
 ADD CONSTRAINT cg19_notification_body_snapshot_check
 CHECK(
   (channel='EMAIL' AND length(body_snapshot) BETWEEN 8 AND 12000)
   OR (channel IN('IN_APP','SMS') AND length(body_snapshot) BETWEEN 8 AND 480)
 );
