-- CG13 US003 QA01/03/04/05: first real DIGITAL redemption vertical.
-- No fake gift-card delivery, CG09 payment, CG12 stock, or entitlement.
-- The original points_event remains the only immutable points ledger.
CREATE TABLE redemption (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL,
 policy_version integer NOT NULL CHECK(policy_version>0),
 points_account_id uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 relationship_kind text NOT NULL CHECK(relationship_kind IN('MEMBER','VOLUNTEER')),
 relationship_ref uuid NOT NULL,
 product_id uuid NOT NULL,
 product_revision integer NOT NULL CHECK(product_revision>0),
 product_type text NOT NULL CHECK(product_type='DIGITAL'),
 points_cost bigint NOT NULL CHECK(points_cost>0 AND points_cost<=1000000000),
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'HELD'
  CHECK(state IN('HELD','CANCELLED','FULFILLMENT_PENDING','FULFILLED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 requested_at timestamptz NOT NULL DEFAULT now(),
 cancelled_at timestamptz,
 fulfilled_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,recipient_account_ref,request_key),
 FOREIGN KEY(root_realm_id,programme_id)
  REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,programme_id,policy_version)
  REFERENCES referral_policy_version(root_realm_id,programme_id,version_no) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,points_account_id)
  REFERENCES points_account(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,product_id)
  REFERENCES reward_product(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,product_id,product_revision)
  REFERENCES reward_product_revision(root_realm_id,product_id,revision) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((state='CANCELLED' AND cancelled_at IS NOT NULL) OR
  (state<>'CANCELLED' AND cancelled_at IS NULL)),
 CHECK((state='FULFILLED' AND fulfilled_at IS NOT NULL) OR
  (state<>'FULFILLED' AND fulfilled_at IS NULL))
);
CREATE INDEX ix_cg13_redemption_self_recent
 ON redemption(root_realm_id,recipient_account_ref,requested_at DESC,id DESC);
CREATE INDEX ix_cg13_redemption_due
 ON redemption(root_realm_id,state,requested_at,id)
 WHERE state IN('HELD','FULFILLMENT_PENDING');

ALTER TABLE points_event ADD CONSTRAINT fk_cg13_points_event_redemption
 FOREIGN KEY(root_realm_id,redemption_id)
 REFERENCES redemption(root_realm_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg13_points_redemption_effect
 ON points_event(root_realm_id,redemption_id,event_kind)
 WHERE redemption_id IS NOT NULL;

CREATE TABLE redemption_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 redemption_id uuid NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN('REQUESTED','CANCELLED')),
 original_points_event_id uuid NOT NULL,
 source_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,redemption_id,event_kind),
 FOREIGN KEY(root_realm_id,redemption_id)
  REFERENCES redemption(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,original_points_event_id)
  REFERENCES points_event(root_realm_id,id) ON DELETE RESTRICT
);
CREATE TRIGGER cg13_redemption_event_immutable
 BEFORE UPDATE OR DELETE ON redemption_event FOR EACH ROW
 EXECUTE FUNCTION cg13_immutable_source();

CREATE FUNCTION cg13_digital_redemption_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original redemptions must never be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (OLD.root_realm_id,OLD.id,OLD.programme_id,OLD.policy_version,OLD.points_account_id,
      OLD.recipient_account_ref,OLD.relationship_kind,OLD.relationship_ref,
      OLD.product_id,OLD.product_revision,OLD.product_type,OLD.points_cost,
      OLD.request_key,OLD.payload_digest,OLD.requested_at) IS DISTINCT FROM
     (NEW.root_realm_id,NEW.id,NEW.programme_id,NEW.policy_version,NEW.points_account_id,
      NEW.recipient_account_ref,NEW.relationship_kind,NEW.relationship_ref,
      NEW.product_id,NEW.product_revision,NEW.product_type,NEW.points_cost,
      NEW.request_key,NEW.payload_digest,NEW.requested_at)
    OR NOT (OLD.state='HELD' AND NEW.state='CANCELLED')
    OR NEW.revision<>OLD.revision+1
    OR NEW.cancelled_at IS NULL OR NEW.fulfilled_at IS NOT NULL
  THEN RAISE EXCEPTION 'Digital redemption requires original verified state transition'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.state<>'HELD' OR NEW.revision<>1 OR NEW.cancelled_at IS NOT NULL
   OR NEW.fulfilled_at IS NOT NULL THEN
  RAISE EXCEPTION 'Only actual digital pending holds may be requested'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM points_account wallet
  JOIN referral_program programme ON programme.root_realm_id=wallet.root_realm_id
   AND programme.id=wallet.programme_id AND programme.status='ACTIVE'
  JOIN reward_product product ON product.root_realm_id=wallet.root_realm_id
   AND product.programme_id=wallet.programme_id AND product.id=NEW.product_id
  WHERE wallet.root_realm_id=NEW.root_realm_id AND wallet.id=NEW.points_account_id
   AND wallet.programme_id=NEW.programme_id
   AND wallet.referrer_account_ref=NEW.recipient_account_ref
   AND wallet.referrer_kind=NEW.relationship_kind
   AND wallet.referrer_relationship_ref=NEW.relationship_ref
   AND product.product_type='DIGITAL'
   AND product.status='ACTIVE' AND product.public_visible
   AND (product.eligible_audience='BOTH' OR product.eligible_audience=NEW.relationship_kind)
   AND product.version=NEW.product_revision
   AND product.points_price=NEW.points_cost
   AND NEW.policy_version=(
    SELECT pv.version_no FROM referral_policy_version pv
     WHERE pv.root_realm_id=programme.root_realm_id
      AND pv.programme_id=programme.id AND pv.effective_from<=now()
     ORDER BY pv.effective_from DESC,pv.version_no DESC LIMIT 1)
   AND wallet.earned_points-wallet.reversed_points-wallet.held_points-wallet.spent_points>=GREATEST(
    NEW.points_cost,
    (SELECT pv.minimum_claim_points FROM referral_policy_version pv
     WHERE pv.root_realm_id=NEW.root_realm_id AND pv.programme_id=NEW.programme_id
      AND pv.version_no=NEW.policy_version))
   AND (
     (NEW.relationship_kind='MEMBER' AND EXISTS(
      SELECT 1 FROM member m JOIN membership_term term
       ON term.root_realm_id=m.root_realm_id AND term.member_id=m.id
      WHERE m.root_realm_id=wallet.root_realm_id AND m.id=NEW.relationship_ref
       AND m.account_ref=NEW.recipient_account_ref AND m.status='ACTIVE'
       AND (m.branch_ref IS NULL OR EXISTS(
        SELECT 1 FROM branch br WHERE br.root_realm_id=m.root_realm_id
         AND br.id=m.branch_ref AND br.status='ACTIVE'))
       AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date
       AND (term.expires_on IS NULL
         OR term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date)
     ))
     OR (NEW.relationship_kind='VOLUNTEER' AND EXISTS(
      SELECT 1 FROM volunteer v WHERE v.root_realm_id=wallet.root_realm_id
       AND v.id=NEW.relationship_ref AND v.account_ref=NEW.recipient_account_ref
       AND v.status='ACTIVE'
       AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)
     ))
   )
  FOR UPDATE OF wallet
 ) THEN RAISE EXCEPTION 'Current eligible digital product, member and points are required'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER cg13_digital_redemption_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON redemption
 FOR EACH ROW EXECUTE FUNCTION cg13_digital_redemption_guard();

CREATE FUNCTION cg13_redemption_commit_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM points_event e JOIN redemption_event receipt
   ON receipt.root_realm_id=e.root_realm_id
    AND receipt.original_points_event_id=e.id AND receipt.redemption_id=NEW.id
  WHERE e.root_realm_id=NEW.root_realm_id AND e.redemption_id=NEW.id
   AND e.points_account_id=NEW.points_account_id
   AND e.event_kind='POINTS_HOLD' AND e.points_delta=NEW.points_cost
   AND receipt.event_kind='REQUESTED'
 ) THEN RAISE EXCEPTION 'Original points hold and source receipt required'; END IF;
 IF NEW.state='CANCELLED' AND NOT EXISTS(
  SELECT 1 FROM points_event e JOIN redemption_event receipt
   ON receipt.root_realm_id=e.root_realm_id
    AND receipt.original_points_event_id=e.id AND receipt.redemption_id=NEW.id
  WHERE e.root_realm_id=NEW.root_realm_id AND e.redemption_id=NEW.id
   AND e.points_account_id=NEW.points_account_id
   AND e.event_kind='POINTS_RELEASE' AND e.points_delta=-NEW.points_cost
   AND receipt.event_kind='CANCELLED'
 ) THEN RAISE EXCEPTION 'Cancelled redemption needs exact original points release'; END IF;
 RETURN NULL;
END; $cg13$;
CREATE CONSTRAINT TRIGGER cg13_redemption_commit
 AFTER INSERT OR UPDATE ON redemption DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg13_redemption_commit_guard();
