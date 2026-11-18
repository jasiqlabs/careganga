-- CG-18 US-003 original Contact page three-photo strip (Batch03 021909).
-- One original CG-19 CLEAN_VERIFIED, rights-approved file per placement.
-- The CG-18 server checks CONTACT_INFO, image MIME and index 0..2.
-- No duplicate media storage, project data, or public upload.
ALTER TABLE cms_asset_placement DROP CONSTRAINT cms_asset_placement_role_check;
ALTER TABLE cms_asset_placement ADD CONSTRAINT cms_asset_placement_role_check
 CHECK(role IN('HERO','MOBILE_HERO','TEAM','ABOUT','PROMO','FEATURE',
  'GALLERY','ARTICLE','DOCUMENT','IMPACT','CONTACT','OTHER'));
