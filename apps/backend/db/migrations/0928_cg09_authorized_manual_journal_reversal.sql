-- CG-09 US-006: append-only correction of an original manually posted journal.
-- This is deliberately NOT a generic undo of invoices, bank collections, claims
-- or payment journals. Posted source lines never change. A distinct protected
-- current-password reviewer creates one balanced offsetting journal.
CREATE TABLE finance_manual_journal_reversal(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 original_journal_id uuid NOT NULL,
 reversal_journal_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 300),
 password_verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,original_journal_id),
 UNIQUE(root_realm_id,reversal_journal_id),
 UNIQUE(root_realm_id,reviewer_id,request_key),
 FOREIGN KEY(original_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_manual_reversal_immutable
 BEFORE UPDATE OR DELETE ON finance_manual_journal_reversal
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_verify_manual_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original record; changed record; o record; r record; mismatch integer;
BEGIN
 SELECT posting_kind,source_ref,immutable_source_event_key,created_by,
  immutable_payload_digest,status
  INTO original FROM journal
  WHERE id=NEW.original_journal_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 SELECT posting_kind,reversal_of_id,source_ref,created_by,status
  INTO changed FROM journal
  WHERE id=NEW.reversal_journal_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF original.posting_kind<>'GENERAL' OR original.status<>'POSTED'
  OR original.source_ref<>original.immutable_source_event_key
  OR original.created_by=NEW.reviewer_id
  OR changed.posting_kind<>'REVERSAL' OR changed.status<>'POSTED'
  OR changed.reversal_of_id<>NEW.original_journal_id
  OR changed.source_ref<>NEW.original_journal_id
  OR changed.created_by<>NEW.reviewer_id
  OR NEW.password_verified_at>NEW.created_at+interval '1 minute'
  OR NEW.password_verified_at<NEW.created_at-interval '5 minutes' THEN
  RAISE EXCEPTION 'Original manual journal and distinct reviewer proof required'
   USING ERRCODE='P0929';
 END IF;
 -- Compare actual reversal balances BY account and real branch and number of
 -- lines; aggregate equality rejects hidden positive or negative extra legs.
 WITH prior AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS debits,SUM(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.original_journal_id GROUP BY account_id,branch_id
 ), after AS (
  SELECT account_id,branch_id,COUNT(*) AS n,
   SUM(debit_minor) AS debits,SUM(credit_minor) AS credits
  FROM journal_line WHERE root_realm_id=NEW.root_realm_id
   AND journal_id=NEW.reversal_journal_id GROUP BY account_id,branch_id
 )
 SELECT COUNT(*) INTO mismatch FROM prior p FULL OUTER JOIN after a
  ON a.account_id=p.account_id
  AND a.branch_id IS NOT DISTINCT FROM p.branch_id
 WHERE p.account_id IS NULL OR a.account_id IS NULL OR p.n<>a.n
  OR p.debits<>a.credits OR p.credits<>a.debits;
 IF mismatch<>0 THEN
  RAISE EXCEPTION 'A correction must reverse the exact original double entry'
   USING ERRCODE='P0929';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_guard_manual_reversal_decision
 BEFORE INSERT ON finance_manual_journal_reversal FOR EACH ROW
 EXECUTE FUNCTION cg09_verify_manual_reversal();

-- At COMMIT every reversal journal must be backed by its one immutable
-- protected correction fact. No orphan unapproved reversal even with SQL
-- access to the general posting engine.
CREATE FUNCTION cg09_require_manual_reversal_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posting_kind<>'REVERSAL' THEN RETURN NULL; END IF;
 PERFORM 1 FROM finance_manual_journal_reversal d
  WHERE d.root_realm_id=NEW.root_realm_id
    AND d.reversal_journal_id=NEW.id
    AND d.original_journal_id=NEW.reversal_of_id
  FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Protected manual journal reversal proof missing'
   USING ERRCODE='P0929';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_require_manual_reversal_proof
 AFTER INSERT ON journal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION cg09_require_manual_reversal_proof();

CREATE INDEX ix_cg09_manual_reversal_read ON finance_manual_journal_reversal
 (root_realm_id,created_at DESC,id DESC);
