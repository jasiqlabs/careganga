-- CG-18 US-001: A later approved edit must be able to reuse an earlier,
-- already scanned original photograph of the SAME CareGanga CMS page.
-- Preserve BOTH Foundation-root and page-level referential integrity in SQL.
-- The immutable source file/version/rights remain CG-19 owned; revoked files
-- must be rejected by CG-19 at save, submit, publish, due time and public read.
--
-- The extra page_id is deliberately a composite-FK guard, not new CMS state.
-- It is backfilled exclusively from the already-owned page revision.
ALTER TABLE cms_asset_placement ADD COLUMN page_id uuid;

-- One trusted transactional backfill may touch formerly submitted
-- immutable revisions. Normal CMS edits remain protected afterwards.
-- The migration runner wraps this SQL in a single rollback-safe transaction.
ALTER TABLE cms_asset_placement DISABLE TRIGGER cg18_asset_edit_guard;

UPDATE cms_asset_placement a
 SET page_id=v.page_id
 FROM cms_page_revision v
 WHERE a.page_revision_id=v.id AND a.foundation_root_id=v.foundation_root_id;

ALTER TABLE cms_asset_placement ENABLE TRIGGER cg18_asset_edit_guard;

ALTER TABLE cms_asset_placement ALTER COLUMN page_id SET NOT NULL;

-- Every placement must belong to the exact revision's own CMS page.
ALTER TABLE cms_asset_placement
 ADD CONSTRAINT fk_cg18_placement_same_page
 FOREIGN KEY(foundation_root_id,page_id,page_revision_id)
 REFERENCES cms_page_revision(foundation_root_id,page_id,id)
 ON DELETE RESTRICT;

-- A media source may have originated in a previous revision but can only
-- be placed into a revision of the same page and same Foundation root.
ALTER TABLE cg19_cms_media_file
 ADD CONSTRAINT uq_cg19_original_media_page UNIQUE(id,realm_id,page_id);

ALTER TABLE cms_asset_placement DROP CONSTRAINT fk_cg18_cg19_original_media;

ALTER TABLE cms_asset_placement
 ADD CONSTRAINT fk_cg18_cg19_same_page_media
 FOREIGN KEY(cg19_file_ref,foundation_root_id,page_id)
 REFERENCES cg19_cms_media_file(id,realm_id,page_id)
 ON DELETE RESTRICT;
