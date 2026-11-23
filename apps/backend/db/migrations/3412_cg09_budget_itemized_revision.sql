-- CG09 original approved budget: B02/B08 category / quantity / unit-rate proof.
-- Item rows are immutable budget REVISION details, not another allocation,
-- cash, utilized balance, journal or CG08 source.
CREATE TABLE finance_budget_item_revision(
 root_realm_id uuid NOT NULL,
 budget_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 line_no smallint NOT NULL CHECK(line_no BETWEEN 1 AND 30),
 description text NOT NULL CHECK(char_length(btrim(description)) BETWEEN 3 AND 200),
 quantity_milli bigint NOT NULL CHECK(quantity_milli BETWEEN 1 AND 9999999999999),
 unit_rate_minor bigint NOT NULL CHECK(unit_rate_minor BETWEEN 1 AND 99999999999999),
 line_total_minor bigint GENERATED ALWAYS AS
  ((quantity_milli::numeric*unit_rate_minor::numeric/1000)::bigint) STORED,
 PRIMARY KEY(root_realm_id,budget_id,version,line_no),
 FOREIGN KEY(root_realm_id,budget_id,version)
  REFERENCES finance_budget_revision(root_realm_id,budget_id,version) ON DELETE RESTRICT,
 CHECK(mod(quantity_milli::numeric*unit_rate_minor::numeric,1000)=0),
 CHECK(quantity_milli::numeric*unit_rate_minor::numeric/1000 BETWEEN 1 AND 99999999999999)
);
CREATE TRIGGER cg09_budget_item_revision_immutable
 BEFORE UPDATE OR DELETE ON finance_budget_item_revision
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
-- No backfill or invented quantities: an old approved budget with no item rows
-- remains honestly "not itemized" until a real new Finance revision.
