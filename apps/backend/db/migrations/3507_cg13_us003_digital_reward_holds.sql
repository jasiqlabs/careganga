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
 product_type text NOT NULL CHECK(product_type IN('DIGITAL','PHYSICAL')),
 points_cost bigint NOT NULL CHECK(points_cost>0 AND points_cost<=1000000000000),
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'HELD'
  CHECK(state IN('HELD','CANCELLED','ISSUED_AWAITING_HANDOVER','FULFILLED')),
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
 event_kind text NOT NULL CHECK(event_kind IN('REQUESTED','CANCELLED','RECOGNIZED','HANDED_OVER')),
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
    OR NEW.revision<>OLD.revision+1
    OR NOT (
     (OLD.state='HELD' AND NEW.state='ISSUED_AWAITING_HANDOVER'
      AND NEW.product_type='PHYSICAL'
      AND NEW.cancelled_at IS NULL AND NEW.fulfilled_at IS NULL
      AND EXISTS(
       SELECT 1 FROM stock_reward_hold h
       JOIN stock_reward_hold_event issued
        ON issued.root_realm_id=h.root_realm_id AND issued.hold_id=h.id
        AND issued.event_kind='ISSUED'
       JOIN stock_event stock ON stock.root_realm_id=issued.root_realm_id
        AND stock.id=issued.original_stock_event_id
       JOIN stock_operation_draft op ON op.root_realm_id=stock.root_realm_id
        AND op.id=stock.operation_id
       WHERE h.root_realm_id=NEW.root_realm_id AND h.redemption_id=NEW.id
        AND h.state='ISSUED' AND issued.source_key=h.issue_key
        AND stock.event_kind='ISSUE' AND stock.source_event_key=h.issue_key
        AND op.reward_hold_id=h.id AND op.status='CONFIRMED'))
     OR
     (OLD.state='HELD' AND NEW.state='CANCELLED'
      AND NEW.cancelled_at IS NOT NULL AND NEW.fulfilled_at IS NULL
      AND (NEW.product_type='DIGITAL' OR EXISTS(
       SELECT 1 FROM stock_reward_hold h
       WHERE h.root_realm_id=NEW.root_realm_id AND h.redemption_id=NEW.id
        AND h.recipient_account_ref=NEW.recipient_account_ref
        AND h.state='RELEASED')))
     OR
     (OLD.state='ISSUED_AWAITING_HANDOVER' AND NEW.state='FULFILLED'
      AND NEW.product_type='PHYSICAL'
      AND NEW.cancelled_at IS NULL AND NEW.fulfilled_at IS NOT NULL
      AND EXISTS(
       SELECT 1 FROM cg19_reward_handover actual
       WHERE actual.realm_id=NEW.root_realm_id
        AND actual.redemption_id=NEW.id
        AND actual.recipient_account_ref=NEW.recipient_account_ref
        AND actual.source_key=NEW.request_key))
     OR
     (OLD.state='HELD' AND NEW.state='FULFILLED'
      AND NEW.product_type='DIGITAL'
      AND NEW.cancelled_at IS NULL AND NEW.fulfilled_at IS NOT NULL
      AND EXISTS(
       SELECT 1 FROM cg19_reward_recognition proof
       WHERE proof.realm_id=NEW.root_realm_id AND proof.redemption_id=NEW.id
        AND proof.recipient_account_ref=NEW.recipient_account_ref
        AND proof.source_key=NEW.request_key
        AND proof.product_id=NEW.product_id
        AND proof.product_revision=NEW.product_revision))
    )
  THEN RAISE EXCEPTION 'Digital redemption requires exact verified original source transition'; END IF;
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
   AND product.product_type=NEW.product_type
   -- 3508 supplies this current CG19 delivery-method column before first
   -- operational redemption. PL/pgSQL query planning occurs at execution.
   -- Do not permit a database caller to hold points for future-only DIGITAL.
   AND (NEW.product_type='PHYSICAL' OR
    product.digital_fulfillment_method='ON_PLATFORM_RECOGNITION')
   AND product.status='ACTIVE' AND product.public_visible
   AND (programme.audience='BOTH' OR programme.audience=NEW.relationship_kind)
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
 IF NEW.state='FULFILLED' AND NOT EXISTS(
  SELECT 1 FROM points_event e JOIN redemption_event receipt
   ON receipt.root_realm_id=e.root_realm_id
    AND receipt.original_points_event_id=e.id AND receipt.redemption_id=NEW.id
  LEFT JOIN cg19_reward_recognition proof ON proof.realm_id=NEW.root_realm_id
   AND proof.redemption_id=NEW.id
  LEFT JOIN cg19_reward_handover actual ON actual.realm_id=NEW.root_realm_id
   AND actual.redemption_id=NEW.id
  WHERE e.root_realm_id=NEW.root_realm_id AND e.redemption_id=NEW.id
   AND e.points_account_id=NEW.points_account_id
   AND e.event_kind='POINTS_SPENT' AND e.points_delta=NEW.points_cost
   AND e.policy_version=NEW.policy_version
   AND e.qualifying_source_digest=NEW.payload_digest
   AND ((NEW.product_type='DIGITAL'
    AND receipt.event_kind='RECOGNIZED'
    AND proof.recipient_account_ref=NEW.recipient_account_ref
    AND proof.source_key=NEW.request_key)
    OR (NEW.product_type='PHYSICAL'
    AND receipt.event_kind='HANDED_OVER'
    AND actual.recipient_account_ref=NEW.recipient_account_ref
    AND actual.source_key=NEW.request_key))
 ) THEN RAISE EXCEPTION 'Delivered reward needs exact spent points and original CG19 recipient proof'; END IF;
 IF NEW.product_type='PHYSICAL' AND NOT EXISTS(
  SELECT 1 FROM stock_reward_hold h
  JOIN reward_product_revision p ON p.root_realm_id=NEW.root_realm_id
   AND p.product_id=NEW.product_id AND p.revision=NEW.product_revision
  WHERE h.root_realm_id=NEW.root_realm_id AND h.redemption_id=NEW.id
   AND h.recipient_account_ref=NEW.recipient_account_ref
   AND h.item_id=p.cg12_item_ref AND h.location_id=p.cg12_location_ref
   AND ((NEW.state='HELD' AND h.state='HELD')
    OR (NEW.state='CANCELLED' AND h.state='RELEASED')
    OR (NEW.state='ISSUED_AWAITING_HANDOVER' AND h.state='ISSUED')
    OR (NEW.state='FULFILLED' AND h.state='ISSUED'))
 ) THEN RAISE EXCEPTION 'Original CG12 one-unit reservation source required'; END IF;
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
