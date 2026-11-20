-- CG16 US005: optional equipment readiness and quality. No CG12 stock, CG15
-- patient, CG17 payment or independent health_center master is created.
CREATE TABLE lab_equipment (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 equipment_code text NOT NULL CHECK(equipment_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 160),
 manufacturer text NOT NULL DEFAULT '' CHECK(length(manufacturer)<=120),
 model text NOT NULL DEFAULT '' CHECK(length(model)<=120),
 serial_number text NOT NULL DEFAULT '' CHECK(length(serial_number)<=120),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','RETIRED')),
 readiness text NOT NULL DEFAULT 'NOT_READY'
  CHECK(readiness IN('NOT_READY','READY','OUT_OF_SERVICE')),
 calibration_due_on date,
 evidence_file_ref uuid,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_ref,id),
 UNIQUE(root_realm_id,center_ref,equipment_code),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(readiness<>'READY' OR evidence_file_ref IS NOT NULL
  AND calibration_due_on IS NOT NULL)
);
CREATE INDEX ix_lab_equipment_center_status
 ON lab_equipment(root_realm_id,center_ref,status,equipment_code,id);
CREATE INDEX ix_lab_equipment_due
 ON lab_equipment(root_realm_id,center_ref,calibration_due_on,id)
 WHERE status='ACTIVE' AND readiness='READY' AND calibration_due_on IS NOT NULL;

CREATE TABLE lab_equipment_command(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 center_ref uuid NOT NULL,
 equipment_ref uuid NOT NULL,
 applied_revision integer NOT NULL CHECK(applied_revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_ref,equipment_ref)
  REFERENCES lab_equipment(root_realm_id,center_ref,id) ON DELETE RESTRICT
);
CREATE TABLE lab_equipment_event(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 equipment_ref uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN
   ('REGISTERED','MAINTENANCE','MARK_OUT_OF_SERVICE','RETIRED')),
 prior_revision integer NOT NULL CHECK(prior_revision>=0),
 new_revision integer NOT NULL CHECK(new_revision=prior_revision+1),
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 2 AND 1000),
 evidence_file_ref uuid,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,equipment_ref,new_revision),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(root_realm_id,center_ref,equipment_ref)
  REFERENCES lab_equipment(root_realm_id,center_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_lab_equipment_event_history
 ON lab_equipment_event(root_realm_id,center_ref,equipment_ref,occurred_at DESC,id DESC);
CREATE FUNCTION cg16_equipment_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 RAISE EXCEPTION 'Original equipment event or command cannot be rewritten';
END $cg16$;
CREATE TRIGGER cg16_equipment_command_immutable BEFORE UPDATE OR DELETE
 ON lab_equipment_command FOR EACH ROW EXECUTE FUNCTION cg16_equipment_event_immutable();
CREATE TRIGGER cg16_equipment_event_immutable BEFORE UPDATE OR DELETE
 ON lab_equipment_event FOR EACH ROW EXECUTE FUNCTION cg16_equipment_event_immutable();
CREATE FUNCTION cg16_equipment_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id OR NEW.center_ref IS DISTINCT FROM OLD.center_ref
  OR NEW.equipment_code IS DISTINCT FROM OLD.equipment_code
  OR NEW.display_name IS DISTINCT FROM OLD.display_name
  OR NEW.manufacturer IS DISTINCT FROM OLD.manufacturer
  OR NEW.model IS DISTINCT FROM OLD.model
  OR NEW.serial_number IS DISTINCT FROM OLD.serial_number
  OR NEW.created_by IS DISTINCT FROM OLD.created_by
  OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
  NEW.revision<>OLD.revision+1 THEN
   RAISE EXCEPTION 'Registered equipment identity cannot be rewritten';
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_equipment_identity_guard BEFORE UPDATE OR DELETE
 ON lab_equipment FOR EACH ROW EXECUTE FUNCTION cg16_equipment_source_guard();

CREATE FUNCTION cg16_equipment_event_required() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lab_equipment_event e
  WHERE e.root_realm_id=NEW.root_realm_id AND
   e.equipment_ref=NEW.id AND e.center_ref=NEW.center_ref AND
   e.prior_revision=OLD.revision AND e.new_revision=NEW.revision) THEN
   RAISE EXCEPTION 'Equipment state requires original auditable source event';
 END IF;
 RETURN NULL;
END $cg16$;
CREATE CONSTRAINT TRIGGER cg16_equipment_event_required
 AFTER UPDATE ON lab_equipment DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg16_equipment_event_required();
