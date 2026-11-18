-- CG-03 verifies immutable original CG-09 invoice/budget reviewer sources.
-- Strict application fresh-password confirmation remains mandatory; SQL rejects
-- alternate source/version/digest and same-actor approvals even if HTTP is bypassed.
CREATE FUNCTION cg03_verify_finance_invoice_budget_decision()
 RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original record;
BEGIN
 SELECT c.case_kind,c.proposer_id,c.status,c.finance_invoice_id,
   c.finance_invoice_revision,c.finance_invoice_digest,c.finance_budget_id,
   c.finance_budget_revision,c.finance_budget_digest
 INTO original FROM cg03_case c
 WHERE c.id=NEW.case_id AND c.realm_id=NEW.realm_id FOR SHARE;
 IF NOT FOUND OR original.case_kind NOT IN('FINANCE_INVOICE','FINANCE_BUDGET')
 THEN RETURN NEW; END IF;
 IF original.proposer_id=NEW.actor_id OR NEW.step_ordinal<>1 OR
    NEW.fresh_password_verified_at IS NULL OR
    NEW.action NOT IN('APPROVE','RETURN','REJECT') THEN
  RAISE EXCEPTION 'Different protected finance reviewer is required' USING ERRCODE='P0928';
 END IF;
 IF (NEW.action='APPROVE' AND original.status<>'PENDING_OWNER') OR
    (NEW.action='RETURN' AND original.status<>'RETURNED') OR
    (NEW.action='REJECT' AND original.status<>'REJECTED') THEN
  RAISE EXCEPTION 'Original finance case review outcome is not current' USING ERRCODE='P0928';
 END IF;
 IF NEW.action<>'APPROVE' THEN RETURN NEW; END IF;
 IF original.case_kind='FINANCE_INVOICE' THEN
  PERFORM 1 FROM finance_invoice i
  JOIN finance_invoice_revision r
    ON r.invoice_id=i.id AND r.root_realm_id=i.root_realm_id
    AND r.version=i.version AND r.payload_digest=i.current_digest
  WHERE i.id=original.finance_invoice_id AND i.root_realm_id=NEW.realm_id
    AND i.status='SUBMITTED' AND i.version=original.finance_invoice_revision
    AND i.current_digest=original.finance_invoice_digest
    AND r.draft_payload=i.draft_payload FOR SHARE OF i,r;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Submitted original invoice snapshot changed' USING ERRCODE='P0928';
  END IF;
 ELSE
  PERFORM 1 FROM finance_budget b
  JOIN finance_budget_revision r
    ON r.budget_id=b.id AND r.root_realm_id=b.root_realm_id
    AND r.version=b.version AND r.source_digest=b.current_digest
  WHERE b.id=original.finance_budget_id AND b.root_realm_id=NEW.realm_id
    AND b.status='SUBMITTED' AND b.version=original.finance_budget_revision
    AND b.current_digest=original.finance_budget_digest
    AND r.financial_year_id=b.financial_year_id AND r.category_label=b.category_label
    AND r.branch_id IS NOT DISTINCT FROM b.branch_id
    AND r.approved_ceiling_minor=b.approved_ceiling_minor
    FOR SHARE OF b,r;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Submitted original budget ceiling or revision changed' USING ERRCODE='P0928';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_finance_invoice_budget_decision_integrity
 BEFORE INSERT ON cg03_case_decision FOR EACH ROW
 EXECUTE FUNCTION cg03_verify_finance_invoice_budget_decision();
