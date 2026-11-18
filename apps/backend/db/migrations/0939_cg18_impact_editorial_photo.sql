-- CG-18 US-002 editorial Impact imagery; original validated media remains CG19-owned.
ALTER TABLE cms_asset_placement DROP CONSTRAINT cms_asset_placement_role_check;
ALTER TABLE cms_asset_placement ADD CONSTRAINT cms_asset_placement_role_check
 CHECK(role IN('HERO','MOBILE_HERO','TEAM','ABOUT','PROMO','FEATURE',
  'GALLERY','ARTICLE','DOCUMENT','IMPACT','OTHER'));
