-- CG07 source refund intent: reserves only genuinely posted original money.
-- CG09 alone owns a linked balancing journal; no second CG07 finance ledger.
CREATE TABLE donation_refund_request(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 300),
 status text NOT NULL DEFAULT 'REQUESTED'
  CHECK(status IN('REQUESTED','FINANCE_REVERSED','CANCELLED')),
 requested_by uuid NOT NULL,
 approved_by uuid,
 approval_request_key uuid,
 voucher_reference text CHECK(voucher_reference IS NULL OR
   length(btrim(voucher_reference)) BETWEEN 4 AND 100),
 cash_account_ref uuid,
 income_account_ref uuid,
 financial_year_ref uuid,
 posting_date date,
 reversal_journal_ref uuid,
 password_verified_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,requested_by,request_key),
 UNIQUE(root_realm_id,approval_request_key),
 UNIQUE(root_realm_id,voucher_reference),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(cash_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(income_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(financial_year_ref,root_realm_id) REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_journal_ref,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((status='REQUESTED' AND approved_by IS NULL AND approval_request_key IS NULL
   AND reversal_journal_ref IS NULL AND password_verified_at IS NULL AND verified_at IS NULL)
  OR (status='FINANCE_REVERSED' AND approved_by IS NOT NULL AND approved_by<>requested_by
   AND approval_request_key IS NOT NULL AND reversal_journal_ref IS NOT NULL
   AND voucher_reference IS NOT NULL AND cash_account_ref IS NOT NULL
   AND income_account_ref IS NOT NULL AND financial_year_ref IS NOT NULL
   AND posting_date IS NOT NULL AND password_verified_at IS NOT NULL AND verified_at IS NOT NULL)
  OR (status='CANCELLED' AND reversal_journal_ref IS NULL AND verified_at IS NULL))
);
CREATE INDEX ix_cg07_refund_queue ON donation_refund_request(root_realm_id,status,requested_at DESC,id DESC);
CREATE INDEX ix_cg07_refund_donation ON donation_refund_request(root_realm_id,donation_id,status);
-- Even direct SQL inserts cannot reserve more than one original posted
-- payment. Parent lock serializes concurrent requests across backend nodes.
CREATE FUNCTION cg07_refund_source_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
DECLARE received bigint; reserved numeric;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund requests are immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'REQUESTED' OR NEW.status NOT IN('FINANCE_REVERSED','CANCELLED') OR
   NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
   NEW.id IS DISTINCT FROM OLD.id OR NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
   NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
   NEW.request_key IS DISTINCT FROM OLD.request_key OR
   NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
   NEW.reason IS DISTINCT FROM OLD.reason OR NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
   NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
   RAISE EXCEPTION 'Refund source must not be rewritten'; END IF;
 ELSE
  IF NEW.status<>'REQUESTED' THEN RAISE EXCEPTION 'New refunds must await verification'; END IF;
 END IF;
 SELECT d.amount_minor INTO received FROM donation d
 JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
 JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
 WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
  AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED'
  AND j.status='POSTED' AND j.source_ref=d.id FOR UPDATE OF d;
 IF received IS NULL THEN RAISE EXCEPTION 'Refund requires an original verified received donation'; END IF;
 IF NEW.status<>'CANCELLED' THEN
  SELECT coalesce(sum(amount_minor),0) INTO reserved
  FROM donation_refund_request
  WHERE root_realm_id=NEW.root_realm_id AND donation_id=NEW.donation_id
   AND status<>'CANCELLED' AND id<>NEW.id;
  IF reserved+NEW.amount_minor>received THEN
   RAISE EXCEPTION 'Combined refund requests exceed original received amount';
  END IF;
 END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg07_refund_source_reserve BEFORE INSERT OR UPDATE OR DELETE ON donation_refund_request
 FOR EACH ROW EXECUTE FUNCTION cg07_refund_source_guard();
CREATE FUNCTION cg07_refund_finance_proof() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NEW.status<>'FINANCE_REVERSED' THEN RETURN NULL; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM journal j JOIN donation d
   ON d.root_realm_id=j.root_realm_id
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND j.id=NEW.reversal_journal_ref AND j.root_realm_id=NEW.root_realm_id
   AND j.source_ref=NEW.id AND j.status='POSTED' AND j.posting_kind='GENERAL'
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
CREATE CONSTRAINT TRIGGER cg07_refund_requires_posted_finance
 AFTER UPDATE ON donation_refund_request DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg07_refund_finance_proof();
