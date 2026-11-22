-- Audit private reason disclosure without persisting reason text or authentication proof.
ALTER TABLE hr_audit DROP CONSTRAINT hr_audit_action_check;
ALTER TABLE hr_audit ADD CONSTRAINT hr_audit_action_check CHECK(action IN(
 'DRAFT_CREATED','DRAFT_UPDATED','SUBMITTED','RETURNED','REJECTED','ACTIVATED','PENDING_ACCESS','ACCESS_CONFIRMED',
 'LEAVE_PRIVATE_READ','ATTENDANCE_CORRECTION_PRIVATE_READ'));
