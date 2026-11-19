-- CG-15 US-006/008: bound exact center-local attendance lookups
-- without changing the original appointment date/time or materializing
-- a second center/timezone owner. Physical PostgreSQL EXPLAIN is NOT_RUN.
-- Used by ConsultationQueueService.list/summary and H15 day filtering.
CREATE INDEX ix_cg15_appointment_center_local_day
 ON cg15_consultation_appointment(
  root_realm_id,center_id,
  ((start_at AT TIME ZONE time_zone)::date),
  start_at,id
 );
COMMENT ON INDEX ix_cg15_appointment_center_local_day IS
 'Actual appointment-local date index for bounded CG15 center queue/report; retains original booking timezone';
