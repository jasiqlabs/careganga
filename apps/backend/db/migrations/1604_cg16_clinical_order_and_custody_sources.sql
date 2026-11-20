-- CG16 US002 / checkpoint 1: ORIGINAL internal clinical source persistence.
-- No public lab booking, payment, Foundation contribution, CG09 journal,
-- shadow CG15 patient/CG14 center, or clinical "released" button.
-- This migration only defines source. Application admission and professional
-- release require separate, reviewed components before any route is enabled.
-- Original 1424/1429 CG15 source keys are reused, never reconstructed.
ALTER TABLE cg15_consultation_appointment
 ADD CONSTRAINT uq_cg16_genuine_consultation_care_source
 UNIQUE(root_realm_id,id,patient_id,center_id);

CREATE TABLE lab_order (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 display_order_ref text NOT NULL CHECK(display_order_ref ~ '^CGL-[A-F0-9]{16}$'),
 center_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 care_source_kind text NOT NULL CHECK(care_source_kind IN('CENTER_INTAKE','CONSULTATION')),
 center_intake_ref uuid,
 consultation_ref uuid,
 care_purpose text NOT NULL DEFAULT 'PATIENT_CARE' CHECK(care_purpose='PATIENT_CARE'),
 care_consent_revision integer NOT NULL CHECK(care_consent_revision>0),
 consent_granted_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'COLLECTION_PENDING'
  CHECK(status IN('COLLECTION_PENDING','COLLECTED','PROCESSING',
   'RESULT_READY','AWAITING_REVIEW','PROFESSIONALLY_APPROVED',
   'RELEASED','RECOLLECTION_REQUIRED','CANCELLED')),
 accepted_currency char(3) NOT NULL DEFAULT 'INR' CHECK(accepted_currency='INR'),
 accepted_center_total_minor bigint NOT NULL
  CHECK(accepted_center_total_minor BETWEEN 0 AND 9999999999),
 payment_verification_state text NOT NULL DEFAULT 'NOT_VERIFIED'
  CHECK(payment_verification_state='NOT_VERIFIED'),
 source_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by_account uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,display_order_ref),
 UNIQUE(root_realm_id,created_by_account,source_key),
 UNIQUE(root_realm_id,id,center_ref,patient_ref),
 CHECK(
  (care_source_kind='CENTER_INTAKE' AND center_intake_ref IS NOT NULL
    AND consultation_ref IS NULL)
  OR
  (care_source_kind='CONSULTATION' AND consultation_ref IS NOT NULL
    AND center_intake_ref IS NULL)
 ),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_ref)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,center_intake_ref,patient_ref,center_ref)
  REFERENCES cg15_patient_center_intake(root_realm_id,id,patient_id,center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,consultation_ref,patient_ref,center_ref)
  REFERENCES cg15_consultation_appointment(root_realm_id,id,patient_id,center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_ref,care_purpose,care_consent_revision)
  REFERENCES cg15_patient_consent(root_realm_id,patient_id,purpose,revision_no)
  ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_lab_order_center_recent
 ON lab_order(root_realm_id,center_ref,created_at DESC,id DESC);
CREATE INDEX ix_cg16_lab_order_patient_recent
 ON lab_order(root_realm_id,patient_ref,created_at DESC,id DESC);

-- One accepted source line per expanded original test and its exact revision.
-- Stored accepted money is historical quote, never a current-catalog lookup.
CREATE TABLE lab_order_line (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 test_ref uuid NOT NULL,
 test_revision integer NOT NULL CHECK(test_revision>0),
 source_package_ref uuid,
 package_revision integer,
 mapping_ref uuid NOT NULL,
 price_ref uuid NOT NULL,
 accepted_price_version integer NOT NULL CHECK(accepted_price_version>0),
 test_name_snapshot text NOT NULL CHECK(length(test_name_snapshot) BETWEEN 2 AND 160),
 test_code_snapshot text NOT NULL CHECK(test_code_snapshot ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
 sample_type_snapshot text NOT NULL CHECK(sample_type_snapshot IN
  ('BLOOD','URINE','STOOL','SALIVA','SWAB','TISSUE','OTHER','NOT_APPLICABLE')),
 qty integer NOT NULL CHECK(qty BETWEEN 1 AND 100),
 accepted_unit_minor bigint NOT NULL CHECK(accepted_unit_minor BETWEEN 0 AND 999999999),
 accepted_line_total_minor bigint NOT NULL CHECK(
  accepted_line_total_minor BETWEEN 0 AND 9999999999),
 source_line_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,order_ref,source_line_key),
 FOREIGN KEY(root_realm_id,order_ref)
  REFERENCES lab_order(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,test_ref,test_revision)
  REFERENCES diagnostic_test_revision(root_realm_id,test_ref,revision_no)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,source_package_ref)
  REFERENCES diagnostic_package(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,mapping_ref)
  REFERENCES lab_center_test_mapping(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,price_ref)
  REFERENCES lab_center_price_version(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((source_package_ref IS NULL AND package_revision IS NULL) OR
  (source_package_ref IS NOT NULL AND package_revision>0)),
 CHECK(accepted_line_total_minor=accepted_unit_minor*qty)
);
CREATE INDEX ix_cg16_lab_order_line_order
 ON lab_order_line(root_realm_id,order_ref,id);

CREATE TABLE lab_sample (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 opaque_sample_label text NOT NULL
  CHECK(opaque_sample_label ~ '^CGS-[A-F0-9]{20}$'),
 material_type text NOT NULL CHECK(material_type IN
  ('BLOOD','URINE','STOOL','SALIVA','SWAB','TISSUE','OTHER')),
 custody_state text NOT NULL DEFAULT 'PENDING_COLLECTION'
  CHECK(custody_state IN('PENDING_COLLECTION','COLLECTED','RECEIVED',
   'PROCESSING','RESULT_READY','REJECTED','RECOLLECTION_REQUIRED')),
 collection_location_ref uuid,
 replacement_for_sample_ref uuid,
 collected_at timestamptz,
 received_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,opaque_sample_label),
 UNIQUE(root_realm_id,order_ref,id),
 FOREIGN KEY(root_realm_id,order_ref) REFERENCES lab_order(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,collection_location_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,replacement_for_sample_ref)
  REFERENCES lab_sample(root_realm_id,id) ON DELETE RESTRICT,
 CHECK(replacement_for_sample_ref IS NULL OR replacement_for_sample_ref<>id),
 CHECK(received_at IS NULL OR collected_at IS NOT NULL),
 CHECK(received_at IS NULL OR received_at>=collected_at)
);
CREATE INDEX ix_cg16_lab_sample_order_state
 ON lab_sample(root_realm_id,order_ref,custody_state,id);
CREATE TABLE lab_sample_line (
 root_realm_id uuid NOT NULL,
 sample_ref uuid NOT NULL,
 order_ref uuid NOT NULL,
 order_line_ref uuid NOT NULL,
 PRIMARY KEY(root_realm_id,sample_ref,order_line_ref),
 FOREIGN KEY(root_realm_id,order_ref,sample_ref)
  REFERENCES lab_sample(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_line_ref)
  REFERENCES lab_order_line(root_realm_id,id) ON DELETE RESTRICT
);
-- Composite reference prevents associating an order's sample to lines from
-- some OTHER order even if all identifiers share the Foundation root.
ALTER TABLE lab_order_line ADD CONSTRAINT uq_cg16_line_original_order
 UNIQUE(root_realm_id,order_ref,id);
ALTER TABLE lab_sample_line DROP CONSTRAINT lab_sample_line_root_realm_id_order_line_ref_fkey;
ALTER TABLE lab_sample_line ADD FOREIGN KEY(root_realm_id,order_ref,order_line_ref)
 REFERENCES lab_order_line(root_realm_id,order_ref,id) ON DELETE RESTRICT;

CREATE TABLE lab_sample_custody_event (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 sample_ref uuid NOT NULL,
 actor_ref uuid NOT NULL,
 source_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 prior_revision integer NOT NULL CHECK(prior_revision>=0),
 new_revision integer NOT NULL CHECK(new_revision>0),
 from_status text,
 to_status text NOT NULL,
 from_holder_ref uuid,
 to_holder_ref uuid,
 event_type text NOT NULL CHECK(event_type IN
  ('COLLECTED','RECEIVED','PROCESSING_STARTED','RESULT_RECORDED',
   'REJECTED','RECOLLECTION_REQUESTED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,sample_ref,source_key),
 UNIQUE(root_realm_id,sample_ref,new_revision),
 FOREIGN KEY(root_realm_id,order_ref,sample_ref)
  REFERENCES lab_sample(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(from_holder_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(to_holder_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(new_revision=prior_revision+1)
);
CREATE INDEX ix_cg16_lab_sample_events
 ON lab_sample_custody_event(root_realm_id,sample_ref,occurred_at,id);

-- Report content is NOT fabricated from specimen/test descriptions.
-- Clinical professional review, original CG19 report bytes and
-- patient-protected issue are separate source-owned follow-up checkpoints.
CREATE TABLE lab_result_revision (
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 version_no integer NOT NULL CHECK(version_no>0),
 result_state text NOT NULL DEFAULT 'DRAFT'
  CHECK(result_state IN('DRAFT','RESULT_READY','AWAITING_REVIEW','REJECTED')),
 operator_account_ref uuid,
 original_cg19_file_ref uuid,
 report_digest char(64) CHECK(report_digest ~ '^[a-f0-9]{64}$'),
 corrects_revision_ref uuid,
 source_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,order_ref,version_no),
 UNIQUE(root_realm_id,source_key),
 UNIQUE(root_realm_id,order_ref,id),
 FOREIGN KEY(root_realm_id,order_ref)
  REFERENCES lab_order(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(operator_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,corrects_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((original_cg19_file_ref IS NULL AND report_digest IS NULL) OR
  (original_cg19_file_ref IS NOT NULL AND report_digest IS NOT NULL)),
 CHECK(result_state<>'RESULT_READY' OR original_cg19_file_ref IS NOT NULL)
);
CREATE INDEX ix_cg16_result_order_versions
 ON lab_result_revision(root_realm_id,order_ref,version_no DESC,id);

CREATE FUNCTION cg16_clinical_source_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 RAISE EXCEPTION 'Original lab clinical source cannot be deleted or rewritten';
END $cg16$;
CREATE TRIGGER cg16_order_line_frozen BEFORE UPDATE OR DELETE
 ON lab_order_line FOR EACH ROW EXECUTE FUNCTION cg16_clinical_source_frozen();
CREATE TRIGGER cg16_sample_line_frozen BEFORE UPDATE OR DELETE
 ON lab_sample_line FOR EACH ROW EXECUTE FUNCTION cg16_clinical_source_frozen();
CREATE TRIGGER cg16_custody_event_frozen BEFORE UPDATE OR DELETE
 ON lab_sample_custody_event FOR EACH ROW EXECUTE FUNCTION cg16_clinical_source_frozen();

-- Accepted order snapshots (patient, amount, consent, center and source key)
-- are immutable, even if the operational status/revision later advances.
CREATE FUNCTION cg16_order_source_guard() RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id
  OR NEW.display_order_ref IS DISTINCT FROM OLD.display_order_ref
  OR NEW.center_ref IS DISTINCT FROM OLD.center_ref
  OR NEW.patient_ref IS DISTINCT FROM OLD.patient_ref
  OR NEW.care_source_kind IS DISTINCT FROM OLD.care_source_kind
  OR NEW.center_intake_ref IS DISTINCT FROM OLD.center_intake_ref
  OR NEW.consultation_ref IS DISTINCT FROM OLD.consultation_ref
  OR NEW.care_purpose IS DISTINCT FROM OLD.care_purpose
  OR NEW.care_consent_revision IS DISTINCT FROM OLD.care_consent_revision
  OR NEW.consent_granted_at IS DISTINCT FROM OLD.consent_granted_at
  OR NEW.accepted_currency IS DISTINCT FROM OLD.accepted_currency
  OR NEW.accepted_center_total_minor IS DISTINCT FROM OLD.accepted_center_total_minor
  OR NEW.payment_verification_state IS DISTINCT FROM OLD.payment_verification_state
  OR NEW.source_key IS DISTINCT FROM OLD.source_key
  OR NEW.source_digest IS DISTINCT FROM OLD.source_digest
  OR NEW.created_by_account IS DISTINCT FROM OLD.created_by_account
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Accepted lab order source is immutable';
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_lab_order_source_protection BEFORE UPDATE OR DELETE
 ON lab_order FOR EACH ROW EXECUTE FUNCTION cg16_order_source_guard();

CREATE FUNCTION cg16_sample_source_guard() RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id OR NEW.order_ref IS DISTINCT FROM OLD.order_ref
  OR NEW.opaque_sample_label IS DISTINCT FROM OLD.opaque_sample_label
  OR NEW.material_type IS DISTINCT FROM OLD.material_type
  OR NEW.replacement_for_sample_ref IS DISTINCT FROM OLD.replacement_for_sample_ref
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.revision<>OLD.revision+1 THEN
  RAISE EXCEPTION 'Original specimen identity cannot be rewritten';
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_lab_sample_source_protection BEFORE UPDATE OR DELETE
 ON lab_sample FOR EACH ROW EXECUTE FUNCTION cg16_sample_source_guard();
