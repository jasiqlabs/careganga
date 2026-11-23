-- Original /collaboration needs a fully independent CG18 editorial publication
-- of ORIGINAL CG08 revocable partner rights, never sample third-party names.
ALTER TABLE cms_page DROP CONSTRAINT cms_page_kind_check;
ALTER TABLE cms_page ADD CONSTRAINT cms_page_kind_check
 CHECK(kind IN('HOME','ABOUT','IMPACT','COMPLIANCE','GALLERY',
  'ARTICLE','CONTACT','HEALTHCARE','POLICY','OTHER','PARTNERS'));
CREATE UNIQUE INDEX ux_cg18_csr_collaboration_root
 ON cms_page(foundation_root_id) WHERE kind='PARTNERS' AND archived_at IS NULL;
