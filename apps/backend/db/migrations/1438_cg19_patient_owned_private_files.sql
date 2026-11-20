-- CG19 original patient evidence supplementary DDL only.
-- The preceding 1438_cg19_original_patient_private_files.sql already defines
-- the original three CG19 patient tables, source triggers and audit.
-- Previously this file repeated CREATE TABLE, breaking fresh installations.
-- Keep original event timestamp created_at; no shadow tables.
--
-- If a deployed DB recorded this filename with its previous divergent hash,
-- STOP and reconcile the actual ledger/schema under a DBA review. The
-- existing migration-runner applied-checksum guard must NOT be bypassed.

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
ALTER TABLE cg19_patient_file_intent
 ADD CONSTRAINT cg19_patient_photo_not_pdf
 CHECK(classification<>'PATIENT_PHOTO' OR mime<>'application/pdf');

COMMENT ON TABLE cg19_patient_private_file IS
 'CG19 scanner-verified original patient-owned private files; not clinician-issued reports or public URLs.';
