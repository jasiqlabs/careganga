-- CG17 US006: append-only protected correction of an original posted
-- Foundation healthcare accrual BEFORE its liability enters any provider claim.
-- Paid and proposed provider claims are NOT silently rewritten or refunded.
-- CG09 retains sole double-entry authority and original journal/line history.
CREATE TABLE cg17_liability_correction(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 liability_ref uuid NOT NULL,
 original_effect_ref uuid NOT NULL,
 reversal_effect_ref uuid NOT NULL,
 original_journal_ref uuid NOT NULL,
 reversal_journal_ref uuid NOT NULL,
 reviewed_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 300),
 password_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,liability_ref),
 UNIQUE(root_realm_id,original_journal_ref),
 UNIQUE(root_realm_id,reversal_journal_ref),
 UNIQUE(root_realm_id,reviewed_by_account,request_key),
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
 FOREIGN KEY(reviewed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(original_effect_ref<>reversal_effect_ref),
 CHECK(original_journal_ref<>reversal_journal_ref),
 CHECK(password_verified_at BETWEEN created_at-interval '5 minutes'
                              AND created_at+interval '1 minute')
);
CREATE INDEX ix_cg17_liability_correction_recent
 ON cg17_liability_correction(root_realm_id,center_ref,created_at DESC,id DESC);

CREATE FUNCTION cg17_verify_unpaid_liability_reversal()
 RETURNS trigger LANGUAGE plpgsql AS $cg17$
DECLARE original record; changed record; economic record; mismatch integer;
BEGIN
 SELECT l.id,l.amount_minor,e.id AS effect_ref,e.original_cg09_ref,
        e.posting_state,e.source_digest,e.source_ref
 INTO economic
 FROM foundation_liability l
 JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id
  AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL'
 WHERE l.root_realm_id=NEW.root_realm_id AND l.id=NEW.liability_ref
   AND l.center_ref=NEW.center_ref FOR SHARE OF l,e;
 IF NOT FOUND OR economic.effect_ref<>NEW.original_effect_ref
   OR economic.original_cg09_ref<>NEW.original_journal_ref
   OR economic.posting_state<>'POSTED'
   OR EXISTS(SELECT 1 FROM provider_settlement_line line
     WHERE line.root_realm_id=NEW.root_realm_id AND line.liability_ref=NEW.liability_ref)
 THEN
  RAISE EXCEPTION 'Original liability already claimed, changed or unavailable'
   USING ERRCODE='P1719';
 END IF;
 SELECT j.id AS id,j.posting_kind,j.source_owner,j.source_ref,j.created_by,
        j.immutable_payload_digest,j.status,j.reversal_of_id
 INTO original FROM journal j
 WHERE j.id=NEW.original_journal_ref AND j.root_realm_id=NEW.root_realm_id
 FOR SHARE;
 SELECT j.id AS id,j.posting_kind,j.source_owner,j.source_ref,j.created_by,
        j.immutable_payload_digest,j.status,j.reversal_of_id
 INTO changed FROM journal j
 WHERE j.id=NEW.reversal_journal_ref AND j.root_realm_id=NEW.root_realm_id
 FOR SHARE;
 IF original.id IS NULL OR changed.id IS NULL OR original.posting_kind<>'GENERAL' OR original.source_owner<>'CG-09'
   OR original.status<>'POSTED' OR original.reversal_of_id IS NOT NULL
   OR original.source_ref<>NEW.original_effect_ref
   OR original.immutable_payload_digest<>economic.source_digest
   OR original.created_by=NEW.reviewed_by_account
   OR changed.posting_kind<>'REVERSAL' OR changed.source_owner<>'CG-09'
   OR changed.status<>'POSTED' OR changed.reversal_of_id<>NEW.original_journal_ref
   OR changed.source_ref<>NEW.original_journal_ref
   OR changed.created_by<>NEW.reviewed_by_account
   OR changed.immutable_payload_digest<>NEW.request_digest
   OR EXISTS(SELECT 1 FROM journal j
      WHERE j.root_realm_id=NEW.root_realm_id
        AND j.reversal_of_id=NEW.original_journal_ref
        AND j.id<>NEW.reversal_journal_ref)
 THEN
  RAISE EXCEPTION 'Exact independent CG09 accrual reversal proof required'
   USING ERRCODE='P1719';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM cg17_financial_effect e
  WHERE e.root_realm_id=NEW.root_realm_id
    AND e.id=NEW.reversal_effect_ref
    AND e.liability_ref=NEW.liability_ref
    AND e.effect_kind='LIABILITY_REVERSAL'
    AND e.source_ref=economic.source_ref
    AND e.amount_minor=economic.amount_minor
    AND e.source_digest=NEW.request_digest
    AND e.idempotency_key=NEW.request_key
    AND e.posting_state='POSTED'
    AND e.original_cg09_ref=NEW.reversal_journal_ref
 ) THEN
  RAISE EXCEPTION 'Original CG17 correction effect missing'
   USING ERRCODE='P1719';
 END IF;
 WITH prior AS (
  SELECT account_id,branch_id,count(*) AS n,
         sum(debit_minor) AS debits,sum(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.original_journal_ref
  GROUP BY account_id,branch_id
 ), after AS (
  SELECT account_id,branch_id,count(*) AS n,
         sum(debit_minor) AS debits,sum(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.reversal_journal_ref
  GROUP BY account_id,branch_id
 )
 SELECT count(*) INTO mismatch
 FROM prior p FULL OUTER JOIN after a
  ON a.account_id=p.account_id
  AND a.branch_id IS NOT DISTINCT FROM p.branch_id
 WHERE p.account_id IS NULL OR a.account_id IS NULL
   OR p.n<>a.n OR p.debits<>a.credits OR p.credits<>a.debits;
 IF mismatch<>0 OR
   (SELECT count(*) FROM journal_line
    WHERE root_realm_id=NEW.root_realm_id AND journal_id=NEW.original_journal_ref)<>2 OR
   (SELECT count(*) FROM journal_line
    WHERE root_realm_id=NEW.root_realm_id AND journal_id=NEW.reversal_journal_ref)<>2 THEN
  RAISE EXCEPTION 'The correction must exactly offset two original journal lines'
   USING ERRCODE='P1719';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_liability_correction_verified
 BEFORE INSERT ON cg17_liability_correction
 FOR EACH ROW EXECUTE FUNCTION cg17_verify_unpaid_liability_reversal();
CREATE TRIGGER cg17_liability_correction_immutable
 BEFORE UPDATE OR DELETE ON cg17_liability_correction
 FOR EACH ROW EXECUTE FUNCTION cg17_completed_liability_immutable();

-- Reuse the original CG09 protected deferred-reversal boundary. The normal
-- manual-journal branch is unchanged; the ONLY additional proof is an
-- immutable independently reviewed CG17 original healthcare correction.
CREATE OR REPLACE FUNCTION cg09_require_manual_reversal_proof()
 RETURNS trigger LANGUAGE plpgsql AS $cg09$
BEGIN
 IF NEW.posting_kind<>'REVERSAL' THEN RETURN NULL; END IF;
 PERFORM 1 FROM finance_manual_journal_reversal d
 WHERE d.root_realm_id=NEW.root_realm_id
   AND d.reversal_journal_id=NEW.id
   AND d.original_journal_id=NEW.reversal_of_id
 FOR SHARE;
 IF FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM cg17_liability_correction correction
 WHERE correction.root_realm_id=NEW.root_realm_id
   AND correction.reversal_journal_ref=NEW.id
   AND correction.original_journal_ref=NEW.reversal_of_id
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Protected journal reversal proof missing'
   USING ERRCODE='P0929';
 END IF;
 RETURN NULL;
END $cg09$;
