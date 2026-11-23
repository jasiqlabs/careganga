-- CG19 accountless donation receipt availability message: an explicitly requested
-- notice, not a donation, receipt, CG01 account, or shadow finance ledger.
-- Never store donor email, phone, PAN, status-token or private file URL here.
CREATE TABLE cg19_donation_receipt_message(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN('EMAIL','WHATSAPP')),
 request_key uuid NOT NULL,
 state text NOT NULL DEFAULT 'MESSAGE_PENDING'
  CHECK(state IN('MESSAGE_PENDING','SEND_RESERVED','PROVIDER_ACCEPTED',
   'PROVIDER_UNKNOWN','DELIVERY_FAILED')),
 attempt_key uuid,
 provider_ref text CHECK(provider_ref IS NULL OR length(provider_ref)<=160),
 requested_at timestamptz NOT NULL DEFAULT now(),
 attempted_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,donation_id,channel),
 UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,donation_id)
  REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,receipt_id)
  REFERENCES cg19_donation_receipt_document(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((state='MESSAGE_PENDING' AND attempt_key IS NULL AND attempted_at IS NULL
   AND provider_ref IS NULL)
  OR (state<>'MESSAGE_PENDING' AND attempt_key IS NOT NULL AND attempted_at IS NOT NULL))
);
CREATE INDEX ix_cg19_donation_message_status
 ON cg19_donation_receipt_message(root_realm_id,state,requested_at DESC,id DESC);
CREATE FUNCTION cg19_donation_message_integrity() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Receipt delivery history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
   NEW.id IS DISTINCT FROM OLD.id OR
   NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
   NEW.receipt_id IS DISTINCT FROM OLD.receipt_id OR
   NEW.channel IS DISTINCT FROM OLD.channel OR
   NEW.request_key IS DISTINCT FROM OLD.request_key OR
   NEW.requested_at IS DISTINCT FROM OLD.requested_at OR
   OLD.state NOT IN('MESSAGE_PENDING','SEND_RESERVED') OR
   (OLD.state='MESSAGE_PENDING' AND NEW.state NOT IN('SEND_RESERVED','MESSAGE_PENDING')) OR
   (OLD.state='SEND_RESERVED' AND NEW.state NOT IN
    ('PROVIDER_ACCEPTED','PROVIDER_UNKNOWN','DELIVERY_FAILED')) OR
   (OLD.attempt_key IS NOT NULL AND NEW.attempt_key IS DISTINCT FROM OLD.attempt_key)
  THEN RAISE EXCEPTION 'Original receipt message attempt is immutable or cannot be resent'; END IF;
 ELSE
  IF NEW.state<>'MESSAGE_PENDING' OR NEW.attempt_key IS NOT NULL
   THEN RAISE EXCEPTION 'New receipt notices must start pending'; END IF;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM donation d
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
  JOIN cg19_donation_receipt_document r
   ON r.root_realm_id=d.root_realm_id AND r.donation_id=d.id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED'
   AND j.status='POSTED' AND j.source_ref=d.id
   AND j.immutable_source_event_key=e.source_event_key
   AND j.immutable_payload_digest=e.immutable_digest
   AND r.id=NEW.receipt_id AND r.status='ISSUED'
   AND r.source_digest=e.immutable_digest
 ) THEN RAISE EXCEPTION 'Actual issued CG19 receipt and posted CG09 donation are required'; END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_donation_message_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg19_donation_receipt_message
 FOR EACH ROW EXECUTE FUNCTION cg19_donation_message_integrity();
