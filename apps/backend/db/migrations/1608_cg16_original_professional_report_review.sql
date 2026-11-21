-- CG16 US002: independently authenticated CG14 professional review of a
-- scanner-verified private CG19 report. This is a decision SOURCE, not a
-- released patient document, legal e-signature or notification claim.
-- Professional discipline-specific clinical policy and signature issuance
-- must be additionally verified before any protected patient release.
CREATE TABLE cg16_lab_result_professional_review(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
 original_cg19_file_ref uuid NOT NULL,
 report_digest char(64) NOT NULL CHECK(report_digest ~ '^[a-f0-9]{64}$'),
 result_version integer NOT NULL CHECK(result_version>0),
 operator_account_ref uuid NOT NULL,
 reviewer_account_ref uuid NOT NULL,
 reviewer_doctor_ref uuid NOT NULL,
 reviewer_revision_ref uuid NOT NULL,
 reviewer_license_proof_ref uuid NOT NULL,
 reviewer_affiliation_ref uuid NOT NULL,
 reviewer_license_valid_through date NOT NULL,
 decision text NOT NULL CHECK(decision IN('APPROVE','REJECT')),
 decision_note text NOT NULL CHECK(length(btrim(decision_note)) BETWEEN 12 AND 1000),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,result_revision_ref),
 UNIQUE(root_realm_id,reviewer_account_ref,request_key),
 CHECK(reviewer_account_ref<>operator_account_ref),
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,result_revision_ref,original_cg19_file_ref)
  REFERENCES cg19_lab_result_file(root_realm_id,result_revision_ref,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(operator_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reviewer_doctor_ref)
  REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reviewer_revision_ref)
  REFERENCES health_doctor_revision(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_license_proof_ref,root_realm_id)
  REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,reviewer_affiliation_ref)
  REFERENCES health_doctor_center(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_lab_professional_review_order
 ON cg16_lab_result_professional_review(root_realm_id,order_ref,reviewed_at DESC,id DESC);
CREATE FUNCTION cg16_lab_professional_review_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Professional lab report decision is immutable';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM health_doctor_revision professional
  JOIN health_doctor doctor ON
   doctor.root_realm_id=professional.root_realm_id AND
   doctor.id=professional.doctor_id
  JOIN health_doctor_center affiliation ON
   affiliation.root_realm_id=professional.root_realm_id AND
   affiliation.id=NEW.reviewer_affiliation_ref AND
   affiliation.doctor_id=professional.doctor_id
  JOIN health_doctor_account_link clinician ON
   clinician.root_realm_id=doctor.root_realm_id AND
   clinician.doctor_id=doctor.id AND clinician.account_id=NEW.reviewer_account_ref
   AND clinician.status='ACTIVE' AND clinician.revoked_at IS NULL
  JOIN cg03_case doctor_review ON
   doctor_review.realm_id=professional.root_realm_id AND
   doctor_review.id=professional.approval_case_ref AND
   doctor_review.case_kind='HEALTH_DOCTOR_VERIFICATION' AND
   doctor_review.health_doctor_id=doctor.id AND
   doctor_review.health_doctor_revision_id=professional.id AND
   doctor_review.health_source_digest=professional.source_digest AND
   doctor_review.status='OWNER_COMPLETED'
  JOIN cg03_case_decision original_decision ON
   original_decision.realm_id=doctor_review.realm_id AND
   original_decision.case_id=doctor_review.id AND
   original_decision.action='APPROVE' AND
   original_decision.actor_id<>doctor_review.proposer_id AND
   original_decision.fresh_password_verified_at IS NOT NULL
  JOIN cg19_stored_file original_proof ON
   original_proof.realm_id=professional.root_realm_id AND
   original_proof.id=professional.proof_file_ref AND
   original_proof.owner_kind='CG14_DOCTOR' AND
   original_proof.health_doctor_id=doctor.id AND
   original_proof.health_source_version=professional.source_version AND
   original_proof.scan_status='CLEAN_VERIFIED' AND
   original_proof.revoked_at IS NULL
  JOIN cg19_upload_intent original_upload ON
   original_upload.id=original_proof.upload_intent_id AND
   original_upload.realm_id=original_proof.realm_id AND
   original_upload.owner_kind='CG14_DOCTOR' AND
   original_upload.classification='HEALTH_DOCTOR_LICENSE' AND
   original_upload.status='VALIDATED'
  JOIN lab_order accepted ON
   accepted.root_realm_id=professional.root_realm_id AND
   accepted.center_ref=affiliation.center_id AND
   accepted.id=NEW.order_ref
  JOIN health_center center ON
   center.root_realm_id=accepted.root_realm_id AND
   center.id=accepted.center_ref
  WHERE professional.root_realm_id=NEW.root_realm_id
   AND professional.id=NEW.reviewer_revision_ref
   AND professional.doctor_id=NEW.reviewer_doctor_ref
   AND professional.proof_file_ref=NEW.reviewer_license_proof_ref
   AND doctor.professional_license_valid_through=NEW.reviewer_license_valid_through
   AND doctor.professional_license_valid_through>=
       (now() AT TIME ZONE center.time_zone)::date
   AND professional.source_snapshot->>'professionalLicenseValidThrough'=
       to_char(doctor.professional_license_valid_through,'YYYY-MM-DD')
   AND professional.revision_no=(SELECT max(latest.revision_no)
       FROM health_doctor_revision latest WHERE
       latest.root_realm_id=professional.root_realm_id AND
       latest.doctor_id=professional.doctor_id)
   AND doctor.status='VERIFIED'
   AND center.status='VERIFIED' AND center.access_state='ENABLED'
   AND affiliation.affiliation_state='APPROVED'
   AND affiliation.approved_from<=now()
   AND (affiliation.approved_to IS NULL OR affiliation.approved_to>now())
   AND EXISTS(
     SELECT 1 FROM cg15_patient_consent consent
     WHERE consent.root_realm_id=accepted.root_realm_id AND
     consent.patient_id=accepted.patient_ref AND
     consent.purpose='PATIENT_CARE' AND consent.granted=true AND
     consent.revision_no=(SELECT max(last.revision_no)
       FROM cg15_patient_consent last WHERE
       last.root_realm_id=consent.root_realm_id AND
       last.patient_id=consent.patient_id AND last.purpose='PATIENT_CARE')
   )
 ) THEN
  RAISE EXCEPTION 'Professional review requires actual currently verified clinician source';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM lab_result_revision result
  JOIN cg19_lab_result_file file ON
   file.root_realm_id=result.root_realm_id AND
   file.result_revision_ref=result.id AND
   file.id=NEW.original_cg19_file_ref AND
   file.order_ref=result.order_ref AND
   file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL
  JOIN cg19_lab_result_intent intent ON
   intent.root_realm_id=file.root_realm_id AND
   intent.id=file.intent_ref AND intent.status='VALIDATED'
  WHERE result.root_realm_id=NEW.root_realm_id AND
   result.id=NEW.result_revision_ref AND
   result.order_ref=NEW.order_ref AND
   result.version_no=NEW.result_version AND
   result.result_state='RESULT_READY' AND
   result.original_cg19_file_ref=file.id AND
   result.report_digest=file.sha256 AND
   result.report_digest=NEW.report_digest AND
   result.operator_account_ref=NEW.operator_account_ref
   AND result.version_no=(SELECT max(latest.version_no)
     FROM lab_result_revision latest WHERE
     latest.root_realm_id=result.root_realm_id AND
     latest.order_ref=result.order_ref)
   AND EXISTS(SELECT 1 FROM cg16_lab_review_file_access viewed
     WHERE viewed.root_realm_id=NEW.root_realm_id
       AND viewed.result_revision_ref=NEW.result_revision_ref
       AND viewed.original_cg19_file_ref=NEW.original_cg19_file_ref
       AND viewed.reviewer_account_ref=NEW.reviewer_account_ref
       AND viewed.report_digest=NEW.report_digest)
 ) THEN
  RAISE EXCEPTION 'Professional decision requires exact original verified lab report';
 END IF;
 RETURN NEW;
END $cg16$;
CREATE TRIGGER cg16_lab_professional_review_original_source
 BEFORE INSERT OR UPDATE OR DELETE ON cg16_lab_result_professional_review
 FOR EACH ROW EXECUTE FUNCTION cg16_lab_professional_review_source_guard();
-- An authorized reviewer must retrieve the exact private file before
-- approving or rejecting that immutable report version. This is an audit of
-- an authorized download, not proof of a clinically valid digital signature.
CREATE TABLE cg16_lab_review_file_access(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 result_revision_ref uuid NOT NULL,
 original_cg19_file_ref uuid NOT NULL,
 reviewer_account_ref uuid NOT NULL,
 report_digest char(64) NOT NULL CHECK(report_digest ~ '^[a-f0-9]{64}$'),
 accessed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,result_revision_ref,reviewer_account_ref),
 FOREIGN KEY(root_realm_id,result_revision_ref,original_cg19_file_ref)
  REFERENCES cg19_lab_result_file(root_realm_id,result_revision_ref,id)
  ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg16_lab_review_file_access_frozen
 BEFORE UPDATE OR DELETE ON cg16_lab_review_file_access
 FOR EACH ROW EXECUTE FUNCTION cg19_lab_result_event_frozen();

-- Neither a review decision nor this download audit creates a released
-- patient report, clinical digital signature or sent notification.
