-- CG04 US002: verified applicant and pinned published offer. This migration
-- creates the original private application source, not a member or payment.
CREATE SEQUENCE cg04_application_number_seq AS bigint MINVALUE 1 START 1;
ALTER TABLE membership_tier_version ADD CONSTRAINT uq_cg04_offer_fee
 UNIQUE(root_realm_id,id,fee_minor,currency);
CREATE TABLE membership_application(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 application_ref text NOT NULL DEFAULT ('CG/MAPP/'||to_char(CURRENT_DATE,'YYYY')||'/'||nextval('cg04_application_number_seq')),
 applicant_account_ref uuid NOT NULL,
 branch_ref uuid,
 tier_version_id uuid NOT NULL,
 accepted_fee_minor bigint NOT NULL CHECK(accepted_fee_minor BETWEEN 0 AND 999999999999999),
 currency char(3) NOT NULL CHECK(currency='INR'),
 display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 2 AND 200),
 contact_mobile text NOT NULL CHECK(contact_mobile ~ '^\+91[6-9][0-9]{9}$'),
 contact_email text CHECK(char_length(contact_email)<=254),
 address_text text NOT NULL CHECK(char_length(btrim(address_text)) BETWEEN 5 AND 1000),
 city text NOT NULL CHECK(char_length(btrim(city)) BETWEEN 2 AND 120),
 pin_code char(6) NOT NULL CHECK(pin_code ~ '^[1-9][0-9]{5}$'),
 state_ref uuid NOT NULL,
 district_ref uuid NOT NULL,
 referral_input text NOT NULL DEFAULT '' CHECK(char_length(referral_input)<=100),
 consent_version text NOT NULL CHECK(consent_version='MEMBERSHIP_V1'),
 consented_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','CANCELLED')),
 version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483647),
 submitted_digest char(64) CHECK(submitted_digest ~ '^[a-f0-9]{64}$'),
 submitted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,application_ref),
 FOREIGN KEY(applicant_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,tier_version_id,accepted_fee_minor,currency)
  REFERENCES membership_tier_version(root_realm_id,id,fee_minor,currency) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((submitted_digest IS NULL)=(submitted_at IS NULL)),
 CHECK(status IN('DRAFT','CANCELLED') OR submitted_digest IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg04_one_open_application ON membership_application(root_realm_id,applicant_account_ref)
 WHERE status IN('DRAFT','SUBMITTED','RETURNED','APPROVED');
CREATE INDEX ix_cg04_application_scope ON membership_application(root_realm_id,branch_ref,status,created_at DESC,id);
CREATE INDEX ix_cg04_application_self ON membership_application(root_realm_id,applicant_account_ref,created_at DESC,id);
CREATE TABLE membership_application_command(
 root_realm_id uuid NOT NULL,request_key uuid NOT NULL,
 application_id uuid NOT NULL,result_version integer NOT NULL CHECK(result_version>0),
 actor_ref uuid NOT NULL,action text NOT NULL CHECK(action IN('CREATE','EDIT','CANCEL')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),UNIQUE(root_realm_id,application_id,result_version),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES membership_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg04_application_command_immutable BEFORE UPDATE OR DELETE ON membership_application_command
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE FUNCTION cg04_application_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership application history must be retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN RAISE EXCEPTION 'Invalid membership application start'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR (NEW.id,NEW.root_realm_id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.root_realm_id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
    OR OLD.status IN('REJECTED','CANCELLED','APPROVED') THEN RAISE EXCEPTION 'Invalid membership application revision'; END IF;
  -- This initial draft-only source deliberately refuses all approval/submission
  -- transitions until the introducing CG03/CG19 owner adapters are installed.
  IF OLD.status<>'DRAFT' OR NEW.status NOT IN('DRAFT','CANCELLED') OR NEW.submitted_digest IS NOT NULL THEN
   RAISE EXCEPTION 'Original application review source is not installed';
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN
  RAISE EXCEPTION 'Invalid Foundation membership scope'; END IF;
 IF TG_OP='UPDATE' AND NEW.status='CANCELLED' AND (to_jsonb(NEW)-'status'-'version'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version'-'updated_at') THEN
  RAISE EXCEPTION 'Cancelling a draft cannot modify the accepted source';
 END IF;
 IF NEW.status='DRAFT' THEN
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
    AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
    AND a.display_name=NEW.display_name AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE) THEN
   RAISE EXCEPTION 'A verified original applicant contact is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM membership_tier_version v JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id
   WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.tier_version_id AND t.version=v.version_no AND t.status='ACTIVE'
    AND v.status='ACTIVE' AND v.published_at<=now() FOR SHARE OF t) THEN
    RAISE EXCEPTION 'Select a current published membership plan'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE) THEN
    RAISE EXCEPTION 'Select an active branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.level='STATE' AND s.status='ACTIVE' AND d.id=NEW.district_ref AND d.level='DISTRICT' AND d.status='ACTIVE' FOR SHARE OF s,d) THEN
    RAISE EXCEPTION 'Select current state and district'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_application_draft_write BEFORE INSERT OR UPDATE OR DELETE ON membership_application FOR EACH ROW EXECUTE FUNCTION cg04_application_draft_guard();

CREATE FUNCTION cg04_application_command_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_application a WHERE a.root_realm_id=NEW.root_realm_id
   AND a.id=NEW.application_id AND a.applicant_account_ref=NEW.actor_ref AND a.version=NEW.result_version
   AND ((NEW.action='CREATE' AND a.version=1 AND a.status='DRAFT')
        OR (NEW.action='EDIT' AND a.version>1 AND a.status='DRAFT')
        OR (NEW.action='CANCEL' AND a.version>1 AND a.status='CANCELLED'))) THEN
   RAISE EXCEPTION 'Application command must match the original applicant and current revision'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_application_command_insert BEFORE INSERT ON membership_application_command
 FOR EACH ROW EXECUTE FUNCTION cg04_application_command_guard();
CREATE FUNCTION cg04_application_command_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM membership_application_command c WHERE c.root_realm_id=NEW.root_realm_id
   AND c.application_id=NEW.id AND c.result_version=NEW.version AND c.actor_ref=NEW.applicant_account_ref) THEN
  RAISE EXCEPTION 'An immutable original applicant command is required'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_application_command_commit AFTER INSERT OR UPDATE ON membership_application
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_application_command_required();
