-- Forward-only supplemental CG19 patient-file integrity.
-- The canonical 1438_cg19_original_patient_private_files.sql defines the
-- three private-file tables and trusted source/event triggers.
-- The second historical 1438 file duplicated those CREATE statements; it is
-- now retained with its original checksum and recorded as a guarded no-op.
-- Never edit an already-applied historical migration or duplicate the owners.
CREATE INDEX IF NOT EXISTS ix_cg19_patient_intent_history
 ON cg19_patient_file_intent(realm_id,patient_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS ix_cg19_patient_intent_reserved
 ON cg19_patient_file_intent(reserved_until,id)
 WHERE status IN('INITIATED','UNKNOWN');
CREATE INDEX IF NOT EXISTS ix_cg19_patient_file_history
 ON cg19_patient_private_file(realm_id,patient_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS ix_cg19_patient_file_active
 ON cg19_patient_private_file(realm_id,patient_id,id)
 WHERE revoked_at IS NULL;
-- The original canonical table did not prohibit a PDF classified as PHOTO.
-- This constraint is additive and never changes an existing row.
ALTER TABLE cg19_patient_file_intent
 ADD CONSTRAINT cg19_patient_photo_not_pdf
 CHECK(classification<>'PATIENT_PHOTO' OR mime<>'application/pdf');

COMMENT ON TABLE cg19_patient_private_file IS
 'CG19 scanner-verified original patient-owned private files; never a clinician-issued report or public URL.';
