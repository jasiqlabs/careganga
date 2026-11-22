-- CG10 original B28: keep all existing ownership and evidence protections.
-- Only extend the original CG19 CG10_DRAFT classification and immutable HR proof enum.
DO $migration$
DECLARE orig text;
BEGIN
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO orig FROM pg_constraint
 WHERE conrelid='cg19_upload_intent'::regclass AND conname='cg19_intent_source_classification' AND contype='c';
 IF orig IS NULL THEN RAISE EXCEPTION 'Original CG19 classification check missing'; END IF;
 ALTER TABLE cg19_upload_intent DROP CONSTRAINT cg19_intent_source_classification;
 EXECUTE format('ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_intent_source_classification CHECK (((%s) OR (owner_kind=''CG10_DRAFT'' AND classification IN (''HR_EXPERIENCE'',''HR_POLICE_VERIFICATION'',''HR_RESUME'',''HR_APPOINTMENT_DOCUMENT''))) IS TRUE)',orig);
END $migration$;
ALTER TABLE hr_application_proof DROP CONSTRAINT hr_application_proof_classification_check;
ALTER TABLE hr_application_proof ADD CONSTRAINT hr_application_proof_classification_check
 CHECK(classification IN('HR_IDENTITY_PROOF','HR_PAN_PROOF','HR_QUALIFICATION','HR_PORTRAIT',
  'HR_EXPERIENCE','HR_POLICE_VERIFICATION','HR_RESUME','HR_APPOINTMENT_DOCUMENT'));
