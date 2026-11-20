-- Forward-only CG19 recovery index for the existing original CG15 queue and
-- appointment event outbox (US-006-QA15). Recover across Foundation roots
-- through one bounded due-source lookup, not per-tenant polling.
-- No new notification sources, delivery channels, or patient data.
CREATE INDEX ix_cg19_appointment_pending_recovery_global
 ON cg19_appointment_event_outbox(recorded_at,realm_id,event_id)
 WHERE state='PENDING';
COMMENT ON INDEX ix_cg19_appointment_pending_recovery_global IS
 'Bounded cross-root recovery of original committed appointment and queue events';
