-- CG10 US001: live actual same-root reporting manager and applicant source guard.
-- Additive FK; never invent a separate staff/manager master.
ALTER TABLE hr_employee_application
 ADD CONSTRAINT fk_cg10_requested_manager_employee
 FOREIGN KEY(proposed_manager_employee_ref,root_realm_id)
 REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg10_application_manager
 ON hr_employee_application(root_realm_id,proposed_manager_employee_ref)
 WHERE proposed_manager_employee_ref IS NOT NULL;
-- Current assignment already references original manager via same-root FK,
-- but an assignment is not an account role and never gives login rights.
ALTER TABLE hr_employment_assignment
 ADD CONSTRAINT ck_cg10_assignment_employee_manager_distinct
 CHECK(manager_employee_ref IS NULL OR manager_employee_ref<>employee_id);
