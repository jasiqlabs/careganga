-- Forward-only CG17 US001 approved non-consultation benefit policy.
-- No clinical/retail ERP is activated and no patient entitlement or liability
-- is created by this migration. Preserve existing consultation-only financial
-- evidence FKs, completion trigger, current settlement and banking rules.
-- Original 1701/1702 files are immutable; reuse original CG03 case and
-- strong protected reviewer/owner proof for EVERY non-consultation policy.
DO $cg17$
DECLARE old_constraint text;
BEGIN
 SELECT conname INTO STRICT old_constraint FROM pg_constraint
 WHERE conrelid='healthcare_policy_revision'::regclass
   AND contype='c'
   AND position('approval_state' in pg_get_constraintdef(oid))>0
   AND position('service_kind' in pg_get_constraintdef(oid))>0
   AND position('CONSULTATION' in pg_get_constraintdef(oid))>0;
 EXECUTE format('ALTER TABLE healthcare_policy_revision DROP CONSTRAINT %I',old_constraint);
END $cg17$;
ALTER TABLE healthcare_policy_revision
 ADD CONSTRAINT cg17_nonconsultation_requires_independent_approval
 CHECK(approval_state<>'ACTIVE' OR service_kind='CONSULTATION' OR
  (approved_case_ref IS NOT NULL AND approved_decision_ref IS NOT NULL));
-- A foreign key to a generic CG03 case is not adequate: the trigger must
-- check the exact existing policy revision/digest, different independent
-- protected reviewer and current owner-pending decision before activation.
CREATE OR REPLACE FUNCTION cg17_policy_full_coverage_fail_closed() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 IF NEW.approval_state='ACTIVE' AND
    (NEW.service_kind<>'CONSULTATION' OR
     (NEW.mode='PERCENT' AND NEW.percent_basis_points=10000)) THEN
  IF NEW.approved_case_ref IS NULL OR NEW.approved_decision_ref IS NULL OR
    NOT EXISTS(
     SELECT 1 FROM cg03_case c
     JOIN cg03_case_decision d ON
      d.realm_id=c.realm_id AND d.case_id=c.id
     JOIN account reviewer ON reviewer.id=d.actor_id
      AND reviewer.realm_id=d.realm_id AND reviewer.status='ACTIVE'
     JOIN account_role ar ON ar.account_id=reviewer.id AND
      ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL
     JOIN role current_role ON current_role.realm_id=ar.realm_id
      AND current_role.id=ar.role_id
      AND current_role.is_protected AND current_role.active
     WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.approved_case_ref
      AND c.case_kind='CG17_POLICY_EXCEPTION'
      AND c.cg17_policy_revision_id=NEW.id
      AND c.cg17_policy_version=NEW.revision_no
      AND c.cg17_policy_digest=NEW.source_digest
      AND c.proposer_id=NEW.actor_ref AND c.status='PENDING_OWNER'
      AND d.id=NEW.approved_decision_ref AND d.action='APPROVE'
      AND d.actor_id<>c.proposer_id
      AND d.fresh_password_verified_at IS NOT NULL
      AND d.accepted_case_revision=c.revision
    )
  THEN
   RAISE EXCEPTION 'Protected healthcare support requires current original CG03 independent approval';
  END IF;
 END IF;
 RETURN NEW;
END $cg17$;

