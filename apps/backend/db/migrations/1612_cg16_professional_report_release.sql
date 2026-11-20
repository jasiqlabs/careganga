-- CG16 US002: a clinician-authenticated immutable professional report
-- release for the EXACT independently approved CG19 scanner-verified PDF.
-- This records source-bound clinical electronic attestation, NOT a claim of
-- certificate-based PDF digital signing. It never sends a notification.
CREATE TABLE cg16_lab_report_release(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
 professional_review_ref uuid NOT NULL,
 original_cg19_file_ref uuid NOT NULL,
 report_digest char(64) NOT NULL CHECK(report_digest~'^[a-f0-9]{64}$'),
 patient_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 clinician_account_ref uuid NOT NULL,
 clinician_doctor_ref uuid NOT NULL,
 clinician_revision_ref uuid NOT NULL,
 release_key uuid NOT NULL,
 release_digest char(64) NOT NULL CHECK(release_digest~'^[a-f0-9]{64}$'),
 electronic_attestation text NOT NULL
  CHECK(electronic_attestation='REVIEWED_EXACT_PDF_AUTHENTICATED_CLINICIAN'),
 released_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,result_revision_ref),
 UNIQUE(root_realm_id,clinician_account_ref,release_key),
 UNIQUE(root_realm_id,order_ref,id),
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,professional_review_ref)
  REFERENCES cg16_lab_result_professional_review(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,result_revision_ref,original_cg19_file_ref)
  REFERENCES cg19_lab_result_file(root_realm_id,result_revision_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,center_ref,patient_ref)
  REFERENCES lab_order(root_realm_id,id,center_ref,patient_ref) ON DELETE RESTRICT,
 FOREIGN KEY(clinician_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,clinician_doctor_ref)
  REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,clinician_revision_ref)
  REFERENCES health_doctor_revision(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_released_patient ON cg16_lab_report_release
 (root_realm_id,patient_ref,released_at DESC,id DESC);

CREATE FUNCTION cg16_professional_report_release_guard() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Original clinician released report evidence is immutable';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM cg16_lab_result_professional_review review
  JOIN lab_result_revision result ON
   result.root_realm_id=review.root_realm_id AND
   result.id=review.result_revision_ref AND result.order_ref=review.order_ref
  JOIN lab_order orders ON
   orders.root_realm_id=result.root_realm_id AND orders.id=result.order_ref
  JOIN cg19_lab_result_file file ON
   file.root_realm_id=result.root_realm_id AND
   file.id=review.original_cg19_file_ref AND
   file.result_revision_ref=result.id AND file.order_ref=result.order_ref
  JOIN cg19_lab_result_intent intent ON
   intent.root_realm_id=file.root_realm_id AND intent.id=file.intent_ref
  JOIN health_doctor_account_link link ON
   link.root_realm_id=review.root_realm_id AND
   link.doctor_id=review.reviewer_doctor_ref AND
   link.account_id=NEW.clinician_account_ref
   AND link.status='ACTIVE' AND link.revoked_at IS NULL
  JOIN health_doctor doctor ON
   doctor.root_realm_id=link.root_realm_id AND doctor.id=link.doctor_id
   AND doctor.status='VERIFIED'
  JOIN health_center center ON
   center.root_realm_id=orders.root_realm_id AND center.id=orders.center_ref
   AND center.status='VERIFIED' AND center.access_state='ENABLED'
  JOIN health_doctor_center affiliation ON
   affiliation.root_realm_id=review.root_realm_id AND
   affiliation.id=review.reviewer_affiliation_ref
   AND affiliation.doctor_id=doctor.id
   AND affiliation.center_id=center.id
   AND affiliation.affiliation_state='APPROVED'
   AND affiliation.approved_from<=now()
   AND (affiliation.approved_to IS NULL OR affiliation.approved_to>now())
  WHERE review.root_realm_id=NEW.root_realm_id
   AND review.id=NEW.professional_review_ref
   AND review.order_ref=NEW.order_ref
   AND review.result_revision_ref=NEW.result_revision_ref
   AND review.original_cg19_file_ref=NEW.original_cg19_file_ref
   AND review.report_digest=NEW.report_digest
   AND review.decision='APPROVE'
   AND review.reviewer_account_ref=NEW.clinician_account_ref
   AND review.reviewer_doctor_ref=NEW.clinician_doctor_ref
   AND review.reviewer_revision_ref=NEW.clinician_revision_ref
   AND review.operator_account_ref<>NEW.clinician_account_ref
   AND orders.id=NEW.order_ref AND orders.patient_ref=NEW.patient_ref
   AND orders.center_ref=NEW.center_ref AND orders.status='RESULT_READY'
   AND result.result_state='RESULT_READY'
   AND result.report_digest=NEW.report_digest
   AND result.original_cg19_file_ref=NEW.original_cg19_file_ref
   AND result.version_no=(SELECT max(latest.version_no)
    FROM lab_result_revision latest WHERE
    latest.root_realm_id=result.root_realm_id AND latest.order_ref=result.order_ref)
   AND file.sha256=NEW.report_digest AND file.scan_status='CLEAN_VERIFIED'
   AND file.revoked_at IS NULL AND intent.status='VALIDATED'
   AND doctor.professional_license_valid_through >=
    (now() AT TIME ZONE center.time_zone)::date
   AND EXISTS(SELECT 1 FROM cg15_patient_consent consent
    WHERE consent.root_realm_id=orders.root_realm_id
    AND consent.patient_id=orders.patient_ref
    AND consent.purpose='PATIENT_CARE' AND consent.granted=true
    AND consent.revision_no=(SELECT max(last.revision_no)
     FROM cg15_patient_consent last
     WHERE last.root_realm_id=consent.root_realm_id
     AND last.patient_id=consent.patient_id AND last.purpose='PATIENT_CARE'))
 ) THEN
  RAISE EXCEPTION 'Patient release requires exact independent approved CG19 report and current clinician proof';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg16_lab_patient_release_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg16_lab_report_release
 FOR EACH ROW EXECUTE FUNCTION cg16_professional_report_release_guard();
-- Historical released files are read only through current CG15 patient ownership,
-- no public URL and no automatic notification. Explicit correction creates a
-- new immutable result revision; no mutation of this release record.
