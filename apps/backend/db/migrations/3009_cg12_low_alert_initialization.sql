-- CG12 US005: initialize low stock for zero-balance catalog/store pairs.
-- Only the changed item or warehouse is considered by the new triggers.
-- Do not schedule tenant-wide polling or send an unverified notification.
CREATE OR REPLACE FUNCTION cg12_alert_item() RETURNS trigger LANGUAGE plpgsql AS $cg12$
DECLARE loc uuid;
BEGIN
 FOR loc IN
  SELECT l.id FROM inventory_location l
  WHERE l.root_realm_id=NEW.root_realm_id AND
   (EXISTS(SELECT 1 FROM stock_low_alert a WHERE a.root_realm_id=l.root_realm_id AND a.location_id=l.id AND a.item_id=NEW.id)
    OR EXISTS(SELECT 1 FROM inventory_item_location_policy p WHERE p.root_realm_id=l.root_realm_id AND p.location_id=l.id AND p.item_id=NEW.id)
    OR EXISTS(SELECT 1 FROM stock_balance b WHERE b.root_realm_id=l.root_realm_id AND b.location_id=l.id AND b.item_id=NEW.id)
    OR (NEW.status='ACTIVE' AND NEW.low_stock_threshold>0 AND l.status='ACTIVE'))
  ORDER BY l.id
 LOOP
  PERFORM cg12_refresh_low_alert(NEW.root_realm_id,NEW.id,loc);
 END LOOP;
 RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_item_alert_insert AFTER INSERT ON inventory_item FOR EACH ROW EXECUTE FUNCTION cg12_alert_item();

CREATE OR REPLACE FUNCTION cg12_alert_location() RETURNS trigger LANGUAGE plpgsql AS $cg12$
DECLARE item uuid;
BEGIN
 FOR item IN
  SELECT i.id FROM inventory_item i
  WHERE i.root_realm_id=NEW.root_realm_id AND
   (EXISTS(SELECT 1 FROM stock_low_alert a WHERE a.root_realm_id=i.root_realm_id AND a.location_id=NEW.id AND a.item_id=i.id)
    OR EXISTS(SELECT 1 FROM inventory_item_location_policy p WHERE p.root_realm_id=i.root_realm_id AND p.location_id=NEW.id AND p.item_id=i.id)
    OR EXISTS(SELECT 1 FROM stock_balance b WHERE b.root_realm_id=i.root_realm_id AND b.location_id=NEW.id AND b.item_id=i.id)
    OR (NEW.status='ACTIVE' AND i.status='ACTIVE' AND i.low_stock_threshold>0))
  ORDER BY i.id
 LOOP
  PERFORM cg12_refresh_low_alert(NEW.root_realm_id,item,NEW.id);
 END LOOP;
 RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_location_alert_insert AFTER INSERT ON inventory_location FOR EACH ROW EXECUTE FUNCTION cg12_alert_location();

-- One-time forward reconciliation for pre-existing catalog, balance and policy rows,
-- keeping historical alert transitions only when the current state changes.
DO $cg12$
DECLARE pair record;
BEGIN
 FOR pair IN
  SELECT b.root_realm_id,b.item_id,b.location_id FROM stock_balance b
  UNION SELECT p.root_realm_id,p.item_id,p.location_id FROM inventory_item_location_policy p
  UNION SELECT a.root_realm_id,a.item_id,a.location_id FROM stock_low_alert a
  UNION SELECT i.root_realm_id,i.id,l.id FROM inventory_item i
   JOIN inventory_location l ON l.root_realm_id=i.root_realm_id
   WHERE i.status='ACTIVE' AND l.status='ACTIVE' AND i.low_stock_threshold>0
  ORDER BY 1,2,3
 LOOP
  PERFORM cg12_refresh_low_alert(pair.root_realm_id,pair.item_id,pair.location_id);
 END LOOP;
END; $cg12$;
