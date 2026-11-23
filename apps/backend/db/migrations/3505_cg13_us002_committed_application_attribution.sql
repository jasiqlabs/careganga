-- CG13 US002 QA04-08/12/13: freeze ONE genuine validated referral source
-- inside the original CG04/CG03 committed application submission transaction.
-- A referral click, draft edit, identity guess or public code lookup NEVER
-- produces attribution or points. This source is pending qualification only.
CREATE TABLE referral_attribution (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL,
 applicant_kind text NOT NULL CHECK(applicant_kind IN('MEMBER','VOLUNTEER')),
 member_application_ref uuid,
 volunteer_application_ref uuid,
 applicant_account_ref uuid NOT NULL,
 referral_code_ref uuid NOT NULL,
 referrer_account_ref uuid NOT NULL,
 referrer_kind text NOT NULL CHECK(referrer_kind IN('MEMBER','VOLUNTEER')),
 referrer_relationship_ref uuid NOT NULL,
 application_revision integer NOT NULL CHECK(application_revision>1),
 submitted_digest char(64) NOT NULL CHECK(submitted_digest ~ '^[0-9a-f]{64}$'),
 original_submit_key uuid NOT NULL,
 policy_version integer NOT NULL CHECK(policy_version>0),
 qualifying_event text NOT NULL CHECK(qualifying_event IN
   ('MEMBERSHIP_ACTIVATED_VERIFIED','VOLUNTEER_APPROVED_ACTIVE')),
 award_points bigint NOT NULL CHECK(award_points BETWEEN 1 AND 1000000000),
 state text NOT NULL DEFAULT 'PENDING'
  CHECK(state IN('PENDING','HELD_FRAUD_REVIEW')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,programme_id,applicant_account_ref),

 UNIQUE(root_realm_id,original_submit_key),
 FOREIGN KEY(root_realm_id,programme_id)
  REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,referral_code_ref)
  REFERENCES referral_code(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(applicant_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(referrer_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,member_application_ref)
  REFERENCES membership_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,volunteer_application_ref)
  REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,programme_id,policy_version)
  REFERENCES referral_policy_version(root_realm_id,programme_id,version_no),
 CHECK((applicant_kind='MEMBER' AND member_application_ref IS NOT NULL
  AND volunteer_application_ref IS NULL)
  OR (applicant_kind='VOLUNTEER' AND volunteer_application_ref IS NOT NULL
  AND member_application_ref IS NULL)),
 CHECK(applicant_account_ref<>referrer_account_ref),
 CHECK((qualifying_event='MEMBERSHIP_ACTIVATED_VERIFIED' AND applicant_kind='MEMBER')
   OR (qualifying_event='VOLUNTEER_APPROVED_ACTIVE' AND applicant_kind='VOLUNTEER'))
);
-- NULL in either polymorphic application column cannot weaken uniqueness.
CREATE UNIQUE INDEX ux_cg13_attribution_member_application
 ON referral_attribution(root_realm_id,member_application_ref)
 WHERE applicant_kind='MEMBER';
CREATE UNIQUE INDEX ux_cg13_attribution_volunteer_application
 ON referral_attribution(root_realm_id,volunteer_application_ref)
 WHERE applicant_kind='VOLUNTEER';
CREATE INDEX ix_cg13_attribution_event_due
 ON referral_attribution(root_realm_id,applicant_kind,state,recorded_at,id);
CREATE INDEX ix_cg13_attribution_referrer_private
 ON referral_attribution(root_realm_id,referrer_account_ref,programme_id,recorded_at DESC,id DESC);
CREATE FUNCTION cg13_committed_attribution_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM referral_code code
    WHERE code.root_realm_id=NEW.root_realm_id
     AND code.id=NEW.referral_code_ref AND code.programme_id=NEW.programme_id
     AND code.referrer_account_ref=NEW.referrer_account_ref
     AND code.referrer_kind=NEW.referrer_kind
     AND code.referrer_relationship_ref=NEW.referrer_relationship_ref
     AND cg13_referral_code_current(code.root_realm_id,code.code_value)
 ) THEN RAISE EXCEPTION 'Current verified referral code source required'; END IF;
 IF NEW.applicant_kind='MEMBER' THEN
  IF NOT EXISTS(SELECT 1 FROM membership_application app
   JOIN referral_code code ON code.root_realm_id=app.root_realm_id
    AND code.id=NEW.referral_code_ref
   WHERE app.root_realm_id=NEW.root_realm_id
    AND app.id=NEW.member_application_ref
    AND app.applicant_account_ref=NEW.applicant_account_ref
    AND app.status='SUBMITTED'
    AND app.version=NEW.application_revision
    AND app.submitted_digest=NEW.submitted_digest
    AND app.referral_input=code.code_value)
  THEN RAISE EXCEPTION 'Real committed member application referral source required'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM volunteer_application app
   JOIN referral_code code ON code.root_realm_id=app.root_realm_id
    AND code.id=NEW.referral_code_ref
   WHERE app.root_realm_id=NEW.root_realm_id
    AND app.id=NEW.volunteer_application_ref
    AND app.applicant_account_ref=NEW.applicant_account_ref
    AND app.status='SUBMITTED'
    AND app.version=NEW.application_revision
    AND app.submitted_digest=NEW.submitted_digest
    AND app.referral_input=code.code_value)
  THEN RAISE EXCEPTION 'Real committed volunteer application referral source required'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM referral_policy_version policy
  WHERE policy.root_realm_id=NEW.root_realm_id
   AND policy.programme_id=NEW.programme_id
   AND policy.version_no=NEW.policy_version
   AND policy.award_points=NEW.award_points
   AND policy.qualifying_event=NEW.qualifying_event
   AND policy.effective_from<=now())
 THEN RAISE EXCEPTION 'Frozen effective qualification rules required'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER cg13_attribution_commit_guard BEFORE INSERT ON referral_attribution
 FOR EACH ROW EXECUTE FUNCTION cg13_committed_attribution_guard();
CREATE TRIGGER cg13_attribution_immutable BEFORE UPDATE OR DELETE ON referral_attribution
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
