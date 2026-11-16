-- CG-19 US-002: durable Foundation-root event notifications, channel-specific
-- outbox/attempts, frozen notice audiences and consent. All are additive.
CREATE TABLE cg19_message_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('CG03_DECISION','NOTICE')),
  channel text NOT NULL CHECK(channel IN ('IN_APP','EMAIL','SMS')),
  version integer NOT NULL CHECK(version>0),
  subject text NOT NULL CHECK(length(subject) BETWEEN 3 AND 120),
  body text NOT NULL CHECK(length(body) BETWEEN 8 AND 480),
  status text NOT NULL CHECK(status IN ('APPROVED','WITHDRAWN')),
  approved_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,kind,channel,version),UNIQUE(id,realm_id),
  UNIQUE(id,realm_id,version),
  FOREIGN KEY(approved_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg19_channel_preference (
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN ('EMAIL','SMS')),
  purpose text NOT NULL CHECK(purpose IN ('TRANSACTIONAL','PROMOTIONAL')),
  opted_in boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(realm_id,account_id,channel,purpose),
  FOREIGN KEY(account_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg19_notice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  author_id uuid NOT NULL,
  title text NOT NULL CHECK(length(title) BETWEEN 5 AND 120),
  body text NOT NULL CHECK(length(body) BETWEEN 10 AND 480),
  priority text NOT NULL CHECK(priority IN ('NORMAL','IMPORTANT')),
  purpose text NOT NULL CHECK(purpose IN ('TRANSACTIONAL','PROMOTIONAL')),
  audience_kind text NOT NULL CHECK(audience_kind IN ('ALL_ACTIVE','ROLE','INDIVIDUAL')),
  audience_ref uuid,
  audience_digest char(64) NOT NULL CHECK(audience_digest ~ '^[a-f0-9]{64}$'),
  audience_count integer NOT NULL CHECK(audience_count BETWEEN 0 AND 1000),
  state text NOT NULL CHECK(state IN('DRAFT','SCHEDULED','ACTIVE','CANCELLED','EXPIRED')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  scheduled_at timestamptz,
  expires_at timestamptz NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,author_id,request_key),UNIQUE(id,realm_id),
  FOREIGN KEY(author_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((audience_kind='ALL_ACTIVE' AND audience_ref IS NULL) OR
    (audience_kind<>'ALL_ACTIVE' AND audience_ref IS NOT NULL)),
  CHECK(scheduled_at IS NULL OR scheduled_at<expires_at),
  CHECK((state='DRAFT' AND approved_at IS NULL) OR
    (state<>'DRAFT' AND (approved_at IS NOT NULL OR state='CANCELLED')))
);
CREATE INDEX ix_cg19_notice_due ON cg19_notice(state,scheduled_at,id)
 WHERE state IN ('SCHEDULED','ACTIVE');
CREATE TABLE cg19_notice_recipient (
  realm_id uuid NOT NULL,
  notice_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  PRIMARY KEY(notice_id,recipient_id),
  FOREIGN KEY(notice_id,realm_id) REFERENCES cg19_notice(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(recipient_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_notice_recipient_scoped ON cg19_notice_recipient(realm_id,recipient_id,notice_id);
CREATE TABLE cg19_decision_cursor (
  realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
  last_created_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  last_decision_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cg19_notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  source_kind text NOT NULL CHECK(source_kind IN ('CG03_DECISION','NOTICE')),
  source_key uuid NOT NULL,
  decision_id uuid,
  case_id uuid,
  notice_id uuid,
  recipient_id uuid NOT NULL,
  template_id uuid NOT NULL,
  template_version integer NOT NULL CHECK(template_version>0),
  channel text NOT NULL CHECK(channel IN ('IN_APP','EMAIL','SMS')),
  subject_snapshot text NOT NULL CHECK(length(subject_snapshot) BETWEEN 3 AND 120),
  body_snapshot text NOT NULL CHECK(length(body_snapshot) BETWEEN 8 AND 480),
  purpose text NOT NULL CHECK(purpose IN ('TRANSACTIONAL','PROMOTIONAL')),
  state text NOT NULL CHECK(state IN(
    'QUEUED','PROVIDER_UNAVAILABLE','SENT_TO_PROVIDER','DELIVERED',
    'UNKNOWN_PROVIDER','RETRY_DUE','FAILED','EXPIRED','SUPPRESSED','IN_APP')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
  claim_token uuid,
  claimed_until timestamptz,
  due_at timestamptz,
  expires_at timestamptz NOT NULL,
  provider_message_ref text CHECK(provider_message_ref IS NULL OR length(provider_message_ref)<=160),
  provider_kind text CHECK(provider_kind IS NULL OR length(provider_kind)<=60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(realm_id,source_kind,source_key,recipient_id,channel,template_id,template_version),
  UNIQUE(id,realm_id),
  FOREIGN KEY(decision_id,case_id,realm_id)
    REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(notice_id,realm_id) REFERENCES cg19_notice(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(template_id,realm_id,template_version)
    REFERENCES cg19_message_template(id,realm_id,version) ON DELETE RESTRICT,
  FOREIGN KEY(recipient_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((source_kind='CG03_DECISION' AND case_id IS NOT NULL AND
    decision_id=source_key AND notice_id IS NULL)
     OR (source_kind='NOTICE' AND notice_id=source_key AND case_id IS NULL
     AND decision_id IS NULL)),
  CHECK((state='IN_APP' AND channel='IN_APP') OR state<>'IN_APP')
);
CREATE INDEX ix_cg19_notifications_inbox ON cg19_notification(realm_id,recipient_id,created_at DESC,id DESC);
CREATE INDEX ix_cg19_notification_due
 ON cg19_notification(due_at,id)
 WHERE channel IN ('EMAIL','SMS') AND state IN(
  'QUEUED','PROVIDER_UNAVAILABLE','RETRY_DUE','UNKNOWN_PROVIDER');
CREATE TABLE cg19_delivery_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  notification_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK(attempt_no BETWEEN 1 AND 5),
  claim_token uuid NOT NULL,
  provider text NOT NULL CHECK(provider IN ('SENDGRID','TWILIO')),
  provider_ref text CHECK(provider_ref IS NULL OR length(provider_ref)<=160),
  result text NOT NULL CHECK(result IN(
    'CLAIMED','ACCEPTED','UNKNOWN','FAILED','DELIVERED','BOUNCED','UNDELIVERED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id,attempt_no),UNIQUE(id,realm_id),
  FOREIGN KEY(notification_id,realm_id) REFERENCES cg19_notification(id,realm_id)
    ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_attempt_provider_ref ON cg19_delivery_attempt(provider,provider_ref)
 WHERE provider_ref IS NOT NULL;
CREATE TABLE cg19_delivery_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL,
  provider_event_id text NOT NULL CHECK(length(provider_event_id) BETWEEN 4 AND 160),
  received_status text NOT NULL CHECK(received_status IN(
    'DELIVERED','BOUNCED','UNDELIVERED','ACCEPTED','UNKNOWN')),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id,provider_event_id),
  FOREIGN KEY(attempt_id,realm_id) REFERENCES cg19_delivery_attempt(id,realm_id)
    ON DELETE RESTRICT
);
CREATE TABLE cg19_notification_read (
  realm_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(recipient_id,notification_id),
  FOREIGN KEY(notification_id,realm_id) REFERENCES cg19_notification(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(recipient_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg19_communication_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  actor_id uuid,
  notification_id uuid,
  notice_id uuid,
  kind text NOT NULL CHECK(kind IN(
    'SOURCE_CAPTURED','NOTICE_DRAFT','NOTICE_APPROVED','NOTICE_CANCELLED',
    'SEND_CLAIMED','PROVIDER_ACCEPTED','PROVIDER_UNKNOWN','PROVIDER_FAILED',
    'PROVIDER_RECEIPT','SUPPRESSED','NOTIFICATION_READ')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(actor_id,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(notification_id,realm_id) REFERENCES cg19_notification(id,realm_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(notice_id,realm_id) REFERENCES cg19_notice(id,realm_id) ON DELETE RESTRICT,
  CHECK(num_nonnulls(notification_id,notice_id) BETWEEN 1 AND 2)
);
CREATE INDEX ix_cg19_comm_event_history
  ON cg19_communication_event(realm_id,occurred_at,id);
CREATE FUNCTION cg19_immutable_comm_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Notification evidence cannot be changed or removed'; END; $$;
CREATE TRIGGER cg19_comm_event_immutable BEFORE UPDATE OR DELETE ON cg19_communication_event
 FOR EACH ROW EXECUTE FUNCTION cg19_immutable_comm_event();
CREATE TRIGGER cg19_delivery_receipt_immutable BEFORE UPDATE OR DELETE ON cg19_delivery_receipt
 FOR EACH ROW EXECUTE FUNCTION cg19_immutable_comm_event();
CREATE FUNCTION cg19_template_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
   NEW.kind IS DISTINCT FROM OLD.kind OR
   NEW.channel IS DISTINCT FROM OLD.channel OR
   NEW.version IS DISTINCT FROM OLD.version OR
   NEW.subject IS DISTINCT FROM OLD.subject OR
   NEW.body IS DISTINCT FROM OLD.body OR
   NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
   RAISE EXCEPTION 'Versioned notification template cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_message_template_frozen BEFORE UPDATE ON cg19_message_template
 FOR EACH ROW EXECUTE FUNCTION cg19_template_frozen();
CREATE FUNCTION cg19_notice_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
    NEW.author_id IS DISTINCT FROM OLD.author_id OR
    NEW.request_key IS DISTINCT FROM OLD.request_key OR
    NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
    NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body OR
    NEW.priority IS DISTINCT FROM OLD.priority OR
    NEW.purpose IS DISTINCT FROM OLD.purpose OR
    NEW.audience_kind IS DISTINCT FROM OLD.audience_kind OR
    NEW.audience_ref IS DISTINCT FROM OLD.audience_ref OR
    NEW.audience_digest IS DISTINCT FROM OLD.audience_digest OR
    NEW.audience_count IS DISTINCT FROM OLD.audience_count OR
    NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
   RAISE EXCEPTION 'Frozen approved notice cannot be changed';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_notice_identity_frozen BEFORE UPDATE ON cg19_notice
 FOR EACH ROW EXECUTE FUNCTION cg19_notice_frozen();

-- CG-03-owned index supporting the bounded, monotonic committed-decision
-- adapter without scanning every account or tenant while idle.
CREATE INDEX ix_cg03_decision_root_cursor
 ON cg03_case_decision(realm_id,created_at,id);
