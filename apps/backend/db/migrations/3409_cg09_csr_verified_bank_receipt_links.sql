-- CG08 US002: original CG09-only attribution of real, independent bank money.
-- No new journal, no second receipt amount, no donor/campaign/invoice money.
-- Finance reconciliations and posted journal lines remain THE financial source.
CREATE TABLE finance_csr_verified_receipt_link(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 funding_proposal_id uuid NOT NULL,
 approved_source_version integer NOT NULL CHECK(approved_source_version>0),
 party_kind text NOT NULL CHECK(party_kind IN('CSR','FOUNDATION')),
 reconciliation_id uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 actor_ref uuid NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),
 UNIQUE(root_realm_id,reconciliation_id),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(funding_proposal_id,root_realm_id)
  REFERENCES csr_funding_proposal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reconciliation_id,root_realm_id)
  REFERENCES finance_bank_reconciliation(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_csr_receipt_by_proposal
 ON finance_csr_verified_receipt_link(root_realm_id,funding_proposal_id,party_kind,linked_at DESC,id DESC);
CREATE TRIGGER cg09_csr_receipt_link_immutable
 BEFORE UPDATE OR DELETE ON finance_csr_verified_receipt_link
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

-- Direct SQL cannot attribute an unreconciled journal, another product's
-- bank receipt, a reversed journal, an unrelated branch, or excess pledge.
CREATE FUNCTION cg09_guard_csr_verified_receipt_link()
 RETURNS trigger LANGUAGE plpgsql AS $cg09_csr$
DECLARE f record; r record; used numeric; cap numeric; eligible integer;
BEGIN
 SELECT status,version,branch_ref,csr_partner_id,
  csr_requested_minor,foundation_requested_minor INTO f
 FROM csr_funding_proposal
 WHERE id=NEW.funding_proposal_id AND root_realm_id=NEW.root_realm_id
 FOR UPDATE;
 IF NOT FOUND OR f.status<>'APPROVED' OR f.version<>NEW.approved_source_version THEN
  RAISE EXCEPTION 'Independently approved original CSR commitment required' USING ERRCODE='P3409';
 END IF;
 IF NEW.party_kind='CSR' AND f.csr_partner_id IS NULL THEN
  RAISE EXCEPTION 'Original approved CSR partner required' USING ERRCODE='P3409';
 END IF;
 PERFORM 1 FROM cg03_case c JOIN cg03_case_decision d
  ON d.case_id=c.id AND d.realm_id=c.realm_id
 WHERE c.realm_id=NEW.root_realm_id AND c.csr_funding_proposal_id=NEW.funding_proposal_id
  AND c.case_kind='CSR_FUNDING_REVIEW' AND c.status='OWNER_COMPLETED'
  AND c.csr_funding_source_version+2=f.version
  AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
  AND d.actor_id<>c.proposer_id FOR SHARE OF c,d;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Original independently approved funding review missing' USING ERRCODE='P3409';
 END IF;
 SELECT rec.id,rec.bank_account_id,rec.journal_id,rec.posted_amount_minor,
  rec.statement_amount_minor,rec.variance_minor,j.posting_kind,
  j.source_ref,j.immutable_source_event_key,j.financial_year_id
 INTO r
 FROM finance_bank_reconciliation rec
 JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id
  AND d.reconciliation_id=rec.id AND d.actor_ref=rec.verified_by
  AND d.action='VERIFY' AND d.password_verified_at IS NOT NULL
 JOIN cg19_stored_file evidence
  ON evidence.id=d.statement_file_id AND evidence.realm_id=d.root_realm_id
  AND evidence.reconciliation_id=d.reconciliation_id
  AND evidence.revision=d.statement_file_version
  AND evidence.owner_kind='CG09_BANK_STATEMENT'
  AND evidence.scan_status='CLEAN_VERIFIED' AND evidence.revoked_at IS NULL
 JOIN cg19_upload_intent intent ON intent.id=evidence.upload_intent_id
  AND intent.realm_id=evidence.realm_id AND intent.reconciliation_id=rec.id
  AND intent.owner_kind='CG09_BANK_STATEMENT' AND intent.status='VALIDATED'
 JOIN journal j ON j.id=rec.journal_id AND j.root_realm_id=rec.root_realm_id
  AND j.status='POSTED' AND j.posting_kind='GENERAL'
 JOIN finance_command command ON command.root_realm_id=j.root_realm_id
  AND command.command_kind='GENERAL_POST'
  AND command.request_key=j.immutable_source_event_key
  AND command.entity_ref=j.id AND j.source_ref=command.request_key
 JOIN financial_year yr ON yr.id=j.financial_year_id
  AND yr.root_realm_id=j.root_realm_id AND yr.status='OPEN'
 WHERE rec.root_realm_id=NEW.root_realm_id AND rec.id=NEW.reconciliation_id
  AND rec.status='VERIFIED' AND rec.variance_minor=0
  AND rec.statement_amount_minor=rec.posted_amount_minor
  AND rec.posted_amount_minor>0
  AND NOT EXISTS(SELECT 1 FROM journal reversal WHERE
   reversal.root_realm_id=j.root_realm_id
   AND reversal.reversal_of_id=j.id AND reversal.posting_kind='REVERSAL')
  AND NOT EXISTS(SELECT 1 FROM finance_invoice_receipt invoice
   WHERE invoice.root_realm_id=rec.root_realm_id AND invoice.reconciliation_id=rec.id)
  AND NOT EXISTS(SELECT 1 FROM donation_bank_collection bank_donation
   WHERE bank_donation.root_realm_id=rec.root_realm_id AND bank_donation.reconciliation_id=rec.id)
  AND NOT EXISTS(SELECT 1 FROM finance_membership_collection member
   WHERE member.root_realm_id=rec.root_realm_id AND member.journal_id=rec.journal_id)
 FOR SHARE OF rec,d,evidence,intent,j,command,yr;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current original verified bank deposit is unavailable' USING ERRCODE='P3409';
 END IF;
 -- Require precisely one debit to the independently reconciled BANK asset
 -- and precisely one credit to an actual INCOME/FUND account, both in the
 -- agreed original branch. Never infer a payer from a journal description.
 SELECT count(*)::integer INTO eligible FROM journal_line l
 JOIN finance_account a ON a.root_realm_id=l.root_realm_id AND a.id=l.account_id
 JOIN account_group g ON g.root_realm_id=a.root_realm_id AND g.id=a.group_id
 WHERE l.root_realm_id=NEW.root_realm_id AND l.journal_id=r.journal_id
  AND l.branch_id IS NOT DISTINCT FROM f.branch_ref
  AND (
   (l.account_id=r.bank_account_id AND a.account_kind='BANK'
    AND g.category='ASSET' AND l.debit_minor=r.posted_amount_minor AND l.credit_minor=0)
   OR (l.account_id<>r.bank_account_id AND g.category IN('INCOME','FUND')
    AND l.credit_minor=r.posted_amount_minor AND l.debit_minor=0)
  );
 IF eligible<>2 OR (SELECT count(*) FROM journal_line
    WHERE root_realm_id=NEW.root_realm_id AND journal_id=r.journal_id)<>2 THEN
  RAISE EXCEPTION 'Bank deposit must credit the original funding/income account' USING ERRCODE='P3409';
 END IF;
 cap=CASE NEW.party_kind WHEN 'CSR' THEN f.csr_requested_minor
  ELSE f.foundation_requested_minor END;
 SELECT COALESCE(sum(rec.posted_amount_minor),0) INTO used
 FROM finance_csr_verified_receipt_link linked
 JOIN finance_bank_reconciliation rec
  ON rec.root_realm_id=linked.root_realm_id AND rec.id=linked.reconciliation_id
 WHERE linked.root_realm_id=NEW.root_realm_id
  AND linked.funding_proposal_id=NEW.funding_proposal_id
  AND linked.party_kind=NEW.party_kind;
 IF used+r.posted_amount_minor>cap THEN
  RAISE EXCEPTION 'Verified bank receipts exceed original approved funding share' USING ERRCODE='P3409';
 END IF;
 RETURN NEW;
END; $cg09_csr$;
CREATE TRIGGER cg09_csr_receipt_link_source_guard
 BEFORE INSERT ON finance_csr_verified_receipt_link
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_csr_verified_receipt_link();
