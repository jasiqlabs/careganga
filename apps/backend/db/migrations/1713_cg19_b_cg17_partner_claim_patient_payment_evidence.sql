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
-- Independently enforce original CG19 scanned patient-owned file at claim
-- intake even when a direct database caller bypasses the NestJS service.
CREATE FUNCTION cg17_claim_patient_payment_scan_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Original patient payment-proof identity cannot be rewritten'
   USING ERRCODE='P1751';
 END IF;
 IF NEW.payment_file_ref IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM cg19_patient_private_file f
  JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id
   AND i.id=f.intent_id AND i.status='VALIDATED'
  WHERE f.realm_id=NEW.root_realm_id AND f.patient_id=NEW.patient_ref
   AND f.id=NEW.payment_file_ref
   AND f.classification='PATIENT_PARTNER_PAYMENT_PROOF'
   AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'Original payment receipt is not verified'
  USING ERRCODE='P1752';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_claim_payment_proof_original
 BEFORE INSERT ON cg17_partner_service_claim
 FOR EACH ROW EXECUTE FUNCTION cg17_claim_patient_payment_scan_guard();
