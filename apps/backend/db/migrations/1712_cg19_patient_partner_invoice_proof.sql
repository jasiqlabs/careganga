-- CG19 source owner: patient-submitted scanned invoice and non-pharmacy
-- performed-service evidence for CG17 manual ERP-OFF benefits. Extends only
-- the original CG19 patient-owned private file classification/scan pipeline.
-- Does NOT create healthcare cash/stock, prescribe, or infer actual payment.
ALTER TABLE cg19_patient_file_intent
 DROP CONSTRAINT IF EXISTS cg19_patient_file_intent_classification_check;
ALTER TABLE cg19_patient_file_intent
 ADD CONSTRAINT cg19_patient_file_intent_classification_check CHECK(
 classification IN ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION',
  'PATIENT_MEDICAL_REPORT','PATIENT_PARTNER_INVOICE',
  'PATIENT_PARTNER_SERVICE_PROOF'));
ALTER TABLE cg19_patient_private_file
 DROP CONSTRAINT IF EXISTS cg19_patient_private_file_classification_check;
ALTER TABLE cg19_patient_private_file
 ADD CONSTRAINT cg19_patient_private_file_classification_check CHECK(
 classification IN ('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION',
  'PATIENT_MEDICAL_REPORT','PATIENT_PARTNER_INVOICE',
  'PATIENT_PARTNER_SERVICE_PROOF'));
COMMENT ON TABLE cg19_patient_private_file IS
 'Original scanner-verified patient-owned files; partner invoice and completed-service documents are unverified business claims until independent CG17 review';
