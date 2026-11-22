-- CG07 US002: trusted provider link is distinct from received money.
ALTER TABLE donation_payment_attempt
 ADD COLUMN checkout_url text,
 ADD COLUMN link_started_at timestamptz,
 ADD CONSTRAINT cg07_payment_link_https CHECK(checkout_url IS NULL OR
   (checkout_url LIKE 'https://rzp.io/%' AND length(checkout_url)<=500));
ALTER TABLE donation_payment_attempt DROP CONSTRAINT donation_payment_attempt_status_check;
ALTER TABLE donation_payment_attempt ADD CONSTRAINT cg07_donation_attempt_status_check
 CHECK(status IN('DRAFT','LINK_READY','PAYMENT_PENDING','VERIFIED_EXTERNAL',
  'RECONCILIATION_PENDING','OUTCOME_UNKNOWN','RECEIVED_POSTED','FAILED','EXPIRED'));
CREATE UNIQUE INDEX uq_cg07_provider_payment_link
 ON donation_payment_attempt(root_realm_id,provider,external_reference)
 WHERE external_reference IS NOT NULL;
CREATE INDEX ix_cg07_provider_reconcile
 ON donation_payment_attempt(root_realm_id,status,created_at,id)
 WHERE status IN('OUTCOME_UNKNOWN','VERIFIED_EXTERNAL','RECONCILIATION_PENDING');
-- Only an amount/currency exact original donation and the locked attempt
-- may acquire a signed provider event. Signature and API verification remain
-- enforced in the CG07 HTTP owner, never delegated to caller-supplied flags.
CREATE FUNCTION cg07_guard_payment_event_source() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM donation_payment_attempt a
  JOIN donation d ON d.root_realm_id=a.root_realm_id AND d.id=a.donation_id
  WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.attempt_id
   AND a.donation_id=NEW.donation_id AND a.method='ONLINE'
   AND a.provider=NEW.provider AND a.merchant_reference=NEW.merchant_reference
   AND a.external_reference IS NOT NULL
   AND d.amount_minor=NEW.amount_minor AND d.currency=NEW.currency)
 THEN RAISE EXCEPTION 'Verified payment source/merchant/amount is not exact'; END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg07_guard_payment_event BEFORE INSERT ON donation_payment_event
 FOR EACH ROW EXECUTE FUNCTION cg07_guard_payment_event_source();
