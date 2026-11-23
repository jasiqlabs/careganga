-- CG08 US002. Original B07/B08 requested funding only, not cash or
-- a CG09 allocation. One scoped proposal source and immutable write ledger.
-- Greenfield: no BWC, separate project/finance/approval/document masters.
CREATE TABLE csr_funding_proposal (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 branch_ref uuid,
 csr_partner_id uuid,
 project_ref uuid,
 project_source_version integer CHECK(project_source_version>0),
 purpose text NOT NULL CHECK(length(btrim(purpose)) BETWEEN 10 AND 500),
 fund_type text NOT NULL CHECK(fund_type IN('CSR_PARTNER','FOUNDATION','MIXED')),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 requested_minor bigint NOT NULL CHECK(requested_minor BETWEEN 1 AND 999999999999999),
 csr_share_bps integer NOT NULL CHECK(csr_share_bps BETWEEN 0 AND 10000),
 foundation_share_bps integer NOT NULL CHECK(foundation_share_bps BETWEEN 0 AND 10000),
 csr_requested_minor bigint GENERATED ALWAYS AS
  (floor(requested_minor::numeric*csr_share_bps/10000)::bigint) STORED,
 foundation_requested_minor bigint GENERATED ALWAYS AS
  (requested_minor-floor(requested_minor::numeric*csr_share_bps/10000)::bigint) STORED,
 proposed_from date,
 proposed_until date,
 agreement_summary text NOT NULL DEFAULT '' CHECK(length(btrim(agreement_summary))<=1000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN
  ('DRAFT','SUBMITTED','RETURNED','APPROVED','REJECTED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(csr_partner_id,root_realm_id) REFERENCES csr_partner(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_ref,root_realm_id) REFERENCES project(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((project_ref IS NULL)=(project_source_version IS NULL)),
 CHECK(csr_share_bps+foundation_share_bps=10000),
 CHECK((fund_type='FOUNDATION' AND csr_partner_id IS NULL AND csr_share_bps=0)
    OR (fund_type='CSR_PARTNER' AND csr_partner_id IS NOT NULL AND csr_share_bps=10000)
    OR (fund_type='MIXED' AND csr_partner_id IS NOT NULL
        AND csr_share_bps BETWEEN 1 AND 9999)),
 CHECK(proposed_from IS NULL OR proposed_until IS NULL OR proposed_until>=proposed_from)
);
CREATE INDEX ix_cg08_funding_scope
 ON csr_funding_proposal(root_realm_id,branch_ref,status,updated_at DESC,id DESC);
CREATE INDEX ix_cg08_funding_partner
 ON csr_funding_proposal(root_realm_id,csr_partner_id,updated_at DESC,id DESC);
CREATE INDEX ix_cg08_funding_project
 ON csr_funding_proposal(root_realm_id,project_ref,updated_at DESC,id DESC)
 WHERE project_ref IS NOT NULL;
CREATE TABLE csr_funding_command (
 root_realm_id uuid NOT NULL,
 request_key uuid NOT NULL,
 proposal_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 result_version integer NOT NULL CHECK(result_version>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,proposal_id)
  REFERENCES csr_funding_proposal(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg08_funding_command_no_change
 BEFORE UPDATE OR DELETE ON csr_funding_command FOR EACH ROW
 EXECUTE FUNCTION cg08_partner_command_immutable();

CREATE FUNCTION cg08_funding_proposal_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm
   WHERE id=NEW.root_realm_id AND realm_key='FOUNDATION_ROOT')
 THEN RAISE EXCEPTION 'Foundation CSR funding source required'; END IF;
 IF NEW.branch_ref IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM branch WHERE id=NEW.branch_ref
   AND root_realm_id=NEW.root_realm_id AND status='ACTIVE' FOR SHARE)
 THEN RAISE EXCEPTION 'Current original CG02 branch required'; END IF;
 IF NEW.csr_partner_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM csr_partner WHERE id=NEW.csr_partner_id
   AND root_realm_id=NEW.root_realm_id AND status='APPROVED'
   AND (branch_ref IS NULL OR branch_ref IS NOT DISTINCT FROM NEW.branch_ref)
   FOR SHARE)
 THEN RAISE EXCEPTION 'Approved, scope-matching CSR sponsor required'; END IF;
 IF NEW.project_ref IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM project WHERE id=NEW.project_ref
   AND root_realm_id=NEW.root_realm_id AND status IN('PLANNED','ACTIVE')
   AND branch_ref IS NOT DISTINCT FROM NEW.branch_ref
   AND version=NEW.project_source_version FOR SHARE)
 THEN RAISE EXCEPTION 'Current same-branch CG05 project required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'DRAFT' OR NEW.version<>1
   THEN RAISE EXCEPTION 'New CSR funding starts as an unapproved draft'; END IF;
 ELSE
  IF (NEW.id,NEW.root_realm_id,NEW.branch_ref,NEW.csr_partner_id,
      NEW.created_by,NEW.created_at) IS DISTINCT FROM
     (OLD.id,OLD.root_realm_id,OLD.branch_ref,OLD.csr_partner_id,
      OLD.created_by,OLD.created_at)
    OR NEW.version<>OLD.version+1 OR OLD.status<>'DRAFT'
    OR NEW.status<>'DRAFT'
   THEN RAISE EXCEPTION 'Original funding source cannot bypass independent approval'; END IF;
 END IF;
 RETURN NEW;
END $cg08$;
CREATE TRIGGER cg08_funding_source_guard BEFORE INSERT OR UPDATE ON csr_funding_proposal
 FOR EACH ROW EXECUTE FUNCTION cg08_funding_proposal_guard();
