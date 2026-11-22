-- Extend original CG19 file/scanner authority only for an actual frozen CG12 receipt draft.
ALTER TABLE cg19_upload_intent ADD COLUMN inventory_operation_id uuid,
 ADD CONSTRAINT fk_cg19_movement_intent_source FOREIGN KEY(realm_id,inventory_operation_id,proposal_revision)
 REFERENCES stock_operation_draft(root_realm_id,id,source_version) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_movement_intent_source UNIQUE(id,realm_id,inventory_operation_id,proposal_revision);
ALTER TABLE cg19_stored_file ADD COLUMN inventory_operation_id uuid,
 ADD CONSTRAINT fk_cg19_movement_file_source FOREIGN KEY(realm_id,inventory_operation_id,proposal_revision)
 REFERENCES stock_operation_draft(root_realm_id,id,source_version) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg19_movement_file_intent FOREIGN KEY(upload_intent_id,realm_id,inventory_operation_id,proposal_revision)
 REFERENCES cg19_upload_intent(id,realm_id,inventory_operation_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_movement_file_source UNIQUE(id,realm_id,inventory_operation_id,proposal_revision);
DO $cg12$
DECLARE rec record; original_sql text; predicate text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) v(table_name,constraint_name,kind)
 LOOP
  SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original_sql
   FROM pg_constraint WHERE conrelid=rec.table_name::regclass AND conname=rec.constraint_name AND contype='c';
  IF original_sql IS NULL THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
  IF rec.kind='OWNER' THEN
   predicate:='owner_kind=''CG12_MOVEMENT''';
  ELSIF rec.kind='CLASS' THEN
   predicate:='owner_kind=''CG12_MOVEMENT'' AND classification=''INVENTORY_MOVEMENT_PROOF''';
  ELSE
   predicate:='owner_kind=''CG12_MOVEMENT'' AND inventory_operation_id IS NOT NULL AND proposal_revision=1 AND num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version,reconciliation_id,health_provider_id,health_center_id,health_doctor_id,health_source_version,support_case_id,hr_application_id,hr_source_version,inventory_receipt_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.table_name,rec.constraint_name);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',rec.table_name,rec.constraint_name,original_sql,predicate);
 END LOOP;
END; $cg12$;
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_movement_intent_disjoint CHECK(
 (owner_kind='CG12_MOVEMENT' AND inventory_operation_id IS NOT NULL AND proposal_revision=1)
 OR (owner_kind<>'CG12_MOVEMENT' AND inventory_operation_id IS NULL));
ALTER TABLE cg19_stored_file ADD CONSTRAINT cg19_movement_file_disjoint CHECK(
 (owner_kind='CG12_MOVEMENT' AND inventory_operation_id IS NOT NULL AND proposal_revision=1)
 OR (owner_kind<>'CG12_MOVEMENT' AND inventory_operation_id IS NULL));
CREATE INDEX ix_cg19_movement_clean_file ON cg19_stored_file(realm_id,inventory_operation_id,created_at DESC,id)
 WHERE owner_kind='CG12_MOVEMENT' AND revoked_at IS NULL;
CREATE TABLE cg19_movement_evidence_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), realm_id uuid NOT NULL,
 operation_id uuid NOT NULL, actor_ref uuid NOT NULL,
 intent_ref uuid NOT NULL, action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,operation_id) REFERENCES stock_operation_draft(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id) REFERENCES cg19_upload_intent(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg19_movement_evidence_event_immutable BEFORE UPDATE OR DELETE ON cg19_movement_evidence_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();
ALTER TABLE stock_event ADD COLUMN movement_proof_ref uuid,ADD COLUMN movement_proof_revision integer,ADD COLUMN operation_source_version integer NOT NULL DEFAULT 1 CHECK(operation_source_version=1),
 ADD CONSTRAINT fk_stock_operation_original_clean_file FOREIGN KEY(movement_proof_ref,root_realm_id,operation_id,operation_source_version)
 REFERENCES cg19_stored_file(id,realm_id,inventory_operation_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT stock_operation_proof_pair CHECK(
 (movement_proof_ref IS NULL AND movement_proof_revision IS NULL) OR (operation_id IS NOT NULL AND movement_proof_ref IS NOT NULL AND movement_proof_revision>0));
CREATE TABLE stock_adjustment_submission(
 root_realm_id uuid NOT NULL,operation_id uuid NOT NULL,case_id uuid NOT NULL,proof_ref uuid,proof_revision integer,source_version integer NOT NULL DEFAULT 1 CHECK(source_version=1),
 PRIMARY KEY(root_realm_id,operation_id),UNIQUE(root_realm_id,case_id),
 FOREIGN KEY(root_realm_id,operation_id,source_version) REFERENCES stock_operation_draft(root_realm_id,id,source_version),
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id),
 FOREIGN KEY(proof_ref,root_realm_id,operation_id,source_version) REFERENCES cg19_stored_file(id,realm_id,inventory_operation_id,proposal_revision),
 CHECK((proof_ref IS NULL AND proof_revision IS NULL) OR (proof_ref IS NOT NULL AND proof_revision>0))
);
CREATE TRIGGER stock_adjustment_submission_immutable BEFORE UPDATE OR DELETE ON stock_adjustment_submission FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
