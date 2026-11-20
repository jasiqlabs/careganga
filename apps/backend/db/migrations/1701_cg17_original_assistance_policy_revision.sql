-- CG17 US001. One original versioned benefit policy authority, not a
-- center fee, patient collection, Foundation journal or provider payout.
-- Approved rules are explicit: there is never a blanket 50% entitlement.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE healthcare_policy_revision(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 policy_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 doctor_ref uuid,
 service_kind text NOT NULL CHECK(service_kind IN
  ('CONSULTATION','LAB','PHARMACY','NURSING','OT')),
 revision_no integer NOT NULL CHECK(revision_no BETWEEN 1 AND 2147483647),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 mode text NOT NULL CHECK(mode IN('PERCENT','FIXED')),
 percent_basis_points integer CHECK(percent_basis_points BETWEEN 1 AND 10000),
 fixed_minor bigint CHECK(fixed_minor BETWEEN 1 AND 10000000000),
 cap_minor bigint NOT NULL CHECK(cap_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 eligibility text NOT NULL DEFAULT 'VERIFIED_PATIENT_CARE'
   CHECK(eligibility='VERIFIED_PATIENT_CARE'),
 approval_state text NOT NULL DEFAULT 'PENDING_APPROVAL'
   CHECK(approval_state IN ('PENDING_APPROVAL','ACTIVE','REJECTED',
    'SUPERSEDED','WITHDRAWN')),
 approved_case_ref uuid,
 approved_decision_ref uuid,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 changed_by uuid,
 changed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,policy_ref,revision_no),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,doctor_ref,center_ref)
  REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(changed_by,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_decision_ref,root_realm_id)
  REFERENCES cg03_case_decision(id,realm_id) ON DELETE RESTRICT,
 CHECK(valid_until>valid_from),
 CHECK((mode='PERCENT' AND percent_basis_points IS NOT NULL
   AND fixed_minor IS NULL) OR
   (mode='FIXED' AND fixed_minor IS NOT NULL
   AND percent_basis_points IS NULL)),
 CHECK(approval_state<>'ACTIVE' OR
   service_kind='CONSULTATION'),
 CHECK(approval_state<>'ACTIVE' OR
   (mode='FIXED' OR percent_basis_points<10000) OR
   (approved_case_ref IS NOT NULL AND approved_decision_ref IS NOT NULL)),
 CHECK(changed_at IS NULL OR changed_by IS NOT NULL)
);
-- Every revision is a new original row; no overlapping effective ACTIVE
-- policy at the same center + doctor/center-wide precedence, even with NULL
-- doctor and concurrent proposals. Previous accepted patient charges still
-- reference the old immutable revision after supersession/withdrawal.
ALTER TABLE healthcare_policy_revision ADD CONSTRAINT
 cg17_no_overlapping_effective_policy
 EXCLUDE USING gist(
  root_realm_id WITH =,center_ref WITH =,
  service_kind WITH =,
  (coalesce(doctor_ref,'00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
  tstzrange(valid_from,valid_until,'[)') WITH &&
 ) WHERE(approval_state='ACTIVE');
CREATE INDEX ix_cg17_policy_center_current
 ON healthcare_policy_revision(root_realm_id,center_ref,service_kind,
 valid_from,valid_until,id)
 WHERE approval_state='ACTIVE';
CREATE INDEX ix_cg17_policy_history
 ON healthcare_policy_revision(root_realm_id,center_ref,service_kind,
 policy_ref,revision_no DESC,id DESC);
CREATE INDEX ix_cg17_policy_pending
 ON healthcare_policy_revision(root_realm_id,approval_state,
 created_at DESC,id DESC)
 WHERE approval_state='PENDING_APPROVAL';

-- Freezing all economic identity/source fields ensures no silent retroactive
-- support percentage, cap, doctor, scope, validity or actor change.
CREATE FUNCTION cg17_policy_immutable_source_guard() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Historical healthcare assistance policy cannot be deleted';
 END IF;
 IF (to_jsonb(NEW)-'approval_state'-'changed_by'-'changed_at'
   -'approved_case_ref'-'approved_decision_ref')
  IS DISTINCT FROM
    (to_jsonb(OLD)-'approval_state'-'changed_by'-'changed_at'
   -'approved_case_ref'-'approved_decision_ref') THEN
  RAISE EXCEPTION 'Policy terms and original actor must be immutable';
 END IF;
 IF OLD.approval_state IN('WITHDRAWN','SUPERSEDED','REJECTED') OR
  NOT ((OLD.approval_state='ACTIVE' AND
       NEW.approval_state IN('WITHDRAWN','SUPERSEDED')) OR
       (OLD.approval_state='PENDING_APPROVAL' AND
       NEW.approval_state IN('ACTIVE','REJECTED'))) THEN
  RAISE EXCEPTION 'Healthcare support state transition denied';
 END IF;
 IF NEW.changed_by IS NULL OR NEW.changed_at IS NULL OR
  (OLD.changed_at IS NOT NULL AND NEW.changed_at<=OLD.changed_at) THEN
  RAISE EXCEPTION 'Original policy transition requires an audited actor and time';
 END IF;
 IF OLD.approved_case_ref IS NOT NULL AND
    NEW.approved_case_ref IS DISTINCT FROM OLD.approved_case_ref OR
    OLD.approved_decision_ref IS NOT NULL AND
    NEW.approved_decision_ref IS DISTINCT FROM OLD.approved_decision_ref THEN
  RAISE EXCEPTION 'Protected approval reference cannot be replaced';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_policy_identity_immutable
 BEFORE UPDATE OR DELETE ON healthcare_policy_revision
 FOR EACH ROW EXECUTE FUNCTION cg17_policy_immutable_source_guard();
-- Until CG17's genuine CG03 exceptionally approved case kind, reviewer
-- decision and owner finalizer exist, reject every attempted full award.
-- No dummy case, generic admin assertion or unrelated CG03 approval qualifies.
CREATE FUNCTION cg17_policy_full_coverage_fail_closed() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 IF NEW.approval_state='ACTIVE' AND
    NEW.mode='PERCENT' AND NEW.percent_basis_points=10000
 THEN
  RAISE EXCEPTION 'Full healthcare assistance requires original protected CG03 approval';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_policy_full_coverage_guard
 BEFORE INSERT OR UPDATE ON healthcare_policy_revision
 FOR EACH ROW EXECUTE FUNCTION cg17_policy_full_coverage_fail_closed();
