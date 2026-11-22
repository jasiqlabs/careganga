-- Initial explicit nonworking attendance is an audited HR action, never an inferred missing punch.
ALTER TABLE hr_attendance_event DROP CONSTRAINT hr_attendance_event_action_check;
ALTER TABLE hr_attendance_event ADD CONSTRAINT hr_attendance_event_action_check
 CHECK(action IN('CHECK_IN','CHECK_OUT','INITIAL_NONWORKING_DAY'));
