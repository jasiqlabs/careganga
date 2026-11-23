-- CG07 offline donation: CG09 BANK asset -> suspense LIABILITY until an
-- independently reviewed, CLEAN_VERIFIED CG19 statement matches exactly.
-- Only then may CG09 reclassify LIABILITY -> donation INCOME.
CREATE TABLE donation_bank_collection(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 reconciliation_id uuid NOT NULL,
 initial_journal_id uuid NOT NULL,
 final_journal_id uuid,
 reversal_journal_id uuid,
 method text NOT NULL CHECK(method IN('BANK','CHEQUE','NEFT')),
 bank_account_ref uuid NOT NULL,
 suspense_account_ref uuid NOT NULL,
 income_account_ref uuid NOT NULL,
 financial_year_ref uuid NOT NULL,
 posting_date date NOT NULL,
 bank_item_ref text NOT NULL CHECK(length(btrim(bank_item_ref)) BETWEEN 4 AND 100),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 request_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 recorded_by uuid NOT NULL,
 verified_by uuid,
 source_status text NOT NULL DEFAULT 'PENDING'
  CHECK(source_status IN('PENDING','VERIFIED_POSTED','REJECTED_REVERSED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,donation_id),
 UNIQUE(root_realm_id,attempt_id),
 UNIQUE(root_realm_id,reconciliation_id),
 UNIQUE(root_realm_id,recorded_by,request_key),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attempt_id,donation_id)
  REFERENCES donation_payment_attempt(root_realm_id,id,donation_id) ON DELETE RESTRICT,
 FOREIGN KEY(reconciliation_id,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(initial_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(final_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(bank_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(suspense_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(income_account_ref,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(financial_year_ref,root_realm_id) REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(bank_account_ref<>suspense_account_ref AND bank_account_ref<>income_account_ref
  AND suspense_account_ref<>income_account_ref),
 CHECK((source_status='PENDING' AND final_journal_id IS NULL
    AND reversal_journal_id IS NULL AND verified_by IS NULL)
  OR (source_status='VERIFIED_POSTED' AND final_journal_id IS NOT NULL
    AND reversal_journal_id IS NULL AND verified_by IS NOT NULL AND verified_by<>recorded_by)
  OR (source_status='REJECTED_REVERSED' AND final_journal_id IS NULL
    AND reversal_journal_id IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>recorded_by))
);
CREATE INDEX ix_cg07_bank_collection_queue
 ON donation_bank_collection(root_realm_id,source_status,created_at DESC,id DESC);
CREATE FUNCTION cg07_bank_collection_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original bank donation collection cannot be deleted'; END IF;
 IF TG_OP='INSERT' AND NEW.source_status<>'PENDING' THEN
  RAISE EXCEPTION 'Bank donation starts pending review';
 END IF;
 IF TG_OP='UPDATE' AND
  (OLD.source_status<>'PENDING' OR NEW.source_status NOT IN('VERIFIED_POSTED','REJECTED_REVERSED')
   OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
   OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.donation_id IS DISTINCT FROM OLD.donation_id
   OR NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
   OR NEW.reconciliation_id IS DISTINCT FROM OLD.reconciliation_id
   OR NEW.initial_journal_id IS DISTINCT FROM OLD.initial_journal_id
   OR NEW.method IS DISTINCT FROM OLD.method
   OR NEW.bank_account_ref IS DISTINCT FROM OLD.bank_account_ref
   OR NEW.suspense_account_ref IS DISTINCT FROM OLD.suspense_account_ref
   OR NEW.income_account_ref IS DISTINCT FROM OLD.income_account_ref
   OR NEW.financial_year_ref IS DISTINCT FROM OLD.financial_year_ref
   OR NEW.posting_date IS DISTINCT FROM OLD.posting_date
   OR NEW.bank_item_ref IS DISTINCT FROM OLD.bank_item_ref
   OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
   OR NEW.request_key IS DISTINCT FROM OLD.request_key
   OR NEW.source_digest IS DISTINCT FROM OLD.source_digest
   OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
   OR NEW.created_at IS DISTINCT FROM OLD.created_at)
 THEN RAISE EXCEPTION 'Bank donation source identity is immutable'; END IF;
 RETURN NEW;
END;$cg07$;
CREATE TRIGGER cg07_bank_collection_immutable
 BEFORE INSERT OR UPDATE OR DELETE ON donation_bank_collection
 FOR EACH ROW EXECUTE FUNCTION cg07_bank_collection_identity_guard();
CREATE FUNCTION cg07_bank_collection_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM donation d
  JOIN donation_payment_attempt a ON a.root_realm_id=d.root_realm_id AND a.donation_id=d.id
  JOIN finance_bank_reconciliation r ON r.id=NEW.reconciliation_id AND r.root_realm_id=d.root_realm_id
  JOIN journal provisional ON provisional.root_realm_id=r.root_realm_id AND provisional.id=r.journal_id
  WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
   AND a.id=NEW.attempt_id AND a.method=NEW.method
   AND r.bank_account_id=NEW.bank_account_ref
   AND r.journal_id=NEW.initial_journal_id AND r.recorded_by=NEW.recorded_by
   AND r.bank_item_ref=NEW.bank_item_ref AND r.variance_minor=0
   AND r.statement_amount_minor=NEW.amount_minor AND r.posted_amount_minor=NEW.amount_minor
   AND provisional.status='POSTED' AND provisional.source_ref=d.id
   AND provisional.immutable_payload_digest=NEW.source_digest
   AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=provisional.root_realm_id
     AND l.journal_id=provisional.id)=2
   AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=provisional.root_realm_id
    AND l.journal_id=provisional.id AND l.account_id=NEW.bank_account_ref
    AND l.debit_minor=NEW.amount_minor AND l.credit_minor=0)
   AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=provisional.root_realm_id
    AND l.journal_id=provisional.id AND l.account_id=NEW.suspense_account_ref
    AND l.credit_minor=NEW.amount_minor AND l.debit_minor=0)
 ) THEN RAISE EXCEPTION 'Original provisional bank journal/reconciliation proof missing'; END IF;
 IF NEW.source_status='PENDING' THEN RETURN NULL; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM finance_bank_reconciliation r
  JOIN finance_reconciliation_decision decision
   ON decision.root_realm_id=r.root_realm_id AND decision.reconciliation_id=r.id
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.reconciliation_id
   AND decision.actor_ref=NEW.verified_by AND r.verified_by=NEW.verified_by
   AND r.recorded_by=NEW.recorded_by
   AND ((NEW.source_status='VERIFIED_POSTED' AND r.status='VERIFIED'
     AND decision.action='VERIFY' AND decision.statement_file_id IS NOT NULL
     AND decision.statement_file_version IS NOT NULL)
    OR (NEW.source_status='REJECTED_REVERSED' AND r.status='REJECTED'
     AND decision.action='REJECT'))
 ) THEN RAISE EXCEPTION 'Real independent CG09 bank decision and CG19 proof required'; END IF;
 IF NEW.source_status='VERIFIED_POSTED' THEN
  IF NOT EXISTS(SELECT 1 FROM donation d
   JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
   JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
   WHERE d.root_realm_id=NEW.root_realm_id AND d.id=NEW.donation_id
    AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED'
    AND j.id=NEW.final_journal_id AND j.status='POSTED' AND j.source_ref=d.id
    AND j.immutable_source_event_key=e.source_event_key
    AND j.immutable_payload_digest=e.immutable_digest
    AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2
    AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id
     AND l.account_id=NEW.suspense_account_ref AND l.debit_minor=NEW.amount_minor AND l.credit_minor=0)
    AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id
     AND l.account_id=NEW.income_account_ref AND l.credit_minor=NEW.amount_minor AND l.debit_minor=0))
  THEN RAISE EXCEPTION 'Bank donation requires real income reclassification'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM journal j WHERE j.root_realm_id=NEW.root_realm_id
   AND j.id=NEW.reversal_journal_id AND j.status='POSTED' AND j.source_ref=NEW.id
   AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2
   AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id
    AND l.account_id=NEW.suspense_account_ref AND l.debit_minor=NEW.amount_minor AND l.credit_minor=0)
   AND EXISTS(SELECT 1 FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id
    AND l.account_id=NEW.bank_account_ref AND l.credit_minor=NEW.amount_minor AND l.debit_minor=0))
  THEN RAISE EXCEPTION 'Rejected bank collection requires real CG09 offset'; END IF;
 END IF;
 RETURN NULL;
END;$cg07$;
CREATE CONSTRAINT TRIGGER cg07_bank_collection_posted_proof
 AFTER INSERT OR UPDATE ON donation_bank_collection
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg07_bank_collection_proof_guard();
