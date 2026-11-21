-- CG14 original clinician professional licence validity needed by CG16
-- US-002 professional report review. The applicant declares the date on the
-- ORIGINAL CG14 doctor draft; the existing immutable CG03 reviewed revision
-- and CG19 clean medical licence provide the actual decision provenance.
-- Old/missing expiry is UNKNOWN and cannot sign a lab report. Unrelated
-- CG14 doctor listings/consultations remain unaffected.
ALTER TABLE health_doctor
 ADD COLUMN professional_license_valid_through date;
CREATE INDEX ix_cg14_current_doctor_professional_license
 ON health_doctor(root_realm_id,professional_license_valid_through,id)
 WHERE professional_license_valid_through IS NOT NULL;
