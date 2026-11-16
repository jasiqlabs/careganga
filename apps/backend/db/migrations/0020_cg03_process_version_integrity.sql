-- CG-03 security/DB review (2026-11-16).
-- Additive only: 0016 may already be applied and its checksum must not change.
-- A frozen approval case must reference the *exact* immutable process version,
-- not merely an existing process in the same Foundation realm.
ALTER TABLE cg03_process
  ADD CONSTRAINT ux_cg03_process_id_realm_version
  UNIQUE(id,realm_id,version);

ALTER TABLE cg03_case
  ADD CONSTRAINT fk_cg03_case_frozen_process_version
  FOREIGN KEY(process_id,realm_id,process_version)
  REFERENCES cg03_process(id,realm_id,version)
  ON DELETE RESTRICT;
-- PostgreSQL validates existing cases when this FK is added; inconsistent
-- historical records must fail migration rather than be silently accepted.
