-- CG14 diagnostic licence-valid-through is a pending declaration and only
-- becomes trusted as part of an immutable CG03-approved CG14 center revision.
-- Do not derive expiry from a CG19 file name, upload date or graphic badge.
ALTER TABLE health_center ADD COLUMN diagnostic_license_valid_through date;
-- Legacy NULL remains unknown; it must not be converted into a current
-- CG16 laboratory licence. CG14 general consultations are unchanged.
CREATE INDEX ix_cg14_diagnostic_license_current
 ON health_center(root_realm_id,diagnostic_license_valid_through,id)
 WHERE diagnostic_license_valid_through IS NOT NULL;
