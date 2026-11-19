-- CG-15 US003: narrow center-assisted PROVISIONAL patient intake.
-- No patient account claim, duplicate clinical identity, booking grant, or CG19 data copy.
-- Original CG14 verified own-center affiliation and CG01 capability are checked at write.
CREATE TABLE cg15_patient_center_intake (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_id uuid NOT NULL,
 patient_id uuid,
 created_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}
 assisted_consent_attested boolean NOT NULL CHECK(assisted_consent_attested=true),
 consent_version text NOT NULL CHECK(consent_version ~ '^[A-Za-z0-9._-]{1,32}
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);
),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);
),
 consent_version text NOT NULL CHECK(consent_version ~ '^[A-Za-z0-9._-]{1,32}
 assisted_consent_attested boolean NOT NULL CHECK(assisted_consent_attested=true),
 consent_version text NOT NULL CHECK(consent_version ~ '^[A-Za-z0-9._-]{1,32}
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);
),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);
),
 assisted_consent_attested boolean NOT NULL CHECK(assisted_consent_attested=true),
 consent_version text NOT NULL CHECK(consent_version ~ '^[A-Za-z0-9._-]{1,32}
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);
),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_id,created_by_account,request_key),
 UNIQUE(root_realm_id,patient_id),
 FOREIGN KEY(root_realm_id,center_id)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_center_intake_recent
 ON cg15_patient_center_intake(root_realm_id,center_id,created_at DESC,id DESC);

-- Attested provenance is immutable; only the first atomic source-link to
-- the just-created patient may fill patient_id from NULL exactly once.
-- This makes a stored receptionist attestation uneditable post-registration.
CREATE FUNCTION cg15_center_intake_provenance_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Provisional patient intake provenance is immutable';
 END IF;
 IF OLD.patient_id IS NOT NULL OR NEW.patient_id IS NULL
  OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id
  OR NEW.center_id IS DISTINCT FROM OLD.center_id
  OR NEW.created_by_account IS DISTINCT FROM OLD.created_by_account
  OR NEW.request_key IS DISTINCT FROM OLD.request_key
  OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
  OR NEW.assisted_consent_attested IS DISTINCT FROM OLD.assisted_consent_attested
  OR NEW.consent_version IS DISTINCT FROM OLD.consent_version
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Provisional patient intake provenance cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg15_center_intake_provenance_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_center_intake
 FOR EACH ROW EXECUTE FUNCTION cg15_center_intake_provenance_frozen();
