-- CG13 US002 QA09-13: immutable awarded points and rank snapshots.
-- Only original committed CG04 ACTIVE member/volunteer activation is a
-- qualifying event; no public caller may assert verified=true.
-- All inserts are Foundation-root scoped. No money/CG09 payout or CG12 stock.
CREATE TABLE points_account (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL,
 referrer_kind text NOT NULL CHECK(referrer_kind IN('MEMBER','VOLUNTEER')),
 referrer_relationship_ref uuid NOT NULL,
 referrer_account_ref uuid NOT NULL,
 earned_points bigint NOT NULL DEFAULT 0 CHECK(earned_points>=0),
 reversed_points bigint NOT NULL DEFAULT 0 CHECK(reversed_points>=0),
 held_points bigint NOT NULL DEFAULT 0 CHECK(held_points>=0),
 spent_points bigint NOT NULL DEFAULT 0 CHECK(spent_points>=0),
 qualified_referrals integer NOT NULL DEFAULT 0 CHECK(qualified_referrals>=0),
 current_rank_name text,
 current_rank_sort smallint,
 current_rank_policy_version integer,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,programme_id,referrer_kind,referrer_relationship_ref),
 FOREIGN KEY(root_realm_id,programme_id)
  REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(referrer_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,programme_id,current_rank_policy_version)
  REFERENCES referral_policy_version(root_realm_id,programme_id,version_no)
  ON DELETE RESTRICT,
 CHECK(reversed_points<=earned_points),
 CHECK((current_rank_name IS NULL AND current_rank_sort IS NULL AND current_rank_policy_version IS NULL)
   OR (current_rank_name IS NOT NULL AND current_rank_sort BETWEEN 1 AND 30
     AND current_rank_policy_version IS NOT NULL))
);
CREATE INDEX ix_cg13_points_wallet_owner
 ON points_account(root_realm_id,referrer_account_ref,programme_id,id);

CREATE TABLE points_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 points_account_id uuid NOT NULL,
 attribution_id uuid,
 redemption_id uuid,
 event_kind text NOT NULL CHECK(event_kind IN(
  'QUALIFICATION','QUALIFICATION_REVERSAL','POINTS_HOLD','POINTS_RELEASE','POINTS_SPENT')),
 policy_version integer NOT NULL CHECK(policy_version>0),
 points_delta bigint NOT NULL CHECK(points_delta<>0 AND abs(points_delta)<=1000000000000),
 qualifying_source_digest char(64) NOT NULL CHECK(qualifying_source_digest ~ '^[0-9a-f]{64}$'),
 source_recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,attribution_id,event_kind),
 FOREIGN KEY(root_realm_id,points_account_id)
  REFERENCES points_account(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attribution_id)
  REFERENCES referral_attribution(root_realm_id,id) ON DELETE RESTRICT,
 CHECK(((event_kind='QUALIFICATION' AND points_delta>0)
   OR (event_kind='QUALIFICATION_REVERSAL' AND points_delta<0))
   AND attribution_id IS NOT NULL AND redemption_id IS NULL
   OR (event_kind IN('POINTS_HOLD','POINTS_SPENT') AND points_delta>0
       AND redemption_id IS NOT NULL AND attribution_id IS NULL)
   OR (event_kind='POINTS_RELEASE' AND points_delta<0
       AND redemption_id IS NOT NULL AND attribution_id IS NULL))
);
CREATE INDEX ix_cg13_points_event_account_page
 ON points_event(root_realm_id,points_account_id,source_recorded_at DESC,id DESC);

CREATE TABLE reward_rank_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 points_account_id uuid NOT NULL,
 qualifying_points_event_id uuid NOT NULL,
 policy_version integer NOT NULL,
 prior_rank_name text,
 resulting_rank_name text,
 resulting_rank_sort smallint,
 qualified_referrals_snapshot integer NOT NULL CHECK(qualified_referrals_snapshot>=0),
 eligible_points_snapshot bigint NOT NULL CHECK(eligible_points_snapshot>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,qualifying_points_event_id),
 FOREIGN KEY(root_realm_id,points_account_id)
  REFERENCES points_account(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,qualifying_points_event_id)
  REFERENCES points_event(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((resulting_rank_name IS NULL AND resulting_rank_sort IS NULL)
  OR (resulting_rank_name IS NOT NULL AND resulting_rank_sort BETWEEN 1 AND 30))
);
CREATE INDEX ix_cg13_rank_history
 ON reward_rank_event(root_realm_id,points_account_id,created_at DESC,id DESC);

-- For credits, do not accept any fabricated caller-declared qualification.
-- Reference the ORIGINAL effective CG03/CG04/CG09 activation source and frozen
-- submission digest under this very same root and transaction.
CREATE FUNCTION cg13_points_event_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 -- US003 uses this SAME immutable points_event table. Digital requests are
 -- checked against the original eligible reward and locked wallet via the
 -- independently guarded redemption table created in forward migration 3507.
 IF NEW.event_kind='POINTS_SPENT' THEN
  IF NOT EXISTS(
   SELECT 1 FROM redemption r
   JOIN points_account wallet ON wallet.root_realm_id=r.root_realm_id
    AND wallet.id=r.points_account_id
   WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.redemption_id
    AND r.state='FULFILLED'
    AND r.points_account_id=NEW.points_account_id
    AND wallet.referrer_account_ref=r.recipient_account_ref
    AND r.policy_version=NEW.policy_version
    AND r.payload_digest=NEW.qualifying_source_digest
    AND r.points_cost=NEW.points_delta
    AND (
     (r.product_type='DIGITAL' AND EXISTS(
      SELECT 1 FROM cg19_reward_recognition proof
      JOIN reward_product_revision product ON product.root_realm_id=r.root_realm_id
       AND product.product_id=r.product_id AND product.revision=r.product_revision
      WHERE proof.realm_id=r.root_realm_id AND proof.redemption_id=r.id
       AND proof.recipient_account_ref=r.recipient_account_ref
       AND proof.source_key=r.request_key
       AND product.digital_fulfillment_method='ON_PLATFORM_RECOGNITION'))
     OR
     (r.product_type='PHYSICAL' AND EXISTS(
      SELECT 1 FROM cg19_reward_handover proof
      JOIN stock_reward_hold hold ON hold.root_realm_id=r.root_realm_id
       AND hold.redemption_id=r.id AND hold.state='ISSUED'
      JOIN stock_reward_hold_event issued ON issued.root_realm_id=hold.root_realm_id
       AND issued.hold_id=hold.id AND issued.event_kind='ISSUED'
       AND issued.source_key=hold.issue_key
      WHERE proof.realm_id=r.root_realm_id AND proof.redemption_id=r.id
       AND proof.recipient_account_ref=r.recipient_account_ref
       AND proof.source_key=r.request_key
       AND proof.stock_issue_event_id=issued.original_stock_event_id))
    )
  ) THEN RAISE EXCEPTION 'Original CG19 acknowledged reward proof and genuine CG12 ISSUE required to spend points'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.event_kind IN('POINTS_HOLD','POINTS_RELEASE') THEN
  IF NOT EXISTS(
   SELECT 1 FROM redemption r JOIN points_account wallet
    ON wallet.root_realm_id=r.root_realm_id AND wallet.id=r.points_account_id
   WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.redemption_id
    AND wallet.id=NEW.points_account_id
    AND wallet.referrer_account_ref=r.recipient_account_ref
    AND r.policy_version=NEW.policy_version
    AND r.payload_digest=NEW.qualifying_source_digest
    AND ((NEW.event_kind='POINTS_HOLD' AND r.state='HELD'
      AND NEW.points_delta=r.points_cost)
     OR (NEW.event_kind='POINTS_RELEASE' AND r.state='CANCELLED'
      AND NEW.points_delta=-r.points_cost))
  ) THEN RAISE EXCEPTION 'Verified original redemption points source required'; END IF;
  RETURN NEW;
 END IF;
 -- No DIGITAL entitlement/CG19 issued proof or CG12 physical issue owner
 -- is yet available; refuse fabricated spend and post-activation reversal.
 IF NEW.event_kind<>'QUALIFICATION' THEN
  RAISE EXCEPTION 'An original verified reward or reversal effect is required';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM referral_attribution att
  JOIN points_account wallet ON wallet.root_realm_id=att.root_realm_id
   AND wallet.programme_id=att.programme_id AND wallet.referrer_kind=att.referrer_kind
   AND wallet.referrer_relationship_ref=att.referrer_relationship_ref
   AND wallet.referrer_account_ref=att.referrer_account_ref
  WHERE att.root_realm_id=NEW.root_realm_id AND att.id=NEW.attribution_id
   AND wallet.id=NEW.points_account_id AND att.state='PENDING'
   AND att.policy_version=NEW.policy_version
   AND att.award_points=NEW.points_delta
   -- The first attribution remains immutable across a returned/corrected
   -- application; the credit must instead match the CURRENT approved digest.
   AND cg13_referral_code_current(att.root_realm_id,
       (SELECT code_value FROM referral_code WHERE root_realm_id=att.root_realm_id
        AND id=att.referral_code_ref))
   AND (
    (att.applicant_kind='MEMBER' AND EXISTS(
      SELECT 1 FROM membership_application app
      JOIN member m ON m.root_realm_id=app.root_realm_id
       AND m.original_application_id=app.id
       AND m.account_ref=att.applicant_account_ref AND m.status='ACTIVE'
      JOIN membership_application_effect effect
       ON effect.root_realm_id=m.root_realm_id AND effect.member_id=m.id
       AND effect.application_id=app.id
      JOIN membership_term term ON term.root_realm_id=m.root_realm_id
       AND term.member_id=m.id AND term.original_application_id=app.id
      JOIN cg03_case review ON review.realm_id=effect.root_realm_id
       AND review.id=effect.case_id AND review.status='OWNER_COMPLETED'
      WHERE app.root_realm_id=att.root_realm_id AND app.id=att.member_application_ref
       AND app.status='APPROVED' AND app.submitted_digest=NEW.qualifying_source_digest
       AND app.referral_input=(SELECT code_value FROM referral_code code
        WHERE code.root_realm_id=att.root_realm_id AND code.id=att.referral_code_ref)
       AND app.applicant_account_ref=att.applicant_account_ref
       AND (app.accepted_fee_minor=0 OR EXISTS(
        SELECT 1 FROM finance_membership_verified_collection paid
         WHERE paid.root_realm_id=app.root_realm_id AND paid.application_id=app.id
          AND paid.amount_minor=app.accepted_fee_minor))
       AND NOT EXISTS(
        SELECT 1 FROM finance_membership_verified_refund refunded
         WHERE refunded.root_realm_id=app.root_realm_id AND refunded.application_id=app.id)
    ))
    OR
    (att.applicant_kind='VOLUNTEER' AND EXISTS(
      SELECT 1 FROM volunteer_application app
      JOIN volunteer v ON v.root_realm_id=app.root_realm_id
       AND v.original_application_id=app.id AND v.account_ref=att.applicant_account_ref
      JOIN volunteer_approval_effect effect ON effect.root_realm_id=v.root_realm_id
       AND effect.application_id=app.id AND effect.volunteer_id=v.id
      JOIN cg03_case review ON review.realm_id=effect.root_realm_id
       AND review.id=effect.case_id AND review.status='OWNER_COMPLETED'
      WHERE app.root_realm_id=att.root_realm_id
       AND app.id=att.volunteer_application_ref AND app.status='APPROVED'
       AND app.submitted_digest=NEW.qualifying_source_digest
       AND app.referral_input=(SELECT code_value FROM referral_code code
        WHERE code.root_realm_id=att.root_realm_id AND code.id=att.referral_code_ref)
       AND app.applicant_account_ref=att.applicant_account_ref
       AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)
    ))
   )
 ) THEN RAISE EXCEPTION 'Original verified CG04 activation required for referral credit'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER cg13_points_credit_guard
 BEFORE INSERT ON points_event FOR EACH ROW EXECUTE FUNCTION cg13_points_event_source_guard();

CREATE TRIGGER cg13_points_event_immutable
 BEFORE UPDATE OR DELETE ON points_event FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
CREATE TRIGGER cg13_rank_event_immutable
 BEFORE UPDATE OR DELETE ON reward_rank_event FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();


-- A rank receipt is not an arbitrary editable badge. At the instant of the
-- genuine qualifying award it must match that SAME immutable points event,
-- its original wallet, pinned policy and committed projection. The historical
-- receipt can then remain unchanged when later activity changes the wallet.
CREATE FUNCTION cg13_rank_event_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM points_event e JOIN points_account wallet
   ON wallet.root_realm_id=e.root_realm_id AND wallet.id=e.points_account_id
  WHERE e.root_realm_id=NEW.root_realm_id
   AND e.id=NEW.qualifying_points_event_id
   AND e.points_account_id=NEW.points_account_id
   AND e.event_kind='QUALIFICATION'
   AND e.policy_version=NEW.policy_version
   AND wallet.current_rank_name IS NOT DISTINCT FROM NEW.resulting_rank_name
   AND wallet.current_rank_sort IS NOT DISTINCT FROM NEW.resulting_rank_sort
   AND wallet.qualified_referrals=NEW.qualified_referrals_snapshot
   AND GREATEST(wallet.earned_points-wallet.reversed_points-
    wallet.held_points-wallet.spent_points,0)=NEW.eligible_points_snapshot
 ) THEN RAISE EXCEPTION 'Frozen rank requires exact genuine wallet award and projection'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER cg13_rank_event_insert_guard
 BEFORE INSERT ON reward_rank_event FOR EACH ROW
 EXECUTE FUNCTION cg13_rank_event_source_guard();

-- Prevent direct writes to the materialized account projection without a
-- corresponding validated immutable source event. Check at COMMIT, allowing
-- one short trusted transaction to insert event, update wallet and rank.
CREATE FUNCTION cg13_points_projection_at_commit()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
DECLARE wallet uuid; realm uuid; current_account record; totals record;
BEGIN
 -- Each trigger's NEW row has a DIFFERENT record type. Do not evaluate
 -- nonexistent fields in a shared CASE expression on the other table.
 IF TG_TABLE_NAME='points_event' THEN
  wallet:=NEW.points_account_id;
 ELSE
  wallet:=NEW.id;
 END IF;
 realm:=NEW.root_realm_id;
 SELECT * INTO current_account FROM points_account
  WHERE root_realm_id=realm AND id=wallet;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original points wallet is required'; END IF;
 SELECT COALESCE(SUM(points_delta) FILTER(WHERE event_kind='QUALIFICATION'),0)::bigint AS earned,
  COALESCE(-SUM(points_delta) FILTER(WHERE event_kind='QUALIFICATION_REVERSAL'),0)::bigint AS reversed,
  COUNT(*) FILTER(WHERE event_kind='QUALIFICATION')::integer-
   COUNT(*) FILTER(WHERE event_kind='QUALIFICATION_REVERSAL')::integer AS qualifying_count,
  COALESCE(SUM(points_delta) FILTER(WHERE event_kind='POINTS_HOLD'),0)::bigint+
   COALESCE(SUM(points_delta) FILTER(WHERE event_kind='POINTS_RELEASE'),0)::bigint-
   COALESCE(SUM(points_delta) FILTER(WHERE event_kind='POINTS_SPENT'),0)::bigint AS held,
  COALESCE(SUM(points_delta) FILTER(WHERE event_kind='POINTS_SPENT'),0)::bigint AS spent
  INTO totals FROM points_event WHERE root_realm_id=realm AND points_account_id=wallet;
 IF (current_account.earned_points,current_account.reversed_points,
    current_account.qualified_referrals,current_account.held_points,
    current_account.spent_points)
   IS DISTINCT FROM (totals.earned,totals.reversed,totals.qualifying_count,
    totals.held,totals.spent)
 THEN RAISE EXCEPTION 'Points account must match original immutable events'; END IF;
 IF TG_TABLE_NAME='points_event' AND NEW.event_kind='QUALIFICATION' AND NOT EXISTS(
  SELECT 1 FROM reward_rank_event rank
   WHERE rank.root_realm_id=realm AND rank.points_account_id=wallet
    AND rank.qualifying_points_event_id=NEW.id
 ) THEN RAISE EXCEPTION 'Verified points award requires frozen rank snapshot'; END IF;
 RETURN NULL;
END; $cg13$;
CREATE CONSTRAINT TRIGGER cg13_points_account_projection_commit
 AFTER INSERT OR UPDATE ON points_account DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg13_points_projection_at_commit();
CREATE CONSTRAINT TRIGGER cg13_points_event_projection_commit
 AFTER INSERT ON points_event DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg13_points_projection_at_commit();
