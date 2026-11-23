-- CG13 US001: bounded ordered programme and reward catalogue reads.
-- Additive indexes for the current root-scoped programme selector, physical
-- product category filter and stable newest-first pages. No business rows
-- or existing approved policy/product revisions are changed.
CREATE INDEX IF NOT EXISTS cg13_programme_root_display_page_idx
 ON referral_program(root_realm_id,display_name,id);

CREATE INDEX IF NOT EXISTS cg13_product_root_programme_recent_page_idx
 ON reward_product(root_realm_id,programme_id,created_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS cg13_product_root_programme_category_page_idx
 ON reward_product(root_realm_id,programme_id,category,created_at DESC,id DESC);
