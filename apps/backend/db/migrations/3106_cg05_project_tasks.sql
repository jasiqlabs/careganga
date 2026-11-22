-- CG05 US002: task master belongs to the actual project; assignee is an
-- original CG01 account or an original CG10 employee linked to that account.
CREATE SEQUENCE cg05_task_public_sequence;
CREATE TABLE project_task (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 project_id uuid NOT NULL,
 task_code text NOT NULL DEFAULT ('TSK-'||lpad(nextval('cg05_task_public_sequence')::text,8,'0')) UNIQUE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 2 AND 160),
 task_type text NOT NULL CHECK(char_length(btrim(task_type)) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=2000),
 priority text NOT NULL CHECK(priority IN('LOW','NORMAL','HIGH','URGENT')),
 planned_start date,
 due_at date,
 CHECK(planned_start IS NULL OR due_at IS NULL OR planned_start<=due_at),
 status text NOT NULL CHECK(status IN('DRAFT','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 assignee_kind text NOT NULL CHECK(assignee_kind IN('ACCOUNT','EMPLOYEE','UNASSIGNED')),
 assignee_account_ref uuid,
 assignee_employee_ref uuid,
 assignee_branch_ref uuid,
 assigned_at timestamptz,
 completed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,project_id,id),
 FOREIGN KEY(root_realm_id,project_id) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(assignee_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,assignee_employee_ref) REFERENCES hr_employee(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(assignee_branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(((assignee_kind='UNASSIGNED' AND status='DRAFT' AND assignee_account_ref IS NULL AND assignee_employee_ref IS NULL AND assignee_branch_ref IS NULL AND assigned_at IS NULL)
 OR (assignee_kind='ACCOUNT' AND status<>'DRAFT' AND assignee_account_ref IS NOT NULL AND assignee_employee_ref IS NULL AND assigned_at IS NOT NULL)
 OR (assignee_kind='EMPLOYEE' AND status<>'DRAFT' AND assignee_account_ref IS NOT NULL AND assignee_employee_ref IS NOT NULL AND assignee_branch_ref IS NOT NULL AND assigned_at IS NOT NULL)) IS TRUE),
 CHECK((status='COMPLETED')=(completed_at IS NOT NULL))
);
CREATE INDEX ix_cg05_task_project ON project_task(root_realm_id,project_id,status,due_at,id);
CREATE INDEX ix_cg05_task_assignee ON project_task(root_realm_id,assignee_account_ref,status,due_at,id);
CREATE INDEX ix_cg05_task_due ON project_task(root_realm_id,status,due_at,id);
CREATE TABLE project_task_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 project_id uuid NOT NULL,
 task_id uuid NOT NULL,
 event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 event_kind text NOT NULL CHECK(event_kind IN('CREATE','EDIT','ASSIGN','PROGRESS')),
 actor_ref uuid NOT NULL,
 old_status text CHECK(old_status IN('DRAFT','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 new_status text NOT NULL CHECK(new_status IN('DRAFT','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 assignee_kind text NOT NULL CHECK(assignee_kind IN('ACCOUNT','EMPLOYEE','UNASSIGNED')),
 assignee_account_ref uuid,
 assignee_employee_ref uuid,
 assignee_branch_ref uuid,
 result_version integer NOT NULL CHECK(result_version>0),
 redacted_reason text NOT NULL DEFAULT '' CHECK(char_length(redacted_reason)<=500),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 UNIQUE(root_realm_id,task_id,result_version),
 FOREIGN KEY(root_realm_id,project_id,task_id) REFERENCES project_task(root_realm_id,project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(assignee_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,assignee_employee_ref) REFERENCES hr_employee(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(assignee_branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((event_kind='CREATE')=(old_status IS NULL))
);
CREATE INDEX ix_cg05_task_events ON project_task_event(root_realm_id,task_id,result_version DESC);
CREATE TRIGGER cg05_task_event_immutable BEFORE UPDATE OR DELETE ON project_task_event
 FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();
