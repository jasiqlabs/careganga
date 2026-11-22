-- Original CG09 linked-source fee collection. It records only the
-- source association; all money remains in the existing CG09 journal,
-- reconciliation and verified bank-statement evidence tables.
CREATE TABLE finance_membership_collection(
 root_realm_id uuid NOT NULL,application_id uuid NOT NULL,
 submitted_version integer NOT NULL CHECK(submitted_version>1),
 submitted_digest char(64) NOT NULL CHECK(submitted_digest~'^[a-f0-9]{64}$'),
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=999999999999999),
 branch_id uuid,bank_account_id uuid NOT NULL,income_account_id uuid NOT NULL,
 journal_id uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),UNIQUE(root_realm_id,request_key),UNIQUE(root_realm_id,journal_id),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES membership_application(root_realm_id,id),
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(bank_account_id,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(income_account_id,root_realm_id) REFERENCES finance_account(id,root_realm_id),
 FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(recorded_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(bank_account_id<>income_account_id)
);
CREATE TRIGGER cg09_member_collection_immutable BEFORE UPDATE OR DELETE ON finance_membership_collection FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE FUNCTION cg09_member_collection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_application a JOIN membership_review_snapshot s ON s.root_realm_id=a.root_realm_id AND s.application_id=a.id
 JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.membership_review_ref=s.id AND c.case_kind='MEMBER_APPLICATION'
 JOIN journal j ON j.root_realm_id=a.root_realm_id AND j.id=NEW.journal_id
 JOIN journal_line debit ON debit.root_realm_id=j.root_realm_id AND debit.journal_id=j.id AND debit.account_id=NEW.bank_account_id
 JOIN journal_line credit ON credit.root_realm_id=j.root_realm_id AND credit.journal_id=j.id AND credit.account_id=NEW.income_account_id
 JOIN finance_account bank ON bank.root_realm_id=j.root_realm_id AND bank.id=debit.account_id
 JOIN finance_account income ON income.root_realm_id=j.root_realm_id AND income.id=credit.account_id
 JOIN account_group g ON g.root_realm_id=income.root_realm_id AND g.id=income.group_id
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id AND a.status='SUBMITTED'
   AND a.accepted_fee_minor=NEW.amount_minor AND a.branch_ref IS NOT DISTINCT FROM NEW.branch_id
   AND s.application_version=NEW.submitted_version AND s.source_digest=NEW.submitted_digest
   AND a.version=s.application_version AND a.submitted_digest=s.source_digest
   AND c.status IN('SUBMITTED','PENDING_OWNER') AND j.source_ref=a.id AND j.source_owner='CG-09' AND j.posting_kind='GENERAL' AND j.status='POSTED'
   AND j.immutable_source_event_key=NEW.request_key AND j.created_by=NEW.recorded_by
   AND debit.debit_minor=NEW.amount_minor AND debit.credit_minor=0 AND credit.credit_minor=NEW.amount_minor AND credit.debit_minor=0
   AND debit.branch_id IS NOT DISTINCT FROM NEW.branch_id AND credit.branch_id IS NOT DISTINCT FROM NEW.branch_id
   AND bank.account_kind='BANK' AND income.account_kind='GENERAL' AND g.category='INCOME'
   AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2)
 THEN RAISE EXCEPTION 'Membership collection must match the original submitted fee and posted journal'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_membership_collection_insert BEFORE INSERT ON finance_membership_collection FOR EACH ROW EXECUTE FUNCTION cg09_member_collection_guard();
-- Money verification is derived from actual bank reconciliation (not from
-- a local boolean, client UTR, payment link or successful HTTP response).
CREATE VIEW finance_membership_verified_collection AS
 SELECT m.root_realm_id,m.application_id,m.journal_id,m.amount_minor,r.id AS reconciliation_id,r.statement_date
 FROM finance_membership_collection m
 JOIN finance_bank_reconciliation r ON r.root_realm_id=m.root_realm_id AND r.journal_id=m.journal_id AND r.bank_account_id=m.bank_account_id
 WHERE r.status='VERIFIED' AND r.variance_minor=0 AND r.statement_amount_minor=m.amount_minor AND r.posted_amount_minor=m.amount_minor
 AND EXISTS(SELECT 1 FROM finance_reconciliation_decision d
 JOIN cg19_stored_file f ON f.id=d.statement_file_id AND f.realm_id=d.root_realm_id AND f.reconciliation_id=d.reconciliation_id AND f.revision=d.statement_file_version
 JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id AND i.reconciliation_id=d.reconciliation_id
 WHERE d.root_realm_id=r.root_realm_id AND d.reconciliation_id=r.id AND d.action='VERIFY'
 AND f.owner_kind='CG09_BANK_STATEMENT' AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM journal j WHERE j.root_realm_id=m.root_realm_id AND j.reversal_of_id=m.journal_id);
-- Rejection of a paid application requires a single linked, original-fee
-- refund request. This is not a second payable/bank ledger.
CREATE TABLE finance_membership_refund_request(
 root_realm_id uuid NOT NULL,application_id uuid NOT NULL,
 original_journal_id uuid NOT NULL,original_reconciliation_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 requested_by uuid NOT NULL,requested_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES finance_membership_collection(root_realm_id,application_id),
 FOREIGN KEY(original_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(original_reconciliation_id,root_realm_id) REFERENCES finance_bank_reconciliation(id,root_realm_id),
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg09_membership_refund_request_immutable BEFORE UPDATE OR DELETE ON finance_membership_refund_request FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE FUNCTION cg09_membership_refund_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_membership_verified_collection v JOIN membership_application a ON a.root_realm_id=v.root_realm_id AND a.id=v.application_id
 JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.membership_application_id=a.id 
 WHERE v.root_realm_id=NEW.root_realm_id AND v.application_id=NEW.application_id AND v.journal_id=NEW.original_journal_id
 AND v.reconciliation_id=NEW.original_reconciliation_id AND v.amount_minor=NEW.amount_minor 
 AND a.status='REJECTED' AND c.case_kind='MEMBER_APPLICATION' AND c.status='REJECTED' AND c.membership_review_digest=a.submitted_digest)
 THEN RAISE EXCEPTION 'Refund must be linked to the exact verified original rejected fee'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_membership_refund_request_insert BEFORE INSERT ON finance_membership_refund_request FOR EACH ROW EXECUTE FUNCTION cg09_membership_refund_request_guard();

CREATE TABLE finance_membership_refund_posting(
 root_realm_id uuid NOT NULL,application_id uuid NOT NULL,
 journal_id uuid NOT NULL,request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 approved_by uuid NOT NULL,transfer_reference text NOT NULL CHECK(transfer_reference ~ '^[A-Za-z0-9._/: -]{4,100}
 PRIMARY KEY(root_realm_id,application_id),UNIQUE(root_realm_id,journal_id),UNIQUE(root_realm_id,request_key),UNIQUE(root_realm_id,transfer_reference),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES finance_membership_refund_request(root_realm_id,application_id),
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(approved_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg09_member_refund_posting_immutable BEFORE UPDATE OR DELETE ON finance_membership_refund_posting FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE FUNCTION cg09_member_refund_posting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_membership_refund_request r
 JOIN finance_membership_collection m ON m.root_realm_id=r.root_realm_id AND m.application_id=r.application_id
 JOIN finance_membership_verified_collection v ON v.root_realm_id=r.root_realm_id AND v.application_id=r.application_id AND v.reconciliation_id=r.original_reconciliation_id
 JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=NEW.journal_id
 JOIN journal_line bank ON bank.root_realm_id=j.root_realm_id AND bank.journal_id=j.id AND bank.account_id=m.bank_account_id
 JOIN journal_line income ON income.root_realm_id=j.root_realm_id AND income.journal_id=j.id AND income.account_id=m.income_account_id
 WHERE r.root_realm_id=NEW.root_realm_id AND r.application_id=NEW.application_id AND r.requested_by<>NEW.approved_by AND m.recorded_by<>NEW.approved_by
 AND j.source_owner='CG-09' AND j.source_ref=r.application_id AND j.status='POSTED' AND j.posting_kind='REFUND' AND j.created_by=NEW.approved_by AND j.immutable_source_event_key=NEW.request_key
 AND bank.credit_minor=r.amount_minor AND bank.debit_minor=0 AND income.debit_minor=r.amount_minor AND income.credit_minor=0
 AND bank.branch_id IS NOT DISTINCT FROM m.branch_id AND income.branch_id IS NOT DISTINCT FROM m.branch_id
 AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2
 AND EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role role ON role.id=ar.role_id AND role.realm_id=a.realm_id AND role.active AND role.is_protected WHERE a.id=NEW.approved_by AND a.realm_id=NEW.root_realm_id AND a.status='ACTIVE'))
 THEN RAISE EXCEPTION 'Refund requires distinct protected approval and exact original verified fee'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_member_refund_posting_insert BEFORE INSERT ON finance_membership_refund_posting FOR EACH ROW EXECUTE FUNCTION cg09_member_refund_posting_guard();

CREATE VIEW finance_membership_verified_refund AS
 SELECT q.root_realm_id,q.application_id,q.journal_id,r.id AS reconciliation_id,rr.amount_minor,r.statement_date
 FROM finance_membership_refund_posting q
 JOIN finance_membership_refund_request rr ON rr.root_realm_id=q.root_realm_id AND rr.application_id=q.application_id
 JOIN finance_membership_collection m ON m.root_realm_id=q.root_realm_id AND m.application_id=q.application_id
 JOIN finance_bank_reconciliation r ON r.root_realm_id=q.root_realm_id AND r.journal_id=q.journal_id AND r.bank_account_id=m.bank_account_id
 WHERE r.status='VERIFIED' AND r.variance_minor=0 AND r.statement_amount_minor=-rr.amount_minor AND r.posted_amount_minor=-rr.amount_minor
 AND EXISTS(SELECT 1 FROM finance_reconciliation_decision d
 JOIN cg19_stored_file f ON f.id=d.statement_file_id AND f.realm_id=d.root_realm_id AND f.reconciliation_id=d.reconciliation_id AND f.revision=d.statement_file_version
 JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id AND i.reconciliation_id=d.reconciliation_id
 WHERE d.root_realm_id=r.root_realm_id AND d.reconciliation_id=r.id AND d.action='VERIFY'
 AND f.owner_kind='CG09_BANK_STATEMENT' AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL);
-- Do not reprice a posted original membership collection during correction;
-- returned applications may correct non-financial fields with original offer.
CREATE FUNCTION cg09_membership_fee_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_membership_collection m WHERE m.root_realm_id=OLD.root_realm_id AND m.application_id=OLD.id)
 AND (NEW.tier_version_id,NEW.accepted_fee_minor,NEW.currency,NEW.branch_ref) IS DISTINCT FROM (OLD.tier_version_id,OLD.accepted_fee_minor,OLD.currency,OLD.branch_ref)
 THEN RAISE EXCEPTION 'The recorded membership fee and funding scope cannot be repriced'; END IF;
 IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM finance_membership_collection m WHERE m.root_realm_id=OLD.root_realm_id AND m.application_id=OLD.id)
 THEN RAISE EXCEPTION 'A recorded fee must follow the original rejection and refund flow'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_membership_fee_pin BEFORE UPDATE ON membership_application FOR EACH ROW EXECUTE FUNCTION cg09_membership_fee_pin_guard();
-- Posted source pins the historical offer through a returned correction.
CREATE OR REPLACE FUNCTION cg04_application_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid membership application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR NOT ((OLD.status IN('DRAFT','RETURNED') AND NEW.status IN('DRAFT','CANCELLED','SUBMITTED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED')))
   THEN RAISE EXCEPTION 'Invalid membership application revision'; END IF;
  IF NEW.status IN('SUBMITTED','RETURNED','REJECTED','CANCELLED')
   AND (to_jsonb(NEW)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest')
   THEN RAISE EXCEPTION 'A review transition cannot change the accepted applicant source'; END IF;
  IF OLD.status='SUBMITTED' AND (NEW.submitted_digest,NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_digest,OLD.submitted_at)
   THEN RAISE EXCEPTION 'Original submitted snapshot is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN RAISE EXCEPTION 'Invalid Foundation membership scope'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
    AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
    AND a.display_name=NEW.display_name AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
   THEN RAISE EXCEPTION 'A verified original applicant contact is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM membership_tier_version v JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id
   WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.tier_version_id AND t.version=v.version_no AND t.status='ACTIVE'
    AND v.status='ACTIVE' AND v.published_at<=now() FOR SHARE OF t) AND NOT EXISTS(SELECT 1 FROM finance_membership_collection fee WHERE fee.root_realm_id=NEW.root_realm_id AND fee.application_id=NEW.id AND fee.amount_minor=NEW.accepted_fee_minor AND fee.branch_id IS NOT DISTINCT FROM NEW.branch_ref) THEN RAISE EXCEPTION 'Select a current published membership plan'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE) THEN RAISE EXCEPTION 'Select an active branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.level='STATE' AND s.status='ACTIVE' AND d.id=NEW.district_ref AND d.level='DISTRICT' AND d.status='ACTIVE' FOR SHARE OF s,d) THEN RAISE EXCEPTION 'Select current state and district'; END IF;
 END IF;
 RETURN NEW;
END; $$;
),password_verified_at timestamptz NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),UNIQUE(root_realm_id,journal_id),UNIQUE(root_realm_id,request_key),UNIQUE(root_realm_id,transfer_reference),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES finance_membership_refund_request(root_realm_id,application_id),
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(approved_by,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg09_member_refund_posting_immutable BEFORE UPDATE OR DELETE ON finance_membership_refund_posting FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE FUNCTION cg09_member_refund_posting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_membership_refund_request r
 JOIN finance_membership_collection m ON m.root_realm_id=r.root_realm_id AND m.application_id=r.application_id
 JOIN finance_membership_verified_collection v ON v.root_realm_id=r.root_realm_id AND v.application_id=r.application_id AND v.reconciliation_id=r.original_reconciliation_id
 JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=NEW.journal_id
 JOIN journal_line bank ON bank.root_realm_id=j.root_realm_id AND bank.journal_id=j.id AND bank.account_id=m.bank_account_id
 JOIN journal_line income ON income.root_realm_id=j.root_realm_id AND income.journal_id=j.id AND income.account_id=m.income_account_id
 WHERE r.root_realm_id=NEW.root_realm_id AND r.application_id=NEW.application_id AND r.requested_by<>NEW.approved_by AND m.recorded_by<>NEW.approved_by
 AND j.source_owner='CG-09' AND j.source_ref=r.application_id AND j.status='POSTED' AND j.posting_kind='REFUND' AND j.created_by=NEW.approved_by AND j.immutable_source_event_key=NEW.request_key
 AND bank.credit_minor=r.amount_minor AND bank.debit_minor=0 AND income.debit_minor=r.amount_minor AND income.credit_minor=0
 AND bank.branch_id IS NOT DISTINCT FROM m.branch_id AND income.branch_id IS NOT DISTINCT FROM m.branch_id
 AND (SELECT count(*) FROM journal_line l WHERE l.root_realm_id=j.root_realm_id AND l.journal_id=j.id)=2
 AND EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role role ON role.id=ar.role_id AND role.realm_id=a.realm_id AND role.active AND role.is_protected WHERE a.id=NEW.approved_by AND a.realm_id=NEW.root_realm_id AND a.status='ACTIVE'))
 THEN RAISE EXCEPTION 'Refund requires distinct protected approval and exact original verified fee'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_member_refund_posting_insert BEFORE INSERT ON finance_membership_refund_posting FOR EACH ROW EXECUTE FUNCTION cg09_member_refund_posting_guard();

CREATE VIEW finance_membership_verified_refund AS
 SELECT q.root_realm_id,q.application_id,q.journal_id,r.id AS reconciliation_id,rr.amount_minor,r.statement_date
 FROM finance_membership_refund_posting q
 JOIN finance_membership_refund_request rr ON rr.root_realm_id=q.root_realm_id AND rr.application_id=q.application_id
 JOIN finance_membership_collection m ON m.root_realm_id=q.root_realm_id AND m.application_id=q.application_id
 JOIN finance_bank_reconciliation r ON r.root_realm_id=q.root_realm_id AND r.journal_id=q.journal_id AND r.bank_account_id=m.bank_account_id
 WHERE r.status='VERIFIED' AND r.variance_minor=0 AND r.statement_amount_minor=-rr.amount_minor AND r.posted_amount_minor=-rr.amount_minor
 AND EXISTS(SELECT 1 FROM finance_reconciliation_decision d
 JOIN cg19_stored_file f ON f.id=d.statement_file_id AND f.realm_id=d.root_realm_id AND f.reconciliation_id=d.reconciliation_id AND f.revision=d.statement_file_version
 JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id AND i.reconciliation_id=d.reconciliation_id
 WHERE d.root_realm_id=r.root_realm_id AND d.reconciliation_id=r.id AND d.action='VERIFY'
 AND f.owner_kind='CG09_BANK_STATEMENT' AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL);
-- Do not reprice a posted original membership collection during correction;
-- returned applications may correct non-financial fields with original offer.
CREATE FUNCTION cg09_membership_fee_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_membership_collection m WHERE m.root_realm_id=OLD.root_realm_id AND m.application_id=OLD.id)
 AND (NEW.tier_version_id,NEW.accepted_fee_minor,NEW.currency,NEW.branch_ref) IS DISTINCT FROM (OLD.tier_version_id,OLD.accepted_fee_minor,OLD.currency,OLD.branch_ref)
 THEN RAISE EXCEPTION 'The recorded membership fee and funding scope cannot be repriced'; END IF;
 IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM finance_membership_collection m WHERE m.root_realm_id=OLD.root_realm_id AND m.application_id=OLD.id)
 THEN RAISE EXCEPTION 'A recorded fee must follow the original rejection and refund flow'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_membership_fee_pin BEFORE UPDATE ON membership_application FOR EACH ROW EXECUTE FUNCTION cg09_membership_fee_pin_guard();
-- Posted source pins the historical offer through a returned correction.
CREATE OR REPLACE FUNCTION cg04_application_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid membership application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR NOT ((OLD.status IN('DRAFT','RETURNED') AND NEW.status IN('DRAFT','CANCELLED','SUBMITTED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED')))
   THEN RAISE EXCEPTION 'Invalid membership application revision'; END IF;
  IF NEW.status IN('SUBMITTED','RETURNED','REJECTED','CANCELLED')
   AND (to_jsonb(NEW)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest')
   THEN RAISE EXCEPTION 'A review transition cannot change the accepted applicant source'; END IF;
  IF OLD.status='SUBMITTED' AND (NEW.submitted_digest,NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_digest,OLD.submitted_at)
   THEN RAISE EXCEPTION 'Original submitted snapshot is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN RAISE EXCEPTION 'Invalid Foundation membership scope'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
    AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
    AND a.display_name=NEW.display_name AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
   THEN RAISE EXCEPTION 'A verified original applicant contact is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM membership_tier_version v JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id
   WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.tier_version_id AND t.version=v.version_no AND t.status='ACTIVE'
    AND v.status='ACTIVE' AND v.published_at<=now() FOR SHARE OF t) AND NOT EXISTS(SELECT 1 FROM finance_membership_collection fee WHERE fee.root_realm_id=NEW.root_realm_id AND fee.application_id=NEW.id AND fee.amount_minor=NEW.accepted_fee_minor AND fee.branch_id IS NOT DISTINCT FROM NEW.branch_ref) THEN RAISE EXCEPTION 'Select a current published membership plan'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE) THEN RAISE EXCEPTION 'Select an active branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.level='STATE' AND s.status='ACTIVE' AND d.id=NEW.district_ref AND d.level='DISTRICT' AND d.status='ACTIVE' FOR SHARE OF s,d) THEN RAISE EXCEPTION 'Select current state and district'; END IF;
 END IF;
 RETURN NEW;
END; $$;
