-- Match each append to the current operational revision and its preceding immutable event.
CREATE FUNCTION cg05_activity_event_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a project_activity%ROWTYPE; previous_status text;
BEGIN
 SELECT * INTO a FROM project_activity WHERE root_realm_id=NEW.root_realm_id AND id=NEW.activity_id FOR SHARE;
 IF NOT FOUND OR a.version<>NEW.result_version OR a.status<>NEW.resulting_status OR a.owner_account_ref<>NEW.owner_account_ref THEN
  RAISE EXCEPTION 'Activity event must match current operational revision';
 END IF;
 IF NEW.result_version=1 THEN
  IF NEW.action<>'CREATE' OR NEW.prior_status IS NOT NULL OR NEW.resulting_status NOT IN('DRAFT','SCHEDULED') THEN
   RAISE EXCEPTION 'Invalid initial activity event';
  END IF;
 ELSE
  SELECT resulting_status INTO previous_status FROM project_activity_event
   WHERE root_realm_id=NEW.root_realm_id AND activity_id=NEW.activity_id AND result_version=NEW.result_version-1;
  IF NOT FOUND OR NEW.prior_status IS DISTINCT FROM previous_status OR NEW.action='CREATE'
   OR (NEW.action='EDIT' AND NEW.prior_status<>NEW.resulting_status)
   OR (NEW.action='STATUS' AND NOT (
    (previous_status='DRAFT' AND NEW.resulting_status IN('SCHEDULED','CANCELLED'))
    OR (previous_status='SCHEDULED' AND NEW.resulting_status IN('ONGOING','CANCELLED'))
    OR (previous_status='ONGOING' AND NEW.resulting_status IN('COMPLETED','CANCELLED')))) THEN
    RAISE EXCEPTION 'Activity event must follow the preceding revision';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg05_activity_event_insert BEFORE INSERT ON project_activity_event
 FOR EACH ROW EXECUTE FUNCTION cg05_activity_event_insert_guard();
