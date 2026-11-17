-- CG-09 US-005: additive budget source protection (do not rewrite 0919).
-- A closed financial year, deactivated branch, or reversed posted voucher
-- cannot create a NEW allocation/commitment/utilization on approved budgets.
CREATE FUNCTION cg09_budget_new_effect_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; y record; source record;
BEGIN
 SELECT financial_year_id,branch_id,category_label,period_start,period_end,status
  INTO b FROM finance_budget
  WHERE id=NEW.budget_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR b.status<>'APPROVED' THEN
  RAISE EXCEPTION 'An approved original budget is required'
   USING ERRCODE='P0924';
 END IF;
 SELECT status,start_on,end_on INTO y FROM financial_year
  WHERE id=b.financial_year_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR y.status<>'OPEN' OR
  b.period_start<y.start_on OR b.period_end>y.end_on THEN
  RAISE EXCEPTION 'No new budget movement in closed or changed financial period'
   USING ERRCODE='P0924';
 END IF;
 IF b.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch
   WHERE id=b.branch_id AND root_realm_id=NEW.root_realm_id
    AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Cannot move a budget for an inactive branch'
    USING ERRCODE='P0924';
  END IF;
 END IF;
 IF NEW.kind='UTILIZE' THEN
  SELECT v.branch_id,j.posting_date,j.financial_year_id,j.posting_kind
   INTO source
   FROM journal j
   JOIN finance_voucher v ON v.id=j.source_ref
    AND v.root_realm_id=j.root_realm_id
   WHERE j.id=NEW.source_journal_id AND j.root_realm_id=NEW.root_realm_id
    AND j.status='POSTED' AND v.voucher_type='EXPENSE'
    AND NOT EXISTS(SELECT 1 FROM journal reversal
      WHERE reversal.root_realm_id=j.root_realm_id
       AND reversal.reversal_of_id=j.id
       AND reversal.posting_kind='REVERSAL' AND reversal.status='POSTED')
   FOR SHARE OF j,v;
  IF NOT FOUND OR source.posting_kind<>'VOUCHER'
   OR source.financial_year_id<>b.financial_year_id
   OR source.posting_date NOT BETWEEN b.period_start AND b.period_end
   OR (b.branch_id IS NOT NULL AND source.branch_id IS DISTINCT FROM b.branch_id) THEN
   RAISE EXCEPTION 'Budget utilization requires a current same-scope posted voucher'
    USING ERRCODE='P0924';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_budget_current_effect_guard BEFORE INSERT ON finance_budget_event
 FOR EACH ROW EXECUTE FUNCTION cg09_budget_new_effect_scope_guard();
CREATE INDEX ix_cg09_budget_period_state ON finance_budget
 (root_realm_id,financial_year_id,branch_id,category_label,period_start,period_end)
 WHERE status='APPROVED';
