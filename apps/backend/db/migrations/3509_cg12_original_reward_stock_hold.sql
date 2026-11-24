-- CG13 US003 QA06/07/12. CG12 OWNS every warehouse quantity.
-- Exactly one original stock_balance row, with a source-keyed reward hold.
-- This does NOT create another inventory balance, staff issue, supplier,
-- courier, delivery certificate or a fake stock movement.
CREATE TABLE stock_reward_hold (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 redemption_id uuid NOT NULL,
 item_id uuid NOT NULL,
 location_id uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 issue_key uuid NOT NULL DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'HELD'
  CHECK(state IN('HELD','RELEASED','ISSUED','RETURNED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,redemption_id),
 UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,issue_key),
 FOREIGN KEY(root_realm_id,redemption_id)
  REFERENCES redemption(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,item_id,location_id)
  REFERENCES stock_balance(root_realm_id,item_id,location_id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg12_reward_hold_store
 ON stock_reward_hold(root_realm_id,location_id,state,item_id,id);

CREATE TABLE stock_reward_hold_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 hold_id uuid NOT NULL,
 event_kind text NOT NULL
  CHECK(event_kind IN('RESERVED','RELEASED','ISSUED','RETURNED')),
 source_key uuid NOT NULL,
 actor_account_ref uuid NOT NULL,
 original_stock_event_id uuid,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,hold_id,event_kind),
 FOREIGN KEY(root_realm_id,hold_id)
  REFERENCES stock_reward_hold(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,original_stock_event_id)
  REFERENCES stock_event(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((event_kind IN('RESERVED','RELEASED') AND original_stock_event_id IS NULL)
 OR (event_kind IN('ISSUED','RETURNED') AND original_stock_event_id IS NOT NULL))
);
CREATE TRIGGER cg12_reward_hold_event_immutable
 BEFORE UPDATE OR DELETE ON stock_reward_hold_event
 FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();

CREATE FUNCTION cg12_reward_hold_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original CG12 reward stock hold must not be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.root_realm_id,NEW.id,NEW.redemption_id,NEW.item_id,NEW.location_id,
      NEW.recipient_account_ref,NEW.request_key,NEW.issue_key,NEW.created_at)
     IS DISTINCT FROM
     (OLD.root_realm_id,OLD.id,OLD.redemption_id,OLD.item_id,OLD.location_id,
      OLD.recipient_account_ref,OLD.request_key,OLD.issue_key,OLD.created_at)
     OR NEW.revision<>OLD.revision+1
     OR NOT (
      (OLD.state='HELD' AND NEW.state IN('RELEASED','ISSUED'))
      OR (OLD.state='ISSUED' AND NEW.state='RETURNED')
     )
  THEN RAISE EXCEPTION 'Only original source-backed CG12 hold state transitions allowed'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.state<>'HELD' OR NEW.revision<>1 THEN
  RAISE EXCEPTION 'A new reward stock hold must start HELD'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM redemption r
  JOIN reward_product_revision p ON p.root_realm_id=r.root_realm_id
   AND p.product_id=r.product_id AND p.revision=r.product_revision
  JOIN inventory_item item ON item.root_realm_id=p.root_realm_id
   AND item.id=p.cg12_item_ref
  JOIN inventory_location loc ON loc.root_realm_id=p.root_realm_id
   AND loc.id=p.cg12_location_ref
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.redemption_id
   AND r.state='HELD' AND r.product_type='PHYSICAL'
   AND r.recipient_account_ref=NEW.recipient_account_ref
   AND r.request_key=NEW.request_key
   AND p.product_type='PHYSICAL'
   AND p.cg12_item_ref=NEW.item_id AND p.cg12_location_ref=NEW.location_id
   AND item.status='ACTIVE' AND item.unit_code='PIECE' AND item.qty_scale=0
   AND loc.status='ACTIVE'
   AND (loc.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch b WHERE b.root_realm_id=loc.root_realm_id
     AND b.id=loc.branch_ref AND b.status='ACTIVE'))
 ) THEN RAISE EXCEPTION 'Verified original reward, item and warehouse required'; END IF;
 RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_reward_hold_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON stock_reward_hold
 FOR EACH ROW EXECUTE FUNCTION cg12_reward_hold_source_guard();

CREATE FUNCTION cg12_reward_hold_commit_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg12$
DECLARE h record;reserved numeric;recorded numeric;
BEGIN
 SELECT * INTO h FROM stock_reward_hold
  WHERE root_realm_id=NEW.root_realm_id AND id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original reward hold required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM stock_reward_hold_event e
  WHERE e.root_realm_id=h.root_realm_id AND e.hold_id=h.id
   AND e.event_kind='RESERVED' AND e.source_key=h.request_key)
 THEN RAISE EXCEPTION 'CG12 reward hold requires original reserve event'; END IF;
 IF h.state='RELEASED' AND NOT EXISTS(SELECT 1 FROM stock_reward_hold_event e
  WHERE e.root_realm_id=h.root_realm_id AND e.hold_id=h.id
   AND e.event_kind='RELEASED' AND e.source_key=h.request_key)
 THEN RAISE EXCEPTION 'CG12 release requires original source event'; END IF;
 IF h.state IN('ISSUED','RETURNED') AND NOT EXISTS(
  SELECT 1 FROM stock_reward_hold_event e JOIN stock_event se
   ON se.root_realm_id=e.root_realm_id AND se.id=e.original_stock_event_id
  WHERE e.root_realm_id=h.root_realm_id AND e.hold_id=h.id
   AND e.event_kind='ISSUED' AND e.source_key=h.issue_key
   AND se.event_kind='ISSUE' AND se.source_event_key=h.issue_key)
 THEN RAISE EXCEPTION 'CG12 ISSUE requires original stock_event'; END IF;
 IF h.state='RETURNED' AND NOT EXISTS(
  SELECT 1 FROM stock_reward_hold_event e JOIN stock_event se
   ON se.root_realm_id=e.root_realm_id AND se.id=e.original_stock_event_id
  WHERE e.root_realm_id=h.root_realm_id AND e.hold_id=h.id
   AND e.event_kind='RETURNED' AND se.event_kind='RETURN'
 ) THEN RAISE EXCEPTION 'CG12 RETURN requires original stock_event'; END IF;
 -- No parallel warehouse projection: original CG12 material_request holds
 -- plus live reward holds must equal the SAME stock_balance.reserved_qty.
 SELECT reserved_qty INTO reserved FROM stock_balance
  WHERE root_realm_id=h.root_realm_id AND item_id=h.item_id
   AND location_id=h.location_id;
 SELECT COALESCE((SELECT SUM(quantity) FROM stock_hold m
  WHERE m.root_realm_id=h.root_realm_id AND m.item_id=h.item_id
   AND m.location_id=h.location_id),0)+
  COALESCE((SELECT COUNT(*) FROM stock_reward_hold rw
  WHERE rw.root_realm_id=h.root_realm_id AND rw.item_id=h.item_id
   AND rw.location_id=h.location_id AND rw.state='HELD'),0)
 INTO recorded;
 IF reserved IS DISTINCT FROM recorded THEN
  RAISE EXCEPTION 'CG12 actual reserved projection differs from original holds';
 END IF;
 RETURN NULL;
END; $cg12$;
CREATE CONSTRAINT TRIGGER cg12_reward_hold_at_commit
 AFTER INSERT OR UPDATE ON stock_reward_hold
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION cg12_reward_hold_commit_guard();
