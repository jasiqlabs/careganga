-- CG04 US002 renewal: use the exact original approved application/effect,
-- not a new payment/approval/member master. No overlapping or backdated terms.
-- An already-approved historical application may coexist with one new draft.
DROP INDEX ux_cg04_one_open_application;
CREATE UNIQUE INDEX ux_cg04_one_open_application ON membership_application(root_realm_id,applicant_account_ref)
 WHERE status IN('DRAFT','SUBMITTED','RETURNED');
ALTER TABLE membership_application_effect ADD COLUMN effect_kind text NOT NULL DEFAULT 'ACTIVATE'
 CHECK(effect_kind IN('ACTIVATE','RENEW'));
CREATE OR REPLACE FUNCTION cg04_term_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE offer record;
BEGIN
 PERFORM 1 FROM member m WHERE m.root_realm_id=NEW.root_realm_id AND m.id=NEW.member_id FOR UPDATE;
 SELECT v.duration_unit,v.duration_count INTO offer FROM membership_application a JOIN membership_tier_version v ON v.root_realm_id=a.root_realm_id AND v.id=a.tier_version_id
 JOIN member m ON m.root_realm_id=a.root_realm_id AND (m.original_application_id=a.id OR (m.account_ref=a.applicant_account_ref AND m.status='ACTIVE' AND m.original_application_id<>a.id AND m.branch_ref IS NOT DISTINCT FROM a.branch_ref))
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.original_application_id AND m.id=NEW.member_id AND a.tier_version_id=NEW.tier_version_id AND a.accepted_fee_minor=NEW.fee_minor;
 IF NOT FOUND OR NOT cg04_member_approved_source(NEW.root_realm_id,NEW.original_application_id)
 OR NEW.starts_on<> (
 SELECT CASE WHEN count(*)=0 THEN (now() AT TIME ZONE 'Asia/Kolkata')::date
 ELSE GREATEST((now() AT TIME ZONE 'Asia/Kolkata')::date,max(t.expires_on)) END
 FROM membership_term t WHERE t.root_realm_id=NEW.root_realm_id AND t.member_id=NEW.member_id)
 OR EXISTS(SELECT 1 FROM membership_term t WHERE t.root_realm_id=NEW.root_realm_id AND t.member_id=NEW.member_id
   AND (t.expires_on IS NULL OR t.starts_on>(now() AT TIME ZONE 'Asia/Kolkata')::date))
 OR NEW.expires_on IS DISTINCT FROM (CASE offer.duration_unit WHEN 'LIFETIME' THEN NULL::date WHEN 'DAY' THEN NEW.starts_on+offer.duration_count WHEN 'MONTH' THEN (NEW.starts_on+make_interval(months=>offer.duration_count))::date ELSE (NEW.starts_on+make_interval(years=>offer.duration_count))::date END)
 OR EXISTS(SELECT 1 FROM membership_term t WHERE t.root_realm_id=NEW.root_realm_id AND t.member_id=NEW.member_id AND daterange(t.starts_on,t.expires_on,'[)')&&daterange(NEW.starts_on,NEW.expires_on,'[)'))
 THEN RAISE EXCEPTION 'Original membership term, dates or amount invalid'; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION cg04_effect_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT cg04_member_approved_source(NEW.root_realm_id,NEW.application_id)
 OR NOT EXISTS(SELECT 1 FROM membership_application a JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.membership_application_id=a.id
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.action='APPROVE' AND d.accepted_case_revision=c.revision
 JOIN member m ON m.root_realm_id=a.root_realm_id AND ((NEW.effect_kind='ACTIVATE' AND m.original_application_id=a.id)
 OR (NEW.effect_kind='RENEW' AND m.original_application_id<>a.id AND m.account_ref=a.applicant_account_ref
 AND m.status='ACTIVE' AND m.branch_ref IS NOT DISTINCT FROM a.branch_ref))
 JOIN membership_term t ON t.root_realm_id=m.root_realm_id AND t.member_id=m.id AND t.original_application_id=a.id
 JOIN member_branch_history b ON b.root_realm_id=m.root_realm_id AND b.member_id=m.id AND b.branch_ref IS NOT DISTINCT FROM m.branch_ref AND b.effective_to IS NULL AND b.actor_ref=a.applicant_account_ref
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id AND c.id=NEW.case_id AND d.id=NEW.decision_id
 AND c.membership_application_version=NEW.pinned_review_revision AND c.membership_review_digest=NEW.source_digest
 AND m.id=NEW.member_id AND t.id=NEW.term_id AND NEW.actor_ref=a.applicant_account_ref
 AND ((a.accepted_fee_minor=0 AND NEW.fee_journal_id IS NULL) OR EXISTS(SELECT 1 FROM finance_membership_verified_collection v WHERE v.root_realm_id=a.root_realm_id AND v.application_id=a.id AND v.journal_id=NEW.fee_journal_id AND v.amount_minor=a.accepted_fee_minor)))
 THEN RAISE EXCEPTION 'Membership effect must match original approval, fee and term'; END IF;
 RETURN NEW;
END; $$;
CREATE INDEX ix_cg04_renewal_term_sequence ON membership_term(root_realm_id,member_id,starts_on DESC,id DESC);
-- The original immutable member stays the same. A second application can only
-- extend it through an original CG03 approval and new CG09 payment proof.
CREATE FUNCTION cg04_renewal_effect_completion_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.effect_kind='RENEW' AND NOT EXISTS(
  SELECT 1 FROM member m JOIN membership_term prior ON prior.root_realm_id=m.root_realm_id AND prior.member_id=m.id
  JOIN membership_term current_term ON current_term.root_realm_id=m.root_realm_id AND current_term.id=NEW.term_id
  WHERE m.root_realm_id=NEW.root_realm_id AND m.id=NEW.member_id
  AND m.original_application_id<>NEW.application_id AND m.status='ACTIVE'
  AND current_term.original_application_id=NEW.application_id
  AND prior.id<>current_term.id AND prior.expires_on IS NOT NULL
  AND prior.expires_on<=current_term.starts_on
 ) THEN RAISE EXCEPTION 'Original member and prior finite term required for renewal'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_renewal_effect_insert BEFORE INSERT ON membership_application_effect FOR EACH ROW
 EXECUTE FUNCTION cg04_renewal_effect_completion_guard();
