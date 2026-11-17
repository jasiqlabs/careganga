-- CG-18 US-001: editing a published page must not require the Foundation
-- to reupload every already-approved photograph. The original CG-19 scan,
-- version and rights proof remain immutable; reuse only within the SAME
-- Foundation root and SAME CMS page, guarded by CG-19's typed validation.
-- Preserve a database foreign key across roots. The owning-page equality is
-- checked in validatePlacement and in public/scheduled/reviewer reads.
ALTER TABLE cms_asset_placement
  DROP CONSTRAINT fk_cg18_cg19_original_media;
ALTER TABLE cms_asset_placement
  ADD CONSTRAINT fk_cg18_cg19_same_root_media
  FOREIGN KEY(cg19_file_ref,foundation_root_id)
  REFERENCES cg19_cms_media_file(id,realm_id) ON DELETE RESTRICT;
