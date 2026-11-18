-- CG-18 US-001: source-owned original public-site editorial imagery.
-- Roles are presentation placements for already scanned, rights-confirmed CG-19 files.
-- No new object store or public upload workflow.
ALTER TABLE cms_asset_placement
 DROP CONSTRAINT cms_asset_placement_role_check;
ALTER TABLE cms_asset_placement
 ADD CONSTRAINT cms_asset_placement_role_check
 CHECK(role IN('HERO','MOBILE_HERO','TEAM','ABOUT','PROMO','FEATURE',
   'GALLERY','ARTICLE','DOCUMENT','OTHER'));
