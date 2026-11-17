-- CG-09 US-002: actual Finance voucher draft source, never a payment/posting.
-- CG-03 finance approval and CG-19 verified evidence are introduced separately
-- by their owning source adapters before any SUBMITTED/APPROVED transitions.
CREATE SEQUENCE cg09_voucher_number_sequence;
CREATE TABLE finance_voucher (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 financial_year_id uuid NOT NULL,
 branch_id uuid,
 voucher_number text NOT NULL DEFAULT
   ('CG-FV-' || lpad(nextval('cg09_voucher_number_sequence')::text,10,'0')),
 voucher_type text NOT NULL CHECK(voucher_type IN('PAYMENT','EXPENSE','CONTRA','GENERAL')),
 posting_date date NOT NULL,
 payee_name text NOT NULL CHECK(char_length(btrim(payee_name)) BETWEEN 2 AND 150
    AND payee_name !~ '([0-9][ -]?){8,}'),
 purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 3 AND 500),
 gross_minor bigint NOT NULL CHECK(gross_minor>0),
 tax_minor bigint NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
 charges_minor bigint NOT NULL DEFAULT 0 CHECK(charges_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor>0 AND total_minor=gross_minor+tax_minor+charges_minor),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),UNIQUE(root_realm_id,voucher_number),
 FOREIGN KEY(financial_year_id,root_realm_id)
   REFERENCES financial_year(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_voucher_root_recent ON finance_voucher(root_realm_id,created_at DESC,id DESC);
CREATE INDEX ix_cg09_voucher_owner_recent ON finance_voucher(root_realm_id,created_by,created_at DESC,id DESC);

-- Whole-draft JSON is validated by the Finance owner, while history is
-- append-only and has immutable actor, request, revision, and line totals.
CREATE TABLE finance_voucher_draft_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 voucher_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 line_snapshot jsonb NOT NULL CHECK(jsonb_typeof(line_snapshot)='array'
    AND jsonb_array_length(line_snapshot) BETWEEN 1 AND 40),
 gross_minor bigint NOT NULL CHECK(gross_minor>0),
 tax_minor bigint NOT NULL CHECK(tax_minor>=0),
 charges_minor bigint NOT NULL CHECK(charges_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor=gross_minor+tax_minor+charges_minor),
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 changed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(voucher_id,version),UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(voucher_id,root_realm_id) REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_voucher_revision_history
 ON finance_voucher_draft_revision(voucher_id,version DESC);
CREATE TRIGGER cg09_voucher_revision_immutable BEFORE UPDATE OR DELETE ON finance_voucher_draft_revision
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

CREATE FUNCTION cg09_guard_voucher_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_start date; v_end date; v_status text;
BEGIN
 SELECT fy.start_on,fy.end_on,fy.status INTO v_start,v_end,v_status
 FROM financial_year fy
 WHERE fy.id=NEW.financial_year_id AND fy.root_realm_id=NEW.root_realm_id
 FOR SHARE;
 IF NOT FOUND OR v_status<>'OPEN' THEN
  RAISE EXCEPTION 'Voucher year is not open' USING ERRCODE='P0901';
 END IF;
 IF NEW.posting_date<v_start OR NEW.posting_date>v_end THEN
  RAISE EXCEPTION 'Voucher date is outside its open year' USING ERRCODE='P0911';
 END IF;
 IF NEW.branch_id IS NOT NULL THEN
  PERFORM 1 FROM branch b WHERE b.id=NEW.branch_id AND b.root_realm_id=NEW.root_realm_id
   AND b.status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher branch is not active' USING ERRCODE='P0904'; END IF;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR
   NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
   NEW.voucher_number IS DISTINCT FROM OLD.voucher_number OR
   NEW.created_by IS DISTINCT FROM OLD.created_by OR
   NEW.created_at IS DISTINCT FROM OLD.created_at OR
   NEW.status IS DISTINCT FROM OLD.status OR
   NEW.status<>'DRAFT' OR NEW.version<>OLD.version+1 THEN
   RAISE EXCEPTION 'Voucher source identity is immutable' USING ERRCODE='P0907';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_voucher_draft_guard BEFORE INSERT OR UPDATE ON finance_voucher
 FOR EACH ROW EXECUTE FUNCTION cg09_guard_voucher_draft();
