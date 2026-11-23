-- CG07 provider refund safety prerequisite: original captured payment ID
-- must come from an authenticated Razorpay webhook AND an independent merchant API
-- read. Never derive refund target from donor-provided UTR, email, URL or link ID.
ALTER TABLE donation_payment_event ADD COLUMN provider_payment_id text;
ALTER TABLE donation_payment_event ADD CONSTRAINT cg07_success_payment_id_check
 CHECK(outcome<>'SUCCESS' OR (provider='razorpay' AND provider_payment_id~
  '^pay_[A-Za-z0-9]{8,}$'));
CREATE UNIQUE INDEX uq_cg07_signed_captured_payment_id
 ON donation_payment_event(root_realm_id,provider,provider_payment_id)
 WHERE provider_payment_id IS NOT NULL AND outcome='SUCCESS';
-- Keep original immutable event trigger in force. Payment ID cannot be rewritten
-- after original signed event is inserted; root and amount remain source-frozen.
