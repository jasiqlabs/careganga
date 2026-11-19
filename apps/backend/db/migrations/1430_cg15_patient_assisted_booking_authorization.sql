-- CG-15 US-004 receptionist-assisted booking: explicit original patient
-- authorization for one current center and ONE held consultation. Neither a
-- patient display ID nor a shared mobile grants staff booking authority.
ALTER TABLE cg15_consultation_hold
 ADD CONSTRAINT cg15_hold_original_patient_center
 UNIQUE(root_realm_id,id,patient_id,center_id);

CREATE TABLE cg15_patient_assisted_booking_code(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL,
 account_id uuid NOT NULL,
 center_id uuid NOT NULL,
 code_digest char(64) NOT NULL CHECK(code_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 revoked_at timestamptz,
 consumed_by_account uuid,
 hold_id uuid,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(code_digest),
 CHECK(expires_at>created_at),
 CHECK((consumed_at IS NULL AND consumed_by_account IS NULL AND hold_id IS NULL)
   OR (consumed_at IS NOT NULL AND consumed_by_account IS NOT NULL AND hold_id IS NOT NULL)),
 CHECK(consumed_at IS NULL OR consumed_at>=created_at),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at),
 CHECK(consumed_at IS NULL OR revoked_at IS NULL),
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(account_id,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(consumed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,hold_id,patient_id,center_id)
  REFERENCES cg15_consultation_hold(root_realm_id,id,patient_id,center_id)
  ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg15_patient_one_active_staff_booking_code
 ON cg15_patient_assisted_booking_code(root_realm_id,patient_id)
 WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX ux_cg15_one_hold_one_assisted_booking_code
 ON cg15_patient_assisted_booking_code(root_realm_id,hold_id)
 WHERE hold_id IS NOT NULL;
CREATE INDEX ix_cg15_assisted_booking_code_due
 ON cg15_patient_assisted_booking_code(root_realm_id,expires_at)
 WHERE consumed_at IS NULL AND revoked_at IS NULL;

-- Prohibit mutation of consumed source authorization; only first atomic
-- transition from unconsumed to consumed with exact hold and staff is allowed.
CREATE FUNCTION cg15_assisted_booking_code_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Assisted patient booking authorization is immutable';
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.id IS DISTINCT FROM OLD.id OR
  NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
  NEW.account_id IS DISTINCT FROM OLD.account_id OR
  NEW.center_id IS DISTINCT FROM OLD.center_id OR
  NEW.code_digest IS DISTINCT FROM OLD.code_digest OR
  NEW.created_at IS DISTINCT FROM OLD.created_at OR
  NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
  OLD.consumed_at IS NOT NULL OR
  (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR
  (OLD.revoked_at IS NOT NULL AND NEW.consumed_at IS NOT NULL) OR
  (NEW.consumed_at IS NOT NULL AND
   (NEW.consumed_by_account IS NULL OR NEW.hold_id IS NULL)) THEN
  RAISE EXCEPTION 'Original patient booking authorization cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg15_assisted_booking_code_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_assisted_booking_code
 FOR EACH ROW EXECUTE FUNCTION cg15_assisted_booking_code_guard();
