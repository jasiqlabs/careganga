-- CG16 US002: the same original test/order result owner records actual
-- staff-entered measurements; CG19 renders the PDF from these exact rows.
-- Never duplicate CG15 patient, CG14 center or invent a reference range.
CREATE TABLE lab_result_value (
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_ref uuid NOT NULL,
 result_revision_ref uuid NOT NULL,
 order_line_ref uuid NOT NULL,
 value_text text NOT NULL CHECK(length(btrim(value_text)) BETWEEN 1 AND 120),
 unit_text text NOT NULL DEFAULT '' CHECK(length(unit_text)<=32),
 observation_text text NOT NULL DEFAULT '' CHECK(length(observation_text)<=500),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,result_revision_ref,order_line_ref),
 FOREIGN KEY(root_realm_id,order_ref,result_revision_ref)
  REFERENCES lab_result_revision(root_realm_id,order_ref,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,order_ref,order_line_ref)
  REFERENCES lab_order_line(root_realm_id,order_ref,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_entered_result_by_revision ON lab_result_value
 (root_realm_id,result_revision_ref,order_line_ref);
CREATE TRIGGER cg16_entered_result_immutable BEFORE UPDATE OR DELETE
 ON lab_result_value FOR EACH ROW EXECUTE FUNCTION cg16_clinical_source_frozen();
-- The same CG19 scan/file evidence remains, but its audit event must
-- accurately say GENERATED rather than pretending that a human uploaded it.
ALTER TABLE cg19_lab_result_event
 DROP CONSTRAINT cg19_lab_result_event_action_check;
ALTER TABLE cg19_lab_result_event
 ADD CONSTRAINT cg19_lab_result_event_action_check CHECK(action IN
  ('UPLOAD_INTENT','SCAN_VERIFIED','SCAN_REJECTED','FILE_REVOKED',
   'GENERATED_INTENT','GENERATED_VERIFIED'));
ALTER TABLE cg19_lab_result_event
 DROP CONSTRAINT cg19_lab_result_event_check;
ALTER TABLE cg19_lab_result_event
 ADD CONSTRAINT cg19_lab_result_event_check CHECK(
  (action IN('UPLOAD_INTENT','SCAN_REJECTED','GENERATED_INTENT') AND file_ref IS NULL)
  OR (action IN('SCAN_VERIFIED','FILE_REVOKED','GENERATED_VERIFIED')
   AND file_ref IS NOT NULL)
 );
-- On generated reports, the original report revision/result digest, CG19
-- scan-verification, clinical review and patient release guards are REUSED.
-- Existing manually prepared PDFs are not silently converted or marked
-- generated; the new primary flow is staff result entry -> CG19 PDF.
