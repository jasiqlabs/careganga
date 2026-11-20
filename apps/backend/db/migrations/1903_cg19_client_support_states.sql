-- Client support workflow: preserve existing OPEN/REPLIED/CLOSED records while
-- adding assignment, progress, waiting, escalation and resolution states.
-- OPEN is the existing 'New' equivalent; no migration of old statuses.
ALTER TABLE cg19_support_case DROP CONSTRAINT cg19_support_case_status_check;
ALTER TABLE cg19_support_case ADD CONSTRAINT cg19_support_case_status_check
 CHECK(status IN(
  'OPEN','ASSIGNED','IN_PROGRESS','WAITING_FOR_USER','ESCALATED',
  'REPLIED','RESOLVED','CLOSED'
 ));
ALTER TABLE cg19_support_event DROP CONSTRAINT cg19_support_event_kind_check;
ALTER TABLE cg19_support_event ADD CONSTRAINT cg19_support_event_kind_check
 CHECK(kind IN(
  'CONTACT_SUBMITTED','ASSIGNED','REPLIED','CLOSED','REOPENED',
  'READ','ARCHIVED','RESTORED','STATUS_UPDATED'
 ));
