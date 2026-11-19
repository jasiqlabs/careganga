-- CG15 US-003-QA11: restricted two-person patient identity review.
-- Administrative reviewed alias ONLY: original patient masters, appointment
-- foreign keys, CG19 source objects, account links, consents and ACLs are
-- never re-keyed, deleted, or made visible across accounts by this record.
CREATE TABLE cg15_patient_duplicate_review(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 source_patient_id uuid NOT NULL,
 canonical_patient_id uuid NOT NULL,
 proposed_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING'
  CHECK(status IN('PENDING','APPROVED','REJECTED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision IN(1,2)),
 decided_by_account uuid,
 decision_at timestamptz,
 decision_basis text CHECK(decision_basis IN
  ('SAME_PERSON_EVIDENCE_REVIEWED','IDENTITY_NOT_ESTABLISHED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,id,source_patient_id,canonical_patient_id),
 UNIQUE(root_realm_id,proposed_by_account,request_key),
 CHECK(source_patient_id<>canonical_patient_id),
 CHECK((status='PENDING' AND revision=1 AND decided_by_account IS NULL
        AND decision_at IS NULL AND decision_basis IS NULL)
    OR (status='APPROVED' AND revision=2 AND decided_by_account IS NOT NULL
        AND decision_at IS NOT NULL AND decision_basis='SAME_PERSON_EVIDENCE_REVIEWED')
    OR (status='REJECTED' AND revision=2 AND decided_by_account IS NOT NULL
        AND decision_at IS NOT NULL AND decision_basis='IDENTITY_NOT_ESTABLISHED')),
 CHECK(decided_by_account IS NULL OR decided_by_account<>proposed_by_account),
 FOREIGN KEY(root_realm_id,source_patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,canonical_patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(decided_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg15_duplicate_pending_or_approved_pair
 ON cg15_patient_duplicate_review(
  root_realm_id,LEAST(source_patient_id,canonical_patient_id),
  GREATEST(source_patient_id,canonical_patient_id))
 WHERE status IN('PENDING','APPROVED');
CREATE INDEX ix_cg15_duplicate_review_inbox
 ON cg15_patient_duplicate_review(root_realm_id,status,created_at DESC,id);

CREATE TABLE cg15_patient_reviewed_alias(
 root_realm_id uuid NOT NULL,
 source_patient_id uuid NOT NULL,
 canonical_patient_id uuid NOT NULL,
 review_id uuid NOT NULL,
 approved_by_account uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,source_patient_id),
 UNIQUE(root_realm_id,review_id),
 CHECK(source_patient_id<>canonical_patient_id),
 FOREIGN KEY(root_realm_id,review_id,source_patient_id,canonical_patient_id)
  REFERENCES cg15_patient_duplicate_review(
   root_realm_id,id,source_patient_id,canonical_patient_id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,source_patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,canonical_patient_id)
  REFERENCES cg15_patient(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg15_reviewed_alias_canonical
 ON cg15_patient_reviewed_alias(root_realm_id,canonical_patient_id);
CREATE TRIGGER cg15_reviewed_alias_immutable
 BEFORE UPDATE OR DELETE ON cg15_patient_reviewed_alias
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_history_immutable();

CREATE FUNCTION cg15_patient_duplicate_review_guard() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Patient identity review evidence is not deletable';
 END IF;
 IF OLD.status<>'PENDING' OR NEW.status NOT IN('APPROVED','REJECTED')
  OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.id IS DISTINCT FROM OLD.id
  OR NEW.source_patient_id IS DISTINCT FROM OLD.source_patient_id
  OR NEW.canonical_patient_id IS DISTINCT FROM OLD.canonical_patient_id
  OR NEW.proposed_by_account IS DISTINCT FROM OLD.proposed_by_account
  OR NEW.request_key IS DISTINCT FROM OLD.request_key
  OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.revision<>2 OR NEW.decided_by_account IS NULL
  OR NEW.decided_by_account=OLD.proposed_by_account
  OR NEW.decision_at IS NULL THEN
  RAISE EXCEPTION 'Original restricted patient review source cannot be rewritten';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg15_patient_duplicate_review_guard
 BEFORE UPDATE OR DELETE ON cg15_patient_duplicate_review
 FOR EACH ROW EXECUTE FUNCTION cg15_patient_duplicate_review_guard();

COMMENT ON TABLE cg15_patient_reviewed_alias IS
 'Restricted administrative same-person alias only. All clinical, appointment and original file ACLs remain tied to their original patient identity and consent; no implicit cross-account grant.';
