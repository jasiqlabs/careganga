-- CG-04 US-003 original U14-U17 volunteer intake and current genuine affiliation.
-- No CG01 staff role, CG03 decision, CG19 evidence, CG05 task or CG09 money source is duplicated.
CREATE SEQUENCE cg04_volunteer_application_number_seq AS bigint MINVALUE 1 START 1;
CREATE SEQUENCE cg04_volunteer_number_seq AS bigint MINVALUE 1 START 1;
CREATE TABLE volunteer_application(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 application_ref text NOT NULL DEFAULT ('CG/VAPP/'||to_char((now() AT TIME ZONE 'Asia/Kolkata')::date,'YYYY')||'/'||nextval('cg04_volunteer_application_number_seq')),
 applicant_account_ref uuid NOT NULL,
 first_name text NOT NULL CHECK(length(btrim(first_name)) BETWEEN 1 AND 100),
 last_name text NOT NULL CHECK(length(btrim(last_name)) BETWEEN 1 AND 100),
 date_of_birth date NOT NULL,
 gender text NOT NULL CHECK(length(btrim(gender)) BETWEEN 2 AND 40),
 blood_group text CHECK(blood_group IN('A+','A-','B+','B-','AB+','AB-','O+','O-')),
 contact_mobile text NOT NULL CHECK(contact_mobile ~ '^\+91[6-9][0-9]{9}$'),
 contact_email text CHECK(length(contact_email)<=254),
 address_text text NOT NULL CHECK(length(btrim(address_text)) BETWEEN 5 AND 1000),
 city text NOT NULL CHECK(length(btrim(city)) BETWEEN 2 AND 120),
 village text NOT NULL DEFAULT '' CHECK(length(village)<=120),
 pin_code char(6) NOT NULL CHECK(pin_code ~ '^[1-9][0-9]{5}$'),
 state_ref uuid NOT NULL,district_ref uuid NOT NULL,
 branch_ref uuid,department_ref uuid NOT NULL,
 availability text NOT NULL CHECK(availability IN('FULL_TIME','PART_TIME','WEEKENDS','FLEXIBLE')),
 skills jsonb NOT NULL CHECK(jsonb_typeof(skills)='array' AND jsonb_array_length(skills)<=20),
 experience text NOT NULL DEFAULT '' CHECK(length(experience)<=1000),
 referral_input text NOT NULL DEFAULT '' CHECK(length(referral_input)<=100),
 consent_version text NOT NULL CHECK(consent_version='VOLUNTEER_V1'),
 consented_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 submitted_digest char(64) CHECK(submitted_digest ~ '^[a-f0-9]{64}$'),
 submitted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,application_ref),
 FOREIGN KEY(applicant_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(department_ref,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((submitted_digest IS NULL)=(submitted_at IS NULL)),
 CHECK(status IN('DRAFT','CANCELLED') OR submitted_digest IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg04_volunteer_open ON volunteer_application(root_realm_id,applicant_account_ref)
 WHERE status IN('DRAFT','SUBMITTED','RETURNED','APPROVED');
CREATE INDEX ix_cg04_volunteer_app_scope ON volunteer_application(root_realm_id,branch_ref,status,created_at DESC,id DESC);
CREATE INDEX ix_cg04_volunteer_app_self ON volunteer_application(root_realm_id,applicant_account_ref,created_at DESC,id DESC);
CREATE TABLE volunteer_application_command(
 root_realm_id uuid NOT NULL,request_key uuid NOT NULL,application_id uuid NOT NULL,
 result_version integer NOT NULL CHECK(result_version>0),
 actor_ref uuid NOT NULL,action text NOT NULL CHECK(action IN('CREATE','EDIT','CANCEL','SUBMIT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),UNIQUE(root_realm_id,application_id,result_version),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg04_volunteer_command_immutable BEFORE UPDATE OR DELETE ON volunteer_application_command
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();

CREATE TABLE volunteer(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 volunteer_no text NOT NULL DEFAULT ('CG/VOL/'||to_char((now() AT TIME ZONE 'Asia/Kolkata')::date,'YYYY')||'/'||nextval('cg04_volunteer_number_seq')),
 original_application_id uuid NOT NULL,account_ref uuid NOT NULL,
 display_name text NOT NULL,branch_ref uuid,department_ref uuid NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE','SUSPENDED')),
 skills jsonb NOT NULL CHECK(jsonb_typeof(skills)='array' AND jsonb_array_length(skills)<=20),
 availability text NOT NULL CHECK(availability IN('FULL_TIME','PART_TIME','WEEKENDS','FLEXIBLE')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,volunteer_no),UNIQUE(root_realm_id,original_application_id),UNIQUE(root_realm_id,account_ref),
 FOREIGN KEY(root_realm_id,original_application_id) REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(department_ref,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg04_volunteer_current ON volunteer(root_realm_id,status,volunteer_no,id);
CREATE TABLE volunteer_affiliation_history(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 volunteer_id uuid NOT NULL,branch_ref uuid,department_ref uuid NOT NULL,
 effective_from timestamptz NOT NULL DEFAULT now(),effective_to timestamptz,
 actor_ref uuid NOT NULL,reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,volunteer_id) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(department_ref,root_realm_id) REFERENCES department(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX ux_cg04_volunteer_current_affiliation ON volunteer_affiliation_history(root_realm_id,volunteer_id) WHERE effective_to IS NULL;
CREATE INDEX ix_cg04_volunteer_branch ON volunteer_affiliation_history(root_realm_id,branch_ref,effective_from DESC,id);
CREATE TABLE volunteer_approval_effect(
 root_realm_id uuid NOT NULL,application_id uuid NOT NULL,
 case_id uuid NOT NULL,decision_id uuid NOT NULL,
 volunteer_id uuid NOT NULL,source_digest char(64) NOT NULL,
 request_key uuid NOT NULL,actor_ref uuid NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,application_id),UNIQUE(root_realm_id,case_id),UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,application_id) REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,volunteer_id) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decision_id,root_realm_id) REFERENCES cg03_case_decision(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg04_volunteer_effect_immutable BEFORE UPDATE OR DELETE ON volunteer_approval_effect
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();

-- Fail closed on drafts until CG-19 original ID evidence and CG-03 source
-- approvals are installed by the following source-owner migrations.
CREATE FUNCTION cg04_volunteer_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original volunteer intake is retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1 OR NEW.submitted_digest IS NOT NULL THEN
   RAISE EXCEPTION 'Original volunteer starts only as an application draft'; END IF;
 ELSE
  IF NEW.version<>OLD.version+1 OR
   (NEW.root_realm_id,NEW.id,NEW.application_ref,NEW.applicant_account_ref,NEW.created_at) IS DISTINCT FROM
   (OLD.root_realm_id,OLD.id,OLD.application_ref,OLD.applicant_account_ref,OLD.created_at)
   OR OLD.status NOT IN('DRAFT','RETURNED') OR NEW.status NOT IN('DRAFT','CANCELLED')
   OR NEW.submitted_digest IS NOT NULL
  THEN RAISE EXCEPTION 'Volunteer review transition is not available without original CG-03 and CG-19 proof'; END IF;
 END IF;
 IF NEW.status='DRAFT' THEN
  IF NOT EXISTS(SELECT 1 FROM access_realm r WHERE r.id=NEW.root_realm_id AND r.realm_key='FOUNDATION_ROOT') THEN
   RAISE EXCEPTION 'Wrong Foundation volunteer scope'; END IF;
  IF NOT EXISTS(SELECT 1 FROM account a WHERE a.id=NEW.applicant_account_ref AND a.realm_id=NEW.root_realm_id
   AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL AND a.contact_phone=NEW.contact_mobile
   AND a.normalized_email IS NOT DISTINCT FROM NEW.contact_email FOR SHARE)
  THEN RAISE EXCEPTION 'Verified applicant contact required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM geography_area s JOIN geography_area d ON d.root_realm_id=s.root_realm_id AND d.parent_area_id=s.id
   WHERE s.root_realm_id=NEW.root_realm_id AND s.id=NEW.state_ref AND s.status='ACTIVE' AND s.level='STATE'
    AND d.id=NEW.district_ref AND d.status='ACTIVE' AND d.level='DISTRICT' FOR SHARE OF s,d)
  THEN RAISE EXCEPTION 'Choose real current state and district'; END IF;
  IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=NEW.root_realm_id
   AND b.id=NEW.branch_ref AND b.status='ACTIVE' FOR SHARE)
  THEN RAISE EXCEPTION 'Choose a current Foundation branch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM department d WHERE d.id=NEW.department_ref AND d.root_realm_id=NEW.root_realm_id
   AND d.active AND d.kind='DEPARTMENT' AND
   ((d.scope_kind='FOUNDATION' AND (NEW.branch_ref IS NULL OR EXISTS(
    SELECT 1 FROM branch_department_link l WHERE l.root_realm_id=NEW.root_realm_id AND l.branch_id=NEW.branch_ref
      AND l.foundation_department_id=d.id AND l.ended_at IS NULL)))
    OR (d.scope_kind='BRANCH' AND d.branch_id=NEW.branch_ref))
   FOR SHARE)
  THEN RAISE EXCEPTION 'Choose an eligible current Foundation department'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_draft_write BEFORE INSERT OR UPDATE OR DELETE ON volunteer_application
 FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_draft_guard();

CREATE FUNCTION cg04_volunteer_command_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_application a
 WHERE a.root_realm_id=NEW.root_realm_id AND a.id=NEW.application_id AND a.applicant_account_ref=NEW.actor_ref
 AND a.version=NEW.result_version AND
 ((NEW.action='CREATE' AND a.version=1 AND a.status='DRAFT')
 OR (NEW.action='EDIT' AND a.version>1 AND a.status='DRAFT')
 OR (NEW.action='CANCEL' AND a.version>1 AND a.status='CANCELLED')))
 THEN RAISE EXCEPTION 'Volunteer draft command does not match actual current account'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_volunteer_command_check BEFORE INSERT ON volunteer_application_command
 FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_command_guard();
CREATE FUNCTION cg04_volunteer_command_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM volunteer_application_command c WHERE c.root_realm_id=NEW.root_realm_id
 AND c.application_id=NEW.id AND c.actor_ref=NEW.applicant_account_ref AND c.result_version=NEW.version)
 THEN RAISE EXCEPTION 'Original idempotent volunteer application command is required'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER cg04_volunteer_command_commit AFTER INSERT OR UPDATE ON volunteer_application
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cg04_volunteer_command_required();
