-- CG17 mandatory ERP-off financial-source verification. Keep original CG15
-- consultation charge/clinical events unchanged. No inventory or OT ERP.
-- Patient provides original CG19 clean proof; center representative attests
-- real service and patient collection; distinct protected Foundation reviewer
-- independently accepts/rejects. Each row is append-only (one decision).
ALTER TABLE cg17_partner_service_claim
 ADD CONSTRAINT uq_cg17_claim_realm_id_center
 UNIQUE(root_realm_id,id,center_ref);

CREATE TABLE cg17_partner_invoice_attestation(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 claim_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 collected_minor bigint NOT NULL CHECK(collected_minor BETWEEN 0 AND 10000000000),
 payment_method text NOT NULL CHECK(payment_method IN('CASH_ATTESTED','ELECTRONIC_EVIDENCE')),
 payment_file_ref uuid,
 service_performed boolean NOT NULL CHECK(service_performed),
 invoice_checked boolean NOT NULL CHECK(invoice_checked),
 evidence_digest char(64) NOT NULL CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
 attested_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 attested_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,claim_ref),
 UNIQUE(root_realm_id,attested_by_account,request_key),
 UNIQUE(root_realm_id,id,claim_ref),
 FOREIGN KEY(root_realm_id,claim_ref,center_ref)
  REFERENCES cg17_partner_service_claim(root_realm_id,id,center_ref)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_ref)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(payment_file_ref,root_realm_id)
  REFERENCES cg19_patient_private_file(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(attested_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(payment_method<>'ELECTRONIC_EVIDENCE' OR payment_file_ref IS NOT NULL),
 CHECK(payment_file_ref IS NULL OR collected_minor>0)
);
CREATE INDEX ix_cg17_partner_attest_center
 ON cg17_partner_invoice_attestation(root_realm_id,center_ref,attested_at DESC,id DESC);

CREATE TABLE cg17_partner_invoice_decision(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 claim_ref uuid NOT NULL,
 attestation_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN('APPROVED','REJECTED')),
 reviewed_by_account uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 original_claim_digest char(64) NOT NULL CHECK(original_claim_digest ~ '^[a-f0-9]{64}$'),
 original_evidence_digest char(64) NOT NULL CHECK(original_evidence_digest ~ '^[a-f0-9]{64}$'),
 accepted_gross_minor bigint NOT NULL CHECK(accepted_gross_minor BETWEEN 1 AND 10000000000),
 accepted_patient_paid_minor bigint NOT NULL CHECK(accepted_patient_paid_minor BETWEEN 0 AND 10000000000),
 approved_support_minor bigint NOT NULL CHECK(approved_support_minor BETWEEN 0 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 500),
 request_key uuid NOT NULL,
 decision_digest char(64) NOT NULL CHECK(decision_digest ~ '^[a-f0-9]{64}$'),
 fresh_password_verified_at timestamptz NOT NULL,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,claim_ref),
 UNIQUE(root_realm_id,reviewed_by_account,request_key),
 UNIQUE(root_realm_id,id,claim_ref),
 FOREIGN KEY(root_realm_id,claim_ref,center_ref)
  REFERENCES cg17_partner_service_claim(root_realm_id,id,center_ref)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,attestation_ref,claim_ref)
  REFERENCES cg17_partner_invoice_attestation(root_realm_id,id,claim_ref)
  ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(outcome='REJECTED' OR
       accepted_gross_minor=accepted_patient_paid_minor+approved_support_minor),
 CHECK(outcome='APPROVED' OR approved_support_minor=0)
);
CREATE INDEX ix_cg17_partner_decision_center
 ON cg17_partner_invoice_decision(root_realm_id,center_ref,reviewed_at DESC,id DESC);

CREATE FUNCTION cg17_partner_attestation_validate() RETURNS trigger LANGUAGE plpgsql AS $cg17$
DECLARE source cg17_partner_service_claim%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Original partner attestation cannot be modified' USING ERRCODE='P1732';
 END IF;
 SELECT * INTO source FROM cg17_partner_service_claim
 WHERE root_realm_id=NEW.root_realm_id AND id=NEW.claim_ref
  AND center_ref=NEW.center_ref FOR SHARE;
 IF NOT FOUND OR NEW.patient_ref IS DISTINCT FROM source.patient_ref
  OR NEW.collected_minor IS DISTINCT FROM source.estimated_patient_due_minor
  OR NEW.attested_by_account=source.requested_by_account THEN
  RAISE EXCEPTION 'Current original patient invoice and actual collection are required'
   USING ERRCODE='P1733';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM health_center_account_affiliation f
  JOIN health_center c ON c.root_realm_id=f.root_realm_id AND c.id=f.center_id
  JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id
  JOIN account a ON a.realm_id=f.root_realm_id AND a.id=f.account_ref
  WHERE f.root_realm_id=NEW.root_realm_id AND f.center_id=NEW.center_ref
   AND f.account_ref=NEW.attested_by_account AND f.status='ACTIVE'
   AND a.status='ACTIVE' AND c.status='VERIFIED'
   AND c.access_state='ENABLED' AND p.status='VERIFIED'
  ) THEN
  RAISE EXCEPTION 'Only assigned active partner representative may attest'
   USING ERRCODE='P1734';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM cg19_patient_private_file f
  JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id AND i.id=f.intent_id
  WHERE f.realm_id=source.root_realm_id AND f.id=source.invoice_file_ref
   AND f.patient_id=source.patient_ref AND f.scan_status='CLEAN_VERIFIED'
   AND f.classification='PATIENT_PARTNER_INVOICE'
   AND f.revoked_at IS NULL AND i.status='VALIDATED')
 OR (source.service_kind IN('NURSING','OT') AND NOT EXISTS(
  SELECT 1 FROM cg19_patient_private_file f
  JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id AND i.id=f.intent_id
  WHERE f.realm_id=source.root_realm_id AND f.id=source.completion_file_ref
   AND f.patient_id=source.patient_ref AND f.scan_status='CLEAN_VERIFIED'
   AND f.classification='PATIENT_PARTNER_SERVICE_PROOF'
   AND f.revoked_at IS NULL AND i.status='VALIDATED'))
 THEN
  RAISE EXCEPTION 'Original clinical/service invoice proof is unavailable'
   USING ERRCODE='P1735';
 END IF;
 IF NEW.payment_file_ref IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM cg19_patient_private_file f
  JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id AND i.id=f.intent_id
  WHERE f.realm_id=source.root_realm_id AND f.id=NEW.payment_file_ref
   AND f.patient_id=source.patient_ref AND f.scan_status='CLEAN_VERIFIED'
   AND f.classification='PATIENT_PARTNER_PAYMENT_PROOF'
   AND f.revoked_at IS NULL AND i.status='VALIDATED')
 THEN
  RAISE EXCEPTION 'Original scanned patient payment evidence is unavailable'
   USING ERRCODE='P1736';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_partner_attestation_guard BEFORE INSERT OR UPDATE OR DELETE
 ON cg17_partner_invoice_attestation FOR EACH ROW
 EXECUTE FUNCTION cg17_partner_attestation_validate();

CREATE FUNCTION cg17_partner_decision_validate() RETURNS trigger LANGUAGE plpgsql AS $cg17$
DECLARE claim cg17_partner_service_claim%ROWTYPE;
DECLARE attest cg17_partner_invoice_attestation%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Independent original Foundation decision is immutable'
   USING ERRCODE='P1737';
 END IF;
 SELECT * INTO claim FROM cg17_partner_service_claim
 WHERE root_realm_id=NEW.root_realm_id AND id=NEW.claim_ref
  AND center_ref=NEW.center_ref FOR SHARE;
 SELECT * INTO attest FROM cg17_partner_invoice_attestation
 WHERE root_realm_id=NEW.root_realm_id AND id=NEW.attestation_ref
  AND claim_ref=NEW.claim_ref FOR SHARE;
 IF claim.id IS NULL OR attest.id IS NULL OR
  claim.source_digest<>NEW.original_claim_digest OR
  attest.evidence_digest<>NEW.original_evidence_digest OR
  NEW.reviewed_by_account IN(attest.attested_by_account,claim.requested_by_account)
 THEN
  RAISE EXCEPTION 'Independent reviewed original proof is missing'
   USING ERRCODE='P1738';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM account reviewer
  JOIN account_role ar ON ar.realm_id=reviewer.realm_id AND
   ar.account_id=reviewer.id AND ar.revoked_at IS NULL
  JOIN role r ON r.realm_id=ar.realm_id AND r.id=ar.role_id
  WHERE reviewer.realm_id=NEW.root_realm_id AND reviewer.id=NEW.reviewed_by_account
   AND reviewer.status='ACTIVE' AND r.active AND r.is_protected)
 THEN
  RAISE EXCEPTION 'Current independent protected reviewer required'
   USING ERRCODE='P1739';
 END IF;
 IF NEW.accepted_gross_minor<>claim.quoted_gross_minor OR
    NEW.accepted_patient_paid_minor<>attest.collected_minor OR
    (NEW.outcome='APPROVED' AND NEW.approved_support_minor<>claim.estimated_support_minor) OR
    (NEW.outcome='REJECTED' AND NEW.approved_support_minor<>0)
 THEN
  RAISE EXCEPTION 'Reviewed accepted Foundation amounts changed'
   USING ERRCODE='P1740';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM health_center c JOIN health_provider p ON
   p.root_realm_id=c.root_realm_id AND p.id=c.provider_id
  JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id
   AND cap.center_id=c.id
  WHERE c.root_realm_id=claim.root_realm_id AND c.id=claim.center_ref
   AND c.status='VERIFIED' AND c.access_state='ENABLED'
   AND p.status='VERIFIED' AND cap.capability_code=CASE claim.service_kind
    WHEN 'OT' THEN 'SURGERY' ELSE claim.service_kind END)
 THEN
  RAISE EXCEPTION 'Verified partner service is no longer available'
   USING ERRCODE='P1741';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM cg15_patient pat
  WHERE pat.root_realm_id=claim.root_realm_id AND pat.id=claim.patient_ref
   AND pat.profile_status='VERIFIED'
   AND (SELECT consent.granted FROM cg15_patient_consent consent
     WHERE consent.root_realm_id=pat.root_realm_id
      AND consent.patient_id=pat.id AND consent.purpose='PATIENT_CARE'
     ORDER BY consent.revision_no DESC LIMIT 1)=true)
 THEN
  RAISE EXCEPTION 'Original patient care consent is not current'
   USING ERRCODE='P1742';
 END IF;
 IF NEW.outcome='APPROVED' AND
   (claim.estimated_support_minor=0 OR
   NOT EXISTS(SELECT 1 FROM healthcare_policy_revision pol
     WHERE pol.root_realm_id=claim.root_realm_id
      AND pol.id=claim.policy_revision_ref
      AND pol.center_ref=claim.center_ref
      AND pol.service_kind=claim.service_kind
      AND pol.approval_state='ACTIVE' AND pol.activated_at IS NOT NULL
      AND pol.valid_from<=now() AND pol.valid_until>now()))
 THEN
  RAISE EXCEPTION 'Original independently approved contribution is unavailable'
   USING ERRCODE='P1743';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_partner_decision_guard BEFORE INSERT OR UPDATE OR DELETE
 ON cg17_partner_invoice_decision FOR EACH ROW
 EXECUTE FUNCTION cg17_partner_decision_validate();
