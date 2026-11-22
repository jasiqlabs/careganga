-- CG04 US003-QA17 optional original CG19 approved volunteer card.
-- Uses the already genuine Foundation logo/seal/signature owner; no public member PII.
CREATE TABLE cg19_volunteer_card(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),volunteer_id uuid NOT NULL,
 brand_version integer NOT NULL,issue_revision integer NOT NULL CHECK(issue_revision>0),
 issue_key uuid NOT NULL,issued_by uuid NOT NULL,
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 qr_token_digest char(64) NOT NULL CHECK(qr_token_digest~'^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','VERIFYING','UNKNOWN','ISSUED','REVOKED')),
 claim_token uuid,claim_expires_at timestamptz,attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 object_version text CHECK(length(object_version) BETWEEN 1 AND 160),
 content_sha256 char(64) CHECK(content_sha256~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz,revoked_at timestamptz,
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,issued_by,issue_key),
 UNIQUE(root_realm_id,volunteer_id,issue_revision),UNIQUE(qr_token_digest),
 FOREIGN KEY(root_realm_id,volunteer_id) REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,brand_version) REFERENCES cg19_member_brand_config(root_realm_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(state<>'ISSUED' OR (issued_at IS NOT NULL AND object_version IS NOT NULL AND content_sha256 IS NOT NULL)),
 CHECK(state<>'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_cg19_volunteer_card_current ON cg19_volunteer_card(root_realm_id,volunteer_id)
 WHERE state IN('PENDING','VERIFYING','UNKNOWN','ISSUED');
CREATE INDEX ix_cg19_volunteer_card_owner ON cg19_volunteer_card(root_realm_id,volunteer_id,created_at DESC,id DESC);
CREATE TABLE cg19_volunteer_card_event(
 root_realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 card_id uuid NOT NULL,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('PENDING','ISSUED','UNKNOWN','REVOKED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(root_realm_id,card_id) REFERENCES cg19_volunteer_card(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg19_volunteer_card_event_immutable BEFORE UPDATE OR DELETE ON cg19_volunteer_card_event
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE FUNCTION cg19_volunteer_card_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Official volunteer credential must be retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.root_realm_id,NEW.id,NEW.volunteer_id,NEW.brand_version,NEW.issue_revision,NEW.issue_key,NEW.issued_by,NEW.source_snapshot,NEW.source_digest,NEW.qr_token_digest,NEW.object_key,NEW.created_at)
   IS DISTINCT FROM
   (OLD.root_realm_id,OLD.id,OLD.volunteer_id,OLD.brand_version,OLD.issue_revision,OLD.issue_key,OLD.issued_by,OLD.source_snapshot,OLD.source_digest,OLD.qr_token_digest,OLD.object_key,OLD.created_at)
   OR OLD.state='REVOKED'
   OR NOT ((OLD.state='PENDING' AND NEW.state IN('VERIFYING','REVOKED'))
    OR (OLD.state='VERIFYING' AND NEW.state IN('ISSUED','UNKNOWN','REVOKED'))
    OR (OLD.state='VERIFYING' AND NEW.state='VERIFYING'
      AND OLD.claim_expires_at IS NOT NULL AND OLD.claim_expires_at<=now()
      AND NEW.claim_token IS DISTINCT FROM OLD.claim_token
      AND NEW.claim_token IS NOT NULL AND NEW.claim_expires_at>now()
      AND NEW.attempt_count=OLD.attempt_count+1)
    OR (OLD.state='UNKNOWN' AND NEW.state IN('VERIFYING','REVOKED'))
    OR (OLD.state='ISSUED' AND NEW.state='REVOKED'))
  THEN RAISE EXCEPTION 'Official volunteer card issuance history cannot be modified'; END IF;
  IF (OLD.object_version,OLD.content_sha256,OLD.issued_at,OLD.revoked_at) IS DISTINCT FROM
    (NEW.object_version,NEW.content_sha256,NEW.issued_at,NEW.revoked_at)
    AND NOT ((OLD.state='VERIFYING' AND NEW.state='ISSUED' AND OLD.object_version IS NULL
      AND OLD.content_sha256 IS NULL AND NEW.object_version IS NOT NULL
      AND NEW.content_sha256 IS NOT NULL AND NEW.issued_at IS NOT NULL)
      OR (NEW.state='REVOKED' AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL
       AND (NEW.object_version,NEW.content_sha256,NEW.issued_at)
        IS NOT DISTINCT FROM (OLD.object_version,OLD.content_sha256,OLD.issued_at)))
  THEN RAISE EXCEPTION 'Original approved volunteer card file must remain immutable'; END IF;
 ELSE
  IF NEW.state<>'PENDING' OR NEW.issue_revision<1 OR
   NOT EXISTS(SELECT 1 FROM volunteer v JOIN volunteer_approval_effect effect
    ON effect.root_realm_id=v.root_realm_id AND effect.volunteer_id=v.id
    JOIN cg03_case decision ON decision.realm_id=effect.root_realm_id AND decision.id=effect.case_id
    WHERE v.root_realm_id=NEW.root_realm_id AND v.id=NEW.volunteer_id AND v.status='ACTIVE'
     AND decision.case_kind='VOLUNTEER_APPLICATION' AND decision.status='OWNER_COMPLETED')
   OR NOT EXISTS(SELECT 1 FROM cg19_member_brand_config brand WHERE brand.root_realm_id=NEW.root_realm_id
    AND brand.version=NEW.brand_version AND brand.status='APPROVED')
  THEN RAISE EXCEPTION 'Only currently genuine approved volunteer and Foundation brand can be issued'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_volunteer_card_write BEFORE INSERT OR UPDATE OR DELETE ON cg19_volunteer_card
 FOR EACH ROW EXECUTE FUNCTION cg19_volunteer_card_guard();
