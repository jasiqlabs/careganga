-- CG12 US002. One original immutable quantity ledger and exact materialized balance.
-- No opening-stock rows, invoice/payment or future module source.
ALTER TABLE inventory_location ADD COLUMN receipt_proof_required boolean NOT NULL DEFAULT false;
ALTER TABLE inventory_item ADD CONSTRAINT uq_inventory_item_counting_unit UNIQUE(root_realm_id,id,unit_code,qty_scale);

CREATE TABLE inventory_receipt_draft (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 supplier_id uuid NOT NULL,
 location_id uuid NOT NULL,
 receipt_date date NOT NULL,
 source_note text NOT NULL DEFAULT '' CHECK(length(source_note)<=160),
 created_by uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 source_version integer NOT NULL DEFAULT 1 CHECK(source_version=1),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','CONFIRMED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,id,source_version),
 FOREIGN KEY(root_realm_id,supplier_id) REFERENCES inventory_supplier(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE inventory_receipt_line (
 root_realm_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 item_id uuid NOT NULL,
 line_no integer NOT NULL CHECK(line_no BETWEEN 1 AND 50),
 unit_code text NOT NULL,
 qty_scale smallint NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>0 AND quantity=round(quantity,qty_scale)),
 PRIMARY KEY(root_realm_id,receipt_id,line_no),
 UNIQUE(root_realm_id,receipt_id,item_id),
 FOREIGN KEY(root_realm_id,receipt_id) REFERENCES inventory_receipt_draft(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,item_id,unit_code,qty_scale) REFERENCES inventory_item(root_realm_id,id,unit_code,qty_scale) ON DELETE RESTRICT
);
CREATE FUNCTION cg12_receipt_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='DRAFT' AND NEW.status='CONFIRMED'
 AND (NEW.id,NEW.root_realm_id,NEW.supplier_id,NEW.location_id,NEW.receipt_date,NEW.source_note,
   NEW.created_by,NEW.request_key,NEW.payload_digest,NEW.source_version,NEW.created_at)
 IS NOT DISTINCT FROM
 (OLD.id,OLD.root_realm_id,OLD.supplier_id,OLD.location_id,OLD.receipt_date,OLD.source_note,
   OLD.created_by,OLD.request_key,OLD.payload_digest,OLD.source_version,OLD.created_at)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Frozen receipt source cannot be changed';
END; $cg12$;
CREATE TRIGGER inventory_receipt_frozen BEFORE UPDATE OR DELETE ON inventory_receipt_draft
 FOR EACH ROW EXECUTE FUNCTION cg12_receipt_source_immutable();
CREATE TRIGGER inventory_receipt_line_immutable BEFORE UPDATE OR DELETE ON inventory_receipt_line
 FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();

CREATE SEQUENCE stock_event_public_sequence START 1;
CREATE TABLE stock_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 event_no text NOT NULL UNIQUE CHECK(event_no ~ '^CG-ST-[0-9]{6,}$'),
 source_owner text NOT NULL CHECK(source_owner='CG12'),
 source_ref uuid NOT NULL,
 source_event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 event_kind text NOT NULL CHECK(event_kind IN('RECEIPT','RECEIPT_REVERSAL')),
 actor_ref uuid NOT NULL,
 receipt_draft_id uuid,
 reversal_of_ref uuid,
 effective_date date NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=300),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,id,event_kind),
 UNIQUE(root_realm_id,source_event_key),
 UNIQUE(root_realm_id,source_owner,source_ref,event_kind,source_event_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,receipt_draft_id) REFERENCES inventory_receipt_draft(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reversal_of_ref) REFERENCES stock_event(root_realm_id,id) ON DELETE RESTRICT,
 CONSTRAINT stock_event_receipt_source CHECK(
   (event_kind='RECEIPT' AND receipt_draft_id IS NOT NULL AND source_ref=receipt_draft_id AND reversal_of_ref IS NULL)
   OR (event_kind='RECEIPT_REVERSAL' AND receipt_draft_id IS NOT NULL AND reversal_of_ref IS NOT NULL AND source_ref=reversal_of_ref AND length(btrim(reason))>=3))
);
CREATE UNIQUE INDEX ux_stock_receipt_once ON stock_event(root_realm_id,receipt_draft_id) WHERE event_kind='RECEIPT';
CREATE UNIQUE INDEX ux_stock_receipt_reversal_once ON stock_event(root_realm_id,reversal_of_ref) WHERE event_kind='RECEIPT_REVERSAL';
CREATE INDEX ix_stock_event_history ON stock_event(root_realm_id,occurred_at DESC,id);
CREATE TABLE stock_movement (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 stock_event_id uuid NOT NULL,
 event_kind text NOT NULL,
 item_id uuid NOT NULL,
 location_id uuid NOT NULL,
 signed_qty numeric(18,3) NOT NULL CHECK(signed_qty<>0),
 unit_code text NOT NULL,
 qty_scale smallint NOT NULL CHECK(qty_scale BETWEEN 0 AND 3),
 source_line_no integer NOT NULL CHECK(source_line_no BETWEEN 1 AND 100),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,stock_event_id,source_line_no),
 FOREIGN KEY(root_realm_id,stock_event_id,event_kind) REFERENCES stock_event(root_realm_id,id,event_kind) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,item_id,unit_code,qty_scale) REFERENCES inventory_item(root_realm_id,id,unit_code,qty_scale) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id) ON DELETE RESTRICT,
 CHECK(signed_qty=round(signed_qty,qty_scale)),
 CONSTRAINT stock_movement_receipt_sign CHECK((event_kind='RECEIPT' AND signed_qty>0) OR (event_kind='RECEIPT_REVERSAL' AND signed_qty<0))
);
CREATE INDEX ix_stock_movement_scope ON stock_movement(root_realm_id,location_id,stock_event_id,id);
CREATE INDEX ix_stock_movement_item ON stock_movement(root_realm_id,item_id,location_id,stock_event_id);
CREATE TABLE stock_balance (
 root_realm_id uuid NOT NULL,
 item_id uuid NOT NULL,
 location_id uuid NOT NULL,
 on_hand_qty numeric(18,3) NOT NULL DEFAULT 0,
 reserved_qty numeric(18,3) NOT NULL DEFAULT 0,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,item_id,location_id),
 FOREIGN KEY(root_realm_id,item_id) REFERENCES inventory_item(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id) ON DELETE RESTRICT,
 CHECK(on_hand_qty>=0 AND reserved_qty>=0 AND on_hand_qty>=reserved_qty)
);
CREATE INDEX ix_stock_balance_location ON stock_balance(root_realm_id,location_id,item_id);
CREATE TRIGGER stock_event_immutable BEFORE UPDATE OR DELETE ON stock_event
 FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
CREATE TRIGGER stock_movement_immutable BEFORE UPDATE OR DELETE ON stock_movement
 FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
CREATE INDEX ix_inventory_receipt_draft_actor ON inventory_receipt_draft(root_realm_id,created_by,status,created_at DESC,id);

ALTER TABLE inventory_audit DROP CONSTRAINT inventory_audit_source_kind_check;
ALTER TABLE inventory_audit ADD CONSTRAINT inventory_audit_source_kind_check CHECK(source_kind IN('ITEM','SUPPLIER','LOCATION','THRESHOLD','SUPPLIER_PRIVATE','SUPPLIER_PRIVATE_READ','RECEIPT','RECEIPT_REVERSAL'));
