-- CG-18 US-002/003/004: existing CMS revision schema already supports
-- IMPACT, COMPLIANCE, GALLERY, ARTICLE, CONTACT and HEALTHCARE page kinds.
-- Extend ONLY original CG-19 verified CMS upload types for real public-safe
-- statutory PDFs and short media videos; never create another storage table.
-- The private storage adapter still MUST independently verify the checksum
-- and CLEAN_VERIFIED scanner state before a public placement can be approved.
ALTER TABLE cg19_cms_upload_intent
 DROP CONSTRAINT cg19_cms_upload_intent_original_mime_check;
ALTER TABLE cg19_cms_upload_intent
 ADD CONSTRAINT cg19_cms_upload_intent_original_mime_check
 CHECK(original_mime IN('image/png','image/jpeg','image/webp',
                        'application/pdf','video/mp4'));
ALTER TABLE cg19_cms_upload_intent
 DROP CONSTRAINT cg19_cms_upload_intent_size_bytes_check;
ALTER TABLE cg19_cms_upload_intent
 ADD CONSTRAINT cg19_cms_upload_intent_size_bytes_check
 CHECK(size_bytes BETWEEN 1 AND
  CASE WHEN original_mime='video/mp4' THEN 26214400 ELSE 10485760 END);
ALTER TABLE cg19_cms_media_file
 DROP CONSTRAINT cg19_cms_media_file_verified_size_bytes_check;
ALTER TABLE cg19_cms_media_file
 ADD CONSTRAINT cg19_cms_media_file_verified_size_bytes_check
 CHECK(verified_size_bytes BETWEEN 1 AND
  CASE WHEN original_mime='video/mp4' THEN 26214400 ELSE 10485760 END);

-- No operational project/healthcare/donor/finance records, fictional
-- counts, new notice outbox, extra approvals or public bucket.
