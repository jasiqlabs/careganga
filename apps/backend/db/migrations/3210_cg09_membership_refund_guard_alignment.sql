-- CG09 original refund guards: invoice behavior preserved, with a narrow
-- membership source branch. Full source/actor/fee validity is guarded by
-- finance_membership_refund_posting and its immutable prior decision rows.
-- Original bank reconciliation must still be independent and scan-verified.
CREATE OR REPLACE FUNCTION cg09_require_invoice_adjustment_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posting_kind='CREDIT_NOTE' THEN
  PERFORM 1 FROM finance_invoice_credit_note c
   WHERE c.root_realm_id=NEW.root_realm_id
    AND c.adjustment_journal_id=NEW.id AND c.original_journal_id=NEW.reversal_of_id
   FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Source-bound credit note proof required' USING ERRCODE='P0931';
  END IF;
 ELSIF NEW.posting_kind='REFUND' THEN
  -- CG04 additionally uses CG09's original independently approved refund
  -- event, not the invoice refund source. Both are verified inside this
  -- same transaction by their respective immutable record guards.
  IF EXISTS(SELECT 1 FROM finance_membership_refund_posting m
    JOIN finance_membership_refund_request requested ON requested.root_realm_id=m.root_realm_id AND requested.application_id=m.application_id
    WHERE m.root_realm_id=NEW.root_realm_id AND m.journal_id=NEW.id
      AND m.application_id=NEW.source_ref AND m.request_key=NEW.immutable_source_event_key
      AND m.approved_by=NEW.created_by AND m.approved_by<>requested.requested_by)
    THEN RETURN NULL; END IF;
  PERFORM 1 FROM finance_invoice_refund r
   WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.source_ref
     AND r.approval_journal_id=NEW.id AND r.status='BANK_POSTED'
   FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Independently reviewed refund proof required' USING ERRCODE='P0932';
  END IF;
 END IF;
 RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION cg09_guard_refund_statement_match() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bank journal%ROWTYPE; requested record;
BEGIN
 SELECT * INTO bank FROM journal
  WHERE id=NEW.journal_id AND root_realm_id=NEW.root_realm_id;
 IF NOT FOUND OR bank.posting_kind<>'REFUND' THEN RETURN NEW; END IF;
 -- Match a real CG04 outbound transfer to the exact originally collected
 -- bank account and amount, preserving the CG09 original invoice branch below.
 SELECT c.bank_account_id,r.amount_minor,p.transfer_reference INTO requested
 FROM finance_membership_refund_posting p
 JOIN finance_membership_refund_request r ON r.root_realm_id=p.root_realm_id AND r.application_id=p.application_id
 JOIN finance_membership_collection c ON c.root_realm_id=r.root_realm_id AND c.application_id=r.application_id
 WHERE p.root_realm_id=NEW.root_realm_id AND p.journal_id=NEW.journal_id AND p.application_id=bank.source_ref FOR SHARE OF p,r,c;
 IF FOUND THEN
  IF NEW.bank_account_id IS DISTINCT FROM requested.bank_account_id
   OR NEW.bank_item_ref IS DISTINCT FROM requested.transfer_reference
   OR NEW.statement_amount_minor IS DISTINCT FROM -requested.amount_minor
   OR NEW.posted_amount_minor IS DISTINCT FROM -requested.amount_minor THEN
   RAISE EXCEPTION 'Match the actual outbound membership refund bank reference and amount'
    USING ERRCODE='P0932';
  END IF;
  RETURN NEW;
 END IF;
 SELECT r.bank_account_id,r.amount_minor,r.transfer_reference,r.status
  INTO requested FROM finance_invoice_refund r
  WHERE r.id=bank.source_ref AND r.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR requested.status<>'BANK_POSTED' OR
    NEW.bank_account_id IS DISTINCT FROM requested.bank_account_id OR
    NEW.bank_item_ref IS DISTINCT FROM requested.transfer_reference OR
    NEW.statement_amount_minor IS DISTINCT FROM -requested.amount_minor OR
    NEW.posted_amount_minor IS DISTINCT FROM -requested.amount_minor THEN
  RAISE EXCEPTION 'Use the actual matching outbound refund transfer reference'
   USING ERRCODE='P0932';
 END IF;
 RETURN NEW;
END; $$;
