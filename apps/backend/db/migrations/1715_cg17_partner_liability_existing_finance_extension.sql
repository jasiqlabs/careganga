-- CG17 shared Foundation finance: allow ONLY a genuinely independently
-- approved ERP-OFF pharmacy/nursing/OT patient bill to use ORIGINAL liability,
-- CG09 accrual, one monthly provider_settlement, original bank verification.
-- No new finance/settlement master; consultation shape remains constrained.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE foundation_liability
 DROP CONSTRAINT foundation_liability_root_realm_id_source_ref_fkey;
ALTER TABLE foundation_liability
 DROP CONSTRAINT foundation_liability_source_kind_check;
ALTER TABLE foundation_liability
 ADD CONSTRAINT cg17_liability_original_source_kind
 CHECK(source_kind IN('CG15_CONSULTATION','CG17_PARTNER_SERVICE'));
ALTER TABLE foundation_liability
 ALTER COLUMN completion_event_ref DROP NOT NULL,
 ALTER COLUMN award_ref DROP NOT NULL,
 ALTER COLUMN charge_ref DROP NOT NULL,
 ALTER COLUMN service_completed_at DROP NOT NULL;
ALTER TABLE foundation_liability
 ADD COLUMN original_cg15_source_ref uuid GENERATED ALWAYS AS(
  CASE WHEN source_kind='CG15_CONSULTATION' THEN source_ref ELSE NULL END
 ) STORED,
 ADD COLUMN partner_claim_ref uuid,
 ADD COLUMN partner_decision_ref uuid;
ALTER TABLE foundation_liability
 ADD CONSTRAINT fk_cg17_real_original_consultation
 FOREIGN KEY(root_realm_id,original_cg15_source_ref)
 REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg17_partner_liability_claim
 FOREIGN KEY(root_realm_id,partner_claim_ref,center_ref)
 REFERENCES cg17_partner_service_claim(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg17_partner_liability_review
 FOREIGN KEY(root_realm_id,partner_decision_ref,partner_claim_ref)
 REFERENCES cg17_partner_invoice_decision(root_realm_id,id,claim_ref) ON DELETE RESTRICT,
 ADD CONSTRAINT cg17_liability_source_shape CHECK(
  (source_kind='CG15_CONSULTATION' AND completion_event_ref IS NOT NULL
   AND award_ref IS NOT NULL AND charge_ref IS NOT NULL
   AND service_completed_at IS NOT NULL
   AND partner_claim_ref IS NULL AND partner_decision_ref IS NULL)
  OR
  (source_kind='CG17_PARTNER_SERVICE' AND completion_event_ref IS NULL
   AND award_ref IS NULL AND charge_ref IS NULL
   AND service_completed_at IS NULL
   AND partner_claim_ref IS NOT NULL AND partner_decision_ref IS NOT NULL
   AND partner_claim_ref=source_ref)
 );
CREATE INDEX ix_cg17_partner_approved_liabilities
 ON foundation_liability(root_realm_id,center_ref,service_local_date,id)
 WHERE source_kind='CG17_PARTNER_SERVICE';
-- Original CG15 verification is retained verbatim in the ELSE branch.
CREATE OR REPLACE FUNCTION cg17_liability_completion_guard() RETURNS trigger LANGUAGE plpgsql AS $cg17$
BEGIN
 IF NEW.source_kind='CG17_PARTNER_SERVICE' THEN
  IF NOT EXISTS(
   SELECT 1 FROM cg17_partner_service_claim claim
   JOIN cg17_partner_invoice_attestation att
    ON att.root_realm_id=claim.root_realm_id
    AND att.claim_ref=claim.id
   JOIN cg17_partner_invoice_decision decision
    ON decision.root_realm_id=claim.root_realm_id
    AND decision.claim_ref=claim.id AND decision.attestation_ref=att.id
    AND decision.outcome='APPROVED'
   JOIN health_center center ON center.root_realm_id=claim.root_realm_id
    AND center.id=claim.center_ref
   JOIN health_provider provider ON provider.root_realm_id=center.root_realm_id
    AND provider.id=center.provider_id
   JOIN healthcare_policy_revision policy
    ON policy.root_realm_id=claim.root_realm_id
    AND policy.id=claim.policy_revision_ref
   WHERE claim.root_realm_id=NEW.root_realm_id
    AND claim.id=NEW.partner_claim_ref AND claim.id=NEW.source_ref
    AND claim.center_ref=NEW.center_ref
    AND decision.id=NEW.partner_decision_ref
    AND decision.reviewed_by_account=NEW.created_by_account
    AND decision.approved_support_minor=NEW.amount_minor
    AND claim.estimated_support_minor=NEW.amount_minor
    AND claim.quoted_gross_minor=decision.accepted_gross_minor
    AND att.collected_minor=decision.accepted_patient_paid_minor
    AND att.collected_minor+NEW.amount_minor=claim.quoted_gross_minor
    AND claim.service_local_date=NEW.service_local_date
    AND NEW.service_completed_at IS NULL
    AND center.status='VERIFIED' AND center.access_state='ENABLED'
    AND provider.status='VERIFIED'
    AND policy.service_kind=claim.service_kind
    AND policy.approval_state='ACTIVE'
    AND NEW.source_digest=encode(digest(
      'CG17_PARTNER_LIABILITY_V1|'||claim.source_digest||'|'||
      att.evidence_digest||'|'||decision.decision_digest,
      'sha256'),'hex')
  ) THEN
   RAISE EXCEPTION 'Partner liability requires reviewed genuine service and direct patient payment'
    USING ERRCODE='P1744';
  END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM cg15_visit_event e
  JOIN cg15_visit_queue v ON v.root_realm_id=e.root_realm_id AND v.id=e.visit_id
    AND v.appointment_id=e.appointment_id
  JOIN cg15_consultation_appointment a ON a.root_realm_id=e.root_realm_id
    AND a.id=e.appointment_id
  JOIN patient_charge c ON c.root_realm_id=a.root_realm_id
    AND c.source_ref=a.id AND c.center_ref=a.center_id
  JOIN assistance_award award ON award.root_realm_id=c.root_realm_id
    AND award.charge_ref=c.id AND award.id=NEW.award_ref
  WHERE e.root_realm_id=NEW.root_realm_id AND e.id=NEW.completion_event_ref
   AND e.next_state='COMPLETED' AND e.appointment_id=NEW.source_ref
   AND v.state='COMPLETED' AND a.booking_state='COMPLETED'
   AND a.center_id=NEW.center_ref AND c.id=NEW.charge_ref
   AND c.charge_state='ACCEPTED' AND c.support_minor=NEW.amount_minor
   AND award.approved_support_minor=NEW.amount_minor
   AND award.policy_revision_ref=c.policy_revision_ref
   AND date_trunc('milliseconds',e.created_at)=NEW.service_completed_at
   AND (e.created_at AT TIME ZONE a.time_zone)::date=NEW.service_local_date
 ) THEN
  RAISE EXCEPTION 'Foundation liability requires completed original CG15 service and approved award';
 END IF;
 RETURN NEW;
END $cg17$;
