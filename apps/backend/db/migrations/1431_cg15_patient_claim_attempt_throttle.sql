-- CG-15 US-003: only authenticated patient-account claim attempts are metered.
-- One bounded row per account; no phone, patient ID, code, IP or PII stored.
-- No per-tenant poller or automated cleanup job is required.
CREATE TABLE cg15_patient_claim_attempt_throttle(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 window_started_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 2147483645),
 PRIMARY KEY(root_realm_id,account_id),
 FOREIGN KEY(account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
COMMENT ON TABLE cg15_patient_claim_attempt_throttle IS
 'Single authenticated account claim-attempt budget; fixed-window updates, no raw proof or target patient data';
COMMENT ON COLUMN cg15_patient_claim_attempt_throttle.window_started_at IS
 'Start of the present 15-minute window, atomically reset on the next valid claim attempt';
