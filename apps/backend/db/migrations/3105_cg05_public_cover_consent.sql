-- Optional public rights bind to the original private CG19 file and exact
-- project revision. Freeze the file revision in the eligibility snapshot, not
-- a revision FK that could block the original owner's file revocation.
ALTER TABLE project_public_eligibility ADD COLUMN cover_file_ref uuid,ADD COLUMN cover_file_version integer,
 ADD CONSTRAINT fk_cg05_public_cover_identity FOREIGN KEY(cover_file_ref,root_realm_id,project_id,project_version)
 REFERENCES cg19_stored_file(id,realm_id,project_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg05_public_cover_pair CHECK(
 ((cover_file_ref IS NULL AND cover_file_version IS NULL) OR
 (cover_file_ref IS NOT NULL AND cover_file_version IS NOT NULL AND cover_file_version>0)) IS TRUE);
