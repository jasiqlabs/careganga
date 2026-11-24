-- CG-06 US-001: private Foundation beneficiary intake. No stock/finance shadow owners.
-- Consent/profile history is immutable; contact is deliberately NOT unique.
CREATE SEQUENCE cg06_beneficiary_display_seq;
CREATE TABLE beneficiary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 branch_scope_id uuid,
 display_ref text NOT NULL CHECK(display_ref ~ '^BEN-[0-9]{7,}$'),
 private_name text NOT NULL CHECK(char_length(btrim(private_name)) BETWEEN 2 AND 160),
 contact_mobile text CHECK(contact_mobile IS NULL OR contact_mobile ~ '^[+][1-9][0-9]{7,14}),
 representative_name text CHECK(representative_name IS NULL OR char_length(btrim(representative_name)) BETWEEN 2 AND 160),
 representative_contact text CHECK(representative_contact IS NULL OR representative_contact ~ '^\\+[1-9][0-9]{7,14}$'),
 state_ref uuid NOT NULL,
 district_ref uuid,
 beneficiary_type text NOT NULL CHECK(char_length(btrim(beneficiary_type)) BETWEEN 2 AND 60),
 gender text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(gender IN('FEMALE','MALE','OTHER','NOT_SPECIFIED')),
 age_group text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(age_group IN('CHILD','ADULT','SENIOR','NOT_SPECIFIED')),
 consent_kind text NOT NULL CHECK(consent_kind IN('SELF','GUARDIAN','REPRESENTATIVE')),
 consent_purpose text NOT NULL CHECK(char_length(btrim(consent_purpose)) BETWEEN 5 AND 240),
 consent_acknowledged_at timestamptz NOT NULL,
 consent_revoked_at timestamptz,
 verification_state text NOT NULL DEFAULT 'DRAFT'
    CHECK(verification_state IN('DRAFT','SUBMITTED','UNDER_REVIEW','VERIFIED','RETURNED','REJECTED')),
 verification_case_ref uuid,
 lifecycle_state text NOT NULL DEFAULT 'ACTIVE'
    CHECK(lifecycle_state IN('ACTIVE','INACTIVE')),
 profile_revision integer NOT NULL DEFAULT 1
    CHECK(profile_revision BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,display_ref),
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verification_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(consent_revoked_at IS NULL OR consent_revoked_at >= consent_acknowledged_at),
 CHECK(age_group <> 'CHILD' OR consent_kind = 'GUARDIAN'),
 CHECK(consent_kind = 'SELF' OR representative_name IS NOT NULL),
 CHECK(verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_beneficiary_scope
 ON beneficiary(root_realm_id,branch_scope_id,verification_state,lifecycle_state,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_geography
 ON beneficiary(root_realm_id,state_ref,district_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_contact
 ON beneficiary(root_realm_id,contact_mobile) WHERE contact_mobile IS NOT NULL;

CREATE TABLE beneficiary_command (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','LIFECYCLE','SUBMIT_VERIFICATION','LINK_PROJECT','UNLINK_PROJECT','REVOKE_CONSENT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
),
 representative_name text CHECK(representative_name IS NULL OR char_length(btrim(representative_name)) BETWEEN 2 AND 160),
 representative_contact text CHECK(representative_contact IS NULL OR representative_contact ~ '^[+][1-9][0-9]{7,14}),
 state_ref uuid NOT NULL,
 district_ref uuid,
 beneficiary_type text NOT NULL CHECK(char_length(btrim(beneficiary_type)) BETWEEN 2 AND 60),
 gender text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(gender IN('FEMALE','MALE','OTHER','NOT_SPECIFIED')),
 age_group text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(age_group IN('CHILD','ADULT','SENIOR','NOT_SPECIFIED')),
 consent_kind text NOT NULL CHECK(consent_kind IN('SELF','GUARDIAN','REPRESENTATIVE')),
 consent_purpose text NOT NULL CHECK(char_length(btrim(consent_purpose)) BETWEEN 5 AND 240),
 consent_acknowledged_at timestamptz NOT NULL,
 consent_revoked_at timestamptz,
 verification_state text NOT NULL DEFAULT 'DRAFT'
    CHECK(verification_state IN('DRAFT','SUBMITTED','UNDER_REVIEW','VERIFIED','RETURNED','REJECTED')),
 verification_case_ref uuid,
 lifecycle_state text NOT NULL DEFAULT 'ACTIVE'
    CHECK(lifecycle_state IN('ACTIVE','INACTIVE')),
 profile_revision integer NOT NULL DEFAULT 1
    CHECK(profile_revision BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,display_ref),
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verification_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(consent_revoked_at IS NULL OR consent_revoked_at >= consent_acknowledged_at),
 CHECK(age_group <> 'CHILD' OR consent_kind = 'GUARDIAN'),
 CHECK(consent_kind = 'SELF' OR representative_name IS NOT NULL),
 CHECK(verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_beneficiary_scope
 ON beneficiary(root_realm_id,branch_scope_id,verification_state,lifecycle_state,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_geography
 ON beneficiary(root_realm_id,state_ref,district_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_contact
 ON beneficiary(root_realm_id,contact_mobile) WHERE contact_mobile IS NOT NULL;

CREATE TABLE beneficiary_command (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','LIFECYCLE','SUBMIT_VERIFICATION','LINK_PROJECT','UNLINK_PROJECT','REVOKE_CONSENT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 beneficiary_id uuid NOT NULL,
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
),
 state_ref uuid NOT NULL,
 district_ref uuid,
 beneficiary_type text NOT NULL CHECK(char_length(btrim(beneficiary_type)) BETWEEN 2 AND 60),
 gender text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(gender IN('FEMALE','MALE','OTHER','NOT_SPECIFIED')),
 age_group text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(age_group IN('CHILD','ADULT','SENIOR','NOT_SPECIFIED')),
 consent_kind text NOT NULL CHECK(consent_kind IN('SELF','GUARDIAN','REPRESENTATIVE')),
 consent_purpose text NOT NULL CHECK(char_length(btrim(consent_purpose)) BETWEEN 5 AND 240),
 consent_acknowledged_at timestamptz NOT NULL,
 consent_revoked_at timestamptz,
 verification_state text NOT NULL DEFAULT 'DRAFT'
    CHECK(verification_state IN('DRAFT','SUBMITTED','UNDER_REVIEW','VERIFIED','RETURNED','REJECTED')),
 verification_case_ref uuid,
 lifecycle_state text NOT NULL DEFAULT 'ACTIVE'
    CHECK(lifecycle_state IN('ACTIVE','INACTIVE')),
 profile_revision integer NOT NULL DEFAULT 1
    CHECK(profile_revision BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,display_ref),
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verification_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(consent_revoked_at IS NULL OR consent_revoked_at >= consent_acknowledged_at),
 CHECK(age_group <> 'CHILD' OR consent_kind = 'GUARDIAN'),
 CHECK(consent_kind = 'SELF' OR representative_name IS NOT NULL),
 CHECK(verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_beneficiary_scope
 ON beneficiary(root_realm_id,branch_scope_id,verification_state,lifecycle_state,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_geography
 ON beneficiary(root_realm_id,state_ref,district_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_contact
 ON beneficiary(root_realm_id,contact_mobile) WHERE contact_mobile IS NOT NULL;

CREATE TABLE beneficiary_command (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','LIFECYCLE','SUBMIT_VERIFICATION','LINK_PROJECT','UNLINK_PROJECT','REVOKE_CONSENT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 beneficiary_id uuid NOT NULL,
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
),
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=300),
 beneficiary_id uuid NOT NULL,
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
),
 representative_name text CHECK(representative_name IS NULL OR char_length(btrim(representative_name)) BETWEEN 2 AND 160),
 representative_contact text CHECK(representative_contact IS NULL OR representative_contact ~ '^[+][1-9][0-9]{7,14}),
 state_ref uuid NOT NULL,
 district_ref uuid,
 beneficiary_type text NOT NULL CHECK(char_length(btrim(beneficiary_type)) BETWEEN 2 AND 60),
 gender text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(gender IN('FEMALE','MALE','OTHER','NOT_SPECIFIED')),
 age_group text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(age_group IN('CHILD','ADULT','SENIOR','NOT_SPECIFIED')),
 consent_kind text NOT NULL CHECK(consent_kind IN('SELF','GUARDIAN','REPRESENTATIVE')),
 consent_purpose text NOT NULL CHECK(char_length(btrim(consent_purpose)) BETWEEN 5 AND 240),
 consent_acknowledged_at timestamptz NOT NULL,
 consent_revoked_at timestamptz,
 verification_state text NOT NULL DEFAULT 'DRAFT'
    CHECK(verification_state IN('DRAFT','SUBMITTED','UNDER_REVIEW','VERIFIED','RETURNED','REJECTED')),
 verification_case_ref uuid,
 lifecycle_state text NOT NULL DEFAULT 'ACTIVE'
    CHECK(lifecycle_state IN('ACTIVE','INACTIVE')),
 profile_revision integer NOT NULL DEFAULT 1
    CHECK(profile_revision BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,display_ref),
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verification_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(consent_revoked_at IS NULL OR consent_revoked_at >= consent_acknowledged_at),
 CHECK(age_group <> 'CHILD' OR consent_kind = 'GUARDIAN'),
 CHECK(consent_kind = 'SELF' OR representative_name IS NOT NULL),
 CHECK(verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_beneficiary_scope
 ON beneficiary(root_realm_id,branch_scope_id,verification_state,lifecycle_state,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_geography
 ON beneficiary(root_realm_id,state_ref,district_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_contact
 ON beneficiary(root_realm_id,contact_mobile) WHERE contact_mobile IS NOT NULL;

CREATE TABLE beneficiary_command (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','LIFECYCLE','SUBMIT_VERIFICATION','LINK_PROJECT','UNLINK_PROJECT','REVOKE_CONSENT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 beneficiary_id uuid NOT NULL,
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
),
 state_ref uuid NOT NULL,
 district_ref uuid,
 beneficiary_type text NOT NULL CHECK(char_length(btrim(beneficiary_type)) BETWEEN 2 AND 60),
 gender text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(gender IN('FEMALE','MALE','OTHER','NOT_SPECIFIED')),
 age_group text NOT NULL DEFAULT 'NOT_SPECIFIED'
    CHECK(age_group IN('CHILD','ADULT','SENIOR','NOT_SPECIFIED')),
 consent_kind text NOT NULL CHECK(consent_kind IN('SELF','GUARDIAN','REPRESENTATIVE')),
 consent_purpose text NOT NULL CHECK(char_length(btrim(consent_purpose)) BETWEEN 5 AND 240),
 consent_acknowledged_at timestamptz NOT NULL,
 consent_revoked_at timestamptz,
 verification_state text NOT NULL DEFAULT 'DRAFT'
    CHECK(verification_state IN('DRAFT','SUBMITTED','UNDER_REVIEW','VERIFIED','RETURNED','REJECTED')),
 verification_case_ref uuid,
 lifecycle_state text NOT NULL DEFAULT 'ACTIVE'
    CHECK(lifecycle_state IN('ACTIVE','INACTIVE')),
 profile_revision integer NOT NULL DEFAULT 1
    CHECK(profile_revision BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,display_ref),
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(state_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(district_ref,root_realm_id) REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(verification_case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 CHECK(consent_revoked_at IS NULL OR consent_revoked_at >= consent_acknowledged_at),
 CHECK(age_group <> 'CHILD' OR consent_kind = 'GUARDIAN'),
 CHECK(consent_kind = 'SELF' OR representative_name IS NOT NULL),
 CHECK(verification_state <> 'VERIFIED' OR verification_case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_beneficiary_scope
 ON beneficiary(root_realm_id,branch_scope_id,verification_state,lifecycle_state,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_geography
 ON beneficiary(root_realm_id,state_ref,district_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg06_beneficiary_contact
 ON beneficiary(root_realm_id,contact_mobile) WHERE contact_mobile IS NOT NULL;

CREATE TABLE beneficiary_command (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','LIFECYCLE','SUBMIT_VERIFICATION','LINK_PROJECT','UNLINK_PROJECT','REVOKE_CONSENT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 beneficiary_id uuid NOT NULL,
 result_revision integer NOT NULL CHECK(result_revision > 0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg06_beneficiary_history ON beneficiary_command(root_realm_id,beneficiary_id,occurred_at DESC,id DESC);
CREATE FUNCTION cg06_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Beneficiary history is immutable'; END $$;
CREATE TRIGGER cg06_command_immutable BEFORE UPDATE OR DELETE ON beneficiary_command
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_verification_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 decision text NOT NULL CHECK(decision IN('SUBMITTED','IN_REVIEW','APPROVED','RETURNED','REJECTED')),
 case_ref uuid,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 actor_ref uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,beneficiary_id,source_revision,decision),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(case_ref,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(decision <> 'APPROVED' OR case_ref IS NOT NULL)
);
CREATE INDEX ix_cg06_verification_events
 ON beneficiary_verification_event(root_realm_id,beneficiary_id,at DESC,id DESC);
CREATE TRIGGER cg06_verification_immutable BEFORE UPDATE OR DELETE ON beneficiary_verification_event
 FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

CREATE TABLE beneficiary_project_link (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 project_ref uuid NOT NULL,
 branch_scope_id uuid,
 effective_from timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 linked_by uuid NOT NULL,
 ended_by uuid,
 source_revision integer NOT NULL CHECK(source_revision > 0),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(branch_scope_id,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(linked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ended_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=effective_from))
);
CREATE UNIQUE INDEX ux_cg06_current_project_link
 ON beneficiary_project_link(root_realm_id,beneficiary_id,project_ref) WHERE ended_at IS NULL;
CREATE INDEX ix_cg06_project_link_history
 ON beneficiary_project_link(root_realm_id,beneficiary_id,effective_from DESC,id DESC);
CREATE INDEX ix_cg06_project_link_project
 ON beneficiary_project_link(root_realm_id,project_ref,ended_at);

-- No public beneficiary route/DB view. CG-18 may later receive separately approved aggregate only.
