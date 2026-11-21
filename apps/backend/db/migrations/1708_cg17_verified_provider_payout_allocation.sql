-- CG17 US006. Link only an EXISTING independently VERIFIED CG09 bank
-- reconciliation and its original balanced posted bank disbursement journal.
-- Never create a second bank ledger, initiate a transfer or infer its payee
-- from an unverified UPI screenshot. Reviewer must attest actual beneficiary.
CREATE TABLE provider_settlement_payment(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 settlement_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 bank_reconciliation_ref uuid NOT NULL,
 cg09_journal_ref uuid NOT NULL,
 liability_account_ref uuid NOT NULL,
 bank_account_ref uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 payee_matched_attested boolean NOT NULL CHECK(payee_matched_attested=true),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 request_key uuid NOT NULL,
 verified_by_account uuid NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,settlement_ref,bank_reconciliation_ref),
 UNIQUE(root_realm_id,bank_reconciliation_ref),
 UNIQUE(root_realm_id,cg09_journal_ref),
 UNIQUE(root_realm_id,verified_by_account,request_key),
 FOREIGN KEY(root_realm_id,settlement_ref,center_ref)
  REFERENCES provider_settlement(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(bank_reconciliation_ref,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(cg09_journal_ref,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(liability_account_ref,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(bank_account_ref,root_realm_id)
  REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verified_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg17_payout_by_claim ON provider_settlement_payment
 (root_realm_id,settlement_ref,verified_at,id);

CREATE FUNCTION cg17_verified_payout_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rec record; count_lines integer; bank_count integer; liability_count integer;
 source_line_count integer; matched_line_count integer;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Verified original CG09 provider payout is immutable';
 END IF;
 -- Claimed amount is approved independently, never a prepared draft.
 SELECT claim.state,claim.approved_total_minor,claim.paid_minor,
  claim.proposed_by,claim.destination_file_ref,
  claim.destination_version,claim.provider_ref
 INTO rec FROM provider_settlement claim
 WHERE claim.root_realm_id=NEW.root_realm_id AND claim.id=NEW.settlement_ref
  AND claim.center_ref=NEW.center_ref FOR UPDATE;
 IF NOT FOUND OR rec.state NOT IN('APPROVED','PARTIALLY_SETTLED') OR
  NEW.verified_by_account=rec.proposed_by OR
  NEW.amount_minor>rec.approved_total_minor-rec.paid_minor THEN
  RAISE EXCEPTION 'Original provider settlement cannot exceed its approved payable';
 END IF;
 -- CG14 provider bank destination remains the same scanned original.
 IF NOT EXISTS(
  SELECT 1 FROM health_center center
  JOIN health_provider provider
   ON provider.id=center.provider_id AND provider.root_realm_id=center.root_realm_id
  JOIN health_provider_finance_ref ref
   ON ref.root_realm_id=provider.root_realm_id
   AND ref.provider_id=provider.id
  JOIN cg19_stored_file file ON file.id=ref.protected_file_ref
   AND file.realm_id=ref.root_realm_id
  JOIN cg19_upload_intent intent ON intent.id=file.upload_intent_id
   AND intent.realm_id=file.realm_id
  WHERE center.id=NEW.center_ref AND center.root_realm_id=NEW.root_realm_id
   AND center.status='VERIFIED' AND center.access_state='ENABLED'
   AND provider.status='VERIFIED' AND provider.id=rec.provider_ref
   AND ref.protected_file_ref=rec.destination_file_ref
   AND ref.version=rec.destination_version
   AND file.health_provider_id=provider.id
   AND file.owner_kind='CG14_DRAFT'
   AND file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL
   AND intent.status='VALIDATED'
   AND intent.classification='HEALTH_BANK_PROOF'
 ) THEN
  RAISE EXCEPTION 'Current protected provider bank destination is not verified';
 END IF;
 -- CG09's independent bank reconciliation must match a real posted
 -- two-line liability-debit and Foundation-bank-credit journal exactly.
 IF NOT EXISTS(
  SELECT 1 FROM finance_bank_reconciliation bank
  JOIN journal j ON j.id=bank.journal_id AND j.root_realm_id=bank.root_realm_id
  JOIN finance_account cash ON cash.id=bank.bank_account_id
   AND cash.root_realm_id=bank.root_realm_id
  WHERE bank.id=NEW.bank_reconciliation_ref
   AND bank.root_realm_id=NEW.root_realm_id
   AND bank.status='VERIFIED' AND bank.variance_minor=0
   AND bank.statement_amount_minor=-NEW.amount_minor
   AND bank.posted_amount_minor=-NEW.amount_minor
   AND bank.journal_id=NEW.cg09_journal_ref
   AND bank.bank_account_id=NEW.bank_account_ref
   AND j.status='POSTED' AND j.source_owner='CG-09'
   AND j.posting_kind IN('GENERAL','VOUCHER')
   AND cash.account_kind='BANK' AND cash.scope_kind='FOUNDATION'
   AND cash.status='ACTIVE'
 ) THEN
  RAISE EXCEPTION 'Verified CG09 original bank disbursement is required';
 END IF;
 SELECT count(*),
  count(*) FILTER (WHERE line.account_id=NEW.bank_account_ref
   AND line.debit_minor=0 AND line.credit_minor=NEW.amount_minor
   AND line.branch_id IS NULL),
  count(*) FILTER (WHERE line.account_id=NEW.liability_account_ref
   AND line.credit_minor=0 AND line.debit_minor=NEW.amount_minor
   AND line.branch_id IS NULL)
 INTO count_lines,bank_count,liability_count FROM journal_line line
 WHERE line.root_realm_id=NEW.root_realm_id AND line.journal_id=NEW.cg09_journal_ref;
 IF count_lines<>2 OR bank_count<>1 OR liability_count<>1 OR
  NOT EXISTS(SELECT 1 FROM finance_account pay
   JOIN account_group g ON g.id=pay.group_id AND g.root_realm_id=pay.root_realm_id
   WHERE pay.id=NEW.liability_account_ref AND pay.root_realm_id=NEW.root_realm_id
    AND pay.scope_kind='FOUNDATION' AND pay.account_kind='GENERAL'
    AND pay.status='ACTIVE' AND g.category='LIABILITY') THEN
  RAISE EXCEPTION 'CG09 payout needs exact Foundation liability and bank lines';
 END IF;
 -- Every claim line must have been credited into THIS payable account
 -- by its exact immutable original CG09 accrual. A valid Foundation bank
 -- withdrawal for some other payable account is not this provider's claim.
 -- Keep this at the DB owner boundary so API bypass/replay cannot evade it.
 SELECT count(*) INTO source_line_count
 FROM provider_settlement_line line
 WHERE line.root_realm_id=NEW.root_realm_id
  AND line.settlement_ref=NEW.settlement_ref
  AND line.center_ref=NEW.center_ref;
 SELECT count(*) INTO matched_line_count
 FROM provider_settlement_line line
 JOIN foundation_liability obligation
  ON obligation.root_realm_id=line.root_realm_id
  AND obligation.id=line.liability_ref AND obligation.center_ref=line.center_ref
 JOIN cg17_financial_effect effect
  ON effect.root_realm_id=obligation.root_realm_id
  AND effect.id=line.original_effect_ref
  AND effect.liability_ref=obligation.id
  AND effect.effect_kind='LIABILITY_ACCRUAL'
  AND effect.posting_state='POSTED'
  AND effect.amount_minor=line.amount_minor
  AND effect.source_digest=obligation.source_digest
 JOIN journal accrual
  ON accrual.id=effect.original_cg09_ref
  AND accrual.root_realm_id=effect.root_realm_id
  AND accrual.source_owner='CG-09'
  AND accrual.posting_kind='GENERAL'
  AND accrual.status='POSTED'
  AND accrual.reversal_of_id IS NULL
  AND accrual.source_ref=effect.id
  AND accrual.immutable_source_event_key=effect.idempotency_key
  AND accrual.immutable_payload_digest=effect.source_digest
  AND accrual.posting_date=obligation.service_local_date
 JOIN journal_line credit
  ON credit.root_realm_id=accrual.root_realm_id
  AND credit.journal_id=accrual.id
  AND credit.account_id=NEW.liability_account_ref
  AND credit.branch_id IS NULL
  AND credit.debit_minor=0
  AND credit.credit_minor=line.amount_minor
 WHERE line.root_realm_id=NEW.root_realm_id
  AND line.settlement_ref=NEW.settlement_ref
  AND line.center_ref=NEW.center_ref
  AND (SELECT count(*) FROM journal_line exact
       WHERE exact.root_realm_id=accrual.root_realm_id
        AND exact.journal_id=accrual.id)=2;
 IF source_line_count<1 OR matched_line_count<>source_line_count THEN
  RAISE EXCEPTION 'Provider payout payable account differs from original accrued claim'
   USING ERRCODE='P1718';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg17_verified_payout_immutable BEFORE INSERT OR UPDATE OR DELETE
 ON provider_settlement_payment FOR EACH ROW
 EXECUTE FUNCTION cg17_verified_payout_guard();

-- Allow only source-backed claim approval OR an increase equal to append-only
-- verified payout links. No arbitrary paid amount, source or bank edit.
CREATE OR REPLACE FUNCTION cg17_settlement_claim_guard()
 RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total numeric; v_lines integer; v_paid numeric;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Approved Foundation settlement history cannot be deleted';
 END IF;
 IF (to_jsonb(NEW)-'state'-'revision'-'reviewed_by'-'reviewed_at'-
   'reviewed_request_key'-'paid_minor') IS DISTINCT FROM
   (to_jsonb(OLD)-'state'-'revision'-'reviewed_by'-'reviewed_at'-
   'reviewed_request_key'-'paid_minor') OR
   NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Protected settlement identity and source cannot change';
 END IF;
 IF OLD.state='PROPOSED' AND NEW.state='APPROVED' THEN
  IF NEW.paid_minor<>0 OR NEW.reviewed_by IS NULL OR
   NEW.reviewed_by=OLD.proposed_by OR NEW.reviewed_at IS NULL OR
   NEW.reviewed_request_key IS NULL THEN
   RAISE EXCEPTION 'Original claim requires independent approval';
  END IF;
  SELECT count(*),coalesce(sum(line.amount_minor),0)
  INTO v_lines,v_total
  FROM provider_settlement_line line
  JOIN foundation_liability l ON l.root_realm_id=line.root_realm_id
   AND l.id=line.liability_ref
  JOIN cg17_financial_effect effect ON effect.root_realm_id=l.root_realm_id
   AND effect.id=line.original_effect_ref AND effect.liability_ref=l.id
   AND effect.effect_kind='LIABILITY_ACCRUAL'
   AND effect.posting_state='POSTED'
  JOIN journal j ON j.id=effect.original_cg09_ref
   AND j.root_realm_id=effect.root_realm_id
   AND j.status='POSTED' AND j.source_owner='CG-09'
   AND j.posting_kind='GENERAL' AND j.source_ref=effect.id
   AND j.immutable_source_event_key=effect.idempotency_key
   AND j.immutable_payload_digest=effect.source_digest
   AND j.posting_date=l.service_local_date
  WHERE line.root_realm_id=NEW.root_realm_id
   AND line.settlement_ref=NEW.id AND line.center_ref=NEW.center_ref
   AND line.amount_minor=l.amount_minor
   AND effect.amount_minor=l.amount_minor
   AND effect.source_digest=l.source_digest
   AND l.service_local_date>=NEW.period_start
   AND l.service_local_date<NEW.period_end;
  IF v_lines<1 OR v_total<>NEW.approved_total_minor OR
   v_lines<>(SELECT count(*) FROM provider_settlement_line
    WHERE root_realm_id=NEW.root_realm_id AND settlement_ref=NEW.id)
  THEN
   RAISE EXCEPTION 'Monthly claim must match exact original CG09 posted sources';
  END IF;
 ELSIF OLD.state IN('APPROVED','PARTIALLY_SETTLED') AND
       NEW.state IN('PARTIALLY_SETTLED','SETTLED') THEN
  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
   NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
   NEW.reviewed_request_key IS DISTINCT FROM OLD.reviewed_request_key OR
   NEW.paid_minor<=OLD.paid_minor OR
   NEW.paid_minor>NEW.approved_total_minor THEN
   RAISE EXCEPTION 'Verified payout cannot change protected approval source';
  END IF;
  SELECT coalesce(sum(p.amount_minor),0) INTO v_paid
   FROM provider_settlement_payment p
   WHERE p.root_realm_id=NEW.root_realm_id AND p.settlement_ref=NEW.id;
  IF v_paid<>NEW.paid_minor OR
   (NEW.paid_minor=NEW.approved_total_minor AND NEW.state<>'SETTLED') OR
   (NEW.paid_minor<NEW.approved_total_minor AND NEW.state<>'PARTIALLY_SETTLED') THEN
   RAISE EXCEPTION 'Paid provider amount requires exact verified CG09 allocation';
  END IF;
 ELSE
  RAISE EXCEPTION 'Original settlement transition denied';
 END IF;
 RETURN NEW;
END $$;
