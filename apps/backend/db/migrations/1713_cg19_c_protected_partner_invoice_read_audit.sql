-- CG19 original append-only private patient file events: a protected
-- Foundation reviewer may open only the claim-linked scanned evidence.
-- The event records a verified read, not a patient payment or an approval.
ALTER TABLE cg19_patient_file_event
 DROP CONSTRAINT cg19_patient_file_event_action_check,
 DROP CONSTRAINT cg19_patient_file_event_check;
ALTER TABLE cg19_patient_file_event
 ADD CONSTRAINT cg19_patient_file_event_action_check CHECK(
  action IN('INTENT_CREATED','UPLOAD_VERIFIED','UPLOAD_REJECTED',
   'FILE_REVOKED','PARTNER_CLAIM_REVIEW_READ')),
 ADD CONSTRAINT cg19_patient_file_event_action_shape CHECK(
  (file_id IS NULL AND action IN('INTENT_CREATED','UPLOAD_REJECTED')) OR
  (file_id IS NOT NULL AND action IN('UPLOAD_VERIFIED','FILE_REVOKED',
   'PARTNER_CLAIM_REVIEW_READ')));
CREATE INDEX ix_cg19_partner_proof_verified_reads
 ON cg19_patient_file_event(realm_id,actor_account_id,file_id,created_at DESC)
 WHERE action='PARTNER_CLAIM_REVIEW_READ';
