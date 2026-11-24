-- CG13 US002-QA03: anonymous code resolution is NOT authentication or a
-- qualification/points award. Retain only HMAC(IP) counters, never applicant
-- or referrer PII, device fingerprint, raw IP or looked-up code.
CREATE TABLE cg13_referral_resolve_attempt (
 key_digest char(64) PRIMARY KEY CHECK(key_digest ~ '^[0-9a-f]{64}$'),
 window_started_at timestamptz NOT NULL DEFAULT now(),
 attempt_count integer NOT NULL DEFAULT 1 CHECK(attempt_count BETWEEN 1 AND 2147483647)
);
CREATE INDEX ix_cg13_resolve_attempt_age
 ON cg13_referral_resolve_attempt(window_started_at,key_digest);
-- Root-scoped, current-CG04 eligibility proof reused by anonymous resolution
-- and future trusted CG04 application attribution. Never return account/branch.
CREATE FUNCTION cg13_referral_code_current(root uuid,opaque text)
 RETURNS boolean LANGUAGE sql STABLE AS $cg13$
 SELECT EXISTS(
  SELECT 1 FROM referral_code c
  JOIN referral_program p ON p.root_realm_id=c.root_realm_id AND p.id=c.programme_id
  WHERE c.root_realm_id=root AND c.code_value=opaque AND p.status='ACTIVE'
  AND (p.audience=c.referrer_kind OR p.audience='BOTH')
  AND EXISTS(SELECT 1 FROM referral_policy_version policy
   WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.id
    AND policy.effective_from<=now())
  AND (
   (c.referrer_kind='MEMBER' AND EXISTS(
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
    JOIN membership_term term ON term.root_realm_id=m.root_realm_id
     AND term.member_id=m.id
    LEFT JOIN branch branch ON branch.root_realm_id=m.root_realm_id
     AND branch.id=m.branch_ref
    WHERE m.root_realm_id=c.root_realm_id AND m.id=c.referrer_relationship_ref
     AND m.account_ref=c.referrer_account_ref AND m.status='ACTIVE'
     AND (m.branch_ref IS NULL OR branch.status='ACTIVE')
     AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date
     AND (term.expires_on IS NULL OR
      term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date)
   )) OR
   (c.referrer_kind='VOLUNTEER' AND EXISTS(
    SELECT 1 FROM volunteer v WHERE v.root_realm_id=c.root_realm_id
     AND v.id=c.referrer_relationship_ref AND v.account_ref=c.referrer_account_ref
     AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)
   ))
  )
 );
$cg13$;
