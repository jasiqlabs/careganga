-- CG15 US-003-QA03: family members may share a verified contact phone.
-- Only one account retains that number as a LOGIN identifier. Additional
-- distinct CG01 accounts must have their own unique verified email LOGIN;
-- never match or merge private patients by contact_phone.
-- Historic normalized_mobile login identifiers are unchanged.
ALTER TABLE account ALTER COLUMN normalized_mobile DROP NOT NULL;
ALTER TABLE account
 ADD CONSTRAINT ck_cg01_login_mobile_or_email_present
 CHECK (normalized_mobile IS NOT NULL OR normalized_email IS NOT NULL);
CREATE INDEX ix_cg01_verified_shared_contact
 ON account(realm_id,contact_phone,id)
 WHERE contact_phone_verified_at IS NOT NULL
 AND normalized_mobile IS NULL;
