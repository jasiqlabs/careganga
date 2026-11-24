-- CG13 US002 QA01/02: original, reusable opaque referral code for a real
-- active CG04 member/volunteer relationship. A code is a non-authenticating
-- pointer, NEVER a CG01 credential or qualification/points award.
-- No synthetic CG04 account, source event, points, payment or branch ownership.
CREATE TABLE referral_code (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL,
 referrer_kind text NOT NULL CHECK(referrer_kind IN ('MEMBER','VOLUNTEER')),
 referrer_relationship_ref uuid NOT NULL,
 referrer_account_ref uuid NOT NULL,
 code_value text NOT NULL CHECK(code_value ~ '^[A-Za-z0-9_-]{32}$'),
 issued_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,programme_id,referrer_kind,referrer_relationship_ref),
 UNIQUE(code_value),
 FOREIGN KEY(root_realm_id,programme_id)
  REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(referrer_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg13_referral_code_owner
 ON referral_code(root_realm_id,referrer_account_ref,referrer_kind,programme_id,id);
CREATE INDEX ix_cg13_referral_code_program
 ON referral_code(root_realm_id,programme_id,referrer_kind,id);
-- Direct SQL cannot fabricate a code for another actor, disabled programme,
-- closed branch, expired member term or nonverified volunteer.
CREATE FUNCTION cg13_referral_code_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM referral_program p
  JOIN LATERAL (
   SELECT 1 FROM referral_policy_version policy
    WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.id
     AND policy.effective_from<=now() LIMIT 1
  ) current_policy ON true
  WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.programme_id
    AND p.status='ACTIVE'
    AND (p.audience=NEW.referrer_kind OR p.audience='BOTH')
 ) THEN RAISE EXCEPTION 'Original active referral programme is required'; END IF;
 IF NEW.referrer_kind='MEMBER' THEN
  IF NOT EXISTS(
   SELECT 1 FROM member m
   JOIN membership_application_effect effect ON effect.root_realm_id=m.root_realm_id
    AND effect.member_id=m.id AND effect.application_id=m.original_application_id
   JOIN membership_application app ON app.root_realm_id=m.root_realm_id
    AND app.id=m.original_application_id AND app.status='APPROVED'
   JOIN cg03_case review ON review.realm_id=effect.root_realm_id
    AND review.id=effect.case_id AND review.status='OWNER_COMPLETED'
   JOIN account verified ON verified.realm_id=m.root_realm_id
    AND verified.id=m.account_ref AND verified.status='ACTIVE'
    AND verified.contact_phone_verified_at IS NOT NULL
   JOIN membership_term term
    ON term.root_realm_id=m.root_realm_id AND term.member_id=m.id
   LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref
   WHERE m.root_realm_id=NEW.root_realm_id
    AND m.id=NEW.referrer_relationship_ref
    AND m.account_ref=NEW.referrer_account_ref AND m.status='ACTIVE'
    AND (m.branch_ref IS NULL OR b.status='ACTIVE')
    AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date
    AND (term.expires_on IS NULL OR
      term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date)
  ) THEN RAISE EXCEPTION 'Original active member required'; END IF;
 ELSE
  IF NOT EXISTS(
   SELECT 1 FROM volunteer v WHERE v.root_realm_id=NEW.root_realm_id
    AND v.id=NEW.referrer_relationship_ref
    AND v.account_ref=NEW.referrer_account_ref AND v.status='ACTIVE'
    AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)
  ) THEN RAISE EXCEPTION 'Original active volunteer required'; END IF;
 END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER cg13_referral_code_insert_guard
 BEFORE INSERT ON referral_code FOR EACH ROW
 EXECUTE FUNCTION cg13_referral_code_source_guard();
CREATE TRIGGER cg13_referral_code_immutable
 BEFORE UPDATE OR DELETE ON referral_code FOR EACH ROW
 EXECUTE FUNCTION cg13_immutable_source();
