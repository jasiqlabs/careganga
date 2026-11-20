-- CG17 US002: immutable gross/support/due for one *real* CG15
-- confirmed consultation. Never changes CG15 clinical/booking masters.
-- Center collection and Foundation liability are separate US004/US005.
CREATE TABLE patient_charge(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 source_kind text NOT NULL DEFAULT 'CG15_CONSULTATION'
  CHECK(source_kind='CG15_CONSULTATION'),
 source_ref uuid NOT NULL,
 line_ref text NOT NULL DEFAULT 'CONSULTATION'
  CHECK(line_ref='CONSULTATION'),
 source_version integer NOT NULL CHECK(source_version>0),
 source_terms_version integer NOT NULL CHECK(source_terms_version>0),
 source_start_at timestamptz NOT NULL,
 source_end_at timestamptz NOT NULL,
 CHECK(source_end_at>source_start_at),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 center_ref uuid NOT NULL,
 doctor_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 association_ref uuid NOT NULL,
 fee_revision_ref uuid NOT NULL,
 fee_version integer NOT NULL CHECK(fee_version>0),
 policy_revision_ref uuid,
 patient_consent_revision integer NOT NULL CHECK(patient_consent_revision>0),
 gross_minor bigint NOT NULL CHECK(gross_minor BETWEEN 0 AND 10000000000),
 support_minor bigint NOT NULL CHECK(support_minor BETWEEN 0 AND 10000000000),
 due_minor bigint NOT NULL CHECK(due_minor BETWEEN 0 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 collection_state text NOT NULL DEFAULT 'DUE'
  CHECK(collection_state='DUE'),
 accepted_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,source_kind,source_ref,line_ref),
 UNIQUE(root_realm_id,accepted_by_account,request_key),
 UNIQUE(root_realm_id,id,center_ref,patient_ref),
 FOREIGN KEY(root_realm_id,source_ref)
  REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_ref)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,doctor_ref,center_ref,association_ref)
  REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,fee_revision_ref)
  REFERENCES health_center_fee(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,policy_revision_ref)
  REFERENCES healthcare_policy_revision(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(accepted_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(gross_minor=support_minor+due_minor),
 CHECK(support_minor<=gross_minor),
 CHECK(policy_revision_ref IS NOT NULL OR support_minor=0)
);
CREATE INDEX ix_cg17_charge_by_center
 ON patient_charge(root_realm_id,center_ref,accepted_at DESC,id DESC);
CREATE INDEX ix_cg17_charge_by_patient
 ON patient_charge(root_realm_id,patient_ref,accepted_at DESC,id DESC);
CREATE FUNCTION cg17_patient_charge_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 RAISE EXCEPTION 'Accepted CG17 patient charge must remain immutable';
END $cg17$;
CREATE TRIGGER cg17_patient_charge_immutable BEFORE UPDATE OR DELETE
 ON patient_charge FOR EACH ROW EXECUTE FUNCTION cg17_patient_charge_frozen();
-- Critically: no patient payment, receipt, bank settlement or Foundation
-- receivable is posted by inserting a patient_charge.
