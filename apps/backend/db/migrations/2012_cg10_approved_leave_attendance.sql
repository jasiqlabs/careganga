-- CG10 approved leave projection into the single original attendance-day owner.
-- No fake punch: full leave and unpunched half-day have NULL actual in/out.
ALTER TABLE hr_leave_request ADD CONSTRAINT uq_hr_leave_employee_source UNIQUE(id,root_realm_id,employee_id);
ALTER TABLE hr_attendance_day ALTER COLUMN checked_in_at DROP NOT NULL;
ALTER TABLE hr_attendance_day DROP CONSTRAINT hr_attendance_day_status_check;
ALTER TABLE hr_attendance_day ADD COLUMN leave_request_id uuid,
 ADD COLUMN leave_half_days integer,
 ADD CONSTRAINT fk_hr_attendance_leave_actual_employee FOREIGN KEY(leave_request_id,root_realm_id,employee_id)
  REFERENCES hr_leave_request(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_hr_attendance_leave_units CHECK(
  (leave_request_id IS NULL AND leave_half_days IS NULL) OR
  (leave_request_id IS NOT NULL AND leave_half_days IS NOT NULL AND leave_half_days IN(1,2))),
 ADD CONSTRAINT ck_hr_attendance_punch_or_leave CHECK(
  status IN('PRESENT','LATE','LEAVE','HALF_DAY_LEAVE') AND ((status IN('PRESENT','LATE') AND checked_in_at IS NOT NULL AND (leave_half_days IS NULL OR leave_half_days=1))
  OR (status='LEAVE' AND leave_half_days IS NOT NULL AND leave_half_days=2 AND checked_in_at IS NULL AND checked_out_at IS NULL AND worked_minutes IS NULL)
  OR (status='HALF_DAY_LEAVE' AND leave_half_days IS NOT NULL AND leave_half_days=1 AND checked_in_at IS NULL AND checked_out_at IS NULL AND worked_minutes IS NULL)));
CREATE INDEX ix_hr_attendance_leave_source ON hr_attendance_day(root_realm_id,leave_request_id) WHERE leave_request_id IS NOT NULL;

CREATE FUNCTION cg10_attendance_leave_effect_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.leave_request_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM hr_leave_request r JOIN hr_leave_policy lp ON lp.id=r.policy_id AND lp.root_realm_id=r.root_realm_id
  JOIN hr_shift_policy sp ON sp.id=r.shift_policy_id AND sp.root_realm_id=r.root_realm_id
  WHERE r.id=NEW.leave_request_id AND r.root_realm_id=NEW.root_realm_id AND r.employee_id=NEW.employee_id
   AND r.status='APPROVED' AND r.assignment_id=NEW.assignment_id AND r.shift_id=NEW.shift_id
   AND r.shift_policy_id=NEW.policy_id AND NEW.local_date BETWEEN r.start_date AND r.end_date
   AND (lp.count_weekly_off OR NOT (extract(dow from NEW.local_date)::integer=ANY(sp.weekly_off_days)))
   AND NEW.leave_half_days=CASE WHEN r.half_day THEN 1 ELSE 2 END
 ) THEN RAISE EXCEPTION 'Original approved leave is required'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.leave_request_id IS NOT NULL AND
   (OLD.leave_request_id,OLD.leave_half_days) IS DISTINCT FROM (NEW.leave_request_id,NEW.leave_half_days)
  THEN RAISE EXCEPTION 'Approved leave attendance evidence cannot be removed'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER cg10_attendance_leave_effect_guard BEFORE INSERT OR UPDATE ON hr_attendance_day
 FOR EACH ROW EXECUTE FUNCTION cg10_attendance_leave_effect_guard();
