-- Current low-stock alerts are projected from the ledger; only changed keys produce transition events.
CREATE TABLE stock_low_alert(
 root_realm_id uuid NOT NULL,item_id uuid NOT NULL,location_id uuid NOT NULL,active boolean NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(root_realm_id,item_id,location_id),
 FOREIGN KEY(root_realm_id,item_id) REFERENCES inventory_item(root_realm_id,id),
 FOREIGN KEY(root_realm_id,location_id) REFERENCES inventory_location(root_realm_id,id)
);
CREATE FUNCTION cg12_refresh_low_alert(p_root uuid,p_item uuid,p_loc uuid) RETURNS void LANGUAGE plpgsql AS $cg12$
DECLARE low boolean;
BEGIN
 SELECT i.status='ACTIVE' AND l.status='ACTIVE' AND COALESCE(b.on_hand_qty-b.reserved_qty,0)<COALESCE(p.threshold,i.low_stock_threshold) INTO low
 FROM inventory_item i JOIN inventory_location l ON l.root_realm_id=i.root_realm_id AND l.id=p_loc
 LEFT JOIN stock_balance b ON b.root_realm_id=i.root_realm_id AND b.item_id=i.id AND b.location_id=l.id
 LEFT JOIN inventory_item_location_policy p ON p.root_realm_id=i.root_realm_id AND p.item_id=i.id AND p.location_id=l.id
 WHERE i.root_realm_id=p_root AND i.id=p_item;
 IF low IS NULL THEN RETURN; END IF;
 INSERT INTO stock_low_alert(root_realm_id,item_id,location_id,active) VALUES(p_root,p_item,p_loc,low)
 ON CONFLICT(root_realm_id,item_id,location_id) DO UPDATE SET active=EXCLUDED.active,changed_at=now()
 WHERE stock_low_alert.active IS DISTINCT FROM EXCLUDED.active;
END; $cg12$;
CREATE FUNCTION cg12_alert_pair() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN PERFORM cg12_refresh_low_alert(NEW.root_realm_id,NEW.item_id,NEW.location_id); RETURN NEW; END; $cg12$;
CREATE TRIGGER cg12_balance_alert AFTER INSERT OR UPDATE OF on_hand_qty,reserved_qty ON stock_balance FOR EACH ROW EXECUTE FUNCTION cg12_alert_pair();
CREATE TRIGGER cg12_threshold_alert AFTER INSERT OR UPDATE OF threshold ON inventory_item_location_policy FOR EACH ROW EXECUTE FUNCTION cg12_alert_pair();
CREATE FUNCTION cg12_alert_item() RETURNS trigger LANGUAGE plpgsql AS $cg12$
DECLARE loc uuid;
BEGIN
 FOR loc IN SELECT location_id FROM stock_low_alert WHERE root_realm_id=NEW.root_realm_id AND item_id=NEW.id LOOP
 PERFORM cg12_refresh_low_alert(NEW.root_realm_id,NEW.id,loc); END LOOP; RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_item_alert AFTER UPDATE OF status,low_stock_threshold ON inventory_item FOR EACH ROW EXECUTE FUNCTION cg12_alert_item();
CREATE INDEX ix_cg12_low_alert_active ON stock_low_alert(root_realm_id,location_id,changed_at DESC) WHERE active;
CREATE INDEX ix_cg12_event_date ON stock_event(root_realm_id,effective_date DESC,id);
CREATE INDEX ix_cg12_request_priority ON material_request(root_realm_id,location_id,priority,created_at DESC,id);
