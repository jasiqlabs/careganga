-- CG-01-owned verified mobile projection for CG-19 notifications.
-- Existing contact_phone is unverified. No default proof or automatic grant.
ALTER TABLE account ADD COLUMN contact_phone_verified_at timestamptz;
ALTER TABLE account ADD CONSTRAINT ck_cg01_verified_phone_requires_phone
  CHECK(contact_phone_verified_at IS NULL OR contact_phone IS NOT NULL);
CREATE INDEX ix_cg01_verified_mobile_recipient
  ON account(realm_id,id) WHERE contact_phone IS NOT NULL
  AND contact_phone_verified_at IS NOT NULL AND status='ACTIVE';
