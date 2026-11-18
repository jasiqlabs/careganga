-- CG-09 US-004 / FR-026: one original Foundation invoice source.
-- DRAFT wizard payloads may be incomplete; no financial columns/effect are
-- trusted until fully validated and frozen by the protected submit transaction.
CREATE SEQUENCE cg09_invoice_number_sequence;
CREATE TABLE finance_invoice(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 invoice_number text NOT NULL DEFAULT
   ('CG-INV-'||lpad(nextval('cg09_invoice_number_sequence')::text,10,'0')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'),
 version integer NOT NULL CHECK(version>0),
 draft_payload jsonb NOT NULL CHECK(jsonb_typeof(draft_payload)='object'
  AND pg_column_size(draft_payload)<=65536),
 current_digest char(64) NOT NULL CHECK(current_digest~'^[0-9a-f]{64}$'),
 financial_year_id uuid,
 branch_id uuid,
 invoice_date date,
 due_date date,
 category_label text,
 purpose text,
 counterparty_name text,
 counterparty_address text,
 gross_minor bigint CHECK(gross_minor IS NULL OR gross_minor>0),
 tax_minor bigint CHECK(tax_minor IS NULL OR tax_minor>=0),
 charges_minor bigint CHECK(charges_minor IS NULL OR charges_minor>=0),
 total_minor bigint CHECK(total_minor IS NULL OR total_minor>0),
 receivable_account_id uuid,
 income_account_id uuid,
 tax_account_id uuid,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,invoice_number),
 FOREIGN KEY(financial_year_id,root_realm_id)
   REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_id,root_realm_id)
   REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(receivable_account_id,root_realm_id)
   REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(income_account_id,root_realm_id)
   REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(tax_account_id,root_realm_id)
   REFERENCES finance_account(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((gross_minor IS NULL AND tax_minor IS NULL AND charges_minor IS NULL AND total_minor IS NULL)
  OR (gross_minor IS NOT NULL AND tax_minor IS NOT NULL AND charges_minor IS NOT NULL
    AND total_minor=gross_minor+tax_minor+charges_minor)),
 CHECK(invoice_date IS NULL OR due_date IS NULL OR due_date>=invoice_date),
 CHECK(category_label IS NULL OR char_length(btrim(category_label)) BETWEEN 2 AND 80),
 CHECK(purpose IS NULL OR char_length(btrim(purpose)) BETWEEN 3 AND 500),
 CHECK(counterparty_name IS NULL OR char_length(btrim(counterparty_name)) BETWEEN 2 AND 150),
 CHECK(counterparty_address IS NULL OR char_length(counterparty_address)<=250)
);
CREATE INDEX ix_cg09_invoice_root_recent ON finance_invoice
 (root_realm_id,created_at DESC,id DESC);
CREATE INDEX ix_cg09_invoice_year_status ON finance_invoice
 (root_realm_id,financial_year_id,status,invoice_date DESC,id DESC);
CREATE INDEX ix_cg09_invoice_branch ON finance_invoice
 (root_realm_id,branch_id,status,invoice_date DESC,id DESC);

CREATE TABLE finance_invoice_revision(
 root_realm_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 payload_digest char(64) NOT NULL CHECK(payload_digest~'^[0-9a-f]{64}$'),
 draft_payload jsonb NOT NULL CHECK(jsonb_typeof(draft_payload)='object'
  AND pg_column_size(draft_payload)<=65536),
 actor_ref uuid NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,invoice_id,version),
 FOREIGN KEY(invoice_id,root_realm_id)
   REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_invoice_revision ON finance_invoice_revision
 (root_realm_id,invoice_id,version DESC);
CREATE TRIGGER cg09_invoice_revision_immutable
 BEFORE UPDATE OR DELETE ON finance_invoice_revision FOR EACH ROW
 EXECUTE FUNCTION cg09_immutable_record();

CREATE TABLE finance_invoice_command(
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 invoice_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN
  ('DRAFT_SAVE','SUBMIT','RECONCILE','ACCRUAL_POST','ISSUE','RECEIPT_LINK')),
 request_digest char(64) NOT NULL CHECK(request_digest~'^[0-9a-f]{64}$'),
 result_status text NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(invoice_id,root_realm_id)
   REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_invoice_command_source ON finance_invoice_command
 (root_realm_id,invoice_id,created_at DESC);
CREATE TRIGGER cg09_invoice_command_immutable
 BEFORE UPDATE OR DELETE ON finance_invoice_command FOR EACH ROW
 EXECUTE FUNCTION cg09_immutable_record();

-- A draft revision must be persisted in the original immutable source history
-- within its write transaction, before the new row is visible at commit.
CREATE FUNCTION cg09_invoice_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original invoice cannot be deleted' USING ERRCODE='P0921';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'An invoice starts with a draft' USING ERRCODE='P0921';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
    NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Invoice source identity is immutable' USING ERRCODE='P0921';
 END IF;
 IF OLD.status='DRAFT' AND NEW.status='DRAFT' AND NEW.version=OLD.version+1
   AND NEW.financial_year_id IS NOT DISTINCT FROM OLD.financial_year_id
   AND NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id
   AND NEW.invoice_date IS NOT DISTINCT FROM OLD.invoice_date
   AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date
   AND NEW.category_label IS NOT DISTINCT FROM OLD.category_label
   AND NEW.purpose IS NOT DISTINCT FROM OLD.purpose
   AND NEW.counterparty_name IS NOT DISTINCT FROM OLD.counterparty_name
   AND NEW.counterparty_address IS NOT DISTINCT FROM OLD.counterparty_address
   AND NEW.gross_minor IS NOT DISTINCT FROM OLD.gross_minor
   AND NEW.tax_minor IS NOT DISTINCT FROM OLD.tax_minor
   AND NEW.charges_minor IS NOT DISTINCT FROM OLD.charges_minor
   AND NEW.total_minor IS NOT DISTINCT FROM OLD.total_minor
   AND NEW.receivable_account_id IS NOT DISTINCT FROM OLD.receivable_account_id
   AND NEW.income_account_id IS NOT DISTINCT FROM OLD.income_account_id
   AND NEW.tax_account_id IS NOT DISTINCT FROM OLD.tax_account_id THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Only a new version of an unfinished invoice draft may be saved'
  USING ERRCODE='P0921';
END; $$;
CREATE TRIGGER cg09_invoice_draft_update_guard BEFORE INSERT OR UPDATE OR DELETE
 ON finance_invoice FOR EACH ROW EXECUTE FUNCTION cg09_invoice_draft_guard();
CREATE FUNCTION cg09_invoice_has_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM finance_invoice_revision r
 WHERE r.root_realm_id=NEW.root_realm_id AND r.invoice_id=NEW.id
  AND r.version=NEW.version AND r.payload_digest=NEW.current_digest
  AND r.draft_payload=NEW.draft_payload;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Original immutable invoice draft revision is missing'
   USING ERRCODE='P0921';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_invoice_requires_revision
 AFTER INSERT OR UPDATE ON finance_invoice DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_invoice_has_revision();

ALTER TABLE finance_event DROP CONSTRAINT cg09_finance_event_voucher_kind;
ALTER TABLE finance_event ADD CONSTRAINT cg09_finance_event_voucher_kind
 CHECK(entity_kind IN('YEAR','GROUP','ACCOUNT','JOURNAL','VOUCHER','CLAIM','INVOICE'));
