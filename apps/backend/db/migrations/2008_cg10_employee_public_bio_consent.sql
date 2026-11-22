-- CG10 US001 own current professional-consent seam only. CG18 must still
-- independently approve public publication/media; a private scanned file is
-- never a public portrait or a publication right.
CREATE TABLE hr_public_bio_consent(
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 account_ref uuid NOT NULL,
 consent_status text NOT NULL CHECK(consent_status IN('GRANTED','REVOKED')),
 consent_version integer NOT NULL DEFAULT 1 CHECK(consent_version>0),
 consent_purpose text NOT NULL DEFAULT 'MINIMAL_PROFESSIONAL_PROFILE'
  CHECK(consent_purpose='MINIMAL_PROFESSIONAL_PROFILE'),
 granted_at timestamptz,
 revoked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,employee_id),
 FOREIGN KEY(employee_id,root_realm_id)
  REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((consent_status='GRANTED' AND granted_at IS NOT NULL AND revoked_at IS NULL)
 OR (consent_status='REVOKED' AND revoked_at IS NOT NULL))
);
CREATE TABLE hr_public_bio_consent_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 account_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('GRANTED','REVOKED')),
 consent_version integer NOT NULL CHECK(consent_version>0),
 happened_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,root_realm_id)
  REFERENCES hr_employee(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(account_ref,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 UNIQUE(root_realm_id,employee_id,consent_version)
);
CREATE INDEX ix_cg10_bio_consent_current
 ON hr_public_bio_consent(root_realm_id,consent_status,employee_id);
CREATE TRIGGER cg10_bio_event_immutable
 BEFORE UPDATE OR DELETE ON hr_public_bio_consent_event
 FOR EACH ROW EXECUTE FUNCTION cg03_immutable();
