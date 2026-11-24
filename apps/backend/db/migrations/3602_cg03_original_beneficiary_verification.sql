-- CG-06 US-001 integration in the original CG-03 protected-case and decision engine.
-- This does NOT create a second approval service or permit self-verification.
CREATE TABLE cg06_beneficiary_review_snapshot(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 beneficiary_id uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision>1),
 source_digest char(64) NOT NULL CHECK(source_digest~'^[a-f0-9]{64}$'),
 submitted_by uuid NOT NULL,
 request_key uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,id,beneficiary_id,source_revision,source_digest),
 UNIQUE(root_realm_id,beneficiary_id,source_revision),
 UNIQUE(root_realm_id,submitted_by,request_key),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(submitted_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg06_beneficiary_review_snapshot_immutable
 BEFORE UPDATE OR DELETE ON cg06_beneficiary_review_snapshot FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();

ALTER TABLE cg03_case
 ADD COLUMN beneficiary_review_ref uuid,
 ADD COLUMN beneficiary_id uuid,
 ADD COLUMN beneficiary_source_revision integer,
 ADD COLUMN beneficiary_source_digest char(64),
 ADD CONSTRAINT fk_cg03_beneficiary_exact
 FOREIGN KEY(realm_id,beneficiary_review_ref,beneficiary_id,beneficiary_source_revision,beneficiary_source_digest)
 REFERENCES cg06_beneficiary_review_snapshot(root_realm_id,id,beneficiary_id,source_revision,source_digest);
CREATE UNIQUE INDEX ux_cg03_beneficiary_verification_snapshot
 ON cg03_case(realm_id,beneficiary_review_ref)
 WHERE case_kind='BENEFICIARY_VERIFICATION';
CREATE INDEX ix_cg03_beneficiary_verification_current
 ON cg03_case(realm_id,beneficiary_id,beneficiary_source_revision DESC)
 WHERE case_kind='BENEFICIARY_VERIFICATION';

-- Extend the existing source-type checks. Preserve every previously delivered CG03 owner kind.
DO $cg06$
DECLARE rec record; original text; source_guard text; other_cols text;
BEGIN
 SELECT string_agg(format('%I',column_name),',') INTO other_cols
 FROM information_schema.columns
 WHERE table_schema=current_schema() AND table_name='cg03_case'
 AND column_name NOT IN(
  'id','realm_id','case_number','process_id','process_version','proposer_id',
  'target_account_id','target_role_id','account_name_snapshot','role_name_snapshot',
  'expected_access_version','expected_role_revision','proposal_revision',
  'proposal_digest','request_digest','request_key','previous_case_id',
  'status','current_step','revision','submitted_at','updated_at','case_kind',
  'beneficiary_review_ref','beneficiary_id','beneficiary_source_revision','beneficiary_source_digest');
 source_guard:='case_kind=''BENEFICIARY_VERIFICATION'' AND
  num_nonnulls(beneficiary_review_ref,beneficiary_id,beneficiary_source_revision,beneficiary_source_digest)=4
  AND beneficiary_source_revision=proposal_revision AND beneficiary_source_digest=proposal_digest
  AND target_account_id IS NULL AND target_role_id IS NULL
  AND account_name_snapshot IS NOT NULL AND role_name_snapshot IS NOT NULL
  AND expected_access_version IS NULL AND expected_role_revision IS NULL';
 IF other_cols IS NOT NULL THEN
  source_guard:=source_guard||' AND num_nonnulls('||other_cols||')=0';
 END IF;
 FOR rec IN SELECT * FROM (VALUES
  ('cg03_process','cg03_process_kind_finance','process_kind=''BENEFICIARY_VERIFICATION'''),
  ('cg03_case','cg03_case_kind_finance','case_kind=''BENEFICIARY_VERIFICATION'''),
  ('cg03_case','cg03_case_finance_source_disjoint',source_guard)
 ) AS v(table_name,constraint_name,owner_guard)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original
  FROM pg_constraint WHERE conrelid=rec.table_name::regclass AND conname=rec.constraint_name AND contype='c';
  IF original IS NULL THEN RAISE EXCEPTION 'Original CG03 constraint unavailable: %',rec.constraint_name; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
    rec.table_name,rec.constraint_name,original,rec.owner_guard);
 END LOOP;
END $cg06$;
ALTER TABLE cg03_case ADD CONSTRAINT cg03_beneficiary_verification_disjoint CHECK(
 (case_kind='BENEFICIARY_VERIFICATION'
   AND num_nonnulls(beneficiary_review_ref,beneficiary_id,beneficiary_source_revision,beneficiary_source_digest)=4
   AND beneficiary_source_revision=proposal_revision
   AND beneficiary_source_digest=proposal_digest)
 OR
 (case_kind<>'BENEFICIARY_VERIFICATION'
   AND num_nonnulls(beneficiary_review_ref,beneficiary_id,beneficiary_source_revision,beneficiary_source_digest)=0));

CREATE FUNCTION cg06_guard_beneficiary_case_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.beneficiary_review_ref,NEW.beneficiary_id,NEW.beneficiary_source_revision,NEW.beneficiary_source_digest)
  IS DISTINCT FROM (OLD.beneficiary_review_ref,OLD.beneficiary_id,OLD.beneficiary_source_revision,OLD.beneficiary_source_digest) THEN
  RAISE EXCEPTION 'Frozen beneficiary verification source cannot change';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg06_beneficiary_case_frozen BEFORE UPDATE ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg06_guard_beneficiary_case_frozen();
CREATE TABLE cg03_beneficiary_review_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id),
 process_id uuid NOT NULL,
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
