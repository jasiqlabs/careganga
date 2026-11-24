-- Audited on-demand protected report, no stored private export URL.
CREATE TABLE beneficiary_report_access(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL, action text NOT NULL CHECK(action IN('READ','EXPORT')),
 filter_digest char(64) NOT NULL CHECK(filter_digest~'^[a-f0-9]{64}$'),
 row_count integer NOT NULL CHECK(row_count>=0), at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id)
);
CREATE INDEX ix_cg06_report_access_actor ON beneficiary_report_access(root_realm_id,actor_ref,at DESC);
CREATE TRIGGER cg06_report_access_immutable BEFORE UPDATE OR DELETE ON beneficiary_report_access FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();
CREATE INDEX ix_cg06_delivery_period ON assistance_delivery_event(root_realm_id,at,assistance_id);
