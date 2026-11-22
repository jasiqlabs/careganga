-- CG10 US001 approved role selection is a PROPOSAL ONLY. The CG01 role and
-- real grant remain owned solely by CG01/CG03 protected access.
ALTER TABLE hr_employee_application
 ADD COLUMN proposed_role_ref uuid,
 ADD CONSTRAINT fk_cg10_proposed_original_cg01_role
 FOREIGN KEY(proposed_role_ref,root_realm_id)
 REFERENCES role(id,realm_id) ON DELETE RESTRICT;
CREATE INDEX ix_cg10_proposed_role
 ON hr_employee_application(root_realm_id,proposed_role_ref)
 WHERE proposed_role_ref IS NOT NULL;
