-- Prevent an account/role from being bound to an unrelated Foundation realm.
ALTER TABLE account ADD CONSTRAINT ux_cg01_account_realm UNIQUE (id,realm_id);
ALTER TABLE role ADD CONSTRAINT ux_cg01_role_realm UNIQUE (id,realm_id);
ALTER TABLE account_role ADD CONSTRAINT fk_cg01_assignment_account_realm
  FOREIGN KEY (account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT;
ALTER TABLE account_role ADD CONSTRAINT fk_cg01_assignment_role_realm
  FOREIGN KEY (role_id,realm_id) REFERENCES role(id,realm_id) ON DELETE RESTRICT;
