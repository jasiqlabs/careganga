-- CG16 US002: preserve exact original specimen custody sequence at the DB
-- boundary, including direct SQL writes made outside the NestJS service.
-- Depends on 1604. Not a report-release/CG19/medical signoff implementation.
-- No existing completed source rows are rewritten or backfilled.
CREATE OR REPLACE FUNCTION cg16_sample_source_guard()
RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id OR NEW.order_ref IS DISTINCT FROM OLD.order_ref
  OR NEW.opaque_sample_label IS DISTINCT FROM OLD.opaque_sample_label
  OR NEW.material_type IS DISTINCT FROM OLD.material_type
  OR NEW.collection_location_ref IS DISTINCT FROM OLD.collection_location_ref
  OR NEW.replacement_for_sample_ref IS DISTINCT FROM OLD.replacement_for_sample_ref
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.revision IS DISTINCT FROM OLD.revision+1 THEN
  RAISE EXCEPTION 'Original specimen identity cannot be rewritten';
 END IF;
 -- No speculative clinical RESULT_READY until original CG19 result and
 -- licensed reviewer source are built and this guard is explicitly evolved.
 IF NOT (
   (OLD.custody_state='PENDING_COLLECTION' AND NEW.custody_state='COLLECTED')
   OR (OLD.custody_state='COLLECTED' AND NEW.custody_state IN('RECEIVED','REJECTED'))
   OR (OLD.custody_state='RECEIVED' AND NEW.custody_state IN('PROCESSING','REJECTED'))
   OR (OLD.custody_state='PROCESSING' AND NEW.custody_state='REJECTED')
   OR (OLD.custody_state='REJECTED' AND NEW.custody_state='RECOLLECTION_REQUIRED')
 ) THEN
  RAISE EXCEPTION 'Specimen custody must follow its original order';
 END IF;
 IF OLD.custody_state='PENDING_COLLECTION' THEN
  IF OLD.collected_at IS NOT NULL OR NEW.collected_at IS NULL
   OR NEW.received_at IS NOT NULL THEN
   RAISE EXCEPTION 'Specimen collection time must be recorded exactly once';
  END IF;
 ELSIF NEW.collected_at IS DISTINCT FROM OLD.collected_at THEN
  RAISE EXCEPTION 'Original specimen collection time is immutable';
 END IF;
 IF OLD.custody_state='COLLECTED' AND NEW.custody_state='RECEIVED' THEN
  IF OLD.received_at IS NOT NULL OR NEW.received_at IS NULL
   OR NEW.received_at<OLD.collected_at THEN
   RAISE EXCEPTION 'Specimen receipt cannot precede collection';
  END IF;
 ELSIF NEW.received_at IS DISTINCT FROM OLD.received_at THEN
  RAISE EXCEPTION 'Original specimen receipt time is immutable';
 END IF;
 RETURN NEW;
END $cg16$;

-- A status change is not evidence unless the SAME original source-keyed
-- immutable custody event was written in the transaction. Check at commit
-- so the application may write sample state and its event in either order.
CREATE FUNCTION cg16_sample_requires_custody_event()
RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM lab_sample_custody_event e
  WHERE e.root_realm_id=NEW.root_realm_id
   AND e.order_ref=NEW.order_ref
   AND e.sample_ref=NEW.id
   AND e.prior_revision=OLD.revision
   AND e.new_revision=NEW.revision
   AND e.from_status=OLD.custody_state
   AND e.to_status=NEW.custody_state
 ) THEN
  RAISE EXCEPTION 'A specimen custody change requires its original immutable event';
 END IF;
 RETURN NULL;
END $cg16$;
CREATE CONSTRAINT TRIGGER cg16_specimen_event_required
 AFTER UPDATE ON lab_sample DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION cg16_sample_requires_custody_event();

-- Original source events cannot forge a transition after the sample moved
-- to a different revision (existing unique sample+new revision is retained).
-- PostgreSQL testing of simultaneous requests/rollback is still NOT_RUN.
