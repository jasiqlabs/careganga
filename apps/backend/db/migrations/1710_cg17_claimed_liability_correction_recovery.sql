-- CG17 US006 original claimed/part-paid/paid consultation correction.
-- The approved provider claim and every bank payout stay immutable. Only an
-- append-only offsetting CG09 journal and independently verified actual bank
-- recovery can reduce the ECONOMIC provider payable. No invented refunds.
CREATE TABLE cg17_provider_claim_correction(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 settlement_ref uuid NOT NULL,
 liability_ref uuid NOT NULL,
 original_effect_ref uuid NOT NULL,
 reversal_effect_ref uuid NOT NULL,
 original_journal_ref uuid NOT NULL,
 reversal_journal_ref uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 recovery_minor bigint NOT NULL DEFAULT 0 CHECK(recovery_minor>=0),
 recovery_bank_ref uuid,
 recovery_journal_ref uuid,
 recovery_payer_attested boolean NOT NULL DEFAULT false,
 reviewed_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 300),
 password_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,liability_ref),
 UNIQUE(root_realm_id,reversal_journal_ref),
 UNIQUE(root_realm_id,recovery_bank_ref),
 UNIQUE(root_realm_id,reviewed_by_account,request_key),
 FOREIGN KEY(root_realm_id,settlement_ref,center_ref)
  REFERENCES provider_settlement(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,liability_ref,center_ref)
  REFERENCES foundation_liability(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,original_effect_ref)
  REFERENCES cg17_financial_effect(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reversal_effect_ref)
  REFERENCES cg17_financial_effect(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(original_journal_ref,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_journal_ref,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recovery_bank_ref,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recovery_journal_ref,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(original_journal_ref<>reversal_journal_ref),
 CHECK((recovery_minor=0 AND recovery_bank_ref IS NULL AND
        recovery_journal_ref IS NULL AND recovery_payer_attested=false)
    OR (recovery_minor>0 AND recovery_bank_ref IS NOT NULL AND
        recovery_journal_ref IS NOT NULL AND recovery_payer_attested=true)),
 CHECK(password_verified_at BETWEEN created_at-interval '5 minutes'
                              AND created_at+interval '1 minute')
);
CREATE INDEX ix_cg17_claim_correction_statement
 ON cg17_provider_claim_correction(root_realm_id,settlement_ref,created_at,id);

CREATE FUNCTION cg17_claimed_correction_proof()
 RETURNS trigger LANGUAGE plpgsql AS $cg17$
DECLARE claim record; original record; changed record; source record;
 old_adjusted bigint; old_recovered bigint; needed bigint;
 originals bigint; reversed bigint; offset_mismatch bigint;
 payable_account uuid; bank_account uuid; bank_statement bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Claim correction evidence is immutable' USING ERRCODE='P1720';
 END IF;
 SELECT s.id,s.center_ref,s.approved_total_minor,s.paid_minor,s.state,s.proposed_by
 INTO claim FROM provider_settlement s
 WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.settlement_ref
   AND s.center_ref=NEW.center_ref FOR UPDATE;
 IF NOT FOUND OR claim.state NOT IN('PROPOSED','APPROVED','PARTIALLY_SETTLED','SETTLED') OR
    claim.proposed_by=NEW.reviewed_by_account OR
    EXISTS(SELECT 1 FROM cg17_liability_correction prior
     WHERE prior.root_realm_id=NEW.root_realm_id
       AND prior.liability_ref=NEW.liability_ref) THEN
  RAISE EXCEPTION 'Current original claim and different reviewer required'
   USING ERRCODE='P1720';
 END IF;
 SELECT l.id,l.amount_minor,l.source_digest,l.source_ref,
        e.id AS effect_ref,e.original_cg09_ref,e.posting_state,
        line.settlement_ref
 INTO source FROM foundation_liability l
 JOIN provider_settlement_line line ON line.root_realm_id=l.root_realm_id
   AND line.liability_ref=l.id AND line.center_ref=l.center_ref
   AND line.settlement_ref=NEW.settlement_ref
 JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id
   AND e.id=line.original_effect_ref AND e.liability_ref=l.id
   AND e.effect_kind='LIABILITY_ACCRUAL' AND e.posting_state='POSTED'
   AND e.source_digest=l.source_digest AND e.amount_minor=line.amount_minor
 WHERE l.root_realm_id=NEW.root_realm_id AND l.id=NEW.liability_ref
   AND l.center_ref=NEW.center_ref FOR SHARE OF l,e,line;
 IF NOT FOUND OR source.effect_ref<>NEW.original_effect_ref
    OR source.original_cg09_ref<>NEW.original_journal_ref
    OR source.amount_minor<>NEW.amount_minor
    OR EXISTS(SELECT 1 FROM cg17_provider_claim_correction prior
     WHERE prior.root_realm_id=NEW.root_realm_id
       AND prior.liability_ref=NEW.liability_ref) THEN
  RAISE EXCEPTION 'Original claimed liability changed or was already corrected'
   USING ERRCODE='P1720';
 END IF;
 SELECT coalesce(sum(amount_minor),0),coalesce(sum(recovery_minor),0)
 INTO old_adjusted,old_recovered
 FROM cg17_provider_claim_correction
 WHERE root_realm_id=NEW.root_realm_id AND settlement_ref=NEW.settlement_ref;
 IF old_adjusted+NEW.amount_minor>claim.approved_total_minor THEN
  RAISE EXCEPTION 'Correction exceeds the actual original claim' USING ERRCODE='P1720';
 END IF;
 needed=greatest(0,claim.paid_minor-old_recovered-
          (claim.approved_total_minor-old_adjusted-NEW.amount_minor));
 IF NEW.recovery_minor<>needed THEN
  RAISE EXCEPTION 'Actual overpaid bank recovery must match the claim deficit'
   USING ERRCODE='P1720';
 END IF;
 SELECT j.id,j.posting_kind,j.source_owner,j.source_ref,j.created_by,
        j.immutable_payload_digest,j.status,j.reversal_of_id
 INTO original FROM journal j
 WHERE j.root_realm_id=NEW.root_realm_id AND j.id=NEW.original_journal_ref
 FOR SHARE;
 SELECT j.id,j.posting_kind,j.source_owner,j.source_ref,j.created_by,
        j.immutable_payload_digest,j.status,j.reversal_of_id
 INTO changed FROM journal j
 WHERE j.root_realm_id=NEW.root_realm_id AND j.id=NEW.reversal_journal_ref
 FOR SHARE;
 IF original.id IS NULL OR changed.id IS NULL OR
    original.posting_kind<>'GENERAL' OR original.source_owner<>'CG-09' OR
    original.status<>'POSTED' OR original.reversal_of_id IS NOT NULL OR
    original.source_ref<>NEW.original_effect_ref OR
    original.immutable_payload_digest<>source.source_digest OR
    original.created_by=NEW.reviewed_by_account OR
    changed.posting_kind<>'REVERSAL' OR changed.source_owner<>'CG-09' OR
    changed.status<>'POSTED' OR changed.reversal_of_id<>original.id OR
    changed.source_ref<>original.id OR
    changed.created_by<>NEW.reviewed_by_account OR
    changed.immutable_payload_digest<>NEW.request_digest OR
    EXISTS(SELECT 1 FROM journal other
     WHERE other.root_realm_id=NEW.root_realm_id
       AND other.reversal_of_id=original.id AND other.id<>changed.id) OR
    NOT EXISTS(SELECT 1 FROM cg17_financial_effect e
     WHERE e.root_realm_id=NEW.root_realm_id AND
       e.id=NEW.reversal_effect_ref AND e.liability_ref=NEW.liability_ref
       AND e.effect_kind='LIABILITY_REVERSAL' AND e.posting_state='POSTED'
       AND e.original_cg09_ref=changed.id AND e.idempotency_key=NEW.request_key
       AND e.source_digest=NEW.request_digest
       AND e.amount_minor=NEW.amount_minor AND e.source_ref=source.source_ref)
 THEN
  RAISE EXCEPTION 'Exact CG09 posted original and correction effect required'
   USING ERRCODE='P1720';
 END IF;
 WITH prior AS (
   SELECT account_id,branch_id,count(*) AS n,
     sum(debit_minor) AS debit,sum(credit_minor) AS credit
   FROM journal_line WHERE root_realm_id=NEW.root_realm_id
     AND journal_id=original.id GROUP BY account_id,branch_id
 ), after AS (
   SELECT account_id,branch_id,count(*) AS n,
     sum(debit_minor) AS debit,sum(credit_minor) AS credit
   FROM journal_line WHERE root_realm_id=NEW.root_realm_id
     AND journal_id=changed.id GROUP BY account_id,branch_id
 ) SELECT count(*) INTO offset_mismatch
 FROM prior a FULL OUTER JOIN after b ON a.account_id=b.account_id
  AND a.branch_id IS NOT DISTINCT FROM b.branch_id
 WHERE a.account_id IS NULL OR b.account_id IS NULL OR a.n<>b.n
   OR a.debit<>b.credit OR a.credit<>b.debit;
 SELECT count(*) INTO originals
 FROM journal_line WHERE root_realm_id=NEW.root_realm_id
  AND journal_id=original.id;
 SELECT account_id INTO payable_account
 FROM journal_line
 WHERE root_realm_id=NEW.root_realm_id AND journal_id=original.id
  AND credit_minor=NEW.amount_minor AND debit_minor=0
  AND branch_id IS NULL
 LIMIT 2;
 SELECT count(*) INTO reversed FROM journal_line
 WHERE root_realm_id=NEW.root_realm_id AND journal_id=changed.id;
 IF offset_mismatch<>0 OR originals<>2 OR reversed<>2 OR payable_account IS NULL THEN
  RAISE EXCEPTION 'Original two-line accrual must be offset exactly'
   USING ERRCODE='P1720';
 END IF;
 IF needed>0 THEN
  -- Recover ONLY real independently verified CG09 incoming Foundation bank
  -- money; recorded-by/verified-by are distinct at the original CG09 owner.
  -- The credit is to the actual provider payable account, not invented income.
  SELECT bank.bank_account_id,bank.statement_amount_minor
  INTO bank_account,bank_statement
  FROM finance_bank_reconciliation bank
  JOIN journal recovery ON recovery.root_realm_id=bank.root_realm_id
   AND recovery.id=bank.journal_id
  JOIN finance_account incoming_bank
   ON incoming_bank.root_realm_id=bank.root_realm_id
   AND incoming_bank.id=bank.bank_account_id
   AND incoming_bank.account_kind='BANK'
   AND incoming_bank.scope_kind='FOUNDATION'
   AND incoming_bank.status='ACTIVE'
  JOIN finance_account original_payable
   ON original_payable.root_realm_id=bank.root_realm_id
   AND original_payable.id=payable_account
   AND original_payable.account_kind='GENERAL'
   AND original_payable.scope_kind='FOUNDATION'
   AND original_payable.status='ACTIVE'
  JOIN account_group payable_group
   ON payable_group.root_realm_id=original_payable.root_realm_id
   AND payable_group.id=original_payable.group_id
   AND payable_group.category='LIABILITY'
  WHERE bank.root_realm_id=NEW.root_realm_id
    AND bank.id=NEW.recovery_bank_ref
    AND bank.journal_id=NEW.recovery_journal_ref
    AND bank.status='VERIFIED' AND bank.variance_minor=0
    AND bank.statement_amount_minor=needed
    AND bank.posted_amount_minor=needed
    AND recovery.status='POSTED' AND recovery.source_owner='CG-09'
    AND recovery.posting_kind IN('GENERAL','VOUCHER')
    AND recovery.reversal_of_id IS NULL
  FOR SHARE OF bank,recovery;
  IF NOT FOUND OR bank_statement<>needed OR
     EXISTS(SELECT 1 FROM provider_settlement_payment used
       WHERE used.root_realm_id=NEW.root_realm_id
        AND used.bank_reconciliation_ref=NEW.recovery_bank_ref) OR
     (SELECT count(*) FROM journal_line legs
       WHERE legs.root_realm_id=NEW.root_realm_id
       AND legs.journal_id=NEW.recovery_journal_ref)<>2 OR
     (SELECT count(*) FROM journal_line legs
       WHERE legs.root_realm_id=NEW.root_realm_id AND
       legs.journal_id=NEW.recovery_journal_ref AND legs.branch_id IS NULL AND
       ((legs.account_id=bank_account AND legs.debit_minor=needed AND
         legs.credit_minor=0) OR
        (legs.account_id=payable_account AND legs.credit_minor=needed AND
         legs.debit_minor=0)))<>2
  THEN
   RAISE EXCEPTION 'Independent CG09 recovered bank amount and payable mismatch'
    USING ERRCODE='P1720';
  END IF;
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_claimed_correction_insert_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg17_provider_claim_correction
 FOR EACH ROW EXECUTE FUNCTION cg17_claimed_correction_proof();

-- Existing CG09 deferred reversal guard keeps manual reversal immutable,
-- and accepts ONLY CG17 protected original corrections with complete proof.
CREATE OR REPLACE FUNCTION cg09_require_manual_reversal_proof()
 RETURNS trigger LANGUAGE plpgsql AS $cg09$
BEGIN
 IF NEW.posting_kind<>'REVERSAL' THEN RETURN NULL; END IF;
 PERFORM 1 FROM finance_manual_journal_reversal f
 WHERE f.root_realm_id=NEW.root_realm_id
  AND f.reversal_journal_id=NEW.id AND f.original_journal_id=NEW.reversal_of_id
 FOR SHARE;
 IF FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM cg17_liability_correction f
 WHERE f.root_realm_id=NEW.root_realm_id
  AND f.reversal_journal_ref=NEW.id AND f.original_journal_ref=NEW.reversal_of_id
 FOR SHARE;
 IF FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM cg17_provider_claim_correction f
 WHERE f.root_realm_id=NEW.root_realm_id
  AND f.reversal_journal_ref=NEW.id AND f.original_journal_ref=NEW.reversal_of_id
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Protected original reversal proof is required'
   USING ERRCODE='P0929';
 END IF;
 RETURN NULL;
END $cg09$;

-- A verified payout must not exceed the NET approved claim after original
-- immutable corrections and actual independently matched recoveries.
-- This guard is independent of the app; it cannot be bypassed via direct SQL.
CREATE FUNCTION cg17_effective_payout_limit()
 RETURNS trigger LANGUAGE plpgsql AS $cg17$
DECLARE total bigint; paid bigint; adj bigint; recovered bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
 SELECT approved_total_minor,paid_minor INTO total,paid
 FROM provider_settlement
 WHERE root_realm_id=NEW.root_realm_id AND id=NEW.settlement_ref
   AND center_ref=NEW.center_ref FOR UPDATE;
 SELECT coalesce(sum(amount_minor),0),coalesce(sum(recovery_minor),0)
 INTO adj,recovered FROM cg17_provider_claim_correction
 WHERE root_realm_id=NEW.root_realm_id AND settlement_ref=NEW.settlement_ref;
 IF total IS NULL OR total<adj OR NEW.amount_minor>total-adj-paid+recovered THEN
  RAISE EXCEPTION 'A bank payout cannot exceed the effective corrected payable'
   USING ERRCODE='P1720';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_effective_payout_immutable
 BEFORE INSERT ON provider_settlement_payment
 FOR EACH ROW EXECUTE FUNCTION cg17_effective_payout_limit();

-- Prevent reusing an already-corrected liability when adding source lines
-- directly to a provider claim after its reversal.
CREATE FUNCTION cg17_disallow_claimed_correction_reclaim()
 RETURNS trigger LANGUAGE plpgsql AS $cg17$
BEGIN
 IF EXISTS(SELECT 1 FROM cg17_provider_claim_correction c
   WHERE c.root_realm_id=NEW.root_realm_id AND c.liability_ref=NEW.liability_ref)
 THEN RAISE EXCEPTION 'Corrected original liability is not payable'
   USING ERRCODE='P1720';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_claimed_correction_no_reclaim
 BEFORE INSERT ON provider_settlement_line
 FOR EACH ROW EXECUTE FUNCTION cg17_disallow_claimed_correction_reclaim();
