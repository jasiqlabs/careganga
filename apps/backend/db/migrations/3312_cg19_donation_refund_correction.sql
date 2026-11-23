-- CG19: an issued original receipt remains immutable; a verified posted refund
-- gets one distinct protected source-bound correction, not a replaced PDF.
CREATE SEQUENCE cg19_donation_correction_sequence;
CREATE TABLE cg19_donation_receipt_correction(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 original_receipt_id uuid NOT NULL,
 refund_request_id uuid NOT NULL,
 correction_number text NOT NULL DEFAULT
 ('CG-COR-'||lpad(nextval('cg19_donation_correction_sequence')::text,9,'0')),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 issue_key uuid NOT NULL,
 issued_by uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','UNKNOWN','ISSUED')),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 40 AND 400),
 object_version text,
 content_sha256 char(64) CHECK(content_sha256~'^[a-f0-9]{64}$'),
 content_length integer CHECK(content_length BETWEEN 1 AND 10485760),
 issued_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,refund_request_id),
 UNIQUE(root_realm_id,correction_number),
 UNIQUE(root_realm_id,issued_by,issue_key),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,original_receipt_id)
  REFERENCES cg19_donation_receipt_document(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,refund_request_id)
  REFERENCES donation_refund_request(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='ISSUED' AND object_version IS NOT NULL AND content_sha256 IS NOT NULL
  AND content_length IS NOT NULL AND issued_at IS NOT NULL)
  OR (status IN('PENDING','UNKNOWN') AND object_version IS NULL AND content_sha256 IS NULL
  AND content_length IS NULL AND issued_at IS NULL))
);
CREATE INDEX ix_cg19_correction_donation
 ON cg19_donation_receipt_correction(root_realm_id,donation_id,issued_at DESC,id DESC);
CREATE FUNCTION cg19_correction_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Correction cannot be deleted'; END IF;
 IF OLD.status='ISSUED' OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
 NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
 NEW.original_receipt_id IS DISTINCT FROM OLD.original_receipt_id OR
 NEW.refund_request_id IS DISTINCT FROM OLD.refund_request_id OR
 NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
 NEW.correction_number IS DISTINCT FROM OLD.correction_number OR
 NEW.issue_key IS DISTINCT FROM OLD.issue_key OR
 NEW.issued_by IS DISTINCT FROM OLD.issued_by OR
 NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
 NEW.object_key IS DISTINCT FROM OLD.object_key THEN
  RAISE EXCEPTION 'Correction identity is immutable';
 END IF;
 RETURN NEW;
END;$cg19$;
CREATE TRIGGER cg19_correction_history_guard
 BEFORE UPDATE OR DELETE ON cg19_donation_receipt_correction
 FOR EACH ROW EXECUTE FUNCTION cg19_correction_immutable();
CREATE FUNCTION cg19_correction_posted_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NEW.status<>'ISSUED' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM donation d
  JOIN cg19_donation_receipt_document o ON o.root_realm_id=d.root_realm_id AND o.donation_id=d.id
  JOIN donation_refund_request r ON r.root_realm_id=d.root_realm_id AND r.donation_id=d.id
  JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  JOIN journal collected ON collected.root_realm_id=e.root_realm_id AND collected.id=e.journal_id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND d.source_status='RECEIVED_POSTED' AND o.id=NEW.original_receipt_id
   AND o.status='ISSUED' AND o.source_digest=e.immutable_digest
   AND r.id=NEW.refund_request_id AND r.status='FINANCE_REVERSED'
   AND r.amount_minor=NEW.amount_minor AND j.status='POSTED'
   AND j.source_ref=r.id AND j.immutable_payload_digest=NEW.source_digest
   AND j.immutable_source_event_key=r.approval_request_key
   AND e.status='POSTED' AND collected.status='POSTED' AND collected.source_ref=d.id)
 THEN RAISE EXCEPTION 'Actual posted CG09 refund and issued original CG19 receipt required'; END IF;
 RETURN NULL;
END;$cg19$;
CREATE CONSTRAINT TRIGGER cg19_correction_posted_refund
 AFTER INSERT OR UPDATE ON cg19_donation_receipt_correction
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg19_correction_posted_refund_guard();
