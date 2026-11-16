-- CG-01-owned verified mobile projection for CG-19 notifications.
-- Existing contact_phone is unverified. No default proof or automatic grant.
ALTER TABLE account ADD COLUMN contact_phone_verified_at timestamptz;
ALTER TABLE account ADD CONSTRAINT ck_cg01_verified_phone_requires_phone
  CHECK(contact_phone_verified_at IS NULL OR contact_phone IS NOT NULL);
CREATE INDEX ix_cg01_verified_mobile_recipient
  ON account(realm_id,id) WHERE contact_phone IS NOT NULL
  AND contact_phone_verified_at IS NOT NULL AND status='ACTIVE';

-- A contact number changed by any future CG-01 owner flow must lose proof.
CREATE FUNCTION cg01_phone_proof_reset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_phone IS DISTINCT FROM OLD.contact_phone THEN
    NEW.contact_phone_verified_at=NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg01_phone_proof_reset_before_contact_change
  BEFORE UPDATE OF contact_phone ON account
  FOR EACH ROW EXECUTE FUNCTION cg01_phone_proof_reset();

-- Only CG-01 owns recipient contact verification and MFA/OTP.
-- SMS credentials and provider attempts never enter CG-19 notifications.
CREATE TABLE cg01_mobile_verification (
  account_id uuid PRIMARY KEY,
  realm_id uuid NOT NULL,
  phone_fingerprint char(64) NOT NULL
    CHECK(phone_fingerprint ~ '^[a-f0-9]{64}$'),
  request_key uuid NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  status text NOT NULL CHECK(status IN ('PENDING','VERIFIED','UNAVAILABLE')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  FOREIGN KEY(account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg01_mobile_verification_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  realm_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN(
    'REQUESTED','PROVIDER_UNKNOWN','PROVIDER_ACCEPTED','VERIFIED','DENIED')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg01_mobile_event_account
  ON cg01_mobile_verification_event(realm_id,account_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg01_mobile_proof_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Phone verification evidence cannot be rewritten'; END; $$;
CREATE TRIGGER cg01_mobile_proof_event_immutable BEFORE UPDATE OR DELETE
  ON cg01_mobile_verification_event FOR EACH ROW
  EXECUTE FUNCTION cg01_mobile_proof_immutable();
