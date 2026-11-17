-- CG-09 US-002: one CG-19 private-file authority for later payment proof.
-- Payment proof is uploaded only after protected voucher approval; the original
-- preapproval voucher evidence remains immutable, independently reviewable.
ALTER TABLE cg19_upload_intent
 DROP CONSTRAINT cg19_intent_owner_kind_voucher,
 DROP CONSTRAINT cg19_intent_one_source_voucher,
 DROP CONSTRAINT cg19_intent_voucher_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_intent_owner_kind_voucher CHECK(owner_kind IN
  ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT')),
 ADD CONSTRAINT cg19_intent_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL
   AND registration_id IS NULL AND registration_draft_version IS NULL
   AND branch_id IS NULL AND branch_version IS NULL
   AND voucher_id IS NULL AND voucher_version IS NULL)
  OR (owner_kind='CG02_DRAFT' AND case_id IS NULL
   AND registration_id IS NOT NULL AND registration_draft_version>0
   AND proposal_revision=registration_draft_version
   AND branch_id IS NULL AND branch_version IS NULL
   AND voucher_id IS NULL AND voucher_version IS NULL)
  OR (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
   AND registration_draft_version IS NULL AND branch_id IS NOT NULL AND branch_version>0
   AND proposal_revision=branch_version AND voucher_id IS NULL AND voucher_version IS NULL)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT')
   AND case_id IS NULL AND registration_id IS NULL AND registration_draft_version IS NULL
   AND branch_id IS NULL AND branch_version IS NULL
   AND voucher_id IS NOT NULL AND voucher_version>0 AND proposal_revision=voucher_version)
 ),
 ADD CONSTRAINT cg19_intent_voucher_classification CHECK(
  (owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
  OR (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN
   ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
  OR (owner_kind='CG09_VOUCHER' AND classification='FINANCE_VOUCHER_PROOF')
  OR (owner_kind='CG09_PAYMENT' AND classification='FINANCE_PAYMENT_PROOF')
 );
ALTER TABLE cg19_stored_file
 DROP CONSTRAINT cg19_file_owner_kind_voucher,
 DROP CONSTRAINT cg19_file_one_source_voucher;
ALTER TABLE cg19_stored_file
 ADD CONSTRAINT cg19_file_owner_kind_voucher CHECK(owner_kind IN
  ('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT')),
 ADD CONSTRAINT cg19_file_one_source_voucher CHECK(
  (owner_kind='CG03_CASE' AND case_id IS NOT NULL
   AND registration_id IS NULL AND registration_draft_version IS NULL
   AND branch_id IS NULL AND branch_version IS NULL
   AND voucher_id IS NULL AND voucher_version IS NULL)
  OR (owner_kind='CG02_DRAFT' AND case_id IS NULL
   AND registration_id IS NOT NULL AND registration_draft_version>0
   AND proposal_revision=registration_draft_version
   AND branch_id IS NULL AND branch_version IS NULL AND voucher_id IS NULL
   AND voucher_version IS NULL)
  OR (owner_kind='CG02_BRANCH' AND case_id IS NULL AND registration_id IS NULL
   AND registration_draft_version IS NULL AND branch_id IS NOT NULL AND branch_version>0
   AND proposal_revision=branch_version AND voucher_id IS NULL AND voucher_version IS NULL)
  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT')
   AND case_id IS NULL AND registration_id IS NULL AND registration_draft_version IS NULL
   AND branch_id IS NULL AND branch_version IS NULL
   AND voucher_id IS NOT NULL AND voucher_version>0 AND proposal_revision=voucher_version)
 );
CREATE INDEX ix_cg19_payment_evidence ON cg19_stored_file
 (realm_id,voucher_id,voucher_version,created_at DESC,id DESC)
 WHERE owner_kind='CG09_PAYMENT';

-- No verified payment is inferred from a document upload or provider receipt.
-- A separate current protected reviewer must review the actual private bank
-- statement/cash receipt and confirm the transaction reference/amount.
CREATE TABLE finance_voucher_payment_verification(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 voucher_id uuid NOT NULL,
 voucher_revision integer NOT NULL CHECK(voucher_revision>0),
 case_id uuid NOT NULL,
 proof_file_id uuid NOT NULL,
 proof_file_version integer NOT NULL CHECK(proof_file_version>0),
 method text NOT NULL CHECK(method IN('BANK_STATEMENT','CASH_RECEIPT')),
 bank_reference text CHECK(bank_reference IS NULL OR
  (char_length(bank_reference) BETWEEN 6 AND 64 AND
   bank_reference ~ '^[A-Za-z0-9 /._-]+$')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL DEFAULT 'PENDING_REVIEW'
  CHECK(status IN('PENDING_REVIEW','VERIFIED','REJECTED')),
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[0-9a-f]{64}$'),
 verified_by uuid,
 verified_at timestamptz,
 verifier_proof_at timestamptz,
 review_request_key uuid,
 review_digest char(64),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,voucher_id,request_key),
 UNIQUE(root_realm_id,requested_by,request_key),
 UNIQUE(id,root_realm_id),
 FOREIGN KEY(voucher_id,root_realm_id) REFERENCES finance_voucher(id,root_realm_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(proof_file_id,root_realm_id,voucher_id,voucher_revision)
  REFERENCES cg19_stored_file(id,realm_id,voucher_id,voucher_version)
  ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(verified_by,root_realm_id) REFERENCES account(id,realm_id)
  ON DELETE RESTRICT,
 CHECK((status='PENDING_REVIEW' AND verified_by IS NULL AND verified_at IS NULL
    AND verifier_proof_at IS NULL AND review_request_key IS NULL AND review_digest IS NULL)
  OR (status IN('VERIFIED','REJECTED') AND verified_by IS NOT NULL AND
   verified_at IS NOT NULL AND verifier_proof_at IS NOT NULL
   AND review_request_key IS NOT NULL AND review_digest ~ '^[0-9a-f]{64}$'
   AND verified_by<>requested_by))
);
CREATE UNIQUE INDEX ux_cg09_active_payment_attempt
 ON finance_voucher_payment_verification(root_realm_id,voucher_id)
 WHERE status IN('PENDING_REVIEW','VERIFIED');
CREATE UNIQUE INDEX ux_cg09_voucher_bank_reference ON finance_voucher_payment_verification
 (root_realm_id,bank_reference) WHERE method='BANK_STATEMENT'
 AND bank_reference IS NOT NULL AND status IN('PENDING_REVIEW','VERIFIED');
CREATE INDEX ix_cg09_payment_pending
 ON finance_voucher_payment_verification(root_realm_id,status,created_at DESC,id DESC);

CREATE FUNCTION cg09_payment_verification_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_voucher record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
   OR NEW.voucher_id IS DISTINCT FROM OLD.voucher_id OR NEW.voucher_revision<>OLD.voucher_revision
   OR NEW.case_id IS DISTINCT FROM OLD.case_id
   OR NEW.proof_file_id IS DISTINCT FROM OLD.proof_file_id
   OR NEW.proof_file_version<>OLD.proof_file_version
   OR NEW.method<>OLD.method OR NEW.bank_reference IS DISTINCT FROM OLD.bank_reference
   OR NEW.amount_minor<>OLD.amount_minor OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
   OR NEW.request_key IS DISTINCT FROM OLD.request_key OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
   OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.status<>'PENDING_REVIEW'
   OR NEW.status NOT IN('VERIFIED','REJECTED') THEN
   RAISE EXCEPTION 'Original payment verification cannot change'
    USING ERRCODE='P0917';
  END IF;
 ELSE
  IF NEW.status<>'PENDING_REVIEW' THEN
   RAISE EXCEPTION 'Payment needs independent verification' USING ERRCODE='P0917';
  END IF;
 END IF;
 SELECT v.status,v.version,v.approval_case_id,v.total_minor,v.created_by,
    v.payment_account_id,a.account_kind
  INTO current_voucher FROM finance_voucher v
  JOIN finance_account a ON a.id=v.payment_account_id AND a.root_realm_id=v.root_realm_id
  WHERE v.id=NEW.voucher_id AND v.root_realm_id=NEW.root_realm_id
   AND v.voucher_type IN('PAYMENT','CONTRA') FOR SHARE OF v,a;
 IF NOT FOUND OR current_voucher.status<>'PAYMENT_REQUESTED' OR
  current_voucher.version<>NEW.voucher_revision OR
  current_voucher.approval_case_id IS DISTINCT FROM NEW.case_id OR
  current_voucher.total_minor<>NEW.amount_minor OR
  (NEW.method='BANK_STATEMENT' AND current_voucher.account_kind<>'BANK') OR
  (NEW.method='CASH_RECEIPT' AND current_voucher.account_kind<>'CASH') OR
  (NEW.method='BANK_STATEMENT' AND NEW.bank_reference IS NULL) THEN
  RAISE EXCEPTION 'Payment amount or verified source is not eligible'
   USING ERRCODE='P0917';
 END IF;
 IF NEW.status='VERIFIED' AND (NEW.verified_by=current_voucher.created_by OR
    NEW.verified_by=NEW.requested_by) THEN
  RAISE EXCEPTION 'A different reviewer must verify the payment'
   USING ERRCODE='P0917';
 END IF;
 PERFORM 1 FROM cg19_stored_file f JOIN cg19_upload_intent i
   ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
 WHERE f.id=NEW.proof_file_id AND f.realm_id=NEW.root_realm_id
  AND f.voucher_id=NEW.voucher_id AND f.voucher_version=NEW.voucher_revision
  AND f.owner_kind='CG09_PAYMENT' AND f.revision=NEW.proof_file_version
  AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
  AND i.owner_kind='CG09_PAYMENT' AND i.status='VALIDATED'
 FOR SHARE OF f,i;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original private payment proof is not verified'
   USING ERRCODE='P0917'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_payment_guard BEFORE INSERT OR UPDATE
 ON finance_voucher_payment_verification FOR EACH ROW
 EXECUTE FUNCTION cg09_payment_verification_guard();
CREATE TRIGGER cg09_payment_immutable_delete BEFORE DELETE
 ON finance_voucher_payment_verification FOR EACH ROW
 EXECUTE FUNCTION cg09_immutable_record();

ALTER TABLE finance_voucher_workflow_command
 DROP CONSTRAINT finance_voucher_workflow_command_action_check,
 DROP CONSTRAINT finance_voucher_workflow_command_result_status_check;
ALTER TABLE finance_voucher_workflow_command
 ADD CONSTRAINT finance_voucher_workflow_command_action_check
  CHECK(action IN('SUBMIT','SETTLE','PAYMENT_REQUEST','POST','PAYMENT_VERIFY')),
 ADD CONSTRAINT finance_voucher_workflow_command_result_status_check
  CHECK(result_status IN('SUBMITTED','RETURNED','REJECTED','APPROVED',
   'PAYMENT_REQUESTED','PAID_VERIFIED','POSTED'));
