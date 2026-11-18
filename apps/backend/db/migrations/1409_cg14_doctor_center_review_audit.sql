-- CG-14 US-003: record original per-center professional association decisions.
-- Approval is a separate Foundation authority from CG-03 doctor identity verification.
-- This is an additive migration; the original immutable doctor events remain unchanged.
ALTER TABLE health_doctor_event
  DROP CONSTRAINT health_doctor_event_action_key_check;
ALTER TABLE health_doctor_event
  ADD CONSTRAINT health_doctor_event_action_key_check CHECK(action_key IN (
    'DOCTOR_DRAFT_CREATE','DOCTOR_DRAFT_UPDATE','DOCTOR_CENTER_PROPOSE',
    'DOCTOR_SUBMIT','DOCTOR_VERIFY','DOCTOR_RETURN',
    'DOCTOR_CENTER_APPROVE','DOCTOR_CENTER_SUSPEND'
  ));
