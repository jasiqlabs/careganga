-- CG12 US003: one request, immutable submitted revisions, one reservation projection.
CREATE SEQUENCE inventory_request_public_sequence;
CREATE TABLE material_request(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 request_no text NOT NULL UNIQUE,location_id uuid NOT NULL,requester_id uuid NOT NULL,
 priority text NOT NULL CHECK(priority IN('LOW','NORMAL','HIGH','URGENT')),
 due_date date NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 500),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED_UNRESERVED','HELD','PARTIAL','FULFILLED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),current_revision integer NOT NULL DEFAULT 0 CHECK(current_revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,location_id),
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id),
 FOREIGN KEY(requester_id,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE INDEX ix_material_request_scope ON material_request(root_realm_id,location_id,status,created_at DESC,id);
CREATE TABLE material_request_line(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,request_id uuid NOT NULL,
 item_id uuid NOT NULL,unit_code text NOT NULL,qty_scale smallint NOT NULL,
 requested_qty numeric(18,3) NOT NULL CHECK(requested_qty>0),
 approved_qty numeric(18,3) NOT NULL DEFAULT 0,held_qty numeric(18,3) NOT NULL DEFAULT 0,issued_qty numeric(18,3) NOT NULL DEFAULT 0,
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,request_id,item_id),UNIQUE(root_realm_id,id,item_id,request_id),
 FOREIGN KEY(root_realm_id,request_id) REFERENCES material_request(root_realm_id,id),
 FOREIGN KEY(root_realm_id,item_id,unit_code,qty_scale) REFERENCES inventory_item(root_realm_id,id,unit_code,qty_scale),
 CHECK(issued_qty>=0 AND held_qty>=0 AND issued_qty+held_qty<=approved_qty AND approved_qty<=requested_qty),
 CHECK(requested_qty=round(requested_qty,qty_scale) AND approved_qty=round(approved_qty,qty_scale) AND held_qty=round(held_qty,qty_scale) AND issued_qty=round(issued_qty,qty_scale))
);
CREATE TABLE material_request_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,request_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),digest char(64) NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,request_id,revision_no),UNIQUE(root_realm_id,id,request_id,revision_no,digest),
 FOREIGN KEY(root_realm_id,request_id) REFERENCES material_request(root_realm_id,id)
);
CREATE TRIGGER material_request_revision_immutable BEFORE UPDATE OR DELETE ON material_request_revision FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
CREATE TABLE stock_hold(
 root_realm_id uuid NOT NULL,request_line_id uuid NOT NULL,request_id uuid NOT NULL,item_id uuid NOT NULL,location_id uuid NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>=0),PRIMARY KEY(root_realm_id,request_line_id),
 FOREIGN KEY(root_realm_id,request_line_id,item_id,request_id) REFERENCES material_request_line(root_realm_id,id,item_id,request_id),
 FOREIGN KEY(root_realm_id,request_id,location_id) REFERENCES material_request(root_realm_id,id,location_id),
 FOREIGN KEY(root_realm_id,item_id,location_id) REFERENCES stock_balance(root_realm_id,item_id,location_id)
);
CREATE TABLE stock_hold_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,request_line_id uuid NOT NULL,
 request_key uuid NOT NULL,actor_ref uuid NOT NULL,delta numeric(18,3) NOT NULL CHECK(delta<>0),
 kind text NOT NULL CHECK(kind IN('RESERVE','RELEASE','ISSUE')),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,request_line_id,request_key),
 FOREIGN KEY(root_realm_id,request_line_id) REFERENCES stock_hold(root_realm_id,request_line_id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER stock_hold_event_immutable BEFORE UPDATE OR DELETE ON stock_hold_event FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
CREATE TABLE material_request_command(
 root_realm_id uuid NOT NULL,request_key uuid NOT NULL,request_id uuid NOT NULL,actor_ref uuid NOT NULL,digest char(64) NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,request_id) REFERENCES material_request(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER material_request_command_immutable BEFORE UPDATE OR DELETE ON material_request_command FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
-- Extend original CG03, not a second approval master. New source fields must be absent on all other owners.
ALTER TABLE cg03_case ADD COLUMN material_request_id uuid,ADD COLUMN material_revision_id uuid,ADD COLUMN material_revision_no integer,ADD COLUMN material_digest char(64),
 ADD CONSTRAINT fk_cg03_material_exact FOREIGN KEY(realm_id,material_revision_id,material_request_id,material_revision_no,material_digest)
 REFERENCES material_request_revision(root_realm_id,id,request_id,revision_no,digest);
CREATE UNIQUE INDEX ux_cg03_material_revision ON cg03_case(realm_id,material_revision_id) WHERE case_kind='MATERIAL_REQUEST_REVIEW';
DO $cg12$
DECLARE rec record; orig text; source_guard text; cols text;
BEGIN
 -- All existing owner-specific fields are null for the new source. Derive actual
 -- nullable reference/digest fields from the existing schema, not an old owner list.
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN ('material_request_id','material_revision_id','material_revision_no','material_digest','previous_case_id')
 AND (column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%');
 source_guard:='case_kind=''MATERIAL_REQUEST_REVIEW'' AND material_request_id IS NOT NULL AND material_revision_id IS NOT NULL AND material_revision_no>0 AND material_digest IS NOT NULL AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF cols IS NOT NULL THEN source_guard:=source_guard||' AND num_nonnulls('||cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES ('cg03_process','cg03_process_kind_finance','process_kind=''MATERIAL_REQUEST_REVIEW'''),('cg03_case','cg03_case_kind_finance','case_kind=''MATERIAL_REQUEST_REVIEW'''),('cg03_case','cg03_case_finance_source_disjoint',source_guard)) v(t,n,guard)
 LOOP
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO orig FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
 IF orig IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint absent: %',rec.n; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,orig,rec.guard);
 END LOOP;
END $cg12$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_material_disjoint CHECK(
 (case_kind='MATERIAL_REQUEST_REVIEW' AND num_nonnulls(material_request_id,material_revision_id,material_revision_no,material_digest)=4 AND material_revision_no=proposal_revision AND material_digest=proposal_digest)
 OR (case_kind<>'MATERIAL_REQUEST_REVIEW' AND num_nonnulls(material_request_id,material_revision_id,material_revision_no,material_digest)=0));
-- Cancellation is a new, source-specific action only for a pending material request.
ALTER TABLE cg03_case DROP CONSTRAINT cg03_case_status_check;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_case_status_check CHECK(status IN('SUBMITTED','IN_REVIEW','RETURNED','REJECTED','FINAL_APPROVED','PENDING_OWNER','OWNER_COMPLETED','OWNER_BLOCKED','OWNER_FAILED_RETRYABLE') OR (status='CANCELLED' AND case_kind='MATERIAL_REQUEST_REVIEW'));
ALTER TABLE cg03_case_event DROP CONSTRAINT cg03_case_event_action_check;
ALTER TABLE cg03_case_event ADD CONSTRAINT cg03_case_event_action_check CHECK(action IN('SUBMITTED','CORRECTED','APPROVED','FORWARDED','RETURNED','REJECTED','FINAL_APPROVED','PENDING_OWNER','OWNER_COMPLETED','OWNER_BLOCKED','OWNER_FAILED_RETRYABLE','CANCELLED'));
CREATE FUNCTION cg12_material_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 IF NEW.material_request_id IS DISTINCT FROM OLD.material_request_id OR NEW.material_revision_id IS DISTINCT FROM OLD.material_revision_id OR NEW.material_revision_no IS DISTINCT FROM OLD.material_revision_no OR NEW.material_digest IS DISTINCT FROM OLD.material_digest THEN RAISE EXCEPTION 'Frozen material source cannot be edited'; END IF;
 RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_material_case_immutable BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg12_material_case_frozen();
CREATE TABLE cg03_material_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
);
