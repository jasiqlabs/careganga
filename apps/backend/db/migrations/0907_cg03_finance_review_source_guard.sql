-- CG-03 critical financial-decision guard at the database boundary.
-- A protected reviewer cannot approve a stale, forged or revoked CG-19 proof.
-- Return/Reject remain available when evidence was revoked so it can be corrected.
CREATE FUNCTION cg03_verify_finance_voucher_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_kind text; v_proposer uuid;
BEGIN
 SELECT case_kind,proposer_id INTO v_kind,v_proposer
 FROM cg03_case WHERE id=NEW.case_id AND realm_id=NEW.realm_id FOR SHARE;
 IF NOT FOUND OR v_kind<>'FINANCE_VOUCHER' THEN RETURN NEW; END IF;
 IF NEW.actor_id=v_proposer THEN
  RAISE EXCEPTION 'Submitter cannot approve own Finance voucher'
    USING ERRCODE='P0915';
 END IF;
 IF NEW.fresh_password_verified_at IS NULL OR NEW.step_ordinal<>1
    OR NEW.action NOT IN('APPROVE','RETURN','REJECT') THEN
  RAISE EXCEPTION 'A protected reviewer decision is required'
   USING ERRCODE='P0915';
 END IF;
 IF NEW.action='APPROVE' THEN
  PERFORM 1 FROM cg03_case c
   JOIN finance_voucher v ON v.id=c.finance_voucher_id AND v.root_realm_id=c.realm_id
   JOIN finance_voucher_draft_revision r ON r.voucher_id=v.id
     AND r.root_realm_id=v.root_realm_id AND r.version=c.finance_voucher_revision
   JOIN cg19_stored_file f ON f.id=c.finance_proof_file_id
     AND f.realm_id=c.realm_id AND f.voucher_id=v.id
     AND f.voucher_version=c.finance_voucher_revision
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id
     AND i.realm_id=f.realm_id AND i.owner_kind='CG09_VOUCHER'
   WHERE c.id=NEW.case_id AND c.realm_id=NEW.realm_id AND c.case_kind='FINANCE_VOUCHER'
     AND c.status='PENDING_OWNER'
     AND v.status='SUBMITTED' AND v.approval_case_id=c.id
     AND c.finance_voucher_revision=v.version
     AND c.finance_voucher_digest=r.payload_digest
     AND v.proof_file_id=f.id AND v.proof_file_revision=f.revision
     AND c.finance_proof_revision=f.revision
     AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
     AND i.status='VALIDATED'
   FOR SHARE OF c,v,r,f,i;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Verified voucher source or private evidence has changed'
    USING ERRCODE='P0915';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_finance_decision_verified
 BEFORE INSERT ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_verify_finance_voucher_decision();
