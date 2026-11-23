-- CG08 US001 original B03/B06 to /collaboration rights.
-- An approved company is not automatically approved for publicity.
-- One revocable authorization per current original CSR partner, with the
-- CG19 scanned agreement used in CG03's actual independent final decision.
CREATE TABLE csr_partner_public_release (
 root_realm_id uuid NOT NULL,
 partner_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 state text NOT NULL CHECK(state IN('AUTHORIZED','WITHDRAWN')),
 public_summary text NOT NULL CHECK(length(btrim(public_summary)) BETWEEN 10 AND 500),
 evidence_file_id uuid NOT NULL,
 authorized_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 authorized_at timestamptz NOT NULL DEFAULT now(),
 withdrawn_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,partner_id),
 FOREIGN KEY(root_realm_id,partner_id)
   REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(evidence_file_id,root_realm_id,partner_id)
   REFERENCES cg19_stored_file(id,realm_id,csr_partner_id) ON DELETE RESTRICT,
 FOREIGN KEY(authorized_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((state='AUTHORIZED' AND withdrawn_at IS NULL) OR
       (state='WITHDRAWN' AND withdrawn_at IS NOT NULL))
);
CREATE INDEX ix_cg08_public_release_status
 ON csr_partner_public_release(root_realm_id,state,updated_at DESC,partner_id);

-- Reuse original immutable once-only CG08 command ledger for public rights.
ALTER TABLE csr_partner_command DROP CONSTRAINT csr_partner_command_action_check;
ALTER TABLE csr_partner_command ADD CONSTRAINT csr_partner_command_action_check
 CHECK(action IN ('CREATE','EDIT','CANCEL','AUTHORIZE_PUBLIC','WITHDRAW_PUBLIC'));

CREATE FUNCTION cg08_public_release_guard() RETURNS trigger LANGUAGE plpgsql AS $cg08$
BEGIN
 IF TG_OP='UPDATE' AND
   ((NEW.root_realm_id,NEW.partner_id,NEW.evidence_file_id,NEW.authorized_by,NEW.authorized_at)
     IS DISTINCT FROM
    (OLD.root_realm_id,OLD.partner_id,OLD.evidence_file_id,OLD.authorized_by,OLD.authorized_at)
    OR NEW.version<>OLD.version+1 OR OLD.state<>'AUTHORIZED' OR NEW.state<>'WITHDRAWN')
 THEN RAISE EXCEPTION 'CSR public release cannot be silently rewritten or restored'; END IF;
 IF NEW.state='AUTHORIZED' AND NOT EXISTS(
  SELECT 1 FROM csr_partner p
  JOIN csr_partner_review_snapshot s
   ON s.root_realm_id=p.root_realm_id AND s.partner_id=p.id AND
      s.evidence_file_id=NEW.evidence_file_id
  JOIN cg03_case c ON c.realm_id=s.root_realm_id
   AND c.csr_review_ref=s.id AND c.csr_partner_id=p.id
   AND c.csr_source_version=s.source_version AND c.csr_source_digest=s.source_digest
   AND c.case_kind='CSR_PARTNER_REVIEW' AND c.status='OWNER_COMPLETED'
  JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
   AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
  JOIN cg19_stored_file f ON f.id=s.evidence_file_id
   AND f.realm_id=p.root_realm_id AND f.csr_partner_id=p.id
   AND f.owner_kind='CG08_CSR_AGREEMENT' AND f.scan_status='CLEAN_VERIFIED'
   AND f.revoked_at IS NULL
  JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   AND i.csr_partner_id=f.csr_partner_id AND i.owner_kind='CG08_CSR_AGREEMENT'
   AND i.status='VALIDATED'
  WHERE p.root_realm_id=NEW.root_realm_id AND p.id=NEW.partner_id
    AND p.status='APPROVED'
 ) THEN RAISE EXCEPTION 'Current CG03 approval and clean CG19 publicity evidence required'; END IF;
 RETURN NEW;
END $cg08$;
CREATE TRIGGER cg08_public_release_verified BEFORE INSERT OR UPDATE
 ON csr_partner_public_release FOR EACH ROW EXECUTE FUNCTION cg08_public_release_guard();
