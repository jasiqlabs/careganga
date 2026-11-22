-- Optional real operational project association in the ORIGINAL CG09 budget
-- and voucher owners. No new account, journal, allocation or balance store.
ALTER TABLE finance_budget ADD COLUMN project_ref uuid, ADD COLUMN project_label text,
 ADD CONSTRAINT fk_cg09_budget_project FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg09_budget_project_pair CHECK((project_ref IS NULL)=(project_label IS NULL));
ALTER TABLE finance_budget_revision ADD COLUMN project_ref uuid, ADD COLUMN project_label text,
 ADD CONSTRAINT fk_cg09_budget_revision_project FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg09_budget_revision_project_pair CHECK((project_ref IS NULL)=(project_label IS NULL));
ALTER TABLE finance_voucher ADD COLUMN project_ref uuid, ADD COLUMN project_label text,
 ADD CONSTRAINT fk_cg09_voucher_project FOREIGN KEY(root_realm_id,project_ref) REFERENCES project(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg09_voucher_project_pair CHECK((project_ref IS NULL)=(project_label IS NULL)),
 ADD CONSTRAINT ck_cg09_project_expense CHECK(project_ref IS NULL OR voucher_type='EXPENSE');
CREATE INDEX ix_cg09_project_budget ON finance_budget(root_realm_id,project_ref,branch_id,status) WHERE project_ref IS NOT NULL;
CREATE INDEX ix_cg09_project_voucher ON finance_voucher(root_realm_id,project_ref,branch_id,status) WHERE project_ref IS NOT NULL;
CREATE FUNCTION cg09_current_project_finance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; change_binding boolean; entering_effect boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  change_binding:=NEW.project_ref IS NOT NULL;
  entering_effect:=false;
 ELSE
  change_binding:=NEW.project_ref IS DISTINCT FROM OLD.project_ref OR NEW.project_label IS DISTINCT FROM OLD.project_label;
  IF change_binding AND OLD.status NOT IN('DRAFT','RETURNED') THEN
   RAISE EXCEPTION 'Approved project finance source is immutable' USING ERRCODE='P0924';
  END IF;
  entering_effect:=NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN('SUBMITTED','APPROVED','POSTED');
 END IF;
 IF NEW.project_ref IS NULL THEN RETURN NEW; END IF;
 IF NOT change_binding AND NOT entering_effect THEN
  IF TG_OP='UPDATE' AND NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id THEN RETURN NEW; END IF;
 END IF;
 SELECT branch_ref,code_norm,title,status INTO p FROM project
  WHERE root_realm_id=NEW.root_realm_id AND id=NEW.project_ref FOR SHARE;
 IF NOT FOUND OR p.branch_ref IS DISTINCT FROM NEW.branch_id OR p.status NOT IN('PLANNED','ACTIVE','ON_HOLD') THEN
  RAISE EXCEPTION 'Choose an eligible current project in the same finance branch' USING ERRCODE='P0924';
 END IF;
 IF change_binding AND NEW.project_label IS DISTINCT FROM p.code_norm||' · '||p.title THEN
  RAISE EXCEPTION 'The project label must be read from the original source' USING ERRCODE='P0924';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_budget_project_source BEFORE INSERT OR UPDATE ON finance_budget FOR EACH ROW EXECUTE FUNCTION cg09_current_project_finance_guard();
CREATE TRIGGER cg09_voucher_project_source BEFORE INSERT OR UPDATE ON finance_voucher FOR EACH ROW EXECUTE FUNCTION cg09_current_project_finance_guard();
CREATE FUNCTION cg09_project_budget_effect_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; p record; v record;
BEGIN
 SELECT project_ref,branch_id INTO b FROM finance_budget WHERE root_realm_id=NEW.root_realm_id AND id=NEW.budget_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original budget unavailable' USING ERRCODE='P0924'; END IF;
 IF b.project_ref IS NULL THEN RETURN NEW; END IF;
 IF NEW.kind<>'RELEASE' THEN
  SELECT branch_ref,status INTO p FROM project WHERE root_realm_id=NEW.root_realm_id AND id=b.project_ref FOR SHARE;
  IF NOT FOUND OR p.branch_ref IS DISTINCT FROM b.branch_id OR p.status NOT IN('PLANNED','ACTIVE','ON_HOLD') THEN
   RAISE EXCEPTION 'Project no longer eligible in this budget scope' USING ERRCODE='P0924';
  END IF;
 END IF;
 IF NEW.kind='UTILIZE' THEN
  SELECT f.project_ref,f.branch_id INTO v FROM journal j JOIN finance_voucher f
   ON f.root_realm_id=j.root_realm_id AND f.id=j.source_ref
   WHERE j.root_realm_id=NEW.root_realm_id AND j.id=NEW.source_journal_id
    AND j.posting_kind='VOUCHER' AND j.status='POSTED' FOR SHARE OF j,f;
  IF NOT FOUND OR v.project_ref IS DISTINCT FROM b.project_ref OR v.branch_id IS DISTINCT FROM b.branch_id THEN
   RAISE EXCEPTION 'Project budget utilization requires its own posted expense voucher' USING ERRCODE='P0924';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg09_project_budget_effect_scope BEFORE INSERT ON finance_budget_event FOR EACH ROW EXECUTE FUNCTION cg09_project_budget_effect_guard();
