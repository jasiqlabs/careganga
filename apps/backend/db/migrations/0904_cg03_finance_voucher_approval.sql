-- CG-09 US-002 introducing the first actual CG-03 FINANCE_VOUCHER approval route.
-- Existing role assignment and branch registration case kinds remain untouched.
-- CG-03 alone owns process/case/decision/owner-effect rows.
ALTER TABLE cg03_process DROP CONSTRAINT IF EXISTS cg03_process_process_kind_check;
ALTER TABLE cg03_process ADD CONSTRAINT cg03_process_kind_finance CHECK(
 process_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER'));

CREATE TABLE cg03_finance_process_current(
 realm_id uuid PRIMARY KEY REFERENCES access_realm(id) ON DELETE RESTRICT,
 process_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(process_id,realm_id) REFERENCES cg03_process(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE cg03_case DROP CONSTRAINT IF EXISTS cg03_case_case_kind_check;
ALTER TABLE cg03_case DROP CONSTRAINT IF EXISTS cg03_case_source_disjoint;
ALTER TABLE cg03_case
 ADD COLUMN finance_voucher_id uuid,
 ADD COLUMN finance_voucher_revision integer,
 ADD COLUMN finance_voucher_digest char(64),
 ADD COLUMN finance_proof_file_id uuid,
 ADD COLUMN finance_proof_revision integer,
 ADD CONSTRAINT cg03_case_kind_finance CHECK(
  case_kind IN('CG01_ROLE','BRANCH_REGISTRATION','FINANCE_VOUCHER')),
 ADD CONSTRAINT cg03_case_finance_source_disjoint CHECK(
  (case_kind='CG01_ROLE' AND branch_source_ref IS NULL
    AND branch_source_revision IS NULL AND branch_source_digest IS NULL
    AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
    AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
    AND finance_proof_revision IS NULL
    AND target_account_id IS NOT NULL AND target_role_id IS NOT NULL
    AND expected_access_version IS NOT NULL AND expected_role_revision IS NOT NULL)
  OR
  (case_kind='BRANCH_REGISTRATION'
    AND branch_source_ref IS NOT NULL AND branch_source_revision>0
    AND branch_source_digest ~ '^[0-9a-f]{64}$'
    AND finance_voucher_id IS NULL AND finance_voucher_revision IS NULL
    AND finance_voucher_digest IS NULL AND finance_proof_file_id IS NULL
    AND finance_proof_revision IS NULL
    AND target_account_id IS NULL AND target_role_id IS NULL
    AND expected_access_version IS NULL AND expected_role_revision IS NULL)
  OR
  (case_kind='FINANCE_VOUCHER'
    AND branch_source_ref IS NULL AND branch_source_revision IS NULL
    AND branch_source_digest IS NULL
    AND finance_voucher_id IS NOT NULL AND finance_voucher_revision>0
    AND finance_voucher_digest ~ '^[0-9a-f]{64}$'
    AND finance_proof_file_id IS NOT NULL AND finance_proof_revision>0
    AND target_account_id IS NULL AND target_role_id IS NULL
    AND expected_access_version IS NULL AND expected_role_revision IS NULL)
 ),
 ADD CONSTRAINT fk_cg03_finance_voucher_source
   FOREIGN KEY(finance_voucher_id,realm_id)
   REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_cg03_finance_file_source
   FOREIGN KEY(finance_proof_file_id,realm_id,finance_voucher_id,finance_voucher_revision)
   REFERENCES cg19_stored_file(id,realm_id,voucher_id,voucher_version)
   ON DELETE RESTRICT;

CREATE UNIQUE INDEX ux_cg03_finance_voucher_revision
 ON cg03_case(realm_id,finance_voucher_id,finance_voucher_revision)
 WHERE case_kind='FINANCE_VOUCHER';
CREATE INDEX ix_cg03_finance_root_recent
 ON cg03_case(realm_id,case_kind,status,submitted_at DESC,id DESC)
 WHERE case_kind='FINANCE_VOUCHER';

CREATE FUNCTION cg03_finance_case_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.finance_voucher_id IS DISTINCT FROM OLD.finance_voucher_id
  OR NEW.finance_voucher_revision IS DISTINCT FROM OLD.finance_voucher_revision
  OR NEW.finance_voucher_digest IS DISTINCT FROM OLD.finance_voucher_digest
  OR NEW.finance_proof_file_id IS DISTINCT FROM OLD.finance_proof_file_id
  OR NEW.finance_proof_revision IS DISTINCT FROM OLD.finance_proof_revision THEN
  RAISE EXCEPTION 'Frozen finance approval source cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_finance_case_source_immutable
 BEFORE UPDATE ON cg03_case FOR EACH ROW EXECUTE FUNCTION cg03_finance_case_identity_frozen();

-- A final CG-03 decision is still not a CG-09 posting or PAID_VERIFIED state.
CREATE TABLE cg03_finance_owner_effect(
 case_id uuid NOT NULL,
 realm_id uuid NOT NULL,
 final_decision_id uuid NOT NULL,
 effect_key uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'PENDING_OWNER'
   CHECK(status IN('PENDING_OWNER','OWNER_COMPLETED','OWNER_BLOCKED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 PRIMARY KEY(case_id),UNIQUE(effect_key),UNIQUE(final_decision_id),
 FOREIGN KEY(case_id,realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(final_decision_id,case_id,realm_id)
  REFERENCES cg03_case_decision(id,case_id,realm_id) ON DELETE RESTRICT,
 CHECK(status<>'OWNER_COMPLETED' OR completed_at IS NOT NULL)
);
CREATE FUNCTION cg03_finance_effect_identity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.case_id IS DISTINCT FROM OLD.case_id OR
  NEW.realm_id IS DISTINCT FROM OLD.realm_id OR
  NEW.final_decision_id IS DISTINCT FROM OLD.final_decision_id OR
  NEW.effect_key IS DISTINCT FROM OLD.effect_key OR
  NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Approved finance decision identity cannot change';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg03_finance_effect_frozen
 BEFORE UPDATE ON cg03_finance_owner_effect FOR EACH ROW
 EXECUTE FUNCTION cg03_finance_effect_identity_frozen();
