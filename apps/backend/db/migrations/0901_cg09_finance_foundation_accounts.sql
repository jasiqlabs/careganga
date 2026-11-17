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
CREATE INDEX ix_cg09_account_list
 ON finance_account(root_realm_id,scope_kind,branch_id,status,name,id);

CREATE TABLE cash_bank_account(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('CASH','BANK')),
 display_label text NOT NULL CHECK(char_length(btrim(display_label)) BETWEEN 2 AND 120),
 masked_details text NOT NULL DEFAULT '' CHECK(char_length(masked_details)<=40),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,account_id),
 FOREIGN KEY(account_id,root_realm_id) REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg09_bank_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM finance_account a
  WHERE a.id=NEW.account_id AND a.root_realm_id=NEW.root_realm_id
    AND a.account_kind=NEW.kind AND a.status='ACTIVE'
 ) THEN RAISE EXCEPTION 'Invalid active cash/bank account'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_bank_kind_guard BEFORE INSERT OR UPDATE ON cash_bank_account
 FOR EACH ROW EXECUTE FUNCTION cg09_bank_account_guard();

CREATE TABLE finance_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 command_kind text NOT NULL CHECK(command_kind IN('YEAR_CREATE','GROUP_CREATE','ACCOUNT_CREATE','OPENING_POST')),
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 entity_ref uuid,actor_ref uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,command_kind,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_command_root ON finance_command(root_realm_id,created_at DESC,id);

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
CREATE INDEX ix_cg09_lines_root_account ON journal_line(root_realm_id,account_id,journal_id);

-- Check both the journal and its lines at transaction COMMIT, never expose
-- an unbalanced POSTED journal even if application services are bypassed.
CREATE FUNCTION cg09_check_balanced_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j uuid; r uuid; line_count int; total_debit numeric; total_credit numeric;
BEGIN
 j:=COALESCE(NEW.journal_id,NEW.id);
 r:=COALESCE(NEW.root_realm_id,OLD.root_realm_id);
 SELECT count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0)
 INTO line_count,total_debit,total_credit
 FROM journal_line WHERE journal_id=j AND root_realm_id=r;
 IF line_count<2 OR total_debit<=0 OR total_debit<>total_credit THEN
   RAISE EXCEPTION 'Unbalanced posted journal'; END IF;
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
BEGIN RAISE EXCEPTION 'Posted finance records cannot be edited'; END $$;
CREATE TRIGGER cg09_journal_immutable BEFORE UPDATE OR DELETE ON journal
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE TRIGGER cg09_lines_immutable BEFORE UPDATE OR DELETE ON journal_line
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
