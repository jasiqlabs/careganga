-- CG-09 US-003: returned-case correction without a second claim or ledger.
-- Immutable original revisions preserve each old CG03 decision and CG19 bill.
CREATE TABLE expense_claim_revision(
 root_realm_id uuid NOT NULL,
 claim_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 current_digest char(64) NOT NULL CHECK(current_digest ~ '^[a-f0-9]{64}$'),
 category_label text NOT NULL CHECK(char_length(btrim(category_label)) BETWEEN 2 AND 80),
 purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 3 AND 500),
 expense_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,claim_id,version),
 FOREIGN KEY(claim_id,root_realm_id) REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_claim_revision_history ON
 expense_claim_revision(root_realm_id,claim_id,version DESC);
CREATE TRIGGER cg09_claim_revision_immutable BEFORE UPDATE OR DELETE
 ON expense_claim_revision FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
-- Safe greenfield support if locally created draft records precede migration.
INSERT INTO expense_claim_revision(root_realm_id,claim_id,version,current_digest,
 category_label,purpose,expense_date,amount_minor,recorded_by)
SELECT root_realm_id,id,version,current_digest,category_label,purpose,expense_date,
 amount_minor,requested_by FROM expense_claim;

ALTER TABLE expense_claim_command DROP CONSTRAINT expense_claim_command_action_check;
ALTER TABLE expense_claim_command ADD CONSTRAINT expense_claim_command_action_check
 CHECK(action IN('SUBMIT','RECONCILE','LINK_PAYABLE','LINK_PAYMENT','CORRECT'));

CREATE OR REPLACE FUNCTION cg09_claim_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_case record;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original claim history cannot be deleted' USING ERRCODE='P0919';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
    NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.create_request_key IS DISTINCT FROM OLD.create_request_key OR
    NEW.create_digest IS DISTINCT FROM OLD.create_digest OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Original claim identity cannot change' USING ERRCODE='P0919';
 END IF;
 IF OLD.status='RETURNED' AND NEW.status='DRAFT' THEN
  -- Corrections keep one claim ID but must create a separate immutable version
  -- and clear approval/evidence until the new bill passes actual scanning.
  IF NEW.version<>OLD.version+1 OR
     NEW.current_digest IS NOT DISTINCT FROM OLD.current_digest OR
     NEW.bill_file_id IS NOT NULL OR NEW.bill_file_version IS NOT NULL OR
     NEW.approval_case_id IS NOT NULL THEN
   RAISE EXCEPTION 'Return correction needs new revision' USING ERRCODE='P0919';
  END IF;
  PERFORM 1 FROM cg03_case c
   JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
   WHERE c.id=OLD.approval_case_id AND c.realm_id=OLD.root_realm_id
    AND c.case_kind='FINANCE_REIMBURSEMENT'
    AND c.finance_claim_id=OLD.id AND c.finance_claim_revision=OLD.version
    AND c.status='RETURNED' AND d.action='RETURN'
    AND d.fresh_password_verified_at IS NOT NULL FOR SHARE OF c,d;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'A genuine returned reviewer case is required' USING ERRCODE='P0919';
  END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF (to_jsonb(NEW)-'status'-'bill_file_id'-'bill_file_version'-'approval_case_id')
      IS DISTINCT FROM
     (to_jsonb(OLD)-'status'-'bill_file_id'-'bill_file_version'-'approval_case_id')
  THEN RAISE EXCEPTION 'Submitted claim source cannot change' USING ERRCODE='P0919'; END IF;
  PERFORM 1 FROM cg03_case c
   JOIN cg19_stored_file f ON f.id=c.finance_claim_bill_id
    AND f.realm_id=c.realm_id AND f.claim_id=c.finance_claim_id
    AND f.claim_version=c.finance_claim_revision
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.case_kind='FINANCE_REIMBURSEMENT'
    AND c.finance_claim_id=NEW.id AND c.finance_claim_revision=NEW.version
    AND c.finance_claim_digest=NEW.current_digest
    AND c.finance_claim_bill_id=NEW.bill_file_id
    AND c.finance_claim_bill_version=NEW.bill_file_version
    AND c.status IN('SUBMITTED','IN_REVIEW')
    AND f.revoked_at IS NULL AND f.revision=NEW.bill_file_version
    AND f.owner_kind='CG09_CLAIM' AND f.scan_status='CLEAN_VERIFIED'
    AND i.owner_kind='CG09_CLAIM' AND i.status='VALIDATED'
    FOR SHARE OF c,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'A verified original bill and case are required' USING ERRCODE='P0919';
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Frozen submitted claim cannot be changed' USING ERRCODE='P0919';
  END IF;
  SELECT c.status INTO original_case FROM cg03_case c
   WHERE c.id=OLD.approval_case_id AND c.realm_id=OLD.root_realm_id
    AND c.case_kind='FINANCE_REIMBURSEMENT'
    AND c.finance_claim_id=OLD.id AND c.finance_claim_revision=OLD.version
    FOR SHARE;
  IF NOT FOUND OR
    (NEW.status='RETURNED' AND original_case.status<>'RETURNED') OR
    (NEW.status='REJECTED' AND original_case.status<>'REJECTED') OR
    (NEW.status='APPROVED' AND original_case.status NOT IN('PENDING_OWNER','OWNER_COMPLETED')) THEN
   RAISE EXCEPTION 'A genuine protected reviewer decision is required' USING ERRCODE='P0919';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect e
    JOIN cg03_case_decision d ON d.id=e.final_decision_id AND d.case_id=e.case_id
    WHERE e.case_id=OLD.approval_case_id AND e.realm_id=OLD.root_realm_id
     AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
     FOR SHARE OF e,d;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'Protected reviewer approval is not current' USING ERRCODE='P0919';
   END IF;
  END IF;
 ELSE RAISE EXCEPTION 'This claim transition is not allowed' USING ERRCODE='P0919';
 END IF;
 -- Confirm the immutable source version matches the exact currently stored
 -- purpose, category, date, amount and digest on every accepted transition.
 PERFORM 1 FROM expense_claim_revision r
 WHERE r.root_realm_id=NEW.root_realm_id AND r.claim_id=NEW.id
   AND r.version=NEW.version AND r.current_digest=NEW.current_digest
   AND r.category_label=NEW.category_label AND r.purpose=NEW.purpose
   AND r.expense_date=NEW.expense_date AND r.amount_minor=NEW.amount_minor
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current claim revision lacks original history' USING ERRCODE='P0919';
 END IF;
 RETURN NEW;
END; $$;
