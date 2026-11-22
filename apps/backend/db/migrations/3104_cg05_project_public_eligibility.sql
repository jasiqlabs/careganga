-- CG05 source eligibility is an immutable reviewed projection, not a second
-- project master or a CMS publication. Internal projects remain independent.
CREATE TABLE project_public_eligibility(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,
 project_id uuid NOT NULL,project_version integer NOT NULL CHECK(project_version>0),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 2 AND 160),
 category text NOT NULL CHECK(char_length(btrim(category)) BETWEEN 1 AND 80),
 safe_summary text NOT NULL CHECK(char_length(btrim(safe_summary)) BETWEEN 3 AND 500),
 general_area text NOT NULL CHECK(char_length(btrim(general_area)) BETWEEN 2 AND 160),
 planned_launch date,project_status text NOT NULL CHECK(project_status IN('PLANNED','ACTIVE')),
 consent_confirmed boolean NOT NULL CHECK(consent_confirmed),
 submitted_by uuid NOT NULL,request_key uuid NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,revoked_by uuid,revocation_reason text,
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,project_id,project_version),
 UNIQUE(root_realm_id,request_key),UNIQUE(root_realm_id,id,project_id,project_version,source_digest),
 FOREIGN KEY(root_realm_id,project_id,project_version) REFERENCES project_event(root_realm_id,project_id,result_version) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(revoked_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
 (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND char_length(btrim(revocation_reason)) BETWEEN 3 AND 500))
);
CREATE FUNCTION cg05_public_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Public eligibility history is immutable'; END IF;
 IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
 (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by','revocation_reason']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['revoked_at','revoked_by','revocation_reason']) THEN
 RAISE EXCEPTION 'Only irreversible eligibility withdrawal is permitted'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_public_snapshot_immutable BEFORE UPDATE OR DELETE ON project_public_eligibility
 FOR EACH ROW EXECUTE FUNCTION cg05_public_snapshot_guard();
ALTER TABLE cg03_case ADD COLUMN project_public_ref uuid,ADD COLUMN project_public_id uuid,
 ADD COLUMN project_public_version integer,ADD COLUMN project_public_digest char(64),
 ADD CONSTRAINT fk_cg03_project_public_exact FOREIGN KEY(realm_id,project_public_ref,project_public_id,project_public_version,project_public_digest)
 REFERENCES project_public_eligibility(root_realm_id,id,project_id,project_version,source_digest);
CREATE UNIQUE INDEX ux_cg03_project_public_case ON cg03_case(realm_id,project_public_ref)
 WHERE case_kind='PROJECT_PUBLIC_ELIGIBILITY';
DO $cg05$
DECLARE rec record; orig text; source_guard text; cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN ('project_public_ref','project_public_id','project_public_version','project_public_digest','previous_case_id')
 AND (column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%' OR column_name LIKE 'material_%' OR column_name LIKE 'adjustment_%' OR column_name LIKE 'inventory_%');
 source_guard:='case_kind=''PROJECT_PUBLIC_ELIGIBILITY'' AND num_nonnulls(project_public_ref,project_public_id,project_public_version,project_public_digest)=4 AND project_public_version=proposal_revision AND project_public_digest=proposal_digest AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF cols IS NOT NULL THEN source_guard:=source_guard||' AND num_nonnulls('||cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES ('cg03_process','cg03_process_kind_finance','process_kind=''PROJECT_PUBLIC_ELIGIBILITY'''),('cg03_case','cg03_case_kind_finance','case_kind=''PROJECT_PUBLIC_ELIGIBILITY'''),('cg03_case','cg03_case_finance_source_disjoint',source_guard)) v(t,n,guard)
 LOOP
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO orig FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
 IF orig IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint absent: %',rec.n; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,orig,rec.guard);
 END LOOP;
END $cg05$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_project_public_disjoint CHECK(
 (case_kind='PROJECT_PUBLIC_ELIGIBILITY' AND num_nonnulls(project_public_ref,project_public_id,project_public_version,project_public_digest)=4 AND project_public_version=proposal_revision AND project_public_digest=proposal_digest)
 OR (case_kind<>'PROJECT_PUBLIC_ELIGIBILITY' AND num_nonnulls(project_public_ref,project_public_id,project_public_version,project_public_digest)=0));
CREATE FUNCTION cg05_public_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.project_public_ref IS DISTINCT FROM OLD.project_public_ref OR NEW.project_public_id IS DISTINCT FROM OLD.project_public_id OR NEW.project_public_version IS DISTINCT FROM OLD.project_public_version OR NEW.project_public_digest IS DISTINCT FROM OLD.project_public_digest THEN RAISE EXCEPTION 'Frozen project eligibility cannot change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_public_case_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg05_public_case_frozen();
CREATE TABLE cg03_project_public_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
);
