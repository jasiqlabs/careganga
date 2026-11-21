-- CG17 ERP-OFF patient-submitted optional scanned payment proof, sourced
-- exclusively through original CG19 private scanner. No money posting.
ALTER TABLE cg17_partner_service_claim
 ADD COLUMN payment_file_ref uuid;
ALTER TABLE cg17_partner_service_claim
 ADD CONSTRAINT fk_cg17_claim_patient_payment_proof
 FOREIGN KEY(root_realm_id,payment_file_ref,patient_ref)
 REFERENCES cg19_patient_private_file(realm_id,id,patient_id)
 ON DELETE RESTRICT;
ALTER TABLE cg17_partner_service_claim
 ADD CONSTRAINT cg17_claim_distinct_scanned_documents CHECK(
  payment_file_ref IS NULL OR
   (payment_file_ref<>invoice_file_ref AND
    payment_file_ref IS DISTINCT FROM completion_file_ref)
 );
