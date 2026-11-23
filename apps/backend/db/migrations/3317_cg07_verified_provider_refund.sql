-- CG07 original Razorpay refund provenance; the original CG09 journal remains
-- the only finance truth. Capture and refund IDs MUST originate from signed
-- callback + independently fetched merchant objects, never a donor-provided ID.
ALTER TABLE donation_refund_request
 ADD COLUMN settlement_method text NOT NULL DEFAULT 'CASH'
 CHECK(settlement_method IN('CASH','ONLINE'));
CREATE TABLE donation_provider_refund(
 root_realm_id uuid NOT NULL,
 refund_request_id uuid NOT NULL,
 donation_id uuid NOT NULL,
 captured_event_id uuid NOT NULL,
 captured_payment_id text NOT NULL CHECK(captured_payment_id~'^pay_[A-Za-z0-9]{8,}$'),
 provider_receipt text NOT NULL CHECK(provider_receipt~'^CG07RF[a-f0-9]{32}$'),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 authorized_by uuid NOT NULL,
 state text NOT NULL DEFAULT 'RESERVED' CHECK(state IN('RESERVED','OUTCOME_UNKNOWN',
   'PROVIDER_PENDING','PROVIDER_PROCESSED','PROVIDER_FAILED','FINANCE_POSTED')),
 provider_refund_id text CHECK(provider_refund_id~'^rfnd_[A-Za-z0-9]{8,}$'),
 signed_event_id text CHECK(signed_event_id~'^[A-Za-z0-9_-]{8,160}$'),
 signed_digest char(64) CHECK(signed_digest~'^[a-f0-9]{64}$'),
 processed_at timestamptz,
 posted_by uuid,
 approval_request_key uuid,
 finance_digest char(64) CHECK(finance_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,refund_request_id),
 UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,provider_receipt),
 UNIQUE(root_realm_id,provider_refund_id),
 UNIQUE(root_realm_id,signed_event_id),
 FOREIGN KEY(root_realm_id,refund_request_id)
  REFERENCES donation_refund_request(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,donation_id)
  REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,captured_event_id)
  REFERENCES donation_payment_event(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(authorized_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(posted_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((state IN('RESERVED','OUTCOME_UNKNOWN') AND signed_event_id IS NULL AND
  signed_digest IS NULL AND processed_at IS NULL AND posted_by IS NULL)
  OR (state='PROVIDER_PENDING' AND provider_refund_id IS NOT NULL AND
   signed_event_id IS NULL AND processed_at IS NULL AND posted_by IS NULL)
  OR (state='PROVIDER_PROCESSED' AND provider_refund_id IS NOT NULL AND
   signed_event_id IS NOT NULL AND signed_digest IS NOT NULL AND processed_at IS NOT NULL
   AND posted_by IS NULL AND finance_digest IS NULL)
  OR (state='FINANCE_POSTED' AND provider_refund_id IS NOT NULL AND
   signed_event_id IS NOT NULL AND signed_digest IS NOT NULL AND processed_at IS NOT NULL
   AND posted_by IS NOT NULL AND approval_request_key IS NOT NULL AND finance_digest IS NOT NULL)
  OR (state='PROVIDER_FAILED' AND posted_by IS NULL AND finance_digest IS NULL))
);
CREATE INDEX ix_cg07_provider_refund_queue
 ON donation_provider_refund(root_realm_id,state,created_at DESC,refund_request_id);
CREATE FUNCTION cg07_provider_refund_integrity() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original provider refund history is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.state<>'RESERVED'
  THEN RAISE EXCEPTION 'Provider refund starts RESERVED'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.state IN('PROVIDER_FAILED','FINANCE_POSTED') OR
   NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
   NEW.refund_request_id IS DISTINCT FROM OLD.refund_request_id OR
   NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
   NEW.captured_event_id IS DISTINCT FROM OLD.captured_event_id OR
   NEW.captured_payment_id IS DISTINCT FROM OLD.captured_payment_id OR
   NEW.provider_receipt IS DISTINCT FROM OLD.provider_receipt OR
   NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
   NEW.request_key IS DISTINCT FROM OLD.request_key OR
   NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
   NEW.authorized_by IS DISTINCT FROM OLD.authorized_by OR
   NEW.created_at IS DISTINCT FROM OLD.created_at OR
   (OLD.provider_refund_id IS NOT NULL AND
    NEW.provider_refund_id IS DISTINCT FROM OLD.provider_refund_id) OR
   (OLD.signed_event_id IS NOT NULL AND
    NEW.signed_event_id IS DISTINCT FROM OLD.signed_event_id) OR
   (OLD.signed_digest IS NOT NULL AND NEW.signed_digest IS DISTINCT FROM OLD.signed_digest) OR
   (OLD.processed_at IS NOT NULL AND NEW.processed_at IS DISTINCT FROM OLD.processed_at) OR
   (OLD.state='PROVIDER_PROCESSED' AND NEW.state<>'FINANCE_POSTED') OR
   (OLD.state IN('RESERVED','OUTCOME_UNKNOWN') AND
    NEW.state NOT IN('OUTCOME_UNKNOWN','PROVIDER_PENDING','PROVIDER_PROCESSED','PROVIDER_FAILED')) OR
   (OLD.state='PROVIDER_PENDING' AND NEW.state NOT IN
    ('PROVIDER_PROCESSED','PROVIDER_FAILED','OUTCOME_UNKNOWN'))
  THEN RAISE EXCEPTION 'Original provider refund attempt cannot be rewritten'; END IF;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM donation_refund_request r JOIN donation_payment_event capture
   ON capture.root_realm_id=r.root_realm_id
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.refund_request_id
   AND r.donation_id=NEW.donation_id AND r.amount_minor=NEW.amount_minor
   AND capture.id=NEW.captured_event_id AND capture.donation_id=r.donation_id
   AND capture.outcome='SUCCESS' AND capture.provider='razorpay'
   AND capture.provider_payment_id=NEW.captured_payment_id
   AND r.requested_by<>NEW.authorized_by)
 THEN RAISE EXCEPTION 'Actual separately authorized captured donation refund source required'; END IF;
 RETURN NEW;
END;$cg07$;
CREATE TRIGGER cg07_provider_refund_no_retarget
 BEFORE INSERT OR UPDATE OR DELETE ON donation_provider_refund
 FOR EACH ROW EXECUTE FUNCTION cg07_provider_refund_integrity();
-- Extend existing cash-only deferred proof; retain the original CASH branch
-- exactly, append independent provider-processed CG09 reversal branch.
CREATE OR REPLACE FUNCTION cg07_refund_finance_proof() RETURNS trigger LANGUAGE plpgsql AS $cg07$

BEGIN
 IF NEW.status<>'FINANCE_REVERSED' THEN RETURN NULL; END IF;
 IF NEW.settlement_method='ONLINE' THEN
  IF NOT EXISTS(SELECT 1 FROM donation_provider_refund p
   JOIN donation_payment_event original
    ON original.root_realm_id=p.root_realm_id AND original.id=p.captured_event_id
   JOIN journal j ON j.root_realm_id=p.root_realm_id AND j.id=NEW.reversal_journal_ref
   JOIN donation_finance_effect e ON e.root_realm_id=p.root_realm_id AND e.donation_id=p.donation_id
   JOIN journal received ON received.root_realm_id=e.root_realm_id AND received.id=e.journal_id
   WHERE p.root_realm_id=NEW.root_realm_id AND p.refund_request_id=NEW.id
    AND p.donation_id=NEW.donation_id AND p.state='FINANCE_POSTED'
    AND p.posted_by=NEW.approved_by AND p.approval_request_key=NEW.approval_request_key
    AND p.signed_event_id IS NOT NULL AND p.signed_digest IS NOT NULL
    AND p.provider_refund_id IS NOT NULL AND p.processed_at IS NOT NULL
    AND original.outcome='SUCCESS' AND original.provider='razorpay'
    AND original.provider_payment_id=p.captured_payment_id
    AND original.amount_minor>=NEW.amount_minor
    AND e.status='POSTED' AND received.status='POSTED'
    AND received.source_ref=NEW.donation_id
    AND j.status='POSTED' AND j.posting_kind='GENERAL'
    AND j.source_ref=NEW.id AND j.immutable_source_event_key=NEW.approval_request_key
    AND j.created_by=NEW.approved_by AND j.financial_year_id=NEW.financial_year_ref
    AND j.posting_date=NEW.posting_date
    AND j.immutable_payload_digest=p.finance_digest
    AND (SELECT count(*) FROM journal_line l
     WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2
    AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id
     AND l.journal_id=j.id AND l.account_id=NEW.income_account_ref
     AND l.debit_minor=NEW.amount_minor AND l.credit_minor=0)
    AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id
     AND l.journal_id=j.id AND l.account_id=NEW.cash_account_ref
     AND l.credit_minor=NEW.amount_minor AND l.debit_minor=0))
  THEN RAISE EXCEPTION 'Refund requires processed signed Razorpay payout and exact CG09 reversal'; END IF;
  RETURN NULL;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM journal j JOIN donation d
   ON d.root_realm_id=j.root_realm_id
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND j.id=NEW.reversal_journal_ref AND j.root_realm_id=NEW.root_realm_id
   AND j.source_ref=NEW.id AND j.status='POSTED' AND j.posting_kind='GENERAL'
   AND j.immutable_source_event_key=NEW.approval_request_key
   AND EXISTS(SELECT 1 FROM donation_manual_evidence original
     WHERE original.root_realm_id=NEW.root_realm_id
       AND original.donation_id=NEW.donation_id AND original.status='POSTED'
       AND original.cash_account_ref=NEW.cash_account_ref
       AND original.income_account_ref=NEW.income_account_ref)
   AND EXISTS(SELECT 1 FROM journal_line ln
     WHERE ln.root_realm_id=j.root_realm_id AND ln.journal_id=j.id
       AND ln.account_id=NEW.income_account_ref
       AND ln.debit_minor=NEW.amount_minor AND ln.credit_minor=0)
   AND EXISTS(SELECT 1 FROM journal_line ln
     WHERE ln.root_realm_id=j.root_realm_id AND ln.journal_id=j.id
       AND ln.account_id=NEW.cash_account_ref
       AND ln.credit_minor=NEW.amount_minor AND ln.debit_minor=0)
   AND j.created_by=NEW.approved_by AND j.financial_year_id=NEW.financial_year_ref
   AND j.posting_date=NEW.posting_date
   AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id
      AND l.journal_id=j.id)=2
   AND (SELECT coalesce(sum(l.debit_minor),0) FROM journal_line l
      WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=NEW.amount_minor
   AND (SELECT coalesce(sum(l.credit_minor),0) FROM journal_line l
      WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=NEW.amount_minor
   AND e.status='POSTED')
 THEN RAISE EXCEPTION 'Original CG09 posted refund finance proof is missing'; END IF;
 RETURN NULL;
END; $cg07$;
