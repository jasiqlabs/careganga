-- CG-18 US-001 original CareGanga editorial CMS, staged on the shared
-- CG-09+CG-18 integration feature branch. No demo content or future owner rows.
-- All active records use the authenticated CG01 Foundation root, not public root input.
CREATE TABLE cms_page(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9][a-z0-9-]{0,69}$' AND
  slug NOT IN('admin','api','login','join','volunteer','auth','internal','_next')),
 kind text NOT NULL CHECK(kind IN('HOME','ABOUT','IMPACT','COMPLIANCE',
  'GALLERY','ARTICLE','CONTACT','HEALTHCARE','OTHER')),
 draft_revision_no integer NOT NULL DEFAULT 0 CHECK(draft_revision_no>=0),
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 UNIQUE(foundation_root_id,id),
 UNIQUE(foundation_root_id,slug),
 FOREIGN KEY(created_by,foundation_root_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg18_one_home_per_root
 ON cms_page(foundation_root_id) WHERE kind='HOME' AND archived_at IS NULL;
CREATE INDEX ix_cg18_cms_pages
 ON cms_page(foundation_root_id,kind,created_at DESC,id DESC);

CREATE TABLE cms_page_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>=1),
 schema_version smallint NOT NULL DEFAULT 1 CHECK(schema_version=1),
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 180),
 seo_title text NOT NULL CHECK(char_length(btrim(seo_title)) BETWEEN 3 AND 180),
 seo_description text NOT NULL DEFAULT '' CHECK(char_length(seo_description)<=300),
 seo_canonical_path text NOT NULL
  CHECK(seo_canonical_path ~ '^/[a-z0-9/-]{0,140}$' AND
   seo_canonical_path NOT LIKE '//%'),
 content_digest char(64) NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'DRAFT'
  CHECK(status IN('DRAFT','SUBMITTED','RETURNED')),
 submitted_at timestamptz,
 approval_case_ref uuid,
 approval_source_revision integer CHECK(approval_source_revision>=1),
 UNIQUE(foundation_root_id,id),
 UNIQUE(foundation_root_id,page_id,id),
 UNIQUE(foundation_root_id,page_id,revision_no),
 FOREIGN KEY(foundation_root_id,page_id)
  REFERENCES cms_page(foundation_root_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,foundation_root_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='DRAFT' AND submitted_at IS NULL AND approval_case_ref IS NULL)
   OR (status IN('SUBMITTED','RETURNED') AND submitted_at IS NOT NULL
    AND approval_case_ref IS NOT NULL AND approval_source_revision IS NOT NULL))
);
CREATE INDEX ix_cg18_page_revision_history
 ON cms_page_revision(foundation_root_id,page_id,revision_no DESC);

CREATE TABLE cms_section_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_revision_id uuid NOT NULL,
 section_kind text NOT NULL CHECK(section_kind ~ '^[A-Z_]{2,40}$'),
 order_no smallint NOT NULL CHECK(order_no BETWEEN 0 AND 100),
 structured_fields jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK(jsonb_typeof(structured_fields)='object' AND
   octet_length(structured_fields::text)<=8192),
 UNIQUE(foundation_root_id,page_revision_id,section_kind,order_no),
 FOREIGN KEY(foundation_root_id,page_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg18_sections
 ON cms_section_revision(foundation_root_id,page_revision_id,order_no);

CREATE TABLE cms_asset_placement(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_revision_id uuid NOT NULL,
 cg19_file_ref uuid NOT NULL,
 cg19_validated_version integer NOT NULL CHECK(cg19_validated_version>=1),
 role text NOT NULL CHECK(role IN('HERO','MOBILE_HERO','TEAM','GALLERY',
  'ARTICLE','DOCUMENT','OTHER')),
 alt_text text NOT NULL CHECK(char_length(btrim(alt_text)) BETWEEN 3 AND 300),
 sort_order smallint NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 100),
 public_rights_status text NOT NULL DEFAULT 'PENDING'
  CHECK(public_rights_status IN('PENDING','VALIDATED','REVOKED')),
 UNIQUE(foundation_root_id,page_revision_id,role,sort_order),
 FOREIGN KEY(foundation_root_id,page_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg18_assets_by_revision
 ON cms_asset_placement(foundation_root_id,page_revision_id,sort_order);

CREATE TABLE cms_publication(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_id uuid NOT NULL,
 page_revision_id uuid NOT NULL,
 cg03_final_decision_ref uuid NOT NULL,
 source_content_digest char(64) NOT NULL CHECK(source_content_digest~'^[a-f0-9]{64}$'),
 publication_key uuid NOT NULL,
 state text NOT NULL CHECK(state IN('SCHEDULED','EFFECTIVE',
  'SUPERSEDED','WITHDRAWN','EXPIRED')),
 effective_at timestamptz NOT NULL,
 expires_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 UNIQUE(foundation_root_id,id),
 UNIQUE(foundation_root_id,page_id,id),
 UNIQUE(foundation_root_id,page_id,publication_key),
 UNIQUE(foundation_root_id,page_id,cg03_final_decision_ref),
 FOREIGN KEY(foundation_root_id,page_id)
  REFERENCES cms_page(foundation_root_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(foundation_root_id,page_id,page_revision_id)
  REFERENCES cms_page_revision(foundation_root_id,page_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,foundation_root_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(expires_at IS NULL OR expires_at>effective_at),
 CHECK((state='WITHDRAWN' AND revoked_at IS NOT NULL)
  OR (state<>'WITHDRAWN' AND revoked_at IS NULL))
);
CREATE INDEX ix_cg18_publication_active
 ON cms_publication(foundation_root_id,state,effective_at,id);

CREATE TABLE cms_page_effective(
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_id uuid NOT NULL,
 publication_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(foundation_root_id,page_id),
 FOREIGN KEY(foundation_root_id,page_id)
  REFERENCES cms_page(foundation_root_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(foundation_root_id,page_id,publication_id)
  REFERENCES cms_publication(foundation_root_id,page_id,id) ON DELETE RESTRICT
);

CREATE TABLE cms_navigation_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 revision_no integer NOT NULL CHECK(revision_no>=1),
 login_desired boolean NOT NULL DEFAULT true,
 member_join_desired boolean NOT NULL DEFAULT false,
 volunteer_join_desired boolean NOT NULL DEFAULT false,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 cg03_decision_ref uuid,
 status text NOT NULL CHECK(status IN('DRAFT','SUBMITTED','APPROVED')),
 effective_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(foundation_root_id,id),
 UNIQUE(foundation_root_id,revision_no),
 FOREIGN KEY(created_by,foundation_root_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(status<>'APPROVED' OR
  (cg03_decision_ref IS NOT NULL AND effective_at IS NOT NULL))
);
CREATE TABLE cms_navigation_effective(
 foundation_root_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 revision_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(foundation_root_id,revision_id)
  REFERENCES cms_navigation_revision(foundation_root_id,id) ON DELETE RESTRICT
);

CREATE TABLE cms_publication_due(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_publication_ref uuid,
 navigation_revision_ref uuid,
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'READY'
  CHECK(status IN('READY','CLAIMED','DONE','CANCELLED','FAILED')),
 attempt_count smallint NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 10),
 next_attempt_at timestamptz,
 last_safe_error text CHECK(char_length(last_safe_error)<=250),
 UNIQUE(foundation_root_id,page_publication_ref),
 UNIQUE(foundation_root_id,navigation_revision_ref),
 FOREIGN KEY(foundation_root_id,page_publication_ref)
  REFERENCES cms_publication(foundation_root_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(foundation_root_id,navigation_revision_ref)
  REFERENCES cms_navigation_revision(foundation_root_id,id) ON DELETE RESTRICT,
 CHECK((page_publication_ref IS NOT NULL) <>
  (navigation_revision_ref IS NOT NULL))
);
CREATE INDEX ix_cg18_due_ready
 ON cms_publication_due(due_at,id) WHERE status='READY';

CREATE TABLE cms_change_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 foundation_root_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 page_or_nav_ref uuid NOT NULL,
 event_key uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','SUBMIT','RETURN',
  'APPROVED','PUBLISH','WITHDRAW','SCHEDULE','EXPIRE','MEDIA_REVOKED')),
 revision_ref uuid,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 redacted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK(jsonb_typeof(redacted_metadata)='object' AND
   octet_length(redacted_metadata::text)<=1024),
 UNIQUE(foundation_root_id,event_key),
 FOREIGN KEY(actor_ref,foundation_root_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg18_recent_audit
 ON cms_change_audit(foundation_root_id,occurred_at DESC,id DESC);

-- Submitted page/sections/assets are immutable. DRAFT editing is an explicit
-- versioned operation in the CMS service; proof never changes a submitted page.
CREATE FUNCTION cg18_guard_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src text;
BEGIN
 IF TG_TABLE_NAME='cms_page_revision' THEN
  IF TG_OP='DELETE' OR OLD.status IN('SUBMITTED','RETURNED') THEN
   RAISE EXCEPTION 'Submitted CMS revisions are immutable' USING ERRCODE='P1831';
  END IF;
  IF NEW.foundation_root_id IS DISTINCT FROM OLD.foundation_root_id OR
     NEW.page_id IS DISTINCT FROM OLD.page_id OR
     NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
     NEW.created_by IS DISTINCT FROM OLD.created_by THEN
   RAISE EXCEPTION 'CMS revision identity cannot change' USING ERRCODE='P1831';
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='cms_section_revision' THEN
  src:='cms_section_revision';
 ELSE src:='cms_asset_placement'; END IF;
 PERFORM 1 FROM cms_page_revision rev
  WHERE rev.id=OLD.page_revision_id AND
   rev.foundation_root_id=OLD.foundation_root_id AND rev.status='DRAFT' FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Submitted CMS content cannot be changed' USING ERRCODE='P1831';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg18_revision_edit_guard BEFORE UPDATE OR DELETE
 ON cms_page_revision FOR EACH ROW EXECUTE FUNCTION cg18_guard_revision_mutation();
CREATE TRIGGER cg18_section_edit_guard BEFORE UPDATE OR DELETE
 ON cms_section_revision FOR EACH ROW EXECUTE FUNCTION cg18_guard_revision_mutation();
CREATE TRIGGER cg18_asset_edit_guard BEFORE UPDATE OR DELETE
 ON cms_asset_placement FOR EACH ROW EXECUTE FUNCTION cg18_guard_revision_mutation();
CREATE TRIGGER cg18_audit_immutable BEFORE UPDATE OR DELETE
 ON cms_change_audit FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
