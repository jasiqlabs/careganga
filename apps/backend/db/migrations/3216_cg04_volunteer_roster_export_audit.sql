-- CG04 original U14: restricted volunteer roster CSV export evidence.
CREATE TABLE volunteer_roster_export_audit (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_ref uuid NOT NULL,
 exported_rows integer NOT NULL CHECK(exported_rows BETWEEN 0 AND 500),
 scope_digest char(64) NOT NULL CHECK(scope_digest ~ '^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE TRIGGER cg04_volunteer_export_audit_immutable BEFORE UPDATE OR DELETE ON volunteer_roster_export_audit
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE INDEX ix_cg04_volunteer_export_actor ON volunteer_roster_export_audit(root_realm_id,actor_ref,occurred_at DESC,id DESC);
