-- CG-14 US-003: safely distinguish an approved operating-center representative
-- from a pending registration editor; never auto-grant clinical, finance or public rights.
ALTER TABLE health_center_account_affiliation
  DROP CONSTRAINT health_center_account_affiliation_status_check;
ALTER TABLE health_center_account_affiliation
  ADD CONSTRAINT health_center_account_affiliation_status_check
  CHECK(status IN ('PENDING_EDIT','ACTIVE','REVOKED'));

-- An existing pending association becomes operational only when an
-- independently verified center is explicitly activated by Foundation.
DROP INDEX ux_health_center_active_account;
CREATE UNIQUE INDEX ux_health_center_active_account
  ON health_center_account_affiliation(root_realm_id,center_id,account_ref)
  WHERE status IN ('PENDING_EDIT','ACTIVE');
CREATE INDEX ix_health_center_active_staff
  ON health_center_account_affiliation(root_realm_id,account_ref,center_id)
  WHERE status='ACTIVE';
