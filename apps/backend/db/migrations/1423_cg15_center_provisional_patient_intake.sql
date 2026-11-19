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
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 assisted_consent_attested boolean NOT NULL CHECK(assisted_consent_attested=true),
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
