-- CG04 member and term are original owner records. A review alone is
-- insufficient: the exact original fee must be verified or genuinely zero.
CREATE SEQUENCE cg04_member_number_seq AS bigint MINVALUE 1 START 1;
CREATE TABLE member(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 member_no text NOT NULL DEFAULT ('CG/MEM/'||to_char((now() AT TIME ZONE 'Asia/Kolkata')::date,'YYYY')||'/'||nextval('cg04_member_number_seq')),
 original_application_id uuid NOT NULL,account_ref uuid NOT NULL,
 display_name text NOT NULL,branch_ref uuid,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,member_no),UNIQUE(root_realm_id,original_application_id),UNIQUE(root_realm_id,account_ref),
 FOREIGN KEY(root_realm_id,original_application_id) REFERENCES membership_application(root_realm_id,id),
 FOREIGN KEY(account_ref,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id)
);
CREATE TABLE membership_term(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),member_id uuid NOT NULL,
 original_application_id uuid NOT NULL,tier_version_id uuid NOT NULL,
 fee_minor bigint NOT NULL CHECK(fee_minor>=0),currency char(3) NOT NULL CHECK(currency='INR'),
 starts_on date NOT NULL,expires_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,original_application_id),
 FOREIGN KEY(root_realm_id,member_id) REFERENCES member(root_realm_id,id),
 FOREIGN KEY(root_realm_id,original_application_id) REFERENCES membership_application(root_realm_id,id),
 FOREIGN KEY(root_realm_id,tier_version_id,fee_minor,currency) REFERENCES membership_tier_version(root_realm_id,id,fee_minor,currency),
 CHECK(expires_on IS NULL OR expires_on>starts_on)
);
CREATE INDEX ix_cg04_term_member_expiry ON membership_term(root_realm_id,member_id,starts_on DESC,expires_on);
CREATE TRIGGER cg04_term_immutable BEFORE UPDATE OR DELETE ON membership_term FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE TABLE member_branch_history(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),member_id uuid NOT NULL,
 branch_ref uuid,effective_from timestamptz NOT NULL DEFAULT now(),effective_to timestamptz,reason text NOT NULL,actor_ref uuid NOT NULL,
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,member_id) REFERENCES member(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id),
 CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX ux_cg04_member_branch_current ON member_branch_history(root_realm_id,member_id) WHERE effective_to IS NULL;
CREATE TABLE membership_application_effect(
 root_realm_id uuid NOT NULL,application_id uuid NOT NULL,case_id uuid NOT NULL,
 decision_id uuid NOT NULL,member_id uuid NOT NULL,term_id uuid NOT NULL,
 pinned_review_revision integer NOT NULL CHECK(pinned_review_revision>1),source_digest char(64) NOT NULL,
 fee_journal_id uuid,request_key uuid NOT NULL,actor_ref uuid NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),UNIQUE(root_realm_id,case_id),UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES membership_application(root_realm_id,id),
 FOREIGN KEY(root_realm_id,member_id) REFERENCES member(root_realm_id,id),
 FOREIGN KEY(root_realm_id,term_id) REFERENCES membership_term(root_realm_id,id),
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(fee_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg04_member_effect_immutable BEFORE UPDATE OR DELETE ON membership_application_effect FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE FUNCTION cg04_member_approved_source(realm uuid,app uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM membership_application a
 JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.membership_application_id=a.id
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
 JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE'
 JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL
 JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active AND r.is_protected
 JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id AND p.process_kind='MEMBER_APPLICATION'
 JOIN cg03_process_step step ON step.process_id=p.id AND step.ordinal=d.step_ordinal AND step.protected_root_required AND step.capability_key='approvals.review'
 WHERE a.root_realm_id=realm AND a.id=app AND a.status='SUBMITTED' AND c.case_kind='MEMBER_APPLICATION' AND c.status='PENDING_OWNER'
 AND c.membership_application_version=a.version AND c.membership_review_digest=a.submitted_digest
 AND d.action='APPROVE' AND d.actor_id<>a.applicant_account_ref AND d.fresh_password_verified_at IS NOT NULL AND d.step_ordinal=1 AND d.accepted_case_revision=c.revision
 AND (a.accepted_fee_minor=0 OR EXISTS(SELECT 1 FROM finance_membership_verified_collection v WHERE v.root_realm_id=a.root_realm_id AND v.application_id=a.id AND v.amount_minor=a.accepted_fee_minor))
 AND NOT EXISTS(SELECT 1 FROM finance_membership_refund_request rr WHERE rr.root_realm_id=a.root_realm_id AND rr.application_id=a.id)
 AND EXISTS(SELECT 1 FROM membership_review_file f JOIN cg19_membership_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id
 WHERE f.root_realm_id=c.realm_id AND f.snapshot_id=c.membership_review_ref AND f.application_id=a.id AND f.classification='MEMBER_IDENTITY_PROOF' AND doc.revoked_at IS NULL AND doc.scan_status='CLEAN_VERIFIED' AND doc.revision=f.file_version AND doc.sha256=f.sha256)
 AND NOT EXISTS(SELECT 1 FROM membership_review_file f JOIN cg19_membership_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id WHERE f.root_realm_id=c.realm_id AND f.snapshot_id=c.membership_review_ref AND (doc.revoked_at IS NOT NULL OR doc.revision<>f.file_version OR doc.sha256<>f.sha256 OR doc.scan_status<>'CLEAN_VERIFIED'))
 AND EXISTS(SELECT 1 FROM account owner WHERE owner.realm_id=a.root_realm_id AND owner.id=a.applicant_account_ref AND owner.status='ACTIVE' AND owner.contact_phone_verified_at IS NOT NULL)
 AND (a.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=a.root_realm_id AND b.id=a.branch_ref AND b.status='ACTIVE')));
$$;
CREATE FUNCTION cg04_member_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original member must be retained'; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Protected member profile changes require their original review'; END IF;
 IF NEW.version<>1 OR NEW.status<>'ACTIVE' OR NOT cg04_member_approved_source(NEW.root_realm_id,NEW.original_application_id)
 OR NOT EXISTS(SELECT 1 FROM membership_application a WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.original_application_id AND a.applicant_account_ref=NEW.account_ref AND a.display_name=NEW.display_name AND a.branch_ref IS NOT DISTINCT FROM NEW.branch_ref)
 THEN RAISE EXCEPTION 'Member requires original approved verified application'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_member_guard BEFORE INSERT OR UPDATE OR DELETE ON member FOR EACH ROW EXECUTE FUNCTION cg04_member_insert_guard();
CREATE FUNCTION cg04_term_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE offer record;
BEGIN
 PERFORM 1 FROM member m WHERE m.root_realm_id=NEW.root_realm_id AND m.id=NEW.member_id FOR UPDATE;
 SELECT v.duration_unit,v.duration_count INTO offer FROM membership_application a JOIN membership_tier_version v ON v.root_realm_id=a.root_realm_id AND v.id=a.tier_version_id
 JOIN member m ON m.root_realm_id=a.root_realm_id AND m.original_application_id=a.id
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.original_application_id AND m.id=NEW.member_id AND a.tier_version_id=NEW.tier_version_id AND a.accepted_fee_minor=NEW.fee_minor;
 IF NOT FOUND OR NOT cg04_member_approved_source(NEW.root_realm_id,NEW.original_application_id)
 OR NEW.starts_on<>(now() AT TIME ZONE 'Asia/Kolkata')::date
 OR NEW.expires_on IS DISTINCT FROM (CASE offer.duration_unit WHEN 'LIFETIME' THEN NULL::date WHEN 'DAY' THEN NEW.starts_on+offer.duration_count WHEN 'MONTH' THEN (NEW.starts_on+make_interval(months=>offer.duration_count))::date ELSE (NEW.starts_on+make_interval(years=>offer.duration_count))::date END)
 OR EXISTS(SELECT 1 FROM membership_term t WHERE t.root_realm_id=NEW.root_realm_id AND t.member_id=NEW.member_id AND daterange(t.starts_on,t.expires_on,'[)')&&daterange(NEW.starts_on,NEW.expires_on,'[)'))
 THEN RAISE EXCEPTION 'Original membership term, dates or amount invalid'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_term_insert BEFORE INSERT ON membership_term FOR EACH ROW EXECUTE FUNCTION cg04_term_insert_guard();
CREATE FUNCTION cg04_effect_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT cg04_member_approved_source(NEW.root_realm_id,NEW.application_id)
 OR NOT EXISTS(SELECT 1 FROM membership_application a JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.membership_application_id=a.id
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.action='APPROVE' AND d.accepted_case_revision=c.revision
 JOIN member m ON m.root_realm_id=a.root_realm_id AND m.original_application_id=a.id
 JOIN membership_term t ON t.root_realm_id=m.root_realm_id AND t.member_id=m.id AND t.original_application_id=a.id
 JOIN member_branch_history b ON b.root_realm_id=m.root_realm_id AND b.member_id=m.id AND b.branch_ref IS NOT DISTINCT FROM m.branch_ref AND b.effective_to IS NULL AND b.actor_ref=a.applicant_account_ref
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id AND c.id=NEW.case_id AND d.id=NEW.decision_id
 AND c.membership_application_version=NEW.pinned_review_revision AND c.membership_review_digest=NEW.source_digest
 AND m.id=NEW.member_id AND t.id=NEW.term_id AND NEW.actor_ref=a.applicant_account_ref
 AND ((a.accepted_fee_minor=0 AND NEW.fee_journal_id IS NULL) OR EXISTS(SELECT 1 FROM finance_membership_verified_collection v WHERE v.root_realm_id=a.root_realm_id AND v.application_id=a.id AND v.journal_id=NEW.fee_journal_id AND v.amount_minor=a.accepted_fee_minor)))
 THEN RAISE EXCEPTION 'Membership effect must match original approval, fee and term'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_member_effect_insert BEFORE INSERT ON membership_application_effect FOR EACH ROW EXECUTE FUNCTION cg04_effect_insert_guard();
-- Ensure even a direct SQL caller cannot commit a member without its term,
-- original effect and final authoritative application/case reconciliation.
CREATE FUNCTION cg04_member_completion_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_application_effect e JOIN membership_application a ON a.root_realm_id=e.root_realm_id AND a.id=e.application_id
 JOIN cg03_case c ON c.realm_id=e.root_realm_id AND c.id=e.case_id
 WHERE e.root_realm_id=NEW.root_realm_id AND e.member_id=NEW.id AND a.status='APPROVED' AND c.status='OWNER_COMPLETED')
 THEN RAISE EXCEPTION 'Original member completion required'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_member_completed_at_commit AFTER INSERT ON member DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_member_completion_required();

CREATE OR REPLACE FUNCTION cg04_application_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid membership application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR NOT ((OLD.status IN('DRAFT','RETURNED') AND NEW.status IN('DRAFT','CANCELLED','SUBMITTED')) OR (OLD.status='SUBMITTED' AND NEW.status IN('RETURNED','REJECTED','APPROVED')))
   THEN RAISE EXCEPTION 'Invalid membership application revision'; END IF;
  IF NEW.status IN('SUBMITTED','RETURNED','REJECTED','CANCELLED','APPROVED')
   AND (to_jsonb(NEW)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest')
   THEN RAISE EXCEPTION 'A review transition cannot change the accepted applicant source'; END IF;
  IF OLD.status='SUBMITTED' AND (NEW.submitted_digest,NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_digest,OLD.submitted_at)
   THEN RAISE EXCEPTION 'Original submitted snapshot is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN RAISE EXCEPTION 'Invalid Foundation membership scope'; END IF;
 IF NEW.status IN('DRAFT','SUBMITTED') THEN
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
    AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
    AND a.display_name=NEW.display_name AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
   THEN RAISE EXCEPTION 'A verified original applicant contact is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM membership_tier_version v JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id
   WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.tier_version_id AND t.version=v.version_no AND t.status='ACTIVE'
    AND v.status='ACTIVE' AND v.published_at<=now() FOR SHARE OF t) AND NOT EXISTS(SELECT 1 FROM finance_membership_collection fee WHERE fee.root_realm_id=NEW.root_realm_id AND fee.application_id=NEW.id AND fee.amount_minor=NEW.accepted_fee_minor AND fee.branch_id IS NOT DISTINCT FROM NEW.branch_ref) THEN RAISE EXCEPTION 'Select a current published membership plan'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE) THEN RAISE EXCEPTION 'Select an active branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.level='STATE' AND s.status='ACTIVE' AND d.id=NEW.district_ref AND d.level='DISTRICT' AND d.status='ACTIVE' FOR SHARE OF s,d) THEN RAISE EXCEPTION 'Select current state and district'; END IF;
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION cg04_application_command_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='APPROVED' THEN
  IF NOT EXISTS(SELECT 1 FROM membership_application_effect e JOIN cg03_case c ON c.realm_id=e.root_realm_id AND c.id=e.case_id WHERE e.root_realm_id=NEW.root_realm_id AND e.application_id=NEW.id AND e.pinned_review_revision=NEW.version-1 AND e.source_digest=NEW.submitted_digest AND c.status='OWNER_COMPLETED')
  THEN RAISE EXCEPTION 'Membership activation requires original owner effect'; END IF;
 ELSIF NEW.status IN('RETURNED','REJECTED') THEN
  IF NOT EXISTS(SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
   WHERE c.realm_id=NEW.root_realm_id AND c.case_kind='MEMBER_APPLICATION' AND c.membership_application_id=NEW.id
   AND c.membership_application_version=NEW.version-1 AND c.membership_review_digest=NEW.submitted_digest AND d.actor_id<>NEW.applicant_account_ref
   AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
   AND ((NEW.status='RETURNED' AND c.status='RETURNED' AND d.action='RETURN') OR (NEW.status='REJECTED' AND c.status='REJECTED' AND d.action='REJECT')))
   THEN RAISE EXCEPTION 'Application state requires original protected CG03 decision'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM membership_application_command c WHERE c.root_realm_id=NEW.root_realm_id AND c.application_id=NEW.id AND c.result_version=NEW.version AND c.actor_ref=NEW.applicant_account_ref) THEN RAISE EXCEPTION 'Original applicant command required'; END IF;
  IF NEW.status='SUBMITTED' AND NOT EXISTS(SELECT 1 FROM membership_review_snapshot s JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.membership_review_ref=s.id JOIN membership_application_command cmd ON cmd.root_realm_id=s.root_realm_id AND cmd.request_key=s.request_key
    JOIN membership_review_file f ON f.root_realm_id=s.root_realm_id AND f.snapshot_id=s.id
    JOIN cg19_membership_private_file doc ON doc.realm_id=f.root_realm_id AND doc.id=f.file_id
    WHERE s.root_realm_id=NEW.root_realm_id AND s.application_id=NEW.id AND s.application_version=NEW.version AND s.source_digest=NEW.submitted_digest AND s.submitted_by=NEW.applicant_account_ref
    AND cmd.application_id=NEW.id AND cmd.result_version=NEW.version AND cmd.action='SUBMIT' AND c.case_kind='MEMBER_APPLICATION'
    AND f.application_id=NEW.id AND f.classification='MEMBER_IDENTITY_PROOF' AND doc.classification=f.classification AND doc.sha256=f.sha256 AND doc.revision=f.file_version AND doc.revoked_at IS NULL)
    THEN RAISE EXCEPTION 'Submission requires original protected evidence and review case'; END IF;
 END IF;
 RETURN NULL;
END; $$;


CREATE FUNCTION cg04_initial_branch_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Original membership affiliation history is retained'; END IF;
 IF NEW.effective_to IS NOT NULL OR NOT EXISTS(SELECT 1 FROM member m WHERE m.root_realm_id=NEW.root_realm_id AND m.id=NEW.member_id AND m.branch_ref IS NOT DISTINCT FROM NEW.branch_ref)
 THEN RAISE EXCEPTION 'Initial member branch history must match its source'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_member_initial_branch_write BEFORE INSERT OR UPDATE OR DELETE ON member_branch_history FOR EACH ROW EXECUTE FUNCTION cg04_initial_branch_history_guard();

-- A direct case transition cannot bypass either the protected decision or owner effect.
CREATE FUNCTION cg04_review_completion_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.case_kind<>'MEMBER_APPLICATION' THEN RETURN NULL; END IF;
 IF NEW.status='OWNER_COMPLETED' AND NOT EXISTS(SELECT 1 FROM membership_application_effect e JOIN membership_application a ON a.root_realm_id=e.root_realm_id AND a.id=e.application_id WHERE e.root_realm_id=NEW.realm_id AND e.case_id=NEW.id AND e.application_id=NEW.membership_application_id AND a.status='APPROVED') THEN RAISE EXCEPTION 'Original membership owner effect required'; END IF;
 IF NEW.status='PENDING_OWNER' AND NOT EXISTS(SELECT 1 FROM cg03_case_decision d WHERE d.realm_id=NEW.realm_id AND d.case_id=NEW.id AND d.action='APPROVE' AND d.step_ordinal=1 AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=NEW.revision) THEN RAISE EXCEPTION 'Original protected membership decision required'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_review_completed_at_commit AFTER INSERT OR UPDATE ON cg03_case DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_review_completion_at_commit();
