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

-- A visit submission pins the exact typed route and prior returned case.
-- Enforce this for every insertion, including non-HTTP callers.
CREATE UNIQUE INDEX ux_cg03_active_visit_review ON cg03_case(realm_id,visit_review_id)
 WHERE case_kind='FIELD_VISIT_REVIEW' AND status IN('SUBMITTED','IN_REVIEW','PENDING_OWNER','FINAL_APPROVED','OWNER_FAILED_RETRYABLE');
CREATE FUNCTION cg03_visit_case_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous record; latest uuid;
BEGIN
 IF NEW.case_kind<>'FIELD_VISIT_REVIEW' THEN RETURN NEW; END IF;
 IF NEW.current_step<>1 OR NEW.status<>'SUBMITTED' OR NEW.revision<>1 OR NOT EXISTS(
  SELECT 1 FROM cg03_process p JOIN cg03_visit_review_process_current cur ON cur.process_id=p.id AND cur.realm_id=p.realm_id
  JOIN field_visit_review_snapshot snap ON snap.root_realm_id=NEW.realm_id AND snap.id=NEW.visit_review_ref
  JOIN field_visit v ON v.root_realm_id=snap.root_realm_id AND v.id=snap.visit_id
  WHERE p.id=NEW.process_id AND p.realm_id=NEW.realm_id AND p.process_kind='FIELD_VISIT_REVIEW' AND p.version=NEW.process_version
   AND snap.visit_id=NEW.visit_review_id AND snap.visit_version=NEW.visit_review_version AND snap.source_digest=NEW.visit_review_digest
   AND snap.submitted_by=NEW.proposer_id AND v.version=snap.visit_version AND v.status='PENDING_APPROVAL'
 ) THEN RAISE EXCEPTION 'Invalid original visit review source or route'; END IF;
 SELECT id INTO latest FROM cg03_case WHERE realm_id=NEW.realm_id AND case_kind='FIELD_VISIT_REVIEW'
   AND visit_review_id=NEW.visit_review_id ORDER BY visit_review_version DESC LIMIT 1;
 IF NEW.previous_case_id IS DISTINCT FROM latest THEN RAISE EXCEPTION 'Visit correction requires latest returned case'; END IF;
 IF NEW.previous_case_id IS NOT NULL THEN
  SELECT status,visit_review_version INTO previous FROM cg03_case WHERE realm_id=NEW.realm_id
   AND id=NEW.previous_case_id AND case_kind='FIELD_VISIT_REVIEW' AND visit_review_id=NEW.visit_review_id;
  IF NOT FOUND OR previous.status<>'RETURNED' OR previous.visit_review_version>=NEW.visit_review_version THEN
   RAISE EXCEPTION 'Invalid returned visit review predecessor';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_visit_case_insert BEFORE INSERT ON cg03_case
 FOR EACH ROW EXECUTE FUNCTION cg03_visit_case_insert_guard();

-- Typed reviewer history: only the exact current immutable step may record a
-- decision; final decisions require independent actor and password proof.
CREATE FUNCTION cg03_visit_decision_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; v record; step record;
BEGIN
 SELECT * INTO c FROM cg03_case WHERE id=NEW.case_id AND realm_id=NEW.realm_id;
 IF NOT FOUND OR c.case_kind<>'FIELD_VISIT_REVIEW' THEN RETURN NEW; END IF;
 SELECT actor_account_ref,version,status INTO v FROM field_visit WHERE root_realm_id=NEW.realm_id AND id=c.visit_review_id;
 SELECT * INTO step FROM cg03_process_step WHERE process_id=c.process_id AND ordinal=NEW.step_ordinal;
 IF NOT FOUND OR v.version IS DISTINCT FROM c.visit_review_version OR v.status IS DISTINCT FROM 'PENDING_APPROVAL'
   OR NEW.actor_id=c.proposer_id OR NEW.actor_id=v.actor_account_ref
   OR NEW.accepted_case_revision<>c.revision OR NEW.expected_case_revision+1<>NEW.accepted_case_revision
   OR (step.protected_root_required AND (NEW.fresh_password_verified_at IS NULL OR NEW.action='FORWARD'))
   OR (NOT step.protected_root_required AND NEW.fresh_password_verified_at IS NOT NULL)
   OR (NEW.action='RETURN' AND c.status<>'RETURNED') OR (NEW.action='REJECT' AND c.status<>'REJECTED')
   OR (NEW.action IN('APPROVE','FORWARD') AND
       (step.protected_root_required AND c.status<>'PENDING_OWNER'
        OR NOT step.protected_root_required AND (c.status<>'IN_REVIEW' OR c.current_step<>NEW.step_ordinal+1)))
   OR (NOT (c.status='IN_REVIEW') AND c.current_step<>NEW.step_ordinal)
   OR EXISTS(SELECT 1 FROM cg03_case_decision prior WHERE prior.realm_id=NEW.realm_id AND prior.case_id=NEW.case_id
      AND prior.step_ordinal<NEW.step_ordinal AND prior.actor_id=NEW.actor_id)
   OR (NEW.step_ordinal>1 AND NOT EXISTS(SELECT 1 FROM cg03_case_decision prior WHERE prior.realm_id=NEW.realm_id
      AND prior.case_id=NEW.case_id AND prior.step_ordinal=1 AND prior.action IN('FORWARD','APPROVE'))) THEN
  RAISE EXCEPTION 'Decision does not match the original visit review step';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_visit_decision_insert BEFORE INSERT ON cg03_case_decision
 FOR EACH ROW EXECUTE FUNCTION cg03_visit_decision_insert_guard();
