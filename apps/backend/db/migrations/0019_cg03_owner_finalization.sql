-- CG-03 final decision remains distinct from actual CG-01 owner grant.
-- No idle polling or third-party network dependency. Claim only real due work.
CREATE TABLE cg03_finalization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL,
  final_decision_id uuid NOT NULL,
  effect_key uuid NOT NULL DEFAULT gen_random_uuid(),
  proposal_digest char(64) NOT NULL CHECK(proposal_digest ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'PENDING_OWNER'
    CHECK(state IN('PENDING_OWNER','APPLYING','OWNER_COMPLETED',
      'OWNER_BLOCKED','OWNER_FAILED_RETRYABLE')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 12),
  next_retry_at timestamptz,
  claim_token uuid,
  claimed_until timestamptz,
  last_result_class text CHECK(last_result_class IN
    ('CONFIRMED','SOURCE_CHANGED','OWNER_UNAVAILABLE','UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id), UNIQUE(final_decision_id), UNIQUE(effect_key),
  UNIQUE(id,realm_id),
  FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(final_decision_id,realm_id) REFERENCES cg03_case_decision(id,realm_id)
    ON DELETE RESTRICT,
  CHECK((claim_token IS NULL AND claimed_until IS NULL) OR
        (claim_token IS NOT NULL AND claimed_until IS NOT NULL))
);
CREATE INDEX ix_cg03_effect_due
 ON cg03_finalization(next_retry_at,id)
 WHERE state='OWNER_FAILED_RETRYABLE';
CREATE INDEX ix_cg03_effect_claim
 ON cg03_finalization(claimed_until,id)
 WHERE state='APPLYING';
CREATE FUNCTION cg03_finalization_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
     NEW.case_id IS DISTINCT FROM OLD.case_id OR
     NEW.final_decision_id IS DISTINCT FROM OLD.final_decision_id OR
     NEW.effect_key IS DISTINCT FROM OLD.effect_key OR
     NEW.proposal_digest IS DISTINCT FROM OLD.proposal_digest OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Original approved effect identity is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cg03_finalization_snapshot
 BEFORE UPDATE ON cg03_finalization
 FOR EACH ROW EXECUTE FUNCTION cg03_finalization_frozen();
