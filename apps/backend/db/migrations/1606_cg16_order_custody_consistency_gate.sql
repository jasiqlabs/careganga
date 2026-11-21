-- CG16 US-002 source integrity: order status follows its ORIGINAL specimen
-- custody source and corresponding immutable actor event. This does not
-- approve diagnosis, a result upload, clinical release, or message delivery.
-- Stage 1604/1605 order and sample persistence MUST exist first.
-- Report-ready/review remains denied until the actual CG19 signed-result
-- and qualified CG14 clinician source are integrated by later US-002 steps.
CREATE FUNCTION cg16_order_requires_real_custody() RETURNS trigger
LANGUAGE plpgsql AS $cg16$
DECLARE total_count bigint; collected_count bigint; processing_count bigint;
 pending_count bigint; rejected_count bigint; expected_event text;
BEGIN
 IF NEW.status IN ('RESULT_READY','AWAITING_REVIEW') THEN
  RAISE EXCEPTION 'Clinical result requires verified CG19 report and professional review source';
 END IF;
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

 -- A cancelled order cannot be revived by direct DB access.
 IF OLD.status='CANCELLED' THEN
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
-- Deferrable because custody service updates the samples and order first,
-- then inserts the immutable event in the SAME transaction.
CREATE CONSTRAINT TRIGGER cg16_order_original_custody_required
 AFTER UPDATE ON lab_order DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg16_order_requires_real_custody();
