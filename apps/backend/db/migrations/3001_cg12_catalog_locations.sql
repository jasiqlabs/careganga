-- CG12 US001: catalog and authorized stores only. Stock events/balances arrive in US002.
CREATE TABLE inventory_item (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 sku_norm text NOT NULL CHECK(sku_norm ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 category text NOT NULL CHECK(length(btrim(category)) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 unit_code text NOT NULL CHECK(unit_code IN('PIECE','KG','LITER')),
 qty_scale smallint NOT NULL CHECK(qty_scale BETWEEN 0 AND 3 AND (unit_code<>'PIECE' OR qty_scale=0)),
 low_stock_threshold numeric(18,3) NOT NULL DEFAULT 0 CHECK(low_stock_threshold>=0 AND low_stock_threshold=round(low_stock_threshold,qty_scale)),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,sku_norm)
);
CREATE TABLE inventory_supplier (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 supplier_code_norm text NOT NULL CHECK(supplier_code_norm ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
 legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 2 AND 160),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 160),
 category text NOT NULL CHECK(length(btrim(category)) BETWEEN 1 AND 80),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','BLOCKED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,supplier_code_norm)
);
CREATE TABLE inventory_location (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 location_code_norm text NOT NULL CHECK(location_code_norm ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 160),
 branch_ref uuid,
 scope_kind text NOT NULL CHECK(scope_kind IN('FOUNDATION','BRANCH')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((scope_kind='FOUNDATION' AND branch_ref IS NULL) OR (scope_kind='BRANCH' AND branch_ref IS NOT NULL)),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,location_code_norm),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT
);
CREATE TABLE inventory_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN('ITEM','SUPPLIER','LOCATION')),
 source_ref uuid NOT NULL,
 event_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 result_version integer NOT NULL CHECK(result_version>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,event_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg12_inventory_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $
BEGIN RAISE EXCEPTION 'Inventory audit is immutable'; END; $;
CREATE TRIGGER inventory_audit_immutable BEFORE UPDATE OR DELETE ON inventory_audit
 FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
CREATE INDEX ix_inventory_item_list ON inventory_item(root_realm_id,status,name,id);
CREATE INDEX ix_inventory_supplier_list ON inventory_supplier(root_realm_id,status,display_name,id);
CREATE INDEX ix_inventory_location_scope ON inventory_location(root_realm_id,branch_ref,status,label,id);
-- No synthetic opening stock, future-owner FK, money, or writable balance.
