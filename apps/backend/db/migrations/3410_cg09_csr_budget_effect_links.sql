-- CG08/US002. Attribute original CG09 budget ALLOCATE/UTILIZE events;
-- no second budget, journal, cash, amount or fabricated allocation.
CREATE TABLE finance_csr_budget_effect(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 funding_proposal_id uuid NOT NULL,
 approved_source_version integer NOT NULL CHECK(approved_source_version>0),
 party_kind text NOT NULL CHECK(party_kind IN('CSR','FOUNDATION')),
 budget_event_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 actor_ref uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,budget_event_id),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(root_realm_id,funding_proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(budget_event_id)
  REFERENCES finance_budget_event(id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_csr_budget_proposal
 ON finance_csr_budget_effect(root_realm_id,funding_proposal_id,party_kind,recorded_at DESC);
CREATE TRIGGER cg09_csr_budget_effect_immutable
 BEFORE UPDATE OR DELETE ON finance_csr_budget_effect
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_csr_budget_effect_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg09cb$
DECLARE p record; e record; received numeric; allocated numeric; utilized numeric;
BEGIN
 SELECT id,root_realm_id,status,version,branch_ref,project_ref,csr_partner_id,
 csr_requested_minor,foundation_requested_minor INTO p
 FROM csr_funding_proposal
 WHERE id=NEW.funding_proposal_id AND root_realm_id=NEW.root_realm_id FOR UPDATE;
 IF NOT FOUND OR p.status<>'APPROVED' OR p.version<>NEW.approved_source_version
  OR (NEW.party_kind='CSR' AND p.csr_partner_id IS NULL) THEN
  RAISE EXCEPTION 'Current approved original funding commitment required' USING ERRCODE='P3410';
 END IF;
 SELECT ev.id,ev.kind,ev.amount_minor,ev.budget_id,ev.source_journal_id,
   bud.branch_id,bud.project_ref,bud.status INTO e
 FROM finance_budget_event ev JOIN finance_budget bud
  ON bud.id=ev.budget_id AND bud.root_realm_id=ev.root_realm_id
 WHERE ev.id=NEW.budget_event_id AND ev.root_realm_id=NEW.root_realm_id
 FOR SHARE OF ev,bud;
 IF NOT FOUND OR e.kind NOT IN('ALLOCATE','UTILIZE') OR e.status<>'APPROVED'
  OR e.branch_id IS DISTINCT FROM p.branch_ref
  OR e.project_ref IS DISTINCT FROM p.project_ref THEN
  RAISE EXCEPTION 'Original approved project/category budget effect required' USING ERRCODE='P3410';
 END IF;
 SELECT COALESCE(sum(rec.posted_amount_minor),0) INTO received
 FROM finance_csr_verified_receipt_link link
 JOIN finance_bank_reconciliation rec
  ON rec.id=link.reconciliation_id AND rec.root_realm_id=link.root_realm_id
  AND rec.status='VERIFIED' AND rec.variance_minor=0
 JOIN journal j ON j.id=rec.journal_id AND j.root_realm_id=rec.root_realm_id
 JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id
  AND d.reconciliation_id=rec.id AND d.action='VERIFY'
 JOIN cg19_stored_file f ON f.id=d.statement_file_id AND f.realm_id=d.root_realm_id
  AND f.reconciliation_id=d.reconciliation_id AND f.revision=d.statement_file_version
  AND f.owner_kind='CG09_BANK_STATEMENT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  AND i.reconciliation_id=rec.id AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED'
 WHERE link.root_realm_id=NEW.root_realm_id AND link.funding_proposal_id=NEW.funding_proposal_id
  AND link.party_kind=NEW.party_kind AND link.remitter_attested
  AND NOT EXISTS(SELECT 1 FROM journal reversal
   WHERE reversal.root_realm_id=j.root_realm_id AND reversal.reversal_of_id=j.id
    AND reversal.posting_kind='REVERSAL');
 SELECT COALESCE(sum(ev.amount_minor) FILTER (WHERE ev.kind='ALLOCATE'),0),
        COALESCE(sum(ev.amount_minor) FILTER (WHERE ev.kind='UTILIZE'),0)
  INTO allocated,utilized
 FROM finance_csr_budget_effect link JOIN finance_budget_event ev
  ON ev.id=link.budget_event_id AND ev.root_realm_id=link.root_realm_id
 WHERE link.root_realm_id=NEW.root_realm_id AND link.funding_proposal_id=NEW.funding_proposal_id
  AND link.party_kind=NEW.party_kind AND ev.budget_id=e.budget_id
  AND (ev.kind='ALLOCATE' OR NOT EXISTS(SELECT 1 FROM journal reversal
    WHERE reversal.root_realm_id=ev.root_realm_id AND reversal.reversal_of_id=ev.source_journal_id
     AND reversal.posting_kind='REVERSAL'));
 IF e.kind='ALLOCATE' THEN
  -- Sum across all budgets for this party before comparing against bank cash.
  SELECT COALESCE(sum(ev.amount_minor),0) INTO allocated
  FROM finance_csr_budget_effect link JOIN finance_budget_event ev
   ON ev.id=link.budget_event_id AND ev.root_realm_id=link.root_realm_id
  WHERE link.root_realm_id=NEW.root_realm_id AND link.funding_proposal_id=NEW.funding_proposal_id
   AND link.party_kind=NEW.party_kind AND ev.kind='ALLOCATE';
  IF allocated+e.amount_minor>received THEN
   RAISE EXCEPTION 'CSR budget allocation exceeds currently verified original bank receipts' USING ERRCODE='P3410';
  END IF;
 ELSE
  IF utilized+e.amount_minor>allocated THEN
   RAISE EXCEPTION 'CSR utilization exceeds same-budget attributed allocation' USING ERRCODE='P3410';
  END IF;
  IF EXISTS(SELECT 1 FROM journal reversal WHERE root_realm_id=NEW.root_realm_id
   AND reversal_of_id=e.source_journal_id AND posting_kind='REVERSAL') THEN
   RAISE EXCEPTION 'Reversed CG09 expense cannot be utilized' USING ERRCODE='P3410';
  END IF;
 END IF;
 RETURN NEW;
END; $cg09cb$;
CREATE TRIGGER cg09_csr_budget_effect_source_guard
 BEFORE INSERT ON finance_csr_budget_effect
 FOR EACH ROW EXECUTE FUNCTION cg09_csr_budget_effect_guard();
