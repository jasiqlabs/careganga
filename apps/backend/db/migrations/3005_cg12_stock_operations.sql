-- US004: one operation source; no independent stock/distribution balance.
ALTER TABLE inventory_location ADD COLUMN delivery_proof_required boolean NOT NULL DEFAULT false;
ALTER TABLE inventory_location ADD COLUMN adjustment_review_required boolean NOT NULL DEFAULT true;
CREATE TABLE stock_operation_draft(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL REFERENCES access_realm(id),request_key uuid NOT NULL,actor_ref uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('ISSUE','RETURN','TRANSFER','ADJUSTMENT')),
 location_id uuid NOT NULL,destination_id uuid,request_id uuid,recipient_id uuid,
 original_movement_id uuid,request_line_id uuid,item_id uuid NOT NULL,unit_code text NOT NULL,qty_scale smallint NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>=0),system_quantity numeric(18,3),balance_version integer,
 expected_request_version integer,reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 300),
 digest char(64) NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),source_version integer NOT NULL DEFAULT 1 CHECK(source_version=1),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','REJECTED','RETURNED','CONFIRMED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,request_key),UNIQUE(root_realm_id,id,source_version),UNIQUE(root_realm_id,id,source_version,digest),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(recipient_id,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id),
 FOREIGN KEY(root_realm_id,destination_id) REFERENCES inventory_location(root_realm_id,id),
 FOREIGN KEY(root_realm_id,item_id,unit_code,qty_scale) REFERENCES inventory_item(root_realm_id,id,unit_code,qty_scale),
 FOREIGN KEY(root_realm_id,request_id,location_id) REFERENCES material_request(root_realm_id,id,location_id),
 FOREIGN KEY(root_realm_id,request_line_id,item_id,request_id) REFERENCES material_request_line(root_realm_id,id,item_id,request_id),
 FOREIGN KEY(root_realm_id,original_movement_id) REFERENCES stock_movement(root_realm_id,id),
 CHECK(quantity=round(quantity,qty_scale)),CHECK(system_quantity IS NULL OR system_quantity=round(system_quantity,qty_scale)),
 CHECK((kind='ISSUE' AND quantity>0 AND recipient_id IS NOT NULL AND destination_id IS NULL AND original_movement_id IS NULL AND system_quantity IS NULL AND balance_version IS NULL AND ((request_id IS NULL AND request_line_id IS NULL AND expected_request_version IS NULL) OR (request_id IS NOT NULL AND request_line_id IS NOT NULL AND expected_request_version>0)))
 OR (kind='RETURN' AND quantity>0 AND original_movement_id IS NOT NULL AND destination_id IS NULL AND request_id IS NULL AND request_line_id IS NULL AND recipient_id IS NULL AND expected_request_version IS NULL AND system_quantity IS NULL AND balance_version IS NULL)
 OR (kind='TRANSFER' AND quantity>0 AND destination_id IS NOT NULL AND destination_id<>location_id AND original_movement_id IS NULL AND request_id IS NULL AND request_line_id IS NULL AND recipient_id IS NULL AND expected_request_version IS NULL AND system_quantity IS NULL AND balance_version IS NULL)
 OR (kind='ADJUSTMENT' AND destination_id IS NULL AND original_movement_id IS NULL AND request_id IS NULL AND request_line_id IS NULL AND recipient_id IS NULL AND expected_request_version IS NULL AND system_quantity>=0 AND balance_version>0 AND system_quantity<>quantity))
);
CREATE FUNCTION cg12_operation_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') AND
 ((OLD.status='DRAFT' AND NEW.status IN('SUBMITTED','CONFIRMED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','CONFIRMED'))) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Original stock operation source cannot be edited or deleted';
END; $cg12$;
CREATE TRIGGER cg12_operation_frozen BEFORE UPDATE OR DELETE ON stock_operation_draft FOR EACH ROW EXECUTE FUNCTION cg12_operation_frozen();
CREATE INDEX ix_stock_operation_actor ON stock_operation_draft(root_realm_id,location_id,actor_ref,status,created_at DESC,id);

ALTER TABLE stock_event DROP CONSTRAINT stock_event_event_kind_check;
ALTER TABLE stock_event ADD CONSTRAINT stock_event_event_kind_check CHECK(event_kind IN('RECEIPT','RECEIPT_REVERSAL','ISSUE','RETURN','TRANSFER','ADJUSTMENT'));
ALTER TABLE stock_event ADD COLUMN operation_id uuid,ADD COLUMN recipient_id uuid,ADD COLUMN request_id uuid,ADD COLUMN original_movement_id uuid,
 ADD CONSTRAINT fk_stock_event_operation FOREIGN KEY(root_realm_id,operation_id) REFERENCES stock_operation_draft(root_realm_id,id),
 ADD CONSTRAINT fk_stock_event_recipient FOREIGN KEY(recipient_id,root_realm_id) REFERENCES account(id,realm_id),
 ADD CONSTRAINT fk_stock_event_request FOREIGN KEY(root_realm_id,request_id) REFERENCES material_request(root_realm_id,id),
 ADD CONSTRAINT fk_stock_event_return_source FOREIGN KEY(root_realm_id,original_movement_id) REFERENCES stock_movement(root_realm_id,id);
ALTER TABLE stock_event DROP CONSTRAINT stock_event_receipt_source;
ALTER TABLE stock_event ADD CONSTRAINT stock_event_receipt_source CHECK(
 ((event_kind='RECEIPT' AND receipt_draft_id IS NOT NULL AND source_ref=receipt_draft_id AND reversal_of_ref IS NULL)
 OR (event_kind='RECEIPT_REVERSAL' AND receipt_draft_id IS NOT NULL AND reversal_of_ref IS NOT NULL AND source_ref=reversal_of_ref AND length(btrim(reason))>=3))
 AND num_nonnulls(operation_id,recipient_id,request_id,original_movement_id)=0
 OR (event_kind IN('ISSUE','RETURN','TRANSFER','ADJUSTMENT') AND operation_id IS NOT NULL AND source_ref=operation_id AND receipt_draft_id IS NULL AND reversal_of_ref IS NULL AND proof_ref IS NULL AND proof_revision IS NULL
 AND ((event_kind='ISSUE' AND recipient_id IS NOT NULL AND original_movement_id IS NULL)
 OR (event_kind='RETURN' AND original_movement_id IS NOT NULL AND recipient_id IS NULL AND request_id IS NULL)
 OR (event_kind IN('TRANSFER','ADJUSTMENT') AND num_nonnulls(recipient_id,original_movement_id,request_id)=0))));
CREATE UNIQUE INDEX ux_stock_event_operation_once ON stock_event(root_realm_id,operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX ix_stock_event_return_original ON stock_event(root_realm_id,original_movement_id) WHERE event_kind='RETURN';
ALTER TABLE stock_movement DROP CONSTRAINT stock_movement_receipt_sign;
ALTER TABLE stock_movement ADD CONSTRAINT stock_movement_receipt_sign CHECK(
 (event_kind IN('RECEIPT','RETURN') AND signed_qty>0) OR (event_kind IN('RECEIPT_REVERSAL','ISSUE') AND signed_qty<0) OR event_kind IN('TRANSFER','ADJUSTMENT'));
ALTER TABLE inventory_audit DROP CONSTRAINT inventory_audit_source_kind_check;
ALTER TABLE inventory_audit ADD CONSTRAINT inventory_audit_source_kind_check CHECK(source_kind IN('ITEM','SUPPLIER','LOCATION','THRESHOLD','SUPPLIER_PRIVATE','SUPPLIER_PRIVATE_READ','RECEIPT','RECEIPT_REVERSAL','ISSUE','RETURN','TRANSFER','ADJUSTMENT','REPORT_EXPORT'));
-- The original CG03 process/case identity for count corrections.
ALTER TABLE cg03_case ADD COLUMN stock_adjustment_id uuid,ADD COLUMN stock_adjustment_version integer,ADD COLUMN stock_adjustment_digest char(64),
 ADD CONSTRAINT fk_cg03_stock_adjustment_exact FOREIGN KEY(realm_id,stock_adjustment_id,stock_adjustment_version,stock_adjustment_digest)
 REFERENCES stock_operation_draft(root_realm_id,id,source_version,digest);
CREATE UNIQUE INDEX ux_cg03_stock_adjustment_case ON cg03_case(realm_id,stock_adjustment_id) WHERE case_kind='STOCK_ADJUSTMENT_REVIEW';
DO $cg12$
DECLARE rec record; orig text; source_guard text; cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND (column_name LIKE 'material_%' OR column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%');
 source_guard:='case_kind=''STOCK_ADJUSTMENT_REVIEW'' AND stock_adjustment_id IS NOT NULL AND stock_adjustment_version=1 AND stock_adjustment_digest IS NOT NULL AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF cols IS NOT NULL THEN source_guard:=source_guard||' AND num_nonnulls('||cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES ('cg03_process','cg03_process_kind_finance','process_kind=''STOCK_ADJUSTMENT_REVIEW'''),('cg03_case','cg03_case_kind_finance','case_kind=''STOCK_ADJUSTMENT_REVIEW'''),('cg03_case','cg03_case_finance_source_disjoint',source_guard)) v(t,n,guard)
 LOOP
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO orig FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
 IF orig IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint absent: %',rec.n; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.t,rec.n,orig,rec.guard);
 END LOOP;
END $cg12$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_adjustment_disjoint CHECK(
 (case_kind='STOCK_ADJUSTMENT_REVIEW' AND num_nonnulls(stock_adjustment_id,stock_adjustment_version,stock_adjustment_digest)=3 AND stock_adjustment_version=proposal_revision AND stock_adjustment_digest=proposal_digest)
 OR (case_kind<>'STOCK_ADJUSTMENT_REVIEW' AND num_nonnulls(stock_adjustment_id,stock_adjustment_version,stock_adjustment_digest)=0));
CREATE FUNCTION cg12_adjustment_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 IF (NEW.stock_adjustment_id,NEW.stock_adjustment_version,NEW.stock_adjustment_digest) IS DISTINCT FROM (OLD.stock_adjustment_id,OLD.stock_adjustment_version,OLD.stock_adjustment_digest) THEN RAISE EXCEPTION 'Frozen adjustment source cannot be edited'; END IF; RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_adjustment_case_immutable BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg12_adjustment_case_frozen();
CREATE TABLE cg03_stock_adjustment_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
);
