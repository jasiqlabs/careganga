-- CG17 US005: original approved Foundation obligation for a REAL
-- completed CG15 consultation only, independent of the patient's center cash.
-- Historical policy and charge are immutable; no new CG15, CG14 or CG09 master.
CREATE TABLE assistance_award(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 charge_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 policy_revision_ref uuid NOT NULL,
 approved_case_ref uuid,
 approved_support_minor bigint NOT NULL
  CHECK(approved_support_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 state text NOT NULL DEFAULT 'APPROVED' CHECK(state='APPROVED'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision=1),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 approved_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,charge_ref),
 UNIQUE(root_realm_id,id,charge_ref),
 UNIQUE(root_realm_id,approved_by_account,request_key),
 FOREIGN KEY(root_realm_id,charge_ref,center_ref)
  REFERENCES patient_charge(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,policy_revision_ref)
  REFERENCES healthcare_policy_revision(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_case_ref,root_realm_id)
  REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg17_award_policy
 ON assistance_award(root_realm_id,policy_revision_ref,created_at DESC,id DESC);

CREATE TABLE foundation_liability(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind='CG15_CONSULTATION'),
 source_ref uuid NOT NULL,
 completion_event_ref uuid NOT NULL,
 award_ref uuid NOT NULL,
 charge_ref uuid NOT NULL,
 service_completed_at timestamptz NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 state text NOT NULL DEFAULT 'APPROVED_LIABILITY'
  CHECK(state='APPROVED_LIABILITY'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 created_by_account uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,source_kind,source_ref),
 UNIQUE(root_realm_id,award_ref),
 UNIQUE(root_realm_id,completion_event_ref),
 UNIQUE(root_realm_id,id,center_ref),
 FOREIGN KEY(root_realm_id,source_ref)
  REFERENCES cg15_consultation_appointment(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,completion_event_ref)
  REFERENCES cg15_visit_event(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,award_ref,charge_ref)
  REFERENCES assistance_award(root_realm_id,id,charge_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,charge_ref,center_ref)
  REFERENCES patient_charge(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg17_liability_center
 ON foundation_liability(root_realm_id,center_ref,service_completed_at DESC,id DESC);

-- US006 owns posting/reconciliation of this durable pending effect.
-- Never claim that inserting it posts a CG09 journal or pays the provider.
CREATE TABLE cg17_financial_effect(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 liability_ref uuid NOT NULL,
 effect_kind text NOT NULL CHECK(effect_kind IN
  ('LIABILITY_ACCRUAL','LIABILITY_REVERSAL','PROVIDER_SETTLEMENT','SETTLEMENT_REVERSAL')),
 source_kind text NOT NULL,
 source_ref uuid NOT NULL,
 source_revision integer NOT NULL CHECK(source_revision>0),
 idempotency_key uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 original_cg09_ref uuid,
 posting_state text NOT NULL DEFAULT 'PENDING'
  CHECK(posting_state IN('PENDING','UNKNOWN','POSTED','FAILED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,liability_ref,effect_kind,source_revision),
 UNIQUE(root_realm_id,effect_kind,source_kind,source_ref,source_revision),
 UNIQUE(root_realm_id,idempotency_key),
 FOREIGN KEY(root_realm_id,liability_ref)
  REFERENCES foundation_liability(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(original_cg09_ref,root_realm_id)
  REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 CHECK((posting_state='POSTED' AND original_cg09_ref IS NOT NULL) OR
  (posting_state<>'POSTED' AND original_cg09_ref IS NULL))
);
CREATE INDEX ix_cg17_effect_due
 ON cg17_financial_effect(root_realm_id,posting_state,created_at,id)
 WHERE posting_state IN('PENDING','UNKNOWN');

CREATE FUNCTION cg17_completed_liability_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $cg17$
BEGIN
 RAISE EXCEPTION 'Original approved healthcare assistance evidence is immutable';
END $cg17$;
CREATE TRIGGER cg17_assistance_award_frozen BEFORE UPDATE OR DELETE
 ON assistance_award FOR EACH ROW EXECUTE FUNCTION cg17_completed_liability_immutable();
CREATE TRIGGER cg17_foundation_liability_frozen BEFORE UPDATE OR DELETE
 ON foundation_liability FOR EACH ROW EXECUTE FUNCTION cg17_completed_liability_immutable();

-- Source kind/amount/root never change; original CG09 posting metadata is
-- changed only by US006 under the separately approved posting contract.
CREATE FUNCTION cg17_financial_effect_frozen() RETURNS trigger LANGUAGE plpgsql AS $cg17$
BEGIN
 IF TG_OP='DELETE' OR
   (to_jsonb(NEW)-'posting_state'-'original_cg09_ref'-'updated_at') IS DISTINCT FROM
   (to_jsonb(OLD)-'posting_state'-'original_cg09_ref'-'updated_at') OR
   OLD.posting_state='POSTED' OR
   NOT ((OLD.posting_state='PENDING' AND NEW.posting_state IN('UNKNOWN','POSTED','FAILED'))
     OR (OLD.posting_state='UNKNOWN' AND NEW.posting_state IN('POSTED','FAILED')))
 THEN
  RAISE EXCEPTION 'Original CG17 financial source cannot be rewritten';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_financial_effect_guard BEFORE UPDATE OR DELETE
 ON cg17_financial_effect FOR EACH ROW EXECUTE FUNCTION cg17_financial_effect_frozen();

-- Accrual proof: a genuine prior CG15 clinical completion event and the
-- frozen accepted charge/policy are mandatory. This is a DB defense against
-- accidental direct writes or an application-layer missed guard.
CREATE FUNCTION cg17_liability_completion_guard() RETURNS trigger LANGUAGE plpgsql AS $cg17$
BEGIN
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
   AND e.created_at=NEW.service_completed_at
 ) THEN
  RAISE EXCEPTION 'Foundation liability requires completed original CG15 service and approved award';
 END IF;
 RETURN NEW;
END $cg17$;
CREATE TRIGGER cg17_liability_completed_source
 BEFORE INSERT ON foundation_liability FOR EACH ROW
 EXECUTE FUNCTION cg17_liability_completion_guard();
