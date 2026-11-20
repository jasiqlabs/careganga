-- CG-15 US-003: a patient may securely claim a clinic-created provisional
-- intake after center staff verified the person in the room. No phone number,
-- display ID or unchecked online account may merge/claim another patient's data.
-- Bind any claim to the SAME originating intake, patient AND center:
-- matching three independent FKs would otherwise permit mixed origins.
ALTER TABLE cg15_patient_center_intake
 ADD CONSTRAINT cg15_intake_original_patient_center
 UNIQUE(root_realm_id,id,patient_id,center_id);
CREATE TABLE cg15_patient_center_claim(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 intake_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 center_id uuid NOT NULL,
 issued_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 claim_digest char(64) NOT NULL CHECK(claim_digest ~ '^[a-f0-9]{64}$'),
 identity_checked_in_person boolean NOT NULL CHECK(identity_checked_in_person),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 claimed_at timestamptz,
 claimed_by_account uuid,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(claim_digest),
 UNIQUE(root_realm_id,issued_by_account,request_key),
 CHECK(expires_at>created_at),
 CHECK(claimed_at IS NULL OR claimed_by_account IS NOT NULL),
 CHECK(claimed_at IS NULL OR claimed_at>=created_at),
 FOREIGN KEY(root_realm_id,intake_id,patient_id,center_id)
  REFERENCES cg15_patient_center_intake(root_realm_id,id,patient_id,center_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(claimed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg15_patient_one_current_claim
 ON cg15_patient_center_claim(root_realm_id,patient_id)
 WHERE revoked_at IS NULL AND claimed_at IS NULL;
CREATE INDEX ix_cg15_patient_claim_due
 ON cg15_patient_center_claim(root_realm_id,expires_at)
 WHERE revoked_at IS NULL AND claimed_at IS NULL;

CREATE FUNCTION cg15_patient_center_claim_source_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Patient identity claim evidence cannot be deleted';
 END IF;
 IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
  NEW.id IS DISTINCT FROM OLD.id OR
  NEW.intake_id IS DISTINCT FROM OLD.intake_id OR
  NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
  NEW.center_id IS DISTINCT FROM OLD.center_id OR
  NEW.issued_by_account IS DISTINCT FROM OLD.issued_by_account OR
  NEW.request_key IS DISTINCT FROM OLD.request_key OR
  NEW.claim_digest IS DISTINCT FROM OLD.claim_digest OR
  NEW.identity_checked_in_person IS DISTINCT FROM OLD.identity_checked_in_person OR
  NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
  NEW.created_at IS DISTINCT FROM OLD.created_at OR
  (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR
  (OLD.claimed_at IS NOT NULL AND NEW.claimed_at IS DISTINCT FROM OLD.claimed_at) OR
  (OLD.claimed_by_account IS NOT NULL AND
   NEW.claimed_by_account IS DISTINCT FROM OLD.claimed_by_account) OR
  (NEW.claimed_at IS NOT NULL AND
   (NEW.revoked_at IS NOT NULL OR NEW.claimed_by_account IS NULL)) OR
  (NEW.revoked_at IS NOT NULL AND NEW.claimed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Original patient identity claim evidence cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg15_patient_center_claim_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_center_claim
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_center_claim_source_guard();
