-- Original U42: CG09 owns ONE real expense claim and payment/ledger.
-- Additional CG04 identity references are immutable source provenance, not a payable or payment.
ALTER TABLE expense_claim
 ADD COLUMN volunteer_ref uuid,
 ADD COLUMN volunteer_branch_ref uuid,
 ADD COLUMN volunteer_project_ref uuid,
 ADD COLUMN volunteer_requested_method text,
 ADD COLUMN volunteer_entered_utr text,
 ADD CONSTRAINT fk_cg04_expense_volunteer FOREIGN KEY(root_realm_id,volunteer_ref)
  REFERENCES volunteer(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg04_expense_project FOREIGN KEY(root_realm_id,volunteer_project_ref)
  REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg04_expense_volunteer_source CHECK(
  (volunteer_ref IS NULL AND volunteer_branch_ref IS NULL AND volunteer_project_ref IS NULL
   AND volunteer_requested_method IS NULL AND volunteer_entered_utr IS NULL)
  OR (volunteer_ref IS NOT NULL AND source_kind='GENERAL'
   AND volunteer_requested_method IN('BANK_TRANSFER','UPI','CASH','OTHER')
   AND (volunteer_entered_utr IS NULL OR length(volunteer_entered_utr) BETWEEN 4 AND 100))
 );
CREATE INDEX ix_cg04_volunteer_expense_source ON expense_claim(root_realm_id,volunteer_ref,created_at DESC,id DESC)
 WHERE volunteer_ref IS NOT NULL;

CREATE FUNCTION cg04_expense_volunteer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.volunteer_ref,NEW.volunteer_branch_ref,NEW.volunteer_project_ref,
    NEW.volunteer_requested_method,NEW.volunteer_entered_utr)
   IS DISTINCT FROM
   (OLD.volunteer_ref,OLD.volunteer_branch_ref,OLD.volunteer_project_ref,
    OLD.volunteer_requested_method,OLD.volunteer_entered_utr)
  THEN RAISE EXCEPTION 'Original reimbursement volunteer source is immutable'; END IF;
 END IF;
 IF NEW.volunteer_ref IS NOT NULL
    AND (TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='DRAFT' AND NEW.status<>'DRAFT')) THEN
  IF NOT EXISTS(SELECT 1 FROM volunteer v WHERE v.root_realm_id=NEW.root_realm_id
    AND v.id=NEW.volunteer_ref AND v.branch_ref IS NOT DISTINCT FROM NEW.volunteer_branch_ref
    AND cg04_current_volunteer(NEW.root_realm_id,v.id,v.account_ref,NEW.volunteer_branch_ref))
  THEN RAISE EXCEPTION 'Original currently verified volunteer is required for reimbursement'; END IF;
  IF NEW.volunteer_project_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project p
    WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.volunteer_project_ref
     AND p.branch_ref IS NOT DISTINCT FROM NEW.volunteer_branch_ref
     AND p.status NOT IN('COMPLETED','CANCELLED'))
  THEN RAISE EXCEPTION 'Choose a current Foundation project for volunteer reimbursement'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_expense_volunteer_origin BEFORE INSERT OR UPDATE ON expense_claim
 FOR EACH ROW EXECUTE FUNCTION cg04_expense_volunteer_guard();
