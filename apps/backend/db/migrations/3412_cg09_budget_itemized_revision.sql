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
-- A frozen/submitted/approved revision may never acquire later item rows.
-- DRAFT save writes revision N while the budget may still be on N-1; RETURNED
-- revision must always use the NEW version, never alter the reviewed one.
CREATE FUNCTION cg09_budget_item_revision_insert_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg09item$
DECLARE source record;
BEGIN
 SELECT status,version INTO source FROM finance_budget
 WHERE root_realm_id=NEW.root_realm_id AND id=NEW.budget_id FOR UPDATE;
 IF NOT FOUND OR NOT (
  (source.status='DRAFT' AND
   (NEW.version=source.version OR NEW.version=source.version+1))
  OR (source.status='RETURNED' AND NEW.version=source.version+1)
 ) THEN
  RAISE EXCEPTION 'A reviewed original budget revision cannot gain new item lines'
   USING ERRCODE='P0924';
 END IF;
 RETURN NEW;
END; $cg09item$;
CREATE TRIGGER cg09_budget_item_revision_insert_guard
 BEFORE INSERT ON finance_budget_item_revision
 FOR EACH ROW EXECUTE FUNCTION cg09_budget_item_revision_insert_guard();

-- Prevent submitting a draft with appended/mismatched lines, including
-- direct SQL inserts after a DRAFT save. Legacy unitemized budgets remain valid.
CREATE FUNCTION cg09_budget_itemized_submit_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg09itemsum$
DECLARE line_count integer; item_total numeric;
BEGIN
 IF NEW.status='SUBMITTED' AND OLD.status IS DISTINCT FROM 'SUBMITTED' THEN
  SELECT count(*)::integer,coalesce(sum(line_total_minor),0)
   INTO line_count,item_total
  FROM finance_budget_item_revision
  WHERE root_realm_id=NEW.root_realm_id AND budget_id=NEW.id AND version=NEW.version;
  IF line_count>0 AND item_total<>NEW.approved_ceiling_minor THEN
   RAISE EXCEPTION 'Reviewed item quantities and rates must equal the approved ceiling'
    USING ERRCODE='P0924';
  END IF;
 END IF;
 RETURN NEW;
END; $cg09itemsum$;
CREATE TRIGGER cg09_budget_itemized_submit_guard
 BEFORE UPDATE OF status ON finance_budget
 FOR EACH ROW EXECUTE FUNCTION cg09_budget_itemized_submit_guard();

-- No backfill or invented quantities: an old approved budget with no item rows
-- remains honestly "not itemized" until a real new Finance revision.
