-- CG10 US001: live actual same-root reporting manager and applicant source guard.
-- Additive FK; never invent a separate staff/manager master.
ALTER TABLE hr_employee_application
 ADD CONSTRAINT fk_cg10_requested_manager_employee
 FOREIGN KEY(proposed_manager_employee_ref,root_realm_id)
 REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg10_application_manager
 ON hr_employee_application(root_realm_id,proposed_manager_employee_ref)
 WHERE proposed_manager_employee_ref IS NOT NULL;
-- Existing 1001 assignment manager self-check remains authoritative.
