-- CG08 US001 / CG19-owned verified CSR agreements.
-- Extend the original private object intent/file authority. CG08 owns partners;
-- CG19 owns only private proof metadata, scanner and non-public bytes.
ALTER TABLE cg19_upload_intent
 ADD COLUMN csr_partner_id uuid,
 ADD CONSTRAINT cg19_csr_intent_partner_fk
  FOREIGN KEY(realm_id,csr_partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT uq_cg19_csr_intent_identity UNIQUE(id,realm_id,csr_partner_id,proposal_revision),
 ADD CONSTRAINT uq_cg19_csr_intent_owner UNIQUE(id,realm_id,csr_partner_id),
 ADD CONSTRAINT cg19_csr_intent_disjoint CHECK(
  (owner_kind='CG08_CSR_AGREEMENT')=(csr_partner_id IS NOT NULL));
ALTER TABLE cg19_stored_file
 ADD COLUMN csr_partner_id uuid,
 ADD CONSTRAINT cg19_csr_file_partner_fk
  FOREIGN KEY(realm_id,csr_partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_csr_file_intent_fk
  FOREIGN KEY(upload_intent_id,realm_id,csr_partner_id,proposal_revision)
  REFERENCES cg19_upload_intent(id,realm_id,csr_partner_id,proposal_revision) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_csr_file_disjoint CHECK(
  (owner_kind='CG08_CSR_AGREEMENT')=(csr_partner_id IS NOT NULL));

-- Preserve every existing owner check. Only introduce the specific verified CSR
-- agreement route; never delete the other 19/03/14/07 evidence constraints.
DO $cg08$
DECLARE rec record; old_guard text; additional text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) v(tbl,cn,kind) LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO old_guard FROM pg_constraint
   WHERE conrelid=rec.tbl::regclass AND conname=rec.cn AND contype='c';
  IF old_guard IS NULL THEN RAISE EXCEPTION 'Existing CG19 file guard missing: %',rec.cn; END IF;
  IF rec.kind='OWNER' THEN
   additional:='owner_kind=''CG08_CSR_AGREEMENT''';
  ELSIF rec.kind='CLASS' THEN
   additional:='owner_kind=''CG08_CSR_AGREEMENT'' AND classification=''CSR_AGREEMENT'' AND
    mime IN(''application/pdf'',''image/jpeg'',''image/png'',''image/webp'')';
  ELSE
   additional:='owner_kind=''CG08_CSR_AGREEMENT'' AND csr_partner_id IS NOT NULL
     AND case_id IS NULL AND campaign_id IS NULL
     AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
      voucher_id,voucher_version,claim_id,claim_version,reconciliation_id,
      health_provider_id,health_center_id,health_doctor_id,health_source_version,
      support_case_id,hr_application_id,hr_source_version,inventory_receipt_id,
      inventory_operation_id,project_id,activity_id,visit_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.tbl,rec.cn);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
   rec.tbl,rec.cn,old_guard,additional);
 END LOOP;
END $cg08$;

CREATE INDEX ix_cg19_csr_intent ON cg19_upload_intent(realm_id,csr_partner_id,created_at DESC,id DESC)
 WHERE owner_kind='CG08_CSR_AGREEMENT';
CREATE INDEX ix_cg19_csr_verified ON cg19_stored_file(realm_id,csr_partner_id,created_at DESC,id DESC)
 WHERE owner_kind='CG08_CSR_AGREEMENT' AND revoked_at IS NULL;

CREATE TABLE cg19_csr_evidence_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 partner_id uuid NOT NULL,
 intent_ref uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id,partner_id) REFERENCES cg19_upload_intent(id,realm_id,csr_partner_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg19_csr_evidence_event_immutable BEFORE UPDATE OR DELETE ON cg19_csr_evidence_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();

CREATE FUNCTION cg19_csr_file_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.csr_partner_id IS DISTINCT FROM OLD.csr_partner_id THEN
  RAISE EXCEPTION 'Original CSR agreement owner cannot change'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_csr_intent_owner_immutable BEFORE UPDATE ON cg19_upload_intent
 FOR EACH ROW EXECUTE FUNCTION cg19_csr_file_identity_guard();
CREATE TRIGGER cg19_csr_file_owner_immutable BEFORE UPDATE ON cg19_stored_file
 FOR EACH ROW EXECUTE FUNCTION cg19_csr_file_identity_guard();
