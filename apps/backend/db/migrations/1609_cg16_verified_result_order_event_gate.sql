-- CG16 US002 review: close the original result-order status gap.
-- Supersedes ONLY 1606 order custody trigger function; DO NOT backfill
-- old orders or silently treat scanner verification as clinical release.
-- This runs after 1607 CG19 private scanner evidence migration.
CREATE OR REPLACE FUNCTION cg16_order_requires_real_custody() RETURNS trigger
LANGUAGE plpgsql AS $cg16$
DECLARE total_count bigint; collected_count bigint; processing_count bigint;
 pending_count bigint; rejected_count bigint; expected_event text;
 verified_source_key uuid;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
 -- A scanner-verifiable report is RESULT_READY, NEVER approved/released.
 -- Prevent direct SQL bypasses of the exact source and custody guard.
 IF NEW.status='RESULT_READY' THEN
  IF OLD.status<>'PROCESSING' THEN
   RAISE EXCEPTION 'Only a processing lab order can have a verified result';
  END IF;
  SELECT result.source_key INTO verified_source_key
  FROM lab_result_revision result
  JOIN cg19_lab_result_file file ON
   file.root_realm_id=result.root_realm_id AND
   file.order_ref=result.order_ref AND
   file.result_revision_ref=result.id AND
   file.id=result.original_cg19_file_ref AND
   file.sha256=result.report_digest AND
   file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL
  JOIN cg19_lab_result_intent intent ON
   intent.root_realm_id=file.root_realm_id AND intent.id=file.intent_ref
   AND intent.status='VALIDATED' AND
   intent.center_ref=NEW.center_ref AND intent.patient_ref=NEW.patient_ref
  WHERE result.root_realm_id=NEW.root_realm_id
   AND result.order_ref=NEW.id AND result.result_state='RESULT_READY'
   AND result.version_no=(SELECT max(last.version_no) FROM lab_result_revision last
     WHERE last.root_realm_id=NEW.root_realm_id AND last.order_ref=NEW.id);
  IF verified_source_key IS NULL THEN
   RAISE EXCEPTION 'Ready lab result requires original CG19 clean file';
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM lab_order_event event
   WHERE event.root_realm_id=NEW.root_realm_id AND event.order_ref=NEW.id
    AND event.prior_revision=OLD.revision AND event.new_revision=NEW.revision
    AND event.event_type='RESULT_FILE_READY' AND
    event.source_key=verified_source_key
  ) THEN
   RAISE EXCEPTION 'Original verified result requires the same immutable order event';
  END IF;
  SELECT count(*),count(*) FILTER(WHERE s.custody_state='PROCESSING')
  INTO total_count,processing_count
  FROM lab_sample s WHERE s.root_realm_id=NEW.root_realm_id AND s.order_ref=NEW.id
    AND NOT EXISTS (SELECT 1 FROM lab_sample replacement
      WHERE replacement.root_realm_id=s.root_realm_id AND
       replacement.order_ref=s.order_ref AND
       replacement.replacement_for_sample_ref=s.id);
  IF total_count=0 OR processing_count<>total_count THEN
   RAISE EXCEPTION 'Verified report requires every current specimen processing';
  END IF;
  RETURN NULL;
 END IF;
 -- Professional release/approval are not represented by this upload state.
 IF NEW.status='AWAITING_REVIEW' THEN
  RAISE EXCEPTION 'Professional review requires its own verified issuance source';
 END IF;

 -- A cancelled order cannot be revived by direct DB access.
 IF OLD.status IN('CANCELLED','RESULT_READY','AWAITING_REVIEW') THEN
  RAISE EXCEPTION 'Cancelled clinical order cannot resume';
 END IF;
 IF NEW.status='CANCELLED' THEN expected_event='CANCELLED';
 ELSIF NEW.status='RECOLLECTION_REQUIRED' OR
  (OLD.status='RECOLLECTION_REQUIRED' AND NEW.status='COLLECTION_PENDING') THEN
  -- Original rejected sample now has its own new replacement label.
  expected_event='RECOLLECTION_REQUESTED';
 ELSE expected_event='COLLECTION_RECORDED';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM lab_order_event e
  WHERE e.root_realm_id=NEW.root_realm_id AND e.order_ref=NEW.id
   AND e.prior_revision=OLD.revision AND e.new_revision=NEW.revision
   AND e.event_type=expected_event
 ) THEN
  RAISE EXCEPTION 'Clinical order state requires exact original source event';
 END IF;

 SELECT count(*),
  count(*) FILTER (WHERE s.custody_state IN ('COLLECTED','RECEIVED','PROCESSING','RESULT_READY')),
  count(*) FILTER (WHERE s.custody_state IN ('PROCESSING','RESULT_READY')),
  count(*) FILTER (WHERE s.custody_state='PENDING_COLLECTION'),
  count(*) FILTER (WHERE s.custody_state IN ('REJECTED','RECOLLECTION_REQUIRED'))
 INTO total_count,collected_count,processing_count,pending_count,rejected_count
 FROM lab_sample s
 WHERE s.root_realm_id=NEW.root_realm_id AND s.order_ref=NEW.id
  AND NOT EXISTS(
   SELECT 1 FROM lab_sample replacement
   WHERE replacement.root_realm_id=s.root_realm_id
    AND replacement.order_ref=s.order_ref
    AND replacement.replacement_for_sample_ref=s.id
  );

 IF NEW.status='COLLECTED' AND
  (total_count=0 OR collected_count<>total_count OR rejected_count<>0) THEN
  RAISE EXCEPTION 'Order collection requires all active original specimens collected';
 ELSIF NEW.status='PROCESSING' AND
  (total_count=0 OR processing_count<>total_count OR rejected_count<>0) THEN
  RAISE EXCEPTION 'Order processing requires all active original specimens processing';
 ELSIF NEW.status='RECOLLECTION_REQUIRED' AND rejected_count=0 THEN
  RAISE EXCEPTION 'Recollection status requires real rejected specimen evidence';
 ELSIF NEW.status='COLLECTION_PENDING' AND pending_count=0 THEN
  RAISE EXCEPTION 'Collection pending requires a real uncollected specimen';
 END IF;
 RETURN NULL;
END
$cg16$;
