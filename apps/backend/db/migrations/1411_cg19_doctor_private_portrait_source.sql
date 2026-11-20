-- CG-14 US-003 / CG-19 original owner: optional PRIVATE doctor portrait.
-- A clean photo is never proof of image rights or permission to publish it.
-- Public photo projection/consent verification belongs to the guarded US-004
-- publication workflow; here images remain CG-19 private only.
ALTER TABLE cg19_upload_intent DROP CONSTRAINT cg19_intent_source_classification;
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT cg19_intent_source_classification CHECK(
   (owner_kind='CG03_CASE' AND
    classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))
   OR (owner_kind='CG02_DRAFT' AND
    classification IN('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))
   OR (owner_kind='CG14_DRAFT' AND
    ((health_center_id IS NULL AND
      classification IN('HEALTH_PROVIDER_REGISTRATION','HEALTH_BANK_PROOF'))
     OR (health_center_id IS NOT NULL AND
      classification='HEALTH_CENTER_LICENSE')))
   OR (owner_kind='CG14_DOCTOR' AND
      classification IN('HEALTH_DOCTOR_LICENSE','HEALTH_DOCTOR_PORTRAIT'))
 );
-- Reuses CG-19 original realm+doctor+revision links, scanner,
-- immutable private object proof and revocation. No public media URL.
