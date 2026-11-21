-- CG17 original US002/004 ERP-OFF: real patient-owned, independently
-- reviewable scanned partner invoice and performed service source.
-- A claim is NEVER an accepted charge, patient payment, Foundation liability,
-- CG09 journal, settlement, or medical determination. No optional ERP tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE cg17_partner_service_claim(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 public_code text NOT NULL DEFAULT ('CG-'||upper(encode(gen_random_bytes(7),'hex')))
  CHECK(public_code ~ '^CG-[A-F0-9]{14}$'),
 center_ref uuid NOT NULL,
 patient_ref uuid NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN('PHARMACY','NURSING','OT')),
 invoice_number text NOT NULL CHECK(
   char_length(invoice_number) BETWEEN 2 AND 60
   AND invoice_number ~ '^[A-Za-z0-9][A-Za-z0-9 /._-]*$'),
 invoice_normalized text GENERATED ALWAYS AS(lower(btrim(invoice_number))) STORED,
 service_local_date date NOT NULL,
 invoice_file_ref uuid NOT NULL,
 completion_file_ref uuid,
 policy_revision_ref uuid NOT NULL,
 quoted_gross_minor bigint NOT NULL CHECK(quoted_gross_minor BETWEEN 1 AND 10000000000),
 estimated_support_minor bigint NOT NULL CHECK(estimated_support_minor BETWEEN 0 AND 10000000000),
 estimated_patient_due_minor bigint NOT NULL CHECK(estimated_patient_due_minor BETWEEN 0 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 requested_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'PENDING_VERIFICATION'
  CHECK(state='PENDING_VERIFICATION'),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,public_code),
 UNIQUE(root_realm_id,center_ref,invoice_normalized),
 UNIQUE(root_realm_id,requested_by_account,request_key),
 UNIQUE(root_realm_id,patient_ref,invoice_file_ref),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,patient_ref)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,invoice_file_ref,patient_ref)
  REFERENCES cg19_patient_private_file(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,completion_file_ref,patient_ref)
  REFERENCES cg19_patient_private_file(realm_id,id,patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,policy_revision_ref)
  REFERENCES healthcare_policy_revision(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(quoted_gross_minor=estimated_support_minor+estimated_patient_due_minor),
 CHECK(estimated_support_minor<=quoted_gross_minor),
 CHECK((service_kind='PHARMACY' AND completion_file_ref IS NULL) OR
       (service_kind IN('NURSING','OT') AND completion_file_ref IS NOT NULL
        AND completion_file_ref<>invoice_file_ref))
);
CREATE INDEX ix_cg17_partner_claim_patient ON cg17_partner_service_claim
 (root_realm_id,patient_ref,submitted_at DESC,id DESC);
CREATE INDEX ix_cg17_partner_claim_center ON cg17_partner_service_claim
 (root_realm_id,center_ref,submitted_at DESC,id DESC);
CREATE FUNCTION cg17_partner_claim_original_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
DECLARE v_center record; v_policy record; v_support bigint; v_quote bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Original pending partner service evidence is immutable'
   USING ERRCODE='P1725';
 END IF;
 SELECT center.time_zone,center.status,center.access_state,
  provider.status AS provider_status
 INTO v_center FROM health_center center
 JOIN health_provider provider ON provider.root_realm_id=center.root_realm_id
  AND provider.id=center.provider_id
 WHERE center.root_realm_id=NEW.root_realm_id AND center.id=NEW.center_ref
 FOR SHARE OF center,provider;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current verified healthcare service is required'
   USING ERRCODE='P1726';
 END IF;
 IF v_center.status<>'VERIFIED' OR
  v_center.access_state<>'ENABLED' OR v_center.provider_status<>'VERIFIED' OR
  NEW.service_local_date>(now() AT TIME ZONE v_center.time_zone)::date THEN
  RAISE EXCEPTION 'Current verified healthcare service is required'
   USING ERRCODE='P1726';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM health_center_capability cap
  WHERE cap.root_realm_id=NEW.root_realm_id AND cap.center_id=NEW.center_ref
   AND cap.capability_code=CASE NEW.service_kind
    WHEN 'OT' THEN 'SURGERY' ELSE NEW.service_kind END) THEN
  RAISE EXCEPTION 'Current verified center capability is required'
   USING ERRCODE='P1727';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM cg15_patient patient
  JOIN cg15_patient_account_link own ON own.root_realm_id=patient.root_realm_id
   AND own.patient_id=patient.id AND own.account_id=NEW.requested_by_account
   AND own.revoked_at IS NULL
  JOIN account active ON active.realm_id=own.root_realm_id
   AND active.id=own.account_id AND active.status='ACTIVE'
  WHERE patient.root_realm_id=NEW.root_realm_id AND patient.id=NEW.patient_ref
   AND patient.profile_status='VERIFIED'
   AND EXISTS(SELECT 1 FROM cg15_patient_identity_event identity
     WHERE identity.root_realm_id=patient.root_realm_id AND identity.patient_id=patient.id)
   AND (SELECT consent.granted FROM cg15_patient_consent consent
     WHERE consent.root_realm_id=patient.root_realm_id
      AND consent.patient_id=patient.id AND consent.purpose='PATIENT_CARE'
     ORDER BY consent.revision_no DESC LIMIT 1)=true
 ) THEN
  RAISE EXCEPTION 'Current verified patient consent is required'
   USING ERRCODE='P1728';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM cg19_patient_private_file f
  JOIN cg19_patient_file_intent intent ON intent.realm_id=f.realm_id
   AND intent.id=f.intent_id AND intent.status='VALIDATED'
  WHERE f.realm_id=NEW.root_realm_id AND f.patient_id=NEW.patient_ref
   AND f.id=NEW.invoice_file_ref
   AND f.classification='PATIENT_PARTNER_INVOICE'
   AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL) OR
  (NEW.completion_file_ref IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM cg19_patient_private_file f
   JOIN cg19_patient_file_intent intent ON intent.realm_id=f.realm_id
    AND intent.id=f.intent_id AND intent.status='VALIDATED'
   WHERE f.realm_id=NEW.root_realm_id AND f.patient_id=NEW.patient_ref
    AND f.id=NEW.completion_file_ref
    AND f.classification='PATIENT_PARTNER_SERVICE_PROOF'
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL)) THEN
  RAISE EXCEPTION 'Clean scanned source evidence is required'
   USING ERRCODE='P1729';
 END IF;
 SELECT policy.id,policy.mode,policy.percent_basis_points,policy.fixed_minor,
  policy.cap_minor,policy.valid_from,policy.valid_until
 INTO v_policy FROM healthcare_policy_revision policy
 WHERE policy.root_realm_id=NEW.root_realm_id
  AND policy.id=NEW.policy_revision_ref AND policy.center_ref=NEW.center_ref
  AND policy.service_kind=NEW.service_kind AND policy.doctor_ref IS NULL
  AND policy.approval_state='ACTIVE' AND policy.activated_at IS NOT NULL
  AND policy.activated_at<=now()
  AND policy.valid_from<=now() AND policy.valid_until>now()
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Original active service contribution is unavailable'
   USING ERRCODE='P1730';
 END IF;
 IF NEW.service_local_date <
  (v_policy.valid_from AT TIME ZONE v_center.time_zone)::date OR
  NEW.service_local_date >
  (v_policy.valid_until AT TIME ZONE v_center.time_zone)::date THEN
  RAISE EXCEPTION 'Original active service contribution is unavailable'
   USING ERRCODE='P1730';
 END IF;
 v_quote=CASE WHEN v_policy.mode='PERCENT'
  THEN (NEW.quoted_gross_minor*v_policy.percent_basis_points+5000)/10000
  ELSE v_policy.fixed_minor END;
 v_support=LEAST(v_quote,v_policy.cap_minor,NEW.quoted_gross_minor);
 IF NEW.estimated_support_minor<>v_support OR
  NEW.estimated_patient_due_minor<>NEW.quoted_gross_minor-v_support THEN
  RAISE EXCEPTION 'Original benefit estimate has changed'
   USING ERRCODE='P1731';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_partner_service_claim_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg17_partner_service_claim
 FOR EACH ROW EXECUTE FUNCTION cg17_partner_claim_original_guard();
COMMENT ON TABLE cg17_partner_service_claim IS
 'Scanned and consented patient-submitted invoice/care evidence; provisional contribution only, no approved liability/settlement or verified payment';
