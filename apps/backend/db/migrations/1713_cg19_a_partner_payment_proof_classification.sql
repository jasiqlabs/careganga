-- CG19 original private patient files: optional externally supplied
-- payment proof. Proof is scanned, never automatically treated as bank-paid.
-- A later CG17 independent reviewer must verify the actual partner settlement.
ALTER TABLE cg19_patient_file_intent
 DROP CONSTRAINT cg19_patient_file_intent_classification_check;
ALTER TABLE cg19_patient_file_intent
 ADD CONSTRAINT cg19_patient_file_intent_classification_check
 CHECK(classification IN('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION',
  'PATIENT_MEDICAL_REPORT','PATIENT_PARTNER_INVOICE',
  'PATIENT_PARTNER_SERVICE_PROOF','PATIENT_PARTNER_PAYMENT_PROOF'));
ALTER TABLE cg19_patient_private_file
 DROP CONSTRAINT cg19_patient_private_file_classification_check;
ALTER TABLE cg19_patient_private_file
 ADD CONSTRAINT cg19_patient_private_file_classification_check
 CHECK(classification IN('PATIENT_PHOTO','PATIENT_UPLOADED_PRESCRIPTION',
  'PATIENT_MEDICAL_REPORT','PATIENT_PARTNER_INVOICE',
  'PATIENT_PARTNER_SERVICE_PROOF','PATIENT_PARTNER_PAYMENT_PROOF'));
