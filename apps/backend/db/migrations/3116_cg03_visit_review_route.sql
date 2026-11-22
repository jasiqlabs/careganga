-- CG-05 visit review uses the original CG-03 immutable process and step rows.
-- Preserve the existing role-assignment route; allow visit management only
-- for the optional preliminary step of this explicitly typed process.
DO $cg05$
DECLARE c record; original_sql text; predicate text;
BEGIN
 FOR c IN SELECT conname,conrelid::regclass AS table_name,pg_get_expr(conbin,conrelid) AS expr
 FROM pg_constraint WHERE contype='c' AND
 ((conrelid='cg03_process'::regclass AND pg_get_constraintdef(oid) LIKE '%first_reviewer_capability%roles.assign%')
 OR (conrelid='cg03_process_step'::regclass AND pg_get_constraintdef(oid) LIKE '%capability_key%roles.assign%'))
 LOOP
  original_sql:=c.expr;
  IF c.table_name='cg03_process'::regclass THEN
   predicate:='process_kind=''FIELD_VISIT_REVIEW'' AND first_reviewer_capability=''projects.visits.manage''';
  ELSE
   predicate:='capability_key=''projects.visits.manage'' AND ordinal=1 AND NOT protected_root_required';
  END IF;
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.table_name,c.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK ((%s OR (%s)) IS TRUE)',c.table_name,c.conname,original_sql,predicate);
 END LOOP;
END; $cg05$;
CREATE FUNCTION cg03_visit_route_step_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM cg03_process p WHERE p.id=NEW.process_id AND p.process_kind='FIELD_VISIT_REVIEW') THEN
  IF NOT EXISTS(SELECT 1 FROM cg03_process p WHERE p.id=NEW.process_id AND
    ((p.first_reviewer_capability IS NULL AND NEW.ordinal=1 AND NEW.capability_key='approvals.review' AND NEW.protected_root_required)
    OR (p.first_reviewer_capability='projects.visits.manage' AND
       ((NEW.ordinal=1 AND NEW.capability_key='projects.visits.manage' AND NOT NEW.protected_root_required)
        OR (NEW.ordinal=2 AND NEW.capability_key='approvals.review' AND NEW.protected_root_required))))) THEN
    RAISE EXCEPTION 'Invalid field visit review route';
  END IF;
 ELSIF NEW.capability_key='projects.visits.manage' THEN
  RAISE EXCEPTION 'Visit reviewer step belongs only to field visit review';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_visit_route_step BEFORE INSERT ON cg03_process_step
 FOR EACH ROW EXECUTE FUNCTION cg03_visit_route_step_guard();
-- Current policy pointer is typed, and old case routes remain immutable.
CREATE FUNCTION cg03_visit_route_current_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cg03_process p WHERE p.id=NEW.process_id AND p.realm_id=NEW.realm_id AND p.process_kind='FIELD_VISIT_REVIEW'
  AND ((p.first_reviewer_capability IS NULL AND EXISTS(SELECT 1 FROM cg03_process_step s WHERE s.process_id=p.id AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required) AND (SELECT count(*) FROM cg03_process_step s WHERE s.process_id=p.id)=1)
   OR (p.first_reviewer_capability='projects.visits.manage' AND EXISTS(SELECT 1 FROM cg03_process_step s WHERE s.process_id=p.id AND s.ordinal=1 AND s.capability_key='projects.visits.manage' AND NOT s.protected_root_required) AND EXISTS(SELECT 1 FROM cg03_process_step s WHERE s.process_id=p.id AND s.ordinal=2 AND s.capability_key='approvals.review' AND s.protected_root_required) AND (SELECT count(*) FROM cg03_process_step s WHERE s.process_id=p.id)=2)))
 THEN RAISE EXCEPTION 'Incomplete field visit review route'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_visit_route_current BEFORE INSERT OR UPDATE ON cg03_visit_review_process_current
 FOR EACH ROW EXECUTE FUNCTION cg03_visit_route_current_guard();
