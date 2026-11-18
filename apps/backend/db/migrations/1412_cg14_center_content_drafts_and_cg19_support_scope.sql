-- CG-14 US-005 (draft/source only): typed, versioned center presentation
-- and original CG-19 case ownership. Does not independently authorize
-- publication or invent another helpdesk/approval case master.
CREATE TABLE health_center_content_draft(
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 state text NOT NULL DEFAULT 'DRAFT'
   CHECK(state IN('DRAFT','SUBMITTED','RETURNED')),
 content jsonb NOT NULL DEFAULT '{}'::jsonb
   CHECK(jsonb_typeof(content)='object'),
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,center_id),
 FOREIGN KEY(root_realm_id,center_id)
   REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE health_center_content_revision(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 source_version integer NOT NULL CHECK(source_version>0),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 submitted_by uuid NOT NULL,
 approval_case_ref uuid,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,id),
 UNIQUE(root_realm_id,center_id,revision_no),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approval_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_content_latest
 ON health_center_content_revision(root_realm_id,center_id,revision_no DESC,id DESC);
CREATE OR REPLACE FUNCTION cg14_center_content_revision_frozen()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR
  NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.center_id IS DISTINCT FROM OLD.center_id OR
  NEW.id IS DISTINCT FROM OLD.id OR
  NEW.revision_no IS DISTINCT FROM OLD.revision_no OR
  NEW.source_version IS DISTINCT FROM OLD.source_version OR
  NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR
  NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
  NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
  NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
  (OLD.approval_case_ref IS NOT NULL AND
   NEW.approval_case_ref IS DISTINCT FROM OLD.approval_case_ref) THEN
   RAISE EXCEPTION 'Submitted center content cannot be rewritten';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg14_center_content_revision_immutable
 BEFORE UPDATE OR DELETE ON health_center_content_revision
 FOR EACH ROW EXECUTE FUNCTION cg14_center_content_revision_frozen();

CREATE TABLE health_center_content_publication(
 root_realm_id uuid NOT NULL,
 center_id uuid NOT NULL,
 approved_revision_id uuid NOT NULL,
 original_decision_ref uuid NOT NULL,
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,center_id),
 FOREIGN KEY(root_realm_id,center_id,approved_revision_id)
  REFERENCES health_center_content_revision(root_realm_id,center_id,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(original_decision_ref,root_realm_id)
  REFERENCES cg03_case_decision(id,realm_id) ON DELETE RESTRICT
);

-- Integrate a REAL original CG-19 support_case, not a CG-14 ticket clone.
ALTER TABLE cg19_support_case ADD COLUMN center_id uuid;
ALTER TABLE cg19_support_case ADD CONSTRAINT fk_cg19_center_support_source
 FOREIGN KEY(realm_id,center_id) REFERENCES health_center(root_realm_id,id)
 ON DELETE RESTRICT;
ALTER TABLE cg19_support_case DROP CONSTRAINT cg19_support_case_source_channel_check;
ALTER TABLE cg19_support_case ADD CONSTRAINT cg19_support_case_source_channel_check CHECK(
 (source_channel='FOUNDATION_PUBLIC' AND center_id IS NULL) OR
 (source_channel='CENTER_PORTAL' AND center_id IS NOT NULL));
CREATE INDEX ix_cg19_support_center_queue
 ON cg19_support_case(realm_id,center_id,updated_at DESC,id DESC)
 WHERE source_channel='CENTER_PORTAL';
-- Existing 0024 trigger must also protect this new immutable owner key.
CREATE OR REPLACE FUNCTION cg19_support_case_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.source_channel IS DISTINCT FROM OLD.source_channel OR
    NEW.center_id IS DISTINCT FROM OLD.center_id OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
    NEW.caller_digest IS DISTINCT FROM OLD.caller_digest OR
    NEW.receipt_digest IS DISTINCT FROM OLD.receipt_digest OR
    NEW.receipt_expires_at IS DISTINCT FROM OLD.receipt_expires_at OR
    NEW.request_encrypted IS DISTINCT FROM OLD.request_encrypted OR
    NEW.latest_inbound_at IS DISTINCT FROM OLD.latest_inbound_at OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.revision<>OLD.revision+1 THEN
   RAISE EXCEPTION 'Protected support source cannot be rewritten';
 END IF;
 RETURN NEW;
END $$;
