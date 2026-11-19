-- CG15 US-005-QA08: a verified center actor may query an issued QR only
-- within a small bounded authenticated budget. No QR secret/token, patient
-- identity or clinical payload is retained in this security audit.
CREATE TABLE cg15_center_qr_verify_budget(
 root_realm_id uuid NOT NULL,
 actor_account_id uuid NOT NULL,
 center_id uuid NOT NULL,
 window_started_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 limited_requests integer NOT NULL DEFAULT 0 CHECK(limited_requests>=0),
 last_rejected_at timestamptz,
 PRIMARY KEY(root_realm_id,actor_account_id,center_id),
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT
);
COMMENT ON TABLE cg15_center_qr_verify_budget IS
 'Current 15-minute authenticated QR verification budget for one assigned center; contains no QR token or patient record';

CREATE TABLE cg15_center_qr_verification_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 actor_account_id uuid NOT NULL,
 center_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('VALID','DENIED')),
 verified_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_qr_verification_audit
 ON cg15_center_qr_verification_audit(root_realm_id,center_id,verified_at DESC,id);
COMMENT ON TABLE cg15_center_qr_verification_audit IS
 'Original assigned-center QR verification success/denial, without QR digest, patient data or a public lookup result';

CREATE FUNCTION cg15_qr_verification_audit_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'CG15 QR verification audit is immutable';
END; $$;
CREATE TRIGGER cg15_qr_verification_audit_immutable
 BEFORE UPDATE OR DELETE ON cg15_center_qr_verification_audit
 FOR EACH ROW EXECUTE FUNCTION cg15_qr_verification_audit_immutable();
