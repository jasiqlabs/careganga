-- Original CG19 newsletter opt-in/withdrawal owner, distinct from care/identity consent.
CREATE TABLE cg19_newsletter_subscription (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 email_digest text NOT NULL CHECK (email_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('SUBSCRIBED','WITHDRAWN')),
 email_encrypted bytea,
 withdrawal_digest text CHECK (withdrawal_digest ~ '^[0-9a-f]{64}$'),
 consent_version integer NOT NULL CHECK (consent_version > 0),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 subscribed_at timestamptz,
 withdrawn_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,email_digest),
 CHECK ((state='SUBSCRIBED' AND email_encrypted IS NOT NULL AND withdrawal_digest IS NOT NULL AND subscribed_at IS NOT NULL AND withdrawn_at IS NULL)
 OR (state='WITHDRAWN' AND email_encrypted IS NULL AND withdrawn_at IS NOT NULL))
);
CREATE TABLE cg19_newsletter_challenge (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 email_digest text NOT NULL CHECK (email_digest ~ '^[0-9a-f]{64}$'),
 action text NOT NULL CHECK (action IN ('SUBSCRIBE','WITHDRAW')),
 id uuid NOT NULL UNIQUE,
 code_digest text NOT NULL CHECK (code_digest ~ '^[0-9a-f]{64}$'),
 withdrawal_digest text CHECK (withdrawal_digest ~ '^[0-9a-f]{64}$'),
 consent_version integer NOT NULL CHECK (consent_version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
 consumed_at timestamptz,
 confirmed_revision integer,
 PRIMARY KEY(root_realm_id,email_digest,action),
 CHECK (expires_at > created_at),
 CHECK (action='WITHDRAW' OR withdrawal_digest IS NOT NULL),
 CHECK ((consumed_at IS NULL AND confirmed_revision IS NULL) OR (consumed_at IS NOT NULL AND confirmed_revision IS NOT NULL))
);
CREATE INDEX cg19_newsletter_expired ON cg19_newsletter_challenge(expires_at);
CREATE TABLE cg19_newsletter_consent_event (
 id uuid PRIMARY KEY,
 root_realm_id uuid NOT NULL REFERENCES access_realm(id),
 email_digest text NOT NULL CHECK (email_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('SUBSCRIBED','WITHDRAWN')),
 consent_version integer NOT NULL CHECK (consent_version>0),
 revision integer NOT NULL CHECK (revision>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,email_digest,revision),
 FOREIGN KEY(root_realm_id,email_digest) REFERENCES cg19_newsletter_subscription(root_realm_id,email_digest)
);
