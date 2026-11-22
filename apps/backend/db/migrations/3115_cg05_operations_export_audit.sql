-- CG05 US005: successful private report generation audit, no report/source master.
CREATE TABLE cg05_export_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 actor_account_ref uuid NOT NULL,
 report_kind text NOT NULL CHECK(report_kind IN('PROJECTS','TASKS','ACTIVITIES','VISITS','OPERATIONS')),
 scope_kind text NOT NULL CHECK(scope_kind IN('MINE','PERMITTED')),
 row_count integer NOT NULL CHECK(row_count BETWEEN 0 AND 1000),
 filter_digest text NOT NULL CHECK(filter_digest ~ '^[0-9a-f]{64}$'),
 generated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX cg05_export_audit_actor_idx ON cg05_export_audit(root_realm_id,actor_account_ref,generated_at DESC);
CREATE FUNCTION cg05_export_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CG05 export audit is append only'; END $$;
CREATE TRIGGER cg05_export_audit_no_mutation BEFORE UPDATE OR DELETE ON cg05_export_audit FOR EACH ROW EXECUTE FUNCTION cg05_export_audit_immutable();
