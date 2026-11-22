-- Original CG03 private FIELD_VISIT_REVIEW source, never a separate approval engine.
CREATE TABLE field_visit_review_snapshot(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,visit_id uuid NOT NULL,
 visit_version integer NOT NULL CHECK(visit_version>1),source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 report_snapshot jsonb NOT NULL CHECK(jsonb_typeof(report_snapshot)='object'),
 submitted_by uuid NOT NULL,request_key uuid NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,visit_id),UNIQUE(root_realm_id,visit_id,visit_version),UNIQUE(root_realm_id,request_key),
 UNIQUE(root_realm_id,id,visit_id,visit_version,source_digest),
 FOREIGN KEY(root_realm_id,visit_id,visit_version) REFERENCES field_visit_event(root_realm_id,visit_id,result_version) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg05_visit_review_snapshot_immutable BEFORE UPDATE OR DELETE ON field_visit_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();
CREATE TABLE field_visit_review_file(
 root_realm_id uuid NOT NULL,snapshot_id uuid NOT NULL,visit_id uuid NOT NULL,file_ref uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),file_version integer NOT NULL CHECK(file_version>0),
 sha256 char(64) NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 PRIMARY KEY(root_realm_id,snapshot_id,file_ref),
 FOREIGN KEY(root_realm_id,snapshot_id,visit_id) REFERENCES field_visit_review_snapshot(root_realm_id,id,visit_id) ON DELETE RESTRICT,
 FOREIGN KEY(file_ref,root_realm_id,visit_id,source_version) REFERENCES cg19_stored_file(id,realm_id,visit_id,proposal_revision) ON DELETE RESTRICT
);
CREATE TRIGGER cg05_visit_review_file_immutable BEFORE UPDATE OR DELETE ON field_visit_review_file FOR EACH ROW EXECUTE FUNCTION cg05_immutable_project_event();
ALTER TABLE cg03_case ADD COLUMN visit_review_ref uuid,ADD COLUMN visit_review_id uuid,
 ADD COLUMN visit_review_version integer,ADD COLUMN visit_review_digest char(64),
 ADD CONSTRAINT fk_cg03_visit_review_exact FOREIGN KEY(realm_id,visit_review_ref,visit_review_id,visit_review_version,visit_review_digest)
 REFERENCES field_visit_review_snapshot(root_realm_id,id,visit_id,visit_version,source_digest);
CREATE UNIQUE INDEX ux_cg03_visit_review_case ON cg03_case(realm_id,visit_review_ref) WHERE case_kind='FIELD_VISIT_REVIEW';
DO $cg05$
DECLARE rec record; orig text; source_guard text; cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN ('visit_review_ref','visit_review_id','visit_review_version','visit_review_digest','previous_case_id')
 AND (column_name LIKE 'hr_%' OR column_name LIKE 'health_%' OR column_name LIKE 'cg15_%' OR column_name LIKE 'cg16_%' OR column_name LIKE 'cg17_%' OR column_name LIKE 'cms_%' OR column_name LIKE 'branch_source_%' OR column_name LIKE 'finance_%' OR column_name LIKE 'material_%' OR column_name LIKE 'adjustment_%' OR column_name LIKE 'inventory_%' OR column_name LIKE 'project_public_%' OR column_name LIKE 'event_public_%');
 source_guard:='case_kind=''FIELD_VISIT_REVIEW'' AND num_nonnulls(visit_review_ref,visit_review_id,visit_review_version,visit_review_digest)=4 AND visit_review_version=proposal_revision AND visit_review_digest=proposal_digest AND target_account_id IS NULL AND target_role_id IS NULL AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF cols IS NOT NULL THEN source_guard:=source_guard||' AND num_nonnulls('||cols||')=0'; END IF;
 FOR rec IN SELECT * FROM (VALUES ('cg03_process','cg03_process_kind_finance','process_kind=''FIELD_VISIT_REVIEW'''),('cg03_case','cg03_case_kind_finance','case_kind=''FIELD_VISIT_REVIEW'''),('cg03_case','cg03_case_finance_source_disjoint',source_guard)) v(t,n,guard)
 LOOP
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO orig FROM pg_constraint WHERE conrelid=rec.t::regclass AND conname=rec.n AND contype='c';
 IF orig IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint absent: %',rec.n; END IF;
 EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.t,rec.n);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.t,rec.n,orig,rec.guard);
 END LOOP;
END $cg05$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_visit_review_disjoint CHECK(
 (case_kind='FIELD_VISIT_REVIEW' AND num_nonnulls(visit_review_ref,visit_review_id,visit_review_version,visit_review_digest)=4 AND visit_review_version=proposal_revision AND visit_review_digest=proposal_digest)
 OR (case_kind<>'FIELD_VISIT_REVIEW' AND num_nonnulls(visit_review_ref,visit_review_id,visit_review_version,visit_review_digest)=0));
CREATE FUNCTION cg05_visit_review_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.visit_review_ref,NEW.visit_review_id,NEW.visit_review_version,NEW.visit_review_digest) IS DISTINCT FROM
    (OLD.visit_review_ref,OLD.visit_review_id,OLD.visit_review_version,OLD.visit_review_digest) THEN
  RAISE EXCEPTION 'Frozen visit review cannot change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_visit_review_case_frozen BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg05_visit_review_case_frozen();
CREATE TABLE cg03_visit_review_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id)
);
