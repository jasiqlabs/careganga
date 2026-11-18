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
 header_snapshot jsonb NOT NULL CHECK(jsonb_typeof(header_snapshot)='object'),
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
 UNIQUE(voucher_id,version),CONSTRAINT ux_cg09_voucher_request UNIQUE(root_realm_id,actor_ref,request_key),
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

-- No direct SQL writer may forge voucher line arithmetic in the frozen revision.
CREATE FUNCTION cg09_verify_voucher_draft_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item jsonb; qty numeric; rate numeric; subtotal numeric; total numeric:=0;
BEGIN
 PERFORM 1 FROM finance_voucher v
  WHERE v.id=NEW.voucher_id AND v.root_realm_id=NEW.root_realm_id
   AND v.version=NEW.version AND v.status='DRAFT' FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Voucher revision must match the current draft' USING ERRCODE='P0913';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.line_snapshot) LOOP
  IF jsonb_typeof(item)<>'object'
   OR (item->>'description') IS NULL
   OR char_length(btrim(item->>'description')) NOT BETWEEN 2 AND 180
   OR (item->>'quantity') IS NULL
   OR (item->>'quantity') !~ '^[0-9]{1,7}$'
   OR (item->>'unitRateMinor') IS NULL
   OR (item->>'unitRateMinor') !~ '^[0-9]{1,16}$'
   OR (item->>'lineTotalMinor') IS NULL
   OR (item->>'lineTotalMinor') !~ '^[0-9]{1,16}$' THEN
    RAISE EXCEPTION 'Voucher item is invalid' USING ERRCODE='P0913';
  END IF;
  qty:=(item->>'quantity')::numeric;
  rate:=(item->>'unitRateMinor')::numeric;
  subtotal:=(item->>'lineTotalMinor')::numeric;
  IF qty<1 OR qty>1000000 OR rate<=0 OR rate>99999999999999
     OR subtotal<=0 OR subtotal>99999999999999 OR subtotal<>qty*rate THEN
    RAISE EXCEPTION 'Voucher item total does not match quantity and rate' USING ERRCODE='P0913';
  END IF;
  total:=total+subtotal;
 END LOOP;
 IF total<>NEW.gross_minor OR
  NEW.total_minor<>NEW.gross_minor+NEW.tax_minor+NEW.charges_minor THEN
  RAISE EXCEPTION 'Voucher items do not balance against the draft amount' USING ERRCODE='P0913';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_voucher_line_arithmetic
 BEFORE INSERT ON finance_voucher_draft_revision
 FOR EACH ROW EXECUTE FUNCTION cg09_verify_voucher_draft_revision();

-- Source header and frozen revision must be committed atomically.
CREATE FUNCTION cg09_verify_voucher_revision_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h jsonb; r record;
BEGIN
 SELECT revision.header_snapshot,revision.gross_minor,revision.tax_minor,
   revision.charges_minor,revision.total_minor
  INTO r
 FROM finance_voucher_draft_revision revision
 WHERE revision.voucher_id=NEW.id AND revision.root_realm_id=NEW.root_realm_id
   AND revision.version=NEW.version;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Voucher revision is required before a draft is visible' USING ERRCODE='P0913';
 END IF;
 h:=r.header_snapshot;
 IF r.gross_minor<>NEW.gross_minor OR r.tax_minor<>NEW.tax_minor
  OR r.charges_minor<>NEW.charges_minor OR r.total_minor<>NEW.total_minor
  OR h->>'financialYearRef' IS DISTINCT FROM NEW.financial_year_id::text
  OR h->>'branchRef' IS DISTINCT FROM NEW.branch_id::text
  OR h->>'type' IS DISTINCT FROM NEW.voucher_type
  OR h->>'postingDate' IS DISTINCT FROM NEW.posting_date::text
  OR h->>'payeeName' IS DISTINCT FROM NEW.payee_name
  OR h->>'purpose' IS DISTINCT FROM NEW.purpose THEN
   RAISE EXCEPTION 'Voucher revision does not match the current draft' USING ERRCODE='P0913';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg09_voucher_requires_frozen_revision
 AFTER INSERT OR UPDATE ON finance_voucher DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg09_verify_voucher_revision_link();
