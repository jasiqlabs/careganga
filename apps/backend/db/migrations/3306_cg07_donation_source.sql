-- CG07 US002: own ONLY donation intent, proof and payment-event source.
-- A requested/link-ready/verified external payment is NEVER a CG09 posted receipt.
CREATE TABLE donation(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 campaign_id uuid,
 branch_ref uuid,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 donation_kind text NOT NULL CHECK(donation_kind IN('GENERAL','CAMPAIGN')),
 donor_private_ciphertext text NOT NULL CHECK(length(donor_private_ciphertext) BETWEEN 40 AND 3000),
 donor_consent_at timestamptz NOT NULL DEFAULT now(),
 status_token_digest char(64) NOT NULL CHECK(status_token_digest~'^[a-f0-9]{64}$'),
 status_token_expires_at timestamptz NOT NULL,
 source_status text NOT NULL DEFAULT 'REQUESTED'
  CHECK(source_status IN('REQUESTED','LINK_READY','PAYMENT_PENDING','VERIFIED_EXTERNAL',
   'RECONCILIATION_PENDING','RECEIVED_POSTED','FAILED','EXPIRED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,status_token_digest),
 FOREIGN KEY(root_realm_id,campaign_id) REFERENCES campaign(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((donation_kind='GENERAL' AND campaign_id IS NULL AND branch_ref IS NULL)
    OR (donation_kind='CAMPAIGN' AND campaign_id IS NOT NULL))
);
CREATE INDEX ix_cg07_donation_status ON donation(root_realm_id,source_status,created_at DESC,id DESC);
CREATE INDEX ix_cg07_donation_campaign ON donation(root_realm_id,campaign_id,created_at DESC,id DESC);
CREATE INDEX ix_cg07_donation_branch ON donation(root_realm_id,branch_ref,created_at DESC,id DESC);
CREATE TABLE donation_payment_attempt(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 request_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 method text NOT NULL CHECK(method IN('CASH','BANK','CHEQUE','NEFT','ONLINE')),
 provider text,
 merchant_reference text,
 external_reference text,
 status text NOT NULL CHECK(status IN('DRAFT','LINK_READY','PAYMENT_PENDING',
  'VERIFIED_EXTERNAL','RECONCILIATION_PENDING','RECEIVED_POSTED','FAILED','EXPIRED')),
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,donation_id,request_key),
 UNIQUE(root_realm_id,id,donation_id),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((method='ONLINE' AND provider IS NOT NULL) OR
   (method<>'ONLINE' AND provider IS NULL AND merchant_reference IS NULL))
);
CREATE TABLE donation_payment_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 provider text NOT NULL,
 merchant_reference text NOT NULL,
 external_event_id text NOT NULL,
 immutable_digest char(64) NOT NULL CHECK(immutable_digest~'^[a-f0-9]{64}$'),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 outcome text NOT NULL CHECK(outcome IN('SUCCESS','FAILED','REFUNDED')),
 signed_verified_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,provider,merchant_reference,external_event_id),
 FOREIGN KEY(root_realm_id,attempt_id,donation_id)
  REFERENCES donation_payment_attempt(root_realm_id,id,donation_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT
);
CREATE TRIGGER cg07_payment_event_immutable BEFORE UPDATE OR DELETE ON donation_payment_event
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_event_immutable();
CREATE TABLE donation_finance_effect(
 root_realm_id uuid NOT NULL,
 donation_id uuid NOT NULL,
 source_event_key uuid NOT NULL,
 immutable_digest char(64) NOT NULL CHECK(immutable_digest~'^[a-f0-9]{64}$'),
 journal_id uuid,
 status text NOT NULL CHECK(status IN('PENDING_FINANCE','RECONCILIATION_PENDING','POSTED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,donation_id),
 UNIQUE(root_realm_id,source_event_key),
 UNIQUE(root_realm_id,journal_id),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((status='POSTED')=(journal_id IS NOT NULL))
);
CREATE TABLE cg07_public_request_bucket(
 bucket_digest char(64) PRIMARY KEY CHECK(bucket_digest~'^[a-f0-9]{64}$'),
 window_started_at timestamptz NOT NULL,
 attempt_count integer NOT NULL CHECK(attempt_count BETWEEN 1 AND 2147483647)
);
-- No public client can independently promote a donation to RECEIVED_POSTED:
-- the transaction must contain a real original CG09 posted journal source.
CREATE FUNCTION cg07_donation_finance_proof() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR NEW.id IS DISTINCT FROM OLD.id OR
  NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.currency IS DISTINCT FROM OLD.currency OR
  NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
  NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR
  NEW.donor_private_ciphertext IS DISTINCT FROM OLD.donor_private_ciphertext OR
  NEW.status_token_digest IS DISTINCT FROM OLD.status_token_digest THEN
  RAISE EXCEPTION 'Donation source identity or original consent cannot change';
 END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Donation version must advance once'; END IF;
 IF NEW.source_status='RECEIVED_POSTED' AND
  NOT EXISTS(SELECT 1 FROM donation_finance_effect e JOIN journal j
   ON j.id=e.journal_id AND j.root_realm_id=e.root_realm_id
   WHERE e.root_realm_id=NEW.root_realm_id AND e.donation_id=NEW.id
     AND e.status='POSTED' AND j.status='POSTED'
     AND j.immutable_source_event_key=e.source_event_key
     AND j.immutable_payload_digest=e.immutable_digest)
 THEN RAISE EXCEPTION 'Original verified CG09 journal required for received donation'; END IF;
 RETURN NULL;
END; $cg07$;
CREATE CONSTRAINT TRIGGER cg07_donation_finance_guard
 AFTER UPDATE ON donation DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg07_donation_finance_proof();
