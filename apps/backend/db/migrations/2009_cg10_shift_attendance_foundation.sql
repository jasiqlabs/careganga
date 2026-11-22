-- CG-10 US-002 initial real shift and self-attendance source (not a leave approval).
-- No payroll tables, client clock claims, private HR export, or synthetic attendance.
CREATE TABLE hr_shift_policy(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 branch_ref uuid NOT NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 100),
 time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 3 AND 80),
 work_start_local time NOT NULL,
 work_end_local time NOT NULL,
 break_minutes integer NOT NULL CHECK(break_minutes BETWEEN 0 AND 720),
 grace_minutes integer NOT NULL CHECK(grace_minutes BETWEEN 0 AND 180),
 weekly_off_days integer[] NOT NULL DEFAULT ARRAY[]::integer[]
  CHECK(weekly_off_days <@ ARRAY[0,1,2,3,4,5,6]::integer[] AND cardinality(weekly_off_days)<=7),
 effective_from date NOT NULL,
 created_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(work_start_local <> work_end_local)
);
CREATE INDEX ix_hr_shift_branch_date ON hr_shift_policy(root_realm_id,branch_ref,effective_from DESC,id);

CREATE TABLE hr_employee_shift(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 policy_id uuid NOT NULL,
 valid_from date NOT NULL,
 valid_to date,
 created_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(id,root_realm_id,employee_id,policy_id),
 UNIQUE(root_realm_id,request_key),
 CHECK(valid_to IS NULL OR valid_to>valid_from),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(policy_id,root_realm_id) REFERENCES hr_shift_policy(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_hr_employee_shift_current ON hr_employee_shift(root_realm_id,employee_id) WHERE valid_to IS NULL;
CREATE INDEX ix_hr_employee_shift_history ON hr_employee_shift(root_realm_id,employee_id,valid_from DESC,id);

-- Binding the pinned attendance assignment to the same original employee
-- must be enforceable by PostgreSQL, not only by a service-layer SELECT.
ALTER TABLE hr_employment_assignment
 ADD CONSTRAINT uq_hr_attendance_assignment_employee
 UNIQUE(id,root_realm_id,employee_id);

CREATE TABLE hr_attendance_day(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 shift_id uuid NOT NULL,
 policy_id uuid NOT NULL,
 local_date date NOT NULL,
 status text NOT NULL CHECK(status IN('PRESENT','LATE')),
 checked_in_at timestamptz NOT NULL,
 checked_out_at timestamptz,
 worked_minutes integer CHECK(worked_minutes BETWEEN 0 AND 2160),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK((checked_out_at IS NULL AND worked_minutes IS NULL) OR
  (checked_out_at IS NOT NULL AND worked_minutes IS NOT NULL
   AND checked_out_at>=checked_in_at)),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(id,root_realm_id,employee_id),
 UNIQUE(root_realm_id,employee_id,local_date),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(assignment_id,root_realm_id,employee_id)
  REFERENCES hr_employment_assignment(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(shift_id,root_realm_id,employee_id,policy_id)
  REFERENCES hr_employee_shift(id,root_realm_id,employee_id,policy_id) ON DELETE RESTRICT,
 FOREIGN KEY(policy_id,root_realm_id) REFERENCES hr_shift_policy(id,root_realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_attendance_employee_recent ON hr_attendance_day(root_realm_id,employee_id,local_date DESC);

CREATE TABLE hr_attendance_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 attendance_day_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN('CHECK_IN','CHECK_OUT')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(employee_id,root_realm_id) REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(attendance_day_id,root_realm_id,employee_id)
  REFERENCES hr_attendance_day(id,root_realm_id,employee_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_hr_attendance_event_day ON hr_attendance_event(root_realm_id,attendance_day_id,created_at);
CREATE TRIGGER cg10_attendance_event_immutable
 BEFORE UPDATE OR DELETE ON hr_attendance_event FOR EACH ROW EXECUTE FUNCTION cg03_immutable();

-- Shift rule values are immutable once pinned to an attendance record; new rules insert a new row.
CREATE TRIGGER cg10_shift_policy_immutable BEFORE UPDATE OR DELETE ON hr_shift_policy
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
