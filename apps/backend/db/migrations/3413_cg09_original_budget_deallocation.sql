-- CG09 owner-only correction: DEALLOCATE reverses UNSPENT authorization.
-- Unlike RELEASE, which only releases COMMIT, this never reverses a posted
-- journal and cannot rewrite existing immutable budget events.
ALTER TABLE finance_budget_event
 DROP CONSTRAINT finance_budget_event_kind_check;
ALTER TABLE finance_budget_event
 ADD CONSTRAINT finance_budget_event_kind_check
 CHECK(kind IN('ALLOCATE','DEALLOCATE','COMMIT','RELEASE','UTILIZE'));
CREATE OR REPLACE FUNCTION cg09_budget_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; used bigint; committed bigint; released bigint; allocated bigint; deallocated bigint; applied bigint; outstanding bigint;
 journal_total bigint;
BEGIN
 SELECT status,approved_ceiling_minor,financial_year_id,branch_id,category_label,period_start,period_end INTO b
  FROM finance_budget WHERE id=NEW.budget_id AND root_realm_id=NEW.root_realm_id FOR UPDATE;
 IF NOT FOUND OR b.status<>'APPROVED' THEN
  RAISE EXCEPTION 'Budget must have protected approval' USING ERRCODE='P0924';
 END IF;
 SELECT COALESCE(SUM(amount_minor) FILTER(WHERE kind='UTILIZE'),0),
  COALESCE(SUM(amount_minor) FILTER(WHERE kind='COMMIT'),0),
  COALESCE(SUM(amount_minor) FILTER(WHERE kind='RELEASE'),0),
  COALESCE(SUM(amount_minor) FILTER(WHERE kind='ALLOCATE'),0),
  COALESCE(SUM(amount_minor) FILTER(WHERE kind='DEALLOCATE'),0),
  COALESCE(SUM(commitment_applied_minor),0)
 INTO used,committed,released,allocated,deallocated,applied
 FROM finance_budget_event WHERE root_realm_id=NEW.root_realm_id AND budget_id=NEW.budget_id;
 IF NEW.kind='UTILIZE' THEN
  PERFORM 1 FROM journal j JOIN finance_voucher v
     ON v.id=j.source_ref AND v.root_realm_id=j.root_realm_id
    JOIN finance_account a ON a.id=v.debit_account_id AND a.root_realm_id=v.root_realm_id
    JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE j.id=NEW.source_journal_id AND j.root_realm_id=NEW.root_realm_id
    AND j.status='POSTED' AND j.financial_year_id=b.financial_year_id
    AND j.posting_kind='VOUCHER' AND j.posting_date BETWEEN b.period_start AND b.period_end
    AND v.voucher_type='EXPENSE' AND g.category='EXPENSE' AND g.code=b.category_label
    AND v.status IN('POSTED','PAYMENT_REQUESTED','PAID_VERIFIED')
   FOR SHARE OF j,v,a,g;
  IF NOT FOUND THEN RAISE EXCEPTION 'Real posted journal required' USING ERRCODE='P0924'; END IF;
  SELECT COALESCE(SUM(l.debit_minor),0) INTO journal_total FROM journal_line l
   JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id
   JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE l.journal_id=NEW.source_journal_id AND l.root_realm_id=NEW.root_realm_id
    AND (b.branch_id IS NULL OR l.branch_id=b.branch_id)
    AND g.category='EXPENSE';
  IF journal_total<>NEW.amount_minor OR journal_total<1 THEN
   RAISE EXCEPTION 'Budget utilization must match original actual posted expense' USING ERRCODE='P0924';
  END IF;
 END IF;
 -- Consumption of a real posted expense fulfills an existing obligation
 -- first. Do not double count a committed amount AND its later utilization.
 outstanding=committed-released-applied;
 IF outstanding<0 THEN
  RAISE EXCEPTION 'Original budget commitments are inconsistent' USING ERRCODE='P0924';
 END IF;
 IF NEW.kind='UTILIZE' THEN
  NEW.commitment_applied_minor=LEAST(outstanding,NEW.amount_minor);
 ELSE
  NEW.commitment_applied_minor=0;
 END IF;
 IF NEW.kind='RELEASE' AND NEW.amount_minor>outstanding THEN
  RAISE EXCEPTION 'Cannot release more than unmatched outstanding commitment' USING ERRCODE='P0924';
 END IF;
 IF NEW.kind='ALLOCATE' AND allocated-deallocated+NEW.amount_minor>b.approved_ceiling_minor THEN
  RAISE EXCEPTION 'Cannot allocate beyond approved budget' USING ERRCODE='P0924';
 END IF;
 IF NEW.kind='DEALLOCATE' AND
   (NEW.amount_minor>allocated-deallocated OR
    NEW.amount_minor>allocated-deallocated-used) THEN
  RAISE EXCEPTION 'Cannot reverse an allocation already spent or previously corrected'
   USING ERRCODE='P0924';
 END IF;
 IF NEW.kind IN('COMMIT','UTILIZE') AND
    used+outstanding+NEW.amount_minor-NEW.commitment_applied_minor>
     b.approved_ceiling_minor THEN
  RAISE EXCEPTION 'Budget remaining amount is insufficient' USING ERRCODE='P0924';
 END IF;
 RETURN NEW;
END; $$;

-- A deallocation is only valid when the same transaction records its original
-- CG08/CG09 immutable correction reference. This deferred check covers direct
-- SQL and prevents generic Finance budget actions from erasing CSR earmarks.
CREATE FUNCTION cg09_deallocation_has_csr_provenance()
 RETURNS trigger LANGUAGE plpgsql AS $cg09dealloc$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM finance_csr_budget_effect link
  WHERE link.root_realm_id=NEW.root_realm_id
   AND link.budget_event_id=NEW.id
   AND link.correction_of_event_id IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'A deallocation requires same-transaction original CSR provenance'
   USING ERRCODE='P3410';
 END IF;
 RETURN NULL;
END; $cg09dealloc$;
CREATE CONSTRAINT TRIGGER cg09_deallocation_source_commit
 AFTER INSERT ON finance_budget_event DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW WHEN (NEW.kind='DEALLOCATE')
 EXECUTE FUNCTION cg09_deallocation_has_csr_provenance();
