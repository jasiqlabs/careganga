-- Optional public rights are frozen to the existing CG19 file and CG05
-- eligibility revision. Text-only sources remain valid; never change private storage ACL.
ALTER TABLE cg19_stored_file ADD CONSTRAINT uq_cg05_cover_exact_rights
 UNIQUE(id,realm_id,project_id,proposal_revision,revision);
ALTER TABLE project_public_eligibility ADD COLUMN cover_file_ref uuid,ADD COLUMN cover_file_version integer,
 ADD CONSTRAINT fk_cg05_public_cover_exact FOREIGN KEY(cover_file_ref,root_realm_id,project_id,project_version,cover_file_version)
 REFERENCES cg19_stored_file(id,realm_id,project_id,proposal_revision,revision) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_cg05_public_cover_pair CHECK((cover_file_ref IS NULL AND cover_file_version IS NULL) OR (cover_file_ref IS NOT NULL AND cover_file_version>0));
-- File revision can change on revocation. Do not make public consent a FK
-- blocker for the original owner's revocation operation: freeze the source
-- revision in the eligibility row, but reference only immutable file identity.
ALTER TABLE project_public_eligibility DROP CONSTRAINT fk_cg05_public_cover_exact;
ALTER TABLE project_public_eligibility ADD CONSTRAINT fk_cg05_public_cover_identity FOREIGN KEY(cover_file_ref,root_realm_id,project_id,project_version)
 REFERENCES cg19_stored_file(id,realm_id,project_id,proposal_revision) ON DELETE RESTRICT;
ALTER TABLE cg19_stored_file DROP CONSTRAINT uq_cg05_cover_exact_rights;
