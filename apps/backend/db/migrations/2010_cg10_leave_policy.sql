-- CG10 US002 original Foundation leave policy history; no simulated approval or balance.
CREATE TABLE hr_leave_policy(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 leave_type text NOT NULL CHECK(length(btrim(leave_type)) BETWEEN 2 AND 80),
 type_key text NOT NULL CHECK(length(btrim(type_key)) BETWEEN 2 AND 80),
 annual_half_days integer NOT NULL CHECK(annual_half_days BETWEEN 1 AND 732),
 allow_half_days boolean NOT NULL,
 count_weekly_off boolean NOT NULL,
 accrual_rule text NOT NULL DEFAULT 'ANNUAL' CHECK(accrual_rule='ANNUAL'),
 effective_from date NOT NULL,
 effective_to date,
 version integer NOT NULL CHECK(version>0),
 created_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,type_key,version),
 UNIQUE(root_realm_id,type_key,effective_from),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK(allow_half_days OR annual_half_days%2=0)
);
CREATE UNIQUE INDEX ux_hr_leave_policy_current ON hr_leave_policy(root_realm_id,type_key) WHERE effective_to IS NULL;
CREATE INDEX ix_hr_leave_policy_dates ON hr_leave_policy(root_realm_id,effective_from DESC,id DESC);
