-- CG-20 / US-003–005. One additive CG-20-owned metadata migration.
-- Original source data remains in CG-09/15 and files/delivery in CG-19.
-- No seeds, renamed business masters, public data, or tenant-wide backfill.

CREATE TABLE cg20_report_definition(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000000),
 source_key text NOT NULL
  CHECK(source_key IN('FINANCE_POSTED_LEDGER','FINANCE_POSTED_SUMMARY',
   'FINANCE_POSTED_TREND','APPOINTMENT_STATUS')),
 view_kind text NOT NULL CHECK(view_kind IN('TABLE','SUMMARY','CHART')),
 safe_request jsonb NOT NULL CHECK(jsonb_typeof(safe_request)='object'
  AND octet_length(safe_request::text)<=4096),
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id,revision),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE cg20_saved_report(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 owner_account_ref uuid NOT NULL,
 display_name varchar(100) NOT NULL CHECK(length(trim(display_name)) BETWEEN 3 AND 100),
 normalized_name varchar(100) GENERATED ALWAYS AS (lower(btrim(display_name))) STORED,
 definition_ref uuid NOT NULL,
 current_revision integer NOT NULL DEFAULT 1 CHECK(current_revision>=1),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 1000000),
 visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility='PRIVATE'),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,id,owner_account_ref),
 FOREIGN KEY(owner_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,definition_ref,current_revision)
  REFERENCES cg20_report_definition(root_realm_id,id,revision) ON DELETE RESTRICT,
 CHECK((state='ACTIVE' AND retired_at IS NULL) OR
       (state='RETIRED' AND retired_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_cg20_saved_active_name ON cg20_saved_report
 (root_realm_id,owner_account_ref,normalized_name) WHERE state='ACTIVE';
CREATE INDEX ix_cg20_saved_owner_recent ON cg20_saved_report
 (root_realm_id,owner_account_ref,updated_at DESC,id DESC);

-- Source-only retry identity: one request key per account+root, payload digest
-- and immutable outcome. No duplicate revisions on ambiguous network retries.
CREATE TABLE cg20_saved_request(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 action_kind text NOT NULL CHECK(action_kind IN('CREATE','REVISE','COPY','RETIRE')),
 saved_ref uuid NOT NULL,
 saved_version integer NOT NULL CHECK(saved_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,saved_ref) REFERENCES cg20_saved_report(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg20_saved_requests_recent ON cg20_saved_request
 (root_realm_id,actor_ref,created_at DESC);

-- US-004 creates only metadata here. Actual document bytes are CG-19-owned.
CREATE TABLE cg20_report_run(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 requester_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 source_key text NOT NULL CHECK(source_key IN('FINANCE_POSTED_LEDGER',
  'FINANCE_POSTED_SUMMARY','FINANCE_POSTED_TREND','APPOINTMENT_STATUS')),
 safe_request jsonb NOT NULL CHECK(jsonb_typeof(safe_request)='object'
  AND octet_length(safe_request::text)<=4096),
 saved_ref uuid,
 definition_revision integer,
 run_origin text NOT NULL DEFAULT 'ON_DEMAND' CHECK(run_origin IN('ON_DEMAND','SCHEDULED')),
 schedule_ref uuid,
 occurrence_due_utc timestamptz,
 state text NOT NULL DEFAULT 'QUEUED'
  CHECK(state IN('QUEUED','RUNNING','READY','EMPTY','FAILED','EXPIRED','REVOKED','UNKNOWN')),
 artifact_ref uuid,
 format text CHECK(format IS NULL OR format IN('PDF','XLSX','CSV')),
 source_as_of timestamptz,
 result_row_count integer CHECK(result_row_count BETWEEN 0 AND 500),
 error_class text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,requester_ref,request_key),
 FOREIGN KEY(requester_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,saved_ref) REFERENCES cg20_saved_report(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((run_origin='ON_DEMAND' AND schedule_ref IS NULL AND occurrence_due_utc IS NULL)
    OR (run_origin='SCHEDULED' AND schedule_ref IS NOT NULL AND occurrence_due_utc IS NOT NULL)),
 CHECK((saved_ref IS NULL AND definition_revision IS NULL) OR
       (saved_ref IS NOT NULL AND definition_revision IS NOT NULL)),
 CHECK(state<>'READY' OR (artifact_ref IS NOT NULL AND format IS NOT NULL))
);
CREATE INDEX ix_cg20_runs_actor_recent ON cg20_report_run
 (root_realm_id,requester_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg20_runs_expiry ON cg20_report_run(expires_at,id)
 WHERE state IN('READY','EMPTY','FAILED','REVOKED');
CREATE INDEX ix_cg20_scheduled_queued ON cg20_report_run(created_at,id)
 WHERE run_origin='SCHEDULED' AND state='QUEUED';
CREATE INDEX ix_cg20_scheduled_stale ON cg20_report_run(updated_at,id)
 WHERE run_origin='SCHEDULED' AND state='RUNNING';

-- US-005 schedule metadata. ACTIVE only after a separately authorized worker
-- exists. Current service deliberately creates PAUSED schedules.
CREATE TABLE cg20_report_schedule(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 owner_account_ref uuid NOT NULL,
 saved_ref uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 cadence text NOT NULL CHECK(cadence IN('DAILY','WEEKLY','MONTHLY','YEARLY')),
 timezone text NOT NULL CHECK(char_length(timezone) BETWEEN 3 AND 64),
 local_time time NOT NULL,
 weekday smallint CHECK(weekday IS NULL OR weekday BETWEEN 0 AND 6),
 monthday smallint CHECK(monthday IS NULL OR monthday BETWEEN 1 AND 28),
 annual_month smallint CHECK(annual_month IS NULL OR annual_month BETWEEN 1 AND 12),
 next_due_utc timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'PAUSED'
  CHECK(state IN('ACTIVE','PAUSED','DISABLED')),
 channel text NOT NULL DEFAULT 'IN_APP'
  CHECK(channel IN('IN_APP','EMAIL','SMS')),
 revision integer NOT NULL DEFAULT 1
  CHECK(revision BETWEEN 1 AND 1000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,owner_account_ref,request_key),
 FOREIGN KEY(owner_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,saved_ref)
  REFERENCES cg20_saved_report(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg20_due_only ON cg20_report_schedule(next_due_utc,id)
 WHERE state='ACTIVE';
CREATE INDEX ix_cg20_schedule_owner ON cg20_report_schedule
 (root_realm_id,owner_account_ref,updated_at DESC,id DESC);
ALTER TABLE cg20_report_run ADD CONSTRAINT fk_cg20_scheduled_run_same_root
 FOREIGN KEY(root_realm_id,schedule_ref)
 REFERENCES cg20_report_schedule(root_realm_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_cg20_one_run_per_occurrence ON cg20_report_run
 (root_realm_id,schedule_ref,occurrence_due_utc,definition_revision)
 WHERE run_origin='SCHEDULED';

CREATE TABLE cg20_report_delivery_attempt(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 run_ref uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN('IN_APP','EMAIL','SMS')),
 state text NOT NULL DEFAULT 'QUEUED'
  CHECK(state IN('QUEUED','SENT_PENDING','CONFIRMED','SUPPRESSED',
   'FAILED','UNAVAILABLE')),
 original_cg19_notification_ref uuid,
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 next_retry_utc timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,run_ref,recipient_account_ref,channel),
 FOREIGN KEY(root_realm_id,run_ref)
  REFERENCES cg20_report_run(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg20_delivery_due ON cg20_report_delivery_attempt
 (next_retry_utc,id)
 WHERE state IN('QUEUED','SENT_PENDING','FAILED');
