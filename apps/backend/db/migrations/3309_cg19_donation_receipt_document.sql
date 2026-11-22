-- CG19 original document owner: a donation receipt is never a payment effect.
-- Source: one CG07 donation with one genuinely POSTED CG09 journal.
CREATE SEQUENCE cg19_donation_receipt_sequence;
CREATE TABLE cg19_donation_receipt_document(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 receipt_number text NOT NULL DEFAULT
  ('CG-REC-'||lpad(nextval('cg19_donation_receipt_sequence')::text,9,'0')),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 issue_key uuid NOT NULL,
 issued_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','UNKNOWN','ISSUED')),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 40 AND 400),
 object_version text,
 content_sha256 char(64) CHECK(content_sha256~'^[a-f0-9]{64}$'),
 content_length integer CHECK(content_length BETWEEN 1 AND 10485760),
 issued_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,donation_id),
 UNIQUE(root_realm_id,receipt_number),
 UNIQUE(root_realm_id,issued_by,issue_key),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='ISSUED' AND object_version IS NOT NULL AND content_sha256 IS NOT NULL
   AND content_length IS NOT NULL AND issued_at IS NOT NULL)
  OR (status IN('PENDING','UNKNOWN') AND object_version IS NULL AND content_sha256 IS NULL
   AND content_length IS NULL AND issued_at IS NULL))
);
CREATE INDEX ix_cg19_donation_receipt_recent
 ON cg19_donation_receipt_document(root_realm_id,created_at DESC,id DESC);
CREATE FUNCTION cg19_donation_receipt_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF OLD.status='ISSUED' THEN
  RAISE EXCEPTION 'Issued original donation receipt is immutable';
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR NEW.id IS DISTINCT FROM OLD.id OR
  NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
  NEW.receipt_number IS DISTINCT FROM OLD.receipt_number OR
  NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
  NEW.issue_key IS DISTINCT FROM OLD.issue_key OR
  NEW.issued_by IS DISTINCT FROM OLD.issued_by OR
  NEW.object_key IS DISTINCT FROM OLD.object_key OR NEW.created_at IS DISTINCT FROM OLD.created_at
 THEN RAISE EXCEPTION 'Original donation receipt identity is immutable'; END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_donation_receipt_no_rewrite BEFORE UPDATE ON cg19_donation_receipt_document
 FOR EACH ROW EXECUTE FUNCTION cg19_donation_receipt_identity_guard();
CREATE TRIGGER cg19_donation_receipt_no_delete BEFORE DELETE ON cg19_donation_receipt_document
 FOR EACH ROW EXECUTE FUNCTION cg07_campaign_event_immutable();

-- The receipt is source-bound only to a real CG09 journal, never an
-- unverified provider callback, link, pending request or bank note.
CREATE FUNCTION cg19_donation_receipt_issue_proof() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NEW.status<>'ISSUED' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM donation d
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED' AND j.status='POSTED'
   AND j.source_ref=d.id AND j.immutable_source_event_key=e.source_event_key
   AND j.immutable_payload_digest=e.immutable_digest
   AND NEW.source_digest=e.immutable_digest)
 THEN RAISE EXCEPTION 'Donation receipt requires current original verified finance post'; END IF;
 RETURN NULL;
END; $cg19$;
CREATE CONSTRAINT TRIGGER cg19_donation_receipt_proof
 AFTER INSERT OR UPDATE ON cg19_donation_receipt_document DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg19_donation_receipt_issue_proof();
