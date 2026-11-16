-- CG-19 US-003. Additive Foundation-only contact/helpdesk/FAQ authority.
-- No CG-14 centers, CG-18 content tables, or provider delivery dependency.
CREATE TABLE cg19_support_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  source_channel text NOT NULL DEFAULT 'FOUNDATION_PUBLIC'
    CHECK (source_channel='FOUNDATION_PUBLIC'),
  request_key uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  caller_digest text NOT NULL CHECK (caller_digest ~ '^[a-f0-9]{64}$'),
  receipt_digest text NOT NULL UNIQUE CHECK (receipt_digest ~ '^[a-f0-9]{64}$'),
  receipt_expires_at timestamptz NOT NULL,
  request_encrypted bytea NOT NULL CHECK (length(request_encrypted)>40),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','REPLIED','CLOSED')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  assigned_account_id uuid,
  latest_inbound_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(id,realm_id),
  UNIQUE(realm_id,source_channel,request_key),
  FOREIGN KEY(assigned_account_id,realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT,
  CHECK ((status='CLOSED') = (closed_at IS NOT NULL))
);
CREATE INDEX ix_cg19_support_queue
 ON cg19_support_case(realm_id,status,updated_at DESC,id DESC);
CREATE INDEX ix_cg19_support_assignee
 ON cg19_support_case(realm_id,assigned_account_id,updated_at DESC,id DESC);

-- Search only opaque HMAC-derived word/prefix digests, never plaintext name,
-- contact, subject, messages or unkeyed PII hashes. Bounded at 200 per case.
CREATE TABLE cg19_support_search_token (
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  term_digest text NOT NULL CHECK (term_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY(case_id,term_digest),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg19_support_case(id,realm_id)
    ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_support_search_term
 ON cg19_support_search_token(realm_id,term_digest,case_id);

CREATE TABLE cg19_support_reply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  author_account_id uuid NOT NULL,
  request_key uuid NOT NULL,
  body_digest text NOT NULL CHECK (body_digest ~ '^[a-f0-9]{64}$'),
  body_encrypted bytea NOT NULL CHECK (length(body_encrypted)>32),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id,author_account_id,request_key),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg19_support_case(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(author_account_id,realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_support_reply_timeline
 ON cg19_support_reply(realm_id,case_id,created_at,id);

CREATE TABLE cg19_support_read_state (
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  operator_account_id uuid NOT NULL,
  last_seen_inbound_at timestamptz,
  archived_at timestamptz,
  PRIMARY KEY(case_id,operator_account_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg19_support_case(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(operator_account_id,realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_support_operator_archive
 ON cg19_support_read_state(realm_id,operator_account_id,archived_at);

CREATE TABLE cg19_support_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL CHECK (kind IN
    ('CONTACT_SUBMITTED','ASSIGNED','REPLIED','CLOSED','REOPENED','READ','ARCHIVED','RESTORED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg19_support_case(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_support_event_case
 ON cg19_support_event(realm_id,case_id,occurred_at,id);

CREATE TABLE cg19_support_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  question text NOT NULL CHECK(length(question) BETWEEN 5 AND 200),
  normalized_question text NOT NULL CHECK(length(normalized_question) BETWEEN 5 AND 200),
  answer text NOT NULL CHECK(length(answer) BETWEEN 10 AND 1600),
  state text NOT NULL DEFAULT 'DRAFT'
    CHECK(state IN ('DRAFT','PUBLISHED','WITHDRAWN')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,realm_id),
  FOREIGN KEY(created_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_cg19_support_faq_active_question
 ON cg19_support_faq(realm_id,normalized_question)
 WHERE state='PUBLISHED';
CREATE INDEX ix_cg19_support_faq_public
 ON cg19_support_faq(realm_id,state,updated_at DESC,id DESC);

CREATE TABLE cg19_support_faq_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL,
  faq_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision>0),
  state text NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','WITHDRAWN')),
  question text NOT NULL,
  answer text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(faq_id,revision),
  FOREIGN KEY(faq_id,realm_id) REFERENCES cg19_support_faq(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id)
    ON DELETE RESTRICT
);

-- Bounded anonymous buckets contain only HMAC digests, never raw IPs/contacts.
CREATE TABLE cg19_support_guest_throttle (
  bucket_digest text PRIMARY KEY CHECK (bucket_digest ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK(attempt_count>0)
);

CREATE INDEX ix_cg19_guest_throttle_retention
 ON cg19_support_guest_throttle(window_started_at,bucket_digest);

CREATE FUNCTION cg19_support_immutable_evidence() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Original support evidence is immutable';
END; $$;
CREATE TRIGGER cg19_support_search_immutable BEFORE UPDATE OR DELETE ON cg19_support_search_token
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
CREATE TRIGGER cg19_support_reply_immutable BEFORE UPDATE OR DELETE ON cg19_support_reply
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
CREATE TRIGGER cg19_support_event_immutable BEFORE UPDATE OR DELETE ON cg19_support_event
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();
CREATE TRIGGER cg19_support_faq_revision_immutable BEFORE UPDATE OR DELETE ON cg19_support_faq_revision
 FOR EACH ROW EXECUTE FUNCTION cg19_support_immutable_evidence();

-- Contact ownership, proof, and payload are immutable after acceptance.
CREATE FUNCTION cg19_support_case_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.source_channel IS DISTINCT FROM OLD.source_channel OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
    NEW.caller_digest IS DISTINCT FROM OLD.caller_digest OR
    NEW.receipt_digest IS DISTINCT FROM OLD.receipt_digest OR
    NEW.receipt_expires_at IS DISTINCT FROM OLD.receipt_expires_at OR
    NEW.request_encrypted IS DISTINCT FROM OLD.request_encrypted OR
    NEW.latest_inbound_at IS DISTINCT FROM OLD.latest_inbound_at OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.revision <> OLD.revision+1 THEN
   RAISE EXCEPTION 'Protected support source cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_support_case_guard BEFORE UPDATE ON cg19_support_case
 FOR EACH ROW EXECUTE FUNCTION cg19_support_case_guard();
