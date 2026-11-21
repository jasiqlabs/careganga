-- CG16 US002 QA14: one genuine correction of a PREVIOUSLY RELEASED
-- original CG19 report creates a new CG16 result revision.
-- Nothing rewrites or deletes the prior PDF, clinician decision or release.
CREATE TABLE cg16_lab_result_correction(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 prior_release_ref uuid NOT NULL,
 prior_result_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 8 AND 500),
 created_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,result_revision_ref),
 UNIQUE(root_realm_id,created_by_account,request_key),
 FOREIGN KEY(root_realm_id,order_ref,prior_result_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,prior_release_ref)
  REFERENCES cg16_lab_report_release(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_lab_correction_order
 ON cg16_lab_result_correction(root_realm_id,order_ref,created_at DESC,id);
CREATE FUNCTION cg16_lab_correction_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'An original laboratory correction cannot be edited';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM lab_result_revision previous
  JOIN cg16_lab_report_release prior ON
   prior.root_realm_id=previous.root_realm_id
   AND prior.order_ref=previous.order_ref
   AND prior.result_revision_ref=previous.id
  JOIN lab_result_revision next ON
   next.root_realm_id=previous.root_realm_id
   AND next.order_ref=previous.order_ref
  JOIN lab_order orders ON
   orders.root_realm_id=previous.root_realm_id
   AND orders.id=previous.order_ref AND orders.status='RESULT_READY'
  JOIN cg16_lab_result_professional_review review ON
   review.root_realm_id=prior.root_realm_id
   AND review.id=prior.professional_review_ref
   AND review.decision='APPROVE'
  WHERE previous.root_realm_id=NEW.root_realm_id
   AND previous.order_ref=NEW.order_ref
   AND previous.id=NEW.prior_result_ref
   AND previous.result_state='RESULT_READY'
   AND prior.id=NEW.prior_release_ref
   AND next.id=NEW.result_revision_ref
   AND next.result_state='DRAFT'
   AND next.corrects_revision_ref=previous.id
   AND next.operator_account_ref=NEW.created_by_account
   AND next.source_key=NEW.request_key
   AND next.version_no=previous.version_no+1
   AND next.version_no=(SELECT max(latest.version_no)
    FROM lab_result_revision latest
    WHERE latest.root_realm_id=next.root_realm_id
    AND latest.order_ref=next.order_ref)
   AND EXISTS(SELECT 1 FROM cg15_patient_consent consent
    WHERE consent.root_realm_id=orders.root_realm_id
    AND consent.patient_id=orders.patient_ref
    AND consent.purpose='PATIENT_CARE' AND consent.granted=true
    AND consent.revision_no=(SELECT max(latest.revision_no)
     FROM cg15_patient_consent latest
     WHERE latest.root_realm_id=consent.root_realm_id
     AND latest.patient_id=consent.patient_id
     AND latest.purpose='PATIENT_CARE'))
 ) THEN
  RAISE EXCEPTION 'Correction requires genuine prior released PDF and new linked version';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg16_lab_correction_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg16_lab_result_correction
 FOR EACH ROW EXECUTE FUNCTION cg16_lab_correction_source_guard();
