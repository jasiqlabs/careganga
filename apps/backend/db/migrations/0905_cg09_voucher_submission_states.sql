-- CG-09 US-002: explicit voucher source states backed only by CG-03/CG-19.
-- Approval is NOT a posting and is NEVER a cash/bank payment.
ALTER TABLE finance_voucher DROP CONSTRAINT IF EXISTS finance_voucher_status_check;
ALTER TABLE finance_voucher
 ADD COLUMN approval_case_id uuid,
 ADD COLUMN proof_file_id uuid,
 ADD COLUMN proof_file_revision integer,
 ADD CONSTRAINT cg09_voucher_workflow_status CHECK(status IN
   ('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED')),
 ADD CONSTRAINT cg09_voucher_case_and_proof CHECK(
   (status='DRAFT' AND approval_case_id IS NULL AND proof_file_id IS NULL
     AND proof_file_revision IS NULL)
   OR
   (status<>'DRAFT' AND approval_case_id IS NOT NULL
     AND proof_file_id IS NOT NULL AND proof_file_revision>0)
 ),
 ADD CONSTRAINT fk_cg09_voucher_approval FOREIGN KEY(approval_case_id,root_realm_id)
   REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg09_voucher_proof
   FOREIGN KEY(proof_file_id,root_realm_id,id,version)
   REFERENCES cg19_stored_file(id,realm_id,voucher_id,voucher_version)
   ON DELETE RESTRICT;

-- One original owner: CG-09 is the only writer to voucher source state.
-- CG-03 only writes CG-03 cases/decisions; CG-19 only writes verified files.
CREATE OR REPLACE FUNCTION cg09_guard_voucher_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_start date; v_end date; v_status text; v_case_status text;
BEGIN
 SELECT fy.start_on,fy.end_on,fy.status INTO v_start,v_end,v_status
 FROM financial_year fy
 WHERE fy.id=NEW.financial_year_id AND fy.root_realm_id=NEW.root_realm_id
 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Financial year is not available' USING ERRCODE='P0901'; END IF;
 IF NEW.posting_date<v_start OR NEW.posting_date>v_end THEN
  RAISE EXCEPTION 'Voucher date is outside financial year' USING ERRCODE='P0911';
 END IF;
 IF NEW.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch b WHERE b.id=NEW.branch_id AND b.root_realm_id=NEW.root_realm_id
   AND b.status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher branch is not active' USING ERRCODE='P0904'; END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR v_status<>'OPEN' THEN
   RAISE EXCEPTION 'New voucher must be a draft in an open year' USING ERRCODE='P0901';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id
  OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.voucher_number IS DISTINCT FROM OLD.voucher_number
  OR NEW.created_by IS DISTINCT FROM OLD.created_by
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Voucher source identity is immutable' USING ERRCODE='P0907';
 END IF;
 IF OLD.status='DRAFT' AND NEW.status='DRAFT' THEN
  IF v_status<>'OPEN' OR NEW.version<>OLD.version+1
   OR NEW.approval_case_id IS NOT NULL OR NEW.proof_file_id IS NOT NULL THEN
   RAISE EXCEPTION 'Voucher revision cannot be applied' USING ERRCODE='P0907';
  END IF;
 ELSIF OLD.status='RETURNED' AND NEW.status='DRAFT' THEN
  IF v_status<>'OPEN' OR NEW.version<>OLD.version+1
   OR NEW.approval_case_id IS NOT NULL OR NEW.proof_file_id IS NOT NULL THEN
   RAISE EXCEPTION 'Returned voucher cannot be corrected' USING ERRCODE='P0907';
  END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
  IF v_status<>'OPEN' OR NEW.version<>OLD.version
   OR NEW.approval_case_id IS NULL OR NEW.proof_file_id IS NULL
   OR NEW.proof_file_revision IS NULL THEN
   RAISE EXCEPTION 'Submitted voucher is missing its genuine approval or file' USING ERRCODE='P0913';
  END IF;
  -- The only editable values are the pinned, immutable owner references and status.
  IF NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id
   OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
   OR NEW.voucher_type IS DISTINCT FROM OLD.voucher_type
   OR NEW.posting_date IS DISTINCT FROM OLD.posting_date
   OR NEW.payee_name IS DISTINCT FROM OLD.payee_name
   OR NEW.purpose IS DISTINCT FROM OLD.purpose
   OR NEW.gross_minor IS DISTINCT FROM OLD.gross_minor
   OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor
   OR NEW.charges_minor IS DISTINCT FROM OLD.charges_minor
   OR NEW.total_minor IS DISTINCT FROM OLD.total_minor THEN
   RAISE EXCEPTION 'Submitted voucher financial values cannot change' USING ERRCODE='P0907';
  END IF;
  PERFORM 1 FROM cg03_case c
   JOIN cg19_stored_file f ON f.id=NEW.proof_file_id
     AND f.realm_id=NEW.root_realm_id
     AND f.voucher_id=NEW.id AND f.voucher_version=NEW.version
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.case_kind='FINANCE_VOUCHER' AND c.finance_voucher_id=NEW.id
    AND c.finance_voucher_revision=NEW.version
    AND c.finance_proof_file_id=NEW.proof_file_id
    AND c.finance_proof_revision=NEW.proof_file_revision
    AND c.status IN('SUBMITTED','IN_REVIEW')
    AND f.revision=NEW.proof_file_revision AND f.revoked_at IS NULL
    AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED'
   FOR SHARE OF c,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Original voucher case and clean file are required' USING ERRCODE='P0913';
  END IF;
 ELSIF OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED') THEN
  IF NEW.version<>OLD.version OR
   NEW.approval_case_id IS DISTINCT FROM OLD.approval_case_id OR
   NEW.proof_file_id IS DISTINCT FROM OLD.proof_file_id OR
   NEW.proof_file_revision IS DISTINCT FROM OLD.proof_file_revision OR
   NEW.financial_year_id IS DISTINCT FROM OLD.financial_year_id OR
   NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
   NEW.voucher_type IS DISTINCT FROM OLD.voucher_type OR
   NEW.posting_date IS DISTINCT FROM OLD.posting_date OR
   NEW.payee_name IS DISTINCT FROM OLD.payee_name OR
   NEW.purpose IS DISTINCT FROM OLD.purpose OR
   NEW.gross_minor IS DISTINCT FROM OLD.gross_minor OR
   NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR
   NEW.charges_minor IS DISTINCT FROM OLD.charges_minor OR
   NEW.total_minor IS DISTINCT FROM OLD.total_minor THEN
   RAISE EXCEPTION 'Submitted voucher cannot change financial values' USING ERRCODE='P0907';
  END IF;
  SELECT status INTO v_case_status FROM cg03_case c
   WHERE c.id=NEW.approval_case_id AND c.realm_id=NEW.root_realm_id
    AND c.finance_voucher_id=NEW.id AND c.finance_voucher_revision=NEW.version
    AND c.case_kind='FINANCE_VOUCHER' FOR SHARE;
  IF NOT FOUND OR (NEW.status='APPROVED' AND v_case_status NOT IN('PENDING_OWNER','OWNER_COMPLETED'))
   OR (NEW.status='RETURNED' AND v_case_status<>'RETURNED')
   OR (NEW.status='REJECTED' AND v_case_status<>'REJECTED') THEN
   RAISE EXCEPTION 'Genuine CG-03 review is required' USING ERRCODE='P0913';
  END IF;
  IF NEW.status='APPROVED' THEN
   PERFORM 1 FROM cg03_finance_owner_effect e
   JOIN cg03_case_decision d ON d.id=e.final_decision_id
   WHERE e.case_id=NEW.approval_case_id AND e.realm_id=NEW.root_realm_id
    AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
   FOR SHARE OF e,d;
   IF NOT FOUND THEN RAISE EXCEPTION 'Approval decision has no verified proof' USING ERRCODE='P0913'; END IF;
  END IF;
 ELSE
  RAISE EXCEPTION 'Voucher workflow transition is not allowed' USING ERRCODE='P0907';
 END IF;
 RETURN NEW;
END; $$;

-- Stable actor-bound request identity for submission and reviewer-result settlement.
CREATE TABLE finance_voucher_workflow_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 voucher_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('SUBMIT','SETTLE')),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 voucher_version integer NOT NULL CHECK(voucher_version>0),
 case_id uuid NOT NULL,
 result_status text NOT NULL CHECK(result_status IN('SUBMITTED','RETURNED','REJECTED','APPROVED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(voucher_id,root_realm_id) REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_voucher_command_original ON finance_voucher_workflow_command(root_realm_id,voucher_id,created_at DESC);
CREATE TRIGGER cg09_voucher_command_immutable
 BEFORE UPDATE OR DELETE ON finance_voucher_workflow_command
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
