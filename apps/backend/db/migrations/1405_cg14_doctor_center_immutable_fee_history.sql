-- CG-14 US-003 additive fee source, no appointment/collection/payable rows.
-- Approved fee ranges must never overlap for one doctor at one center.
-- Actual PostgreSQL extension/migration/EXPLAIN/restore and two-session race
-- execution remain REQUIRED QA. The CG-14 fee owner API is introduced later.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE health_center_fee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  doctor_center_id uuid NOT NULL,
  fee_kind text NOT NULL CHECK(fee_kind IN('CONSULTATION','FOLLOW_UP')),
  consultation_mode text NOT NULL DEFAULT 'IN_PERSON'
    CHECK(consultation_mode IN('IN_PERSON','VIDEO')),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
  amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 10000000000),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'PROPOSED'
    CHECK(status IN('PROPOSED','APPROVED','REJECTED')),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  proposed_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  FOREIGN KEY(root_realm_id,doctor_center_id)
    REFERENCES health_doctor_center(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(proposed_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(effective_to IS NULL OR effective_to>effective_from),
  CHECK(status<>'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

-- GIST exclusion enforces the [from,to) nonoverlap invariant even under
-- concurrent approval attempts; optimistic app checks are not sufficient.
ALTER TABLE health_center_fee
 ADD CONSTRAINT ex_health_center_fee_current_no_overlap
 EXCLUDE USING gist (
   root_realm_id WITH =,
   doctor_center_id WITH =,
   fee_kind WITH =,
   consultation_mode WITH =,
   tstzrange(effective_from,effective_to,'[)') WITH &&
 ) WHERE(status='APPROVED');

CREATE INDEX ix_health_fee_by_center_current
 ON health_center_fee(root_realm_id,doctor_center_id,fee_kind,
   consultation_mode,effective_from DESC,id DESC)
 WHERE status='APPROVED';
CREATE INDEX ix_health_fee_pending
 ON health_center_fee(root_realm_id,status,updated_at DESC,id DESC)
 WHERE status='PROPOSED';

-- Historical approved amounts, scope, source and start dates cannot change.
-- A prior accepted interval may be ended earlier solely for a new future
-- effective rate; the original amount/version remains intact and the
-- app must append health_center_fee_event.END_EARLY in the same transaction.
CREATE FUNCTION cg14_approved_fee_source_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.status='APPROVED' THEN
     RAISE EXCEPTION 'Approved center fee history cannot be deleted';
   END IF;
   RETURN OLD;
 END IF;
 IF OLD.status='APPROVED' THEN
   IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
      NEW.doctor_center_id IS DISTINCT FROM OLD.doctor_center_id OR
      NEW.fee_kind IS DISTINCT FROM OLD.fee_kind OR
      NEW.consultation_mode IS DISTINCT FROM OLD.consultation_mode OR
      NEW.currency IS DISTINCT FROM OLD.currency OR
      NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
      NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
      NEW.proposed_by IS DISTINCT FROM OLD.proposed_by OR
      NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
      NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.created_at IS DISTINCT FROM OLD.created_at OR
      NEW.id IS DISTINCT FROM OLD.id THEN
     RAISE EXCEPTION 'Approved center fee amount and source are immutable';
   END IF;
   IF NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
     IF NEW.effective_to IS NULL OR NEW.effective_to<now() OR
       NEW.effective_to<=OLD.effective_from OR
       (OLD.effective_to IS NOT NULL AND
        NEW.effective_to>OLD.effective_to) THEN
       RAISE EXCEPTION 'Only future shortening of approved fee validity is allowed';
     END IF;
     IF NEW.version<>OLD.version+1 OR NEW.updated_at<OLD.updated_at THEN
       RAISE EXCEPTION 'Accepted fee validity change requires next version';
     END IF;
   ELSIF NEW.version IS DISTINCT FROM OLD.version OR
         NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
     RAISE EXCEPTION 'Unchanged approved fee cannot be silently rewritten';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg14_approved_fee_guard
 BEFORE UPDATE OR DELETE ON health_center_fee
 FOR EACH ROW EXECUTE FUNCTION cg14_approved_fee_source_guard();

-- Genuine original fee audit: no shadow cash ledger or booking-source rows.
CREATE TABLE health_center_fee_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  fee_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  action_key text NOT NULL
    CHECK(action_key IN('PROPOSED','APPROVED','REJECTED','END_EARLY')),
  prior_end timestamptz,
  new_end timestamptz,
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,action_key,request_key),
  FOREIGN KEY(root_realm_id,fee_id)
    REFERENCES health_center_fee(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_ref,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_fee_event_history
 ON health_center_fee_event(root_realm_id,fee_id,created_at,id);
CREATE FUNCTION cg14_fee_event_append_only() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Approved fee audit event cannot be changed';
END $$;
CREATE TRIGGER cg14_fee_event_frozen
 BEFORE UPDATE OR DELETE ON health_center_fee_event
 FOR EACH ROW EXECUTE FUNCTION cg14_fee_event_append_only();
