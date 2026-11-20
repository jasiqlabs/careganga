-- CG-16 US-001 original QA06: source-owned test validity is distinct from
-- CG-14 regulatory center-license expiry, which has no approved date field.
-- Keep source test/category revisions and any accepted patient orders immutable.
ALTER TABLE diagnostic_test
 ADD COLUMN active_from timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN active_to timestamptz,
 ADD CONSTRAINT cg16_test_valid_window CHECK(
  active_to IS NULL OR active_to>active_from
 );
CREATE INDEX ix_cg16_test_current_valid
 ON diagnostic_test(root_realm_id,status,active_from,active_to,id);
-- Do not infer any medical-laboratory regulatory license validity here.
