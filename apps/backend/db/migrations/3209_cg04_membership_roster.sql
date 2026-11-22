-- CG04 US002 original B09 roster and read audit. No duplicate person master.
CREATE INDEX ix_cg04_member_roster ON member(root_realm_id,branch_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg04_member_original_account ON member(root_realm_id,account_ref);
CREATE TABLE membership_member_export_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 actor_ref uuid NOT NULL,
 exported_rows integer NOT NULL CHECK(exported_rows BETWEEN 0 AND 500),
 scope_digest char(64) NOT NULL CHECK(scope_digest~'^[a-f0-9]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg04_member_export_audit_scope ON membership_member_export_audit(root_realm_id,occurred_at DESC,id);
CREATE TRIGGER cg04_member_export_immutable BEFORE UPDATE OR DELETE ON membership_member_export_audit FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
