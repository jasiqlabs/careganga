-- CG07 QA09: one collectible payment attempt per donation across all workers.
CREATE FUNCTION cg07_one_active_payment_path() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 PERFORM 1 FROM donation d WHERE d.root_realm_id=NEW.root_realm_id
  AND d.id=NEW.donation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original donation unavailable'; END IF;
 IF NEW.status NOT IN('FAILED','EXPIRED') AND EXISTS(
  SELECT 1 FROM donation_payment_attempt a
  WHERE a.root_realm_id=NEW.root_realm_id AND a.donation_id=NEW.donation_id
   AND a.status NOT IN('FAILED','EXPIRED'))
 THEN RAISE EXCEPTION 'An unresolved payment path must be reconciled first'
  USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $cg07$;
CREATE TRIGGER cg07_one_active_payment_path_before_insert
 BEFORE INSERT ON donation_payment_attempt
 FOR EACH ROW EXECUTE FUNCTION cg07_one_active_payment_path();
CREATE INDEX ix_cg07_active_payment_path
 ON donation_payment_attempt(root_realm_id,donation_id,created_at DESC,id DESC)
 WHERE status NOT IN('FAILED','EXPIRED');
