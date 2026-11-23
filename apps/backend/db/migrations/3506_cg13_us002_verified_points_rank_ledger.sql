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
 attribution_id uuid NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN('QUALIFICATION','QUALIFICATION_REVERSAL')),
 policy_version integer NOT NULL CHECK(policy_version>0),
 points_delta bigint NOT NULL CHECK(points_delta<>0 AND abs(points_delta)<=1000000000),
 qualifying_source_digest char(64) NOT NULL CHECK(qualifying_source_digest ~ '^[0-9a-f]{64}$'),
 source_recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,attribution_id,event_kind),
 FOREIGN KEY(root_realm_id,points_account_id)
  REFERENCES points_account(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attribution_id)
  REFERENCES referral_attribution(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((event_kind='QUALIFICATION' AND points_delta>0)
   OR (event_kind='QUALIFICATION_REVERSAL' AND points_delta<0))
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
 IF NEW.event_kind<>'QUALIFICATION' THEN
  RAISE EXCEPTION 'A verified original reversal adapter is required';
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
   AND att.submitted_digest=NEW.qualifying_source_digest
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
       AND app.status='APPROVED' AND app.submitted_digest=att.submitted_digest
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
       AND app.submitted_digest=att.submitted_digest
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
