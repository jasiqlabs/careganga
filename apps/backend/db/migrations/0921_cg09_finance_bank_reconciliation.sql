-- CG-09 US-006: original bank-item reconciliations against existing posted CG09
-- journal lines. Manual independent attestation is NOT gateway settlement proof.
CREATE TABLE finance_bank_reconciliation(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 bank_account_id uuid NOT NULL,
 journal_id uuid NOT NULL,
 financial_year_id uuid NOT NULL,
 statement_date date NOT NULL,
 bank_item_ref text NOT NULL CHECK(char_length(btrim(bank_item_ref)) BETWEEN 4 AND 100),
 statement_amount_minor bigint NOT NULL CHECK(statement_amount_minor<>0
   AND abs(statement_amount_minor)<=99999999999999),
 posted_amount_minor bigint NOT NULL CHECK(posted_amount_minor<>0
   AND abs(posted_amount_minor)<=99999999999999),
 variance_minor bigint NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','VERIFIED','REJECTED')),
 recorded_by uuid NOT NULL,
 verified_by uuid,
 verified_at timestamptz,
 request_key uuid NOT NULL,
 content_digest char(64) NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,bank_account_id,bank_item_ref),
 UNIQUE(root_realm_id,bank_account_id,journal_id),
 UNIQUE(root_realm_id,recorded_by,request_key),
 UNIQUE(id,root_realm_id),
 FOREIGN KEY(bank_account_id,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(financial_year_id,root_realm_id)
  REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(variance_minor=statement_amount_minor-posted_amount_minor),
 CHECK((status='PENDING' AND verified_by IS NULL AND verified_at IS NULL) OR
  (status IN('VERIFIED','REJECTED') AND verified_by IS NOT NULL AND verified_at IS NOT NULL)),
 CHECK(verified_by IS DISTINCT FROM recorded_by)
);
CREATE INDEX ix_cg09_reconcile_bank_dates ON finance_bank_reconciliation
 (root_realm_id,bank_account_id,statement_date DESC,id DESC);
CREATE INDEX ix_cg09_reconcile_unverified ON finance_bank_reconciliation
 (root_realm_id,status,recorded_at DESC,id DESC);

CREATE TABLE finance_reconciliation_decision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 reconciliation_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('VERIFY','REJECT')),
 original_digest char(64) NOT NULL CHECK(original_digest~'^[a-f0-9]{64}$'),
 password_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 UNIQUE(root_realm_id,reconciliation_id),
 FOREIGN KEY(reconciliation_id,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_reconciliation_decision_immutable
 BEFORE UPDATE OR DELETE ON finance_reconciliation_decision
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_reconciliation_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_account_kind text; bank_line_count bigint; bank_amount bigint; source_year uuid;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Bank reconciliation source cannot be deleted' USING ERRCODE='P0926';
 END IF;
 IF TG_OP='INSERT' THEN
  SELECT a.account_kind INTO v_account_kind FROM finance_account a
   WHERE a.id=NEW.bank_account_id AND a.root_realm_id=NEW.root_realm_id FOR SHARE;
  IF NOT FOUND OR v_account_kind<>'BANK' THEN
   RAISE EXCEPTION 'An actual bank account is required' USING ERRCODE='P0926';
  END IF;
  SELECT j.financial_year_id,COUNT(l.id),COALESCE(SUM(l.debit_minor-l.credit_minor),0)
   INTO source_year,bank_line_count,bank_amount
   FROM journal j JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id
   WHERE j.id=NEW.journal_id AND j.root_realm_id=NEW.root_realm_id
    AND j.status='POSTED' AND l.account_id=NEW.bank_account_id
   GROUP BY j.id,j.financial_year_id;
  IF NOT FOUND OR bank_line_count<>1 OR source_year<>NEW.financial_year_id OR
     bank_amount<>NEW.posted_amount_minor OR
     NEW.variance_minor<>NEW.statement_amount_minor-bank_amount THEN
    RAISE EXCEPTION 'Bank reconciliation must match exactly one posted bank line' USING ERRCODE='P0926';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id OR
    NEW.journal_id IS DISTINCT FROM OLD.journal_id OR
    NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id OR
    NEW.statement_date IS DISTINCT FROM OLD.statement_date OR
    NEW.bank_item_ref IS DISTINCT FROM OLD.bank_item_ref OR
    NEW.statement_amount_minor<>OLD.statement_amount_minor OR
    NEW.posted_amount_minor<>OLD.posted_amount_minor OR
    NEW.variance_minor<>OLD.variance_minor OR
    NEW.recorded_by IS DISTINCT FROM OLD.recorded_by OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.content_digest IS DISTINCT FROM OLD.content_digest OR
    NEW.recorded_at IS DISTINCT FROM OLD.recorded_at OR
    OLD.status<>'PENDING' OR NEW.status NOT IN('VERIFIED','REJECTED') OR
    NEW.verified_by IS NULL OR NEW.verified_at IS NULL THEN
  RAISE EXCEPTION 'A bank statement match cannot be rewritten' USING ERRCODE='P0926';
 END IF;
 PERFORM 1 FROM finance_reconciliation_decision d
 WHERE d.reconciliation_id=NEW.id AND d.root_realm_id=NEW.root_realm_id
   AND d.actor_ref=NEW.verified_by AND
   ((NEW.status='VERIFIED' AND d.action='VERIFY' AND NEW.variance_minor=0)
     OR(NEW.status='REJECTED' AND d.action='REJECT'))
   AND d.original_digest=NEW.content_digest
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'An independent signed bank reconciliation decision is required'
   USING ERRCODE='P0926';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_reconciliation_guard
 BEFORE INSERT OR UPDATE OR DELETE ON finance_bank_reconciliation
 FOR EACH ROW EXECUTE FUNCTION cg09_reconciliation_source_guard();
