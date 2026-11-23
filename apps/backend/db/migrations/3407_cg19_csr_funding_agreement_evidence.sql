-- CG08 US002: original CG19 proof for a specific funding proposal revision.
-- Verified private bytes only; scanner CLEAN does NOT itself prove a signature.
-- CG03 must independently inspect/approve a signed commitment. No CG09 cash.
ALTER TABLE cg19_upload_intent
 ADD COLUMN funding_proposal_id uuid,
 ADD CONSTRAINT cg19_funding_intent_proposal_fk
  FOREIGN KEY(realm_id,funding_proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_funding_intent_disjoint CHECK(
  (owner_kind='CG08_FUNDING_AGREEMENT')=(funding_proposal_id IS NOT NULL)),
 ADD CONSTRAINT uq_cg19_funding_intent_identity
  UNIQUE(id,realm_id,funding_proposal_id,proposal_revision);

ALTER TABLE cg19_stored_file
 ADD COLUMN funding_proposal_id uuid,
 ADD CONSTRAINT cg19_funding_file_proposal_fk
  FOREIGN KEY(realm_id,funding_proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_funding_file_intent_fk
  FOREIGN KEY(upload_intent_id,realm_id,funding_proposal_id,proposal_revision)
  REFERENCES cg19_upload_intent(id,realm_id,funding_proposal_id,proposal_revision)
  ON DELETE RESTRICT,
 ADD CONSTRAINT cg19_funding_file_disjoint CHECK(
  (owner_kind='CG08_FUNDING_AGREEMENT')=(funding_proposal_id IS NOT NULL));

-- Extend (not replace) existing CG19 owner/source/classification checks.
-- Older owner-specific guards (including CSR partner agreement) remain intact.
DO $cg08_funding$
DECLARE rec record; original text; extra text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cg19_upload_intent','cg19_upload_intent_owner_kind_check','OWNER'),
  ('cg19_stored_file','cg19_stored_file_owner_kind_check','OWNER'),
  ('cg19_upload_intent','cg19_intent_branch_source','SOURCE'),
  ('cg19_stored_file','cg19_file_branch_source','SOURCE'),
  ('cg19_upload_intent','cg19_intent_source_classification','CLASS')
 ) v(tbl,cn,kind) LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO original FROM pg_constraint
   WHERE conrelid=rec.tbl::regclass AND conname=rec.cn AND contype='c';
  IF original IS NULL THEN RAISE EXCEPTION 'Missing original CG19 guard %',rec.cn; END IF;
  IF rec.kind='OWNER' THEN
   extra:='owner_kind=''CG08_FUNDING_AGREEMENT''';
  ELSIF rec.kind='CLASS' THEN
   extra:='owner_kind=''CG08_FUNDING_AGREEMENT''
    AND classification=''CSR_FUNDING_AGREEMENT''
    AND mime IN(''application/pdf'',''image/jpeg'',''image/png'',''image/webp'')';
  ELSE
   extra:='owner_kind=''CG08_FUNDING_AGREEMENT''
    AND funding_proposal_id IS NOT NULL AND csr_partner_id IS NULL
    AND case_id IS NULL AND campaign_id IS NULL
    AND num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,
      voucher_id,voucher_version,claim_id,claim_version,reconciliation_id,
      health_provider_id,health_center_id,health_doctor_id,health_source_version,
      support_case_id,hr_application_id,hr_source_version,inventory_receipt_id,
      inventory_operation_id,project_id,activity_id,visit_id)=0';
  END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',rec.tbl,rec.cn);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (((%s) OR (%s)) IS TRUE)',
   rec.tbl,rec.cn,original,extra);
 END LOOP;
END $cg08_funding$;

CREATE INDEX ix_cg19_funding_intent
 ON cg19_upload_intent(realm_id,funding_proposal_id,created_at DESC,id DESC)
 WHERE owner_kind='CG08_FUNDING_AGREEMENT';
CREATE INDEX ix_cg19_funding_verified
 ON cg19_stored_file(realm_id,funding_proposal_id,proposal_revision,created_at DESC,id DESC)
 WHERE owner_kind='CG08_FUNDING_AGREEMENT' AND revoked_at IS NULL;

-- Required before the event FK is created, not afterwards.
ALTER TABLE cg19_upload_intent
 ADD CONSTRAINT uq_cg19_funding_intent_owner
 UNIQUE(id,realm_id,funding_proposal_id);

CREATE TABLE cg19_funding_evidence_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL,
 funding_proposal_id uuid NOT NULL,
 intent_ref uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN(
  'UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','UPLOAD_UNKNOWN')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,funding_proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(intent_ref,realm_id,funding_proposal_id)
  REFERENCES cg19_upload_intent(id,realm_id,funding_proposal_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TRIGGER cg19_funding_evidence_event_immutable
 BEFORE UPDATE OR DELETE ON cg19_funding_evidence_event
 FOR EACH ROW EXECUTE FUNCTION cg19_document_event_immutable();

CREATE FUNCTION cg19_funding_file_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.funding_proposal_id IS DISTINCT FROM OLD.funding_proposal_id THEN
  RAISE EXCEPTION 'Original funding agreement owner cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_funding_intent_owner_immutable
 BEFORE UPDATE ON cg19_upload_intent FOR EACH ROW
 EXECUTE FUNCTION cg19_funding_file_identity_guard();
CREATE TRIGGER cg19_funding_file_owner_immutable
 BEFORE UPDATE ON cg19_stored_file FOR EACH ROW
 EXECUTE FUNCTION cg19_funding_file_identity_guard();
