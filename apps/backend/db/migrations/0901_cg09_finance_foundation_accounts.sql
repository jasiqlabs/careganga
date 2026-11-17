-- CG-09 US-001: Foundation-root accounting setup and immutable balanced opening journal.
-- INR minor units (paise); account balances are always derived from posted lines.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE financial_year(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 80),
 start_on date NOT NULL, end_on date NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,name),
 CHECK(start_on<=end_on),
 CONSTRAINT cg09_year_no_overlap EXCLUDE USING gist
   (root_realm_id WITH =,daterange(start_on,end_on,'[]') WITH &&),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_year_root ON financial_year(root_realm_id,start_on DESC,id);
-- Year dates/identity never change after creation: it would rewrite the
-- meaning of immutable journal history. Closing is a versioned one-way action.
CREATE FUNCTION cg09_guard_year_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
   OR NEW.name IS DISTINCT FROM OLD.name
   OR NEW.start_on IS DISTINCT FROM OLD.start_on
   OR NEW.end_on IS DISTINCT FROM OLD.end_on
   OR NEW.created_by IS DISTINCT FROM OLD.created_by
   OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.version<>OLD.version+1
   OR NEW.status<>'CLOSED' OR OLD.status<>'OPEN'
 THEN RAISE EXCEPTION 'Financial year identity is immutable; only a reviewed close is allowed' USING ERRCODE='P0906'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_year_guard_update BEFORE UPDATE ON financial_year
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_year_update();


CREATE TABLE account_group(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 code text NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{1,19}$'),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 120),
 category text NOT NULL CHECK(category IN('ASSET','LIABILITY','FUND','INCOME','EXPENSE')),
 parent_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,code),
 CHECK(parent_id IS DISTINCT FROM id),
 FOREIGN KEY(parent_id,root_realm_id) REFERENCES account_group(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
-- A group cannot silently change meaning and a child must inherit its category.
CREATE FUNCTION cg09_guard_group_structure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_category text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.code IS DISTINCT FROM OLD.code OR
    NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
   RAISE EXCEPTION 'Financial account group hierarchy is immutable' USING ERRCODE='P0908';
  END IF;
 END IF;
 IF NEW.parent_id IS NOT NULL THEN
  SELECT category INTO parent_category FROM account_group
    WHERE id=NEW.parent_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
  IF parent_category IS NULL OR parent_category<>NEW.category THEN
   RAISE EXCEPTION 'Financial group must use its parent category' USING ERRCODE='P0908'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_group_category_guard BEFORE INSERT OR UPDATE ON account_group
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_group_structure();
CREATE INDEX ix_cg09_group_list ON account_group(root_realm_id,category,name,id);

CREATE TABLE finance_account(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 group_id uuid NOT NULL,
 code text NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{1,19}$'),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 140),
 normal_side text NOT NULL CHECK(normal_side IN('DEBIT','CREDIT')),
 account_kind text NOT NULL DEFAULT 'GENERAL' CHECK(account_kind IN('GENERAL','CASH','BANK')),
 scope_kind text NOT NULL CHECK(scope_kind IN('FOUNDATION','BRANCH')),
 branch_id uuid,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,code),
 CHECK((scope_kind='FOUNDATION' AND branch_id IS NULL) OR
       (scope_kind='BRANCH' AND branch_id IS NOT NULL)),
 FOREIGN KEY(group_id,root_realm_id) REFERENCES account_group(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
-- Normal balances derive from category; direct writes cannot create bank
-- liabilities or an inverted asset account.
CREATE FUNCTION cg09_guard_account_category() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_category text; expected_side text;
BEGIN
 SELECT category INTO group_category FROM account_group
  WHERE id=NEW.group_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF group_category IS NULL THEN
  RAISE EXCEPTION 'Finance group is unavailable' USING ERRCODE='P0908'; END IF;
 expected_side:=CASE WHEN group_category IN('ASSET','EXPENSE') THEN 'DEBIT' ELSE 'CREDIT' END;
 IF NEW.normal_side<>expected_side OR
  (NEW.account_kind IN('CASH','BANK') AND group_category<>'ASSET') THEN
  RAISE EXCEPTION 'Invalid finance account category and balance side' USING ERRCODE='P0905'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.group_id IS DISTINCT FROM OLD.group_id OR
    NEW.code IS DISTINCT FROM OLD.code OR
    NEW.normal_side IS DISTINCT FROM OLD.normal_side OR
    NEW.account_kind IS DISTINCT FROM OLD.account_kind OR
    NEW.scope_kind IS DISTINCT FROM OLD.scope_kind OR
    NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.version<>OLD.version+1 OR
    NEW.status IS NOT DISTINCT FROM OLD.status THEN
   RAISE EXCEPTION 'Account identity cannot change during a status update' USING ERRCODE='P0907';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_account_category_guard BEFORE INSERT OR UPDATE ON finance_account
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_account_category();

CREATE INDEX ix_cg09_account_list
 ON finance_account(root_realm_id,scope_kind,branch_id,status,name,id);

CREATE TABLE cash_bank_account(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('CASH','BANK')),
 display_label text NOT NULL CHECK(char_length(btrim(display_label)) BETWEEN 2 AND 120
  AND display_label !~ '([0-9][ -]?){5,}'),
 masked_details text NOT NULL DEFAULT '' CHECK(
   masked_details='' OR masked_details ~ '^•••• [0-9]{4}$'),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,account_id),
 FOREIGN KEY(account_id,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg09_bank_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text;
BEGIN
 SELECT a.status INTO current_status FROM finance_account a
  WHERE a.id=NEW.account_id AND a.root_realm_id=NEW.root_realm_id
   AND a.account_kind=NEW.kind FOR SHARE;
 IF NOT FOUND OR NEW.status<>current_status THEN
  RAISE EXCEPTION 'Cash/bank account status must match finance account' USING ERRCODE='P0905';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
   OR NEW.account_id IS DISTINCT FROM OLD.account_id
   OR NEW.kind IS DISTINCT FROM OLD.kind
   OR NEW.display_label IS DISTINCT FROM OLD.display_label
   OR NEW.masked_details IS DISTINCT FROM OLD.masked_details
   OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
   RAISE EXCEPTION 'Cash/bank account identity cannot change' USING ERRCODE='P0907';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_bank_kind_guard BEFORE INSERT OR UPDATE ON cash_bank_account
 FOR EACH ROW EXECUTE FUNCTION cg09_bank_account_guard();

CREATE TABLE finance_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 command_kind text NOT NULL CHECK(command_kind IN('YEAR_CREATE','YEAR_STATUS','GROUP_CREATE','ACCOUNT_CREATE','ACCOUNT_STATUS','OPENING_POST')),
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 entity_ref uuid,actor_ref uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,command_kind,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_command_root ON finance_command(root_realm_id,created_at DESC,id);
-- Command proof may only acquire a result once; no digest or actor changes.
CREATE FUNCTION cg09_guard_finance_command() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.actor_ref IS DISTINCT FROM OLD.actor_ref
  OR NEW.command_kind IS DISTINCT FROM OLD.command_kind
  OR NEW.request_key IS DISTINCT FROM OLD.request_key
  OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR OLD.entity_ref IS NOT NULL OR NEW.entity_ref IS NULL THEN
  RAISE EXCEPTION 'Finance command cannot be rewritten' USING ERRCODE='P0907';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_command_once BEFORE UPDATE ON finance_command
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_finance_command();

-- A direct SQL writer cannot post into a CLOSED/foreign/out-of-period year.
-- FOR SHARE serializes this check against the year-closing UPDATE.
CREATE FUNCTION cg09_guard_posting_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_start date; v_end date; v_status text;
BEGIN
 SELECT fy.start_on,fy.end_on,fy.status INTO v_start,v_end,v_status
  FROM financial_year fy
  WHERE fy.id=NEW.financial_year_id AND fy.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR v_status<>'OPEN' THEN
  RAISE EXCEPTION 'Finance posting period is not open' USING ERRCODE='P0901';
 END IF;
 IF NEW.posting_date<v_start OR NEW.posting_date>v_end THEN
  RAISE EXCEPTION 'Finance posting date is outside selected year' USING ERRCODE='P0911';
 END IF;
 RETURN NEW;
END $$;
CREATE TABLE journal(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 financial_year_id uuid NOT NULL,
 source_owner text NOT NULL CHECK(source_owner='CG-09'),
 source_ref uuid NOT NULL,
 posting_kind text NOT NULL CHECK(posting_kind IN('OPENING','GENERAL','VOUCHER','REVERSAL')),
 immutable_source_event_key uuid NOT NULL,
 immutable_payload_digest char(64) NOT NULL CHECK(immutable_payload_digest ~ '^[0-9a-f]{64}$'),
 posting_date date NOT NULL,currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'POSTED' CHECK(status='POSTED'),
 reversal_of_id uuid,created_by uuid NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),
 UNIQUE(root_realm_id,source_owner,source_ref,posting_kind,immutable_source_event_key),
 UNIQUE(root_realm_id,posting_kind,immutable_source_event_key),
 FOREIGN KEY(financial_year_id,root_realm_id) REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reversal_of_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_guard_new_posting BEFORE INSERT ON journal FOR EACH ROW
 EXECUTE FUNCTION cg09_guard_posting_period();
CREATE INDEX ix_cg09_journal_root_date ON journal(root_realm_id,posting_date DESC,id DESC);

CREATE TABLE journal_line(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 journal_id uuid NOT NULL,account_id uuid NOT NULL,branch_id uuid,
 debit_minor bigint NOT NULL DEFAULT 0 CHECK(debit_minor>=0),
 credit_minor bigint NOT NULL DEFAULT 0 CHECK(credit_minor>=0),
 CHECK((debit_minor>0 AND credit_minor=0) OR (credit_minor>0 AND debit_minor=0)),
 FOREIGN KEY(journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(account_id,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT
);
-- A direct SQL writer cannot bypass current active account/scope eligibility.
CREATE FUNCTION cg09_guard_posting_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_scope text; v_branch uuid;
BEGIN
 SELECT a.status,a.scope_kind,a.branch_id INTO v_status,v_scope,v_branch
  FROM finance_account a WHERE a.id=NEW.account_id
   AND a.root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR v_status<>'ACTIVE' THEN
  RAISE EXCEPTION 'Finance posting account is unavailable' USING ERRCODE='P0902';
 END IF;
 IF v_scope='BRANCH' AND v_branch IS DISTINCT FROM NEW.branch_id THEN
  RAISE EXCEPTION 'Finance posting account is in another branch' USING ERRCODE='P0904';
 END IF;
 IF NEW.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch b
   WHERE b.id=NEW.branch_id AND b.root_realm_id=NEW.root_realm_id
    AND b.status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Finance posting branch is not active' USING ERRCODE='P0904';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_guard_new_line BEFORE INSERT ON journal_line FOR EACH ROW
 EXECUTE FUNCTION cg09_guard_posting_account();
CREATE INDEX ix_cg09_lines_root_account ON journal_line(root_realm_id,account_id,journal_id);

-- Check both the journal and its lines at transaction COMMIT, never expose
-- an unbalanced POSTED journal even if application services are bypassed.
CREATE FUNCTION cg09_check_balanced_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_journal uuid; r uuid; line_count int; total_debit numeric; total_credit numeric;
BEGIN
 IF TG_TABLE_NAME='journal' THEN
  v_journal:=NEW.id;
 ELSE
  v_journal:=NEW.journal_id;
 END IF;
 r:=NEW.root_realm_id;
 SELECT count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0)
 INTO line_count,total_debit,total_credit
 FROM journal_line WHERE journal_id=v_journal AND root_realm_id=r;
 IF NOT EXISTS (
   SELECT 1 FROM journal j JOIN financial_year fy
    ON fy.id=j.financial_year_id AND fy.root_realm_id=j.root_realm_id
   WHERE j.id=v_journal AND j.root_realm_id=r
    AND j.posting_date BETWEEN fy.start_on AND fy.end_on
 ) THEN RAISE EXCEPTION 'Posting date outside financial year' USING ERRCODE='P0901'; END IF;
 IF EXISTS (
   SELECT 1 FROM journal_line l JOIN finance_account a
    ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id
   WHERE l.journal_id=v_journal AND l.root_realm_id=r
    AND (a.scope_kind='BRANCH' AND a.branch_id IS DISTINCT FROM l.branch_id)
 ) THEN
  RAISE EXCEPTION 'Finance journal branch and account scope do not match' USING ERRCODE='P0904';
 END IF;
 IF line_count<2 OR total_debit<=0 OR total_debit<>total_credit THEN
   RAISE EXCEPTION 'Unbalanced posted journal' USING ERRCODE='P0903'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cg09_journal_requires_balance
 AFTER INSERT ON journal DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_check_balanced_posting();
CREATE CONSTRAINT TRIGGER cg09_line_requires_balance
 AFTER INSERT ON journal_line DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_check_balanced_posting();

-- Journal/history are append-only; corrections must be new linked reversals.
CREATE FUNCTION cg09_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Posted finance records cannot be edited' USING ERRCODE='P0912'; END $$;
CREATE TRIGGER cg09_journal_immutable BEFORE UPDATE OR DELETE ON journal
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE TRIGGER cg09_lines_immutable BEFORE UPDATE OR DELETE ON journal_line
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE TRIGGER cg09_command_no_delete BEFORE DELETE ON finance_command
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE TABLE finance_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,entity_kind text NOT NULL CHECK(entity_kind IN('YEAR','GROUP','ACCOUNT','JOURNAL')),
 entity_ref uuid NOT NULL,action text NOT NULL,
 request_key uuid NOT NULL,at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,action,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_event_recent ON finance_event(root_realm_id,at DESC,id DESC);
CREATE TRIGGER cg09_event_immutable BEFORE UPDATE OR DELETE ON finance_event
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
