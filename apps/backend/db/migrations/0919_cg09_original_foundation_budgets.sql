-- CG-09 US-005 / FR-027. One real Foundation-root / ACTIVE CG-02 branch
-- budget source. CG-05 project association is NOT a future dependency.
CREATE SEQUENCE cg09_budget_number_seq;
CREATE TABLE finance_budget(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 budget_number text NOT NULL DEFAULT ('CG-BUD-'||lpad(nextval('cg09_budget_number_seq')::text,8,'0')),
 financial_year_id uuid NOT NULL,
 branch_id uuid,
 category_label text NOT NULL CHECK(char_length(btrim(category_label)) BETWEEN 2 AND 80),
 budget_name text NOT NULL CHECK(char_length(btrim(budget_name)) BETWEEN 3 AND 160),
 period_start date NOT NULL,
 period_end date NOT NULL,
 funding_note text NOT NULL DEFAULT 'Foundation budget authorization'
   CHECK(char_length(btrim(funding_note)) BETWEEN 3 AND 250),
 approved_ceiling_minor bigint NOT NULL CHECK(approved_ceiling_minor BETWEEN 1 AND 99999999999999),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'DRAFT'
   CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','ARCHIVED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 current_digest char(64) NOT NULL CHECK(current_digest~'^[a-f0-9]{64}$'),
 approval_case_id uuid,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,budget_number),
 FOREIGN KEY(financial_year_id,root_realm_id)
  REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_id,root_realm_id)
  REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(period_end>=period_start),
 CHECK((status IN('DRAFT','RETURNED','REJECTED') AND
   (approval_case_id IS NULL OR status<>'DRAFT'))
  OR (status IN('SUBMITTED','APPROVED','ARCHIVED') AND approval_case_id IS NOT NULL))
);
-- Prevent two Foundation/branch budgets authorizing the same category in the
-- same financial-year period, including NULL branch (NULLS NOT DISTINCT).
CREATE UNIQUE INDEX ux_cg09_budget_scope_period ON finance_budget
 (root_realm_id,financial_year_id,COALESCE(branch_id,'00000000-0000-0000-0000-000000000000'::uuid),
  lower(category_label),period_start,period_end)
 WHERE status NOT IN('REJECTED','ARCHIVED');
CREATE INDEX ix_cg09_budget_status ON finance_budget
 (root_realm_id,status,financial_year_id,branch_id,created_at DESC,id DESC);

CREATE TABLE finance_budget_revision(
 root_realm_id uuid NOT NULL,
 budget_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 name text NOT NULL,category_label text NOT NULL,
 financial_year_id uuid NOT NULL,branch_id uuid,period_start date NOT NULL,period_end date NOT NULL,
 funding_note text NOT NULL,approved_ceiling_minor bigint NOT NULL CHECK(approved_ceiling_minor>0),
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,budget_id,version),
 FOREIGN KEY(budget_id,root_realm_id) REFERENCES finance_budget(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_budget_revision_immutable BEFORE UPDATE OR DELETE
 ON finance_budget_revision FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE TABLE finance_budget_command(
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 budget_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','REVISE','SUBMIT','RECONCILE','EVENT','ARCHIVE')),
 digest char(64) NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),
 result_status text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(budget_id,root_realm_id) REFERENCES finance_budget(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_budget_commands ON finance_budget_command
 (root_realm_id,budget_id,created_at DESC);
CREATE TRIGGER cg09_budget_command_immutable BEFORE UPDATE OR DELETE
 ON finance_budget_command FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

-- The ONLY financial movements authorized inside this budget. These are not
-- separate cash balances or new GL journals; utilization references one posted
-- existing CG-09 journal. ALLOCATE earmarks, it does not use or receive cash.
CREATE TABLE finance_budget_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 budget_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('ALLOCATE','COMMIT','RELEASE','UTILIZE')),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 event_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 source_journal_id uuid,
 actor_ref uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 UNIQUE(root_realm_id,budget_id,source_journal_id),
 FOREIGN KEY(budget_id,root_realm_id)
  REFERENCES finance_budget(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(source_journal_id,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((kind='UTILIZE' AND source_journal_id IS NOT NULL)
   OR(kind<>'UTILIZE' AND source_journal_id IS NULL))
);
CREATE UNIQUE INDEX ux_cg09_one_budget_per_spent_journal ON finance_budget_event
 (root_realm_id,source_journal_id) WHERE source_journal_id IS NOT NULL;
CREATE INDEX ix_cg09_budget_source_events ON finance_budget_event
 (root_realm_id,budget_id,recorded_at DESC,id DESC);
CREATE TRIGGER cg09_budget_event_immutable BEFORE UPDATE OR DELETE
 ON finance_budget_event FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

ALTER TABLE finance_event DROP CONSTRAINT cg09_finance_event_voucher_kind;
ALTER TABLE finance_event ADD CONSTRAINT cg09_finance_event_voucher_kind
 CHECK(entity_kind IN('YEAR','GROUP','ACCOUNT','JOURNAL','VOUCHER','CLAIM','INVOICE','BUDGET'));

-- A protected reviewer must approve before effects are inserted. Short row
-- locking in service serializes spend; enforce available ceiling again in DB.
CREATE FUNCTION cg09_budget_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; used bigint; committed bigint; released bigint; allocated bigint;
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
  COALESCE(SUM(amount_minor) FILTER(WHERE kind='ALLOCATE'),0)
 INTO used,committed,released,allocated
 FROM finance_budget_event WHERE root_realm_id=NEW.root_realm_id AND budget_id=NEW.budget_id;
 IF NEW.kind='UTILIZE' THEN
  PERFORM 1 FROM journal j JOIN finance_voucher v
     ON v.id=j.source_ref AND v.root_realm_id=j.root_realm_id
   WHERE j.id=NEW.source_journal_id AND j.root_realm_id=NEW.root_realm_id
    AND j.status='POSTED' AND j.financial_year_id=b.financial_year_id
    AND j.posting_kind='VOUCHER' AND j.posting_date BETWEEN b.period_start AND b.period_end
    AND v.voucher_type='EXPENSE' AND v.category_label=b.category_label
    AND v.status IN('POSTED','PAYMENT_REQUESTED','PAID_VERIFIED')
   FOR SHARE OF j,v;
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
 IF NEW.kind='RELEASE' AND released+NEW.amount_minor>committed THEN
  RAISE EXCEPTION 'Cannot release more than outstanding commitment' USING ERRCODE='P0924';
 END IF;
 IF NEW.kind='ALLOCATE' AND allocated+NEW.amount_minor>b.approved_ceiling_minor THEN
  RAISE EXCEPTION 'Cannot allocate beyond approved budget' USING ERRCODE='P0924';
 END IF;
 IF NEW.kind IN('COMMIT','UTILIZE') AND
    used+committed-released+NEW.amount_minor>b.approved_ceiling_minor THEN
  RAISE EXCEPTION 'Budget remaining amount is insufficient' USING ERRCODE='P0924';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_budget_event_capacity
 BEFORE INSERT ON finance_budget_event FOR EACH ROW EXECUTE FUNCTION cg09_budget_event_guard();
