-- CG-14 US-003, first additive schema slice.
-- One real professional identity and its own-center affiliation source.
-- Professional review, private license, fee approval and API are NOT delivered
-- by this slice and must be introduced by their CG-03/19/14 owning adapters.
-- No public doctor eligibility or slot/booking/payment source is introduced.

CREATE TABLE health_doctor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  registration_jurisdiction text NOT NULL
    CHECK(char_length(btrim(registration_jurisdiction)) BETWEEN 2 AND 80
      AND registration_jurisdiction=upper(btrim(registration_jurisdiction))),
  registration_number text NOT NULL
    CHECK(char_length(btrim(registration_number)) BETWEEN 3 AND 80),
  registration_number_normalized text GENERATED ALWAYS AS (
    regexp_replace(upper(btrim(registration_number)),'[[:space:]/-]+','','g')
  ) STORED,
  full_name text NOT NULL CHECK(char_length(btrim(full_name)) BETWEEN 2 AND 160),
  normalized_name text NOT NULL CHECK(normalized_name=lower(btrim(full_name))),
  qualifications text[] NOT NULL DEFAULT '{}'
    CHECK(cardinality(qualifications) BETWEEN 0 AND 15),
  specialties text[] NOT NULL DEFAULT '{}'
    CHECK(cardinality(specialties) BETWEEN 0 AND 12),
  experience_years smallint NOT NULL DEFAULT 0 CHECK(experience_years BETWEEN 0 AND 70),
  public_bio text NOT NULL DEFAULT '' CHECK(char_length(public_bio)<=2000),
  portrait_rights_status text NOT NULL DEFAULT 'NONE'
    CHECK(portrait_rights_status IN('NONE','CONSENT_PENDING','CONSENT_VERIFIED','REVOKED')),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK(status IN('PENDING','SUBMITTED','RETURNED','REJECTED','VERIFIED','SUSPENDED')),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  -- Never clone a professional per center, including while an application
  -- is pending. Rejected registrations are corrected through the original
  -- versioned doctor source instead of a second identity.
  UNIQUE(root_realm_id,registration_jurisdiction,registration_number_normalized),
  FOREIGN KEY(created_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(char_length(registration_number_normalized) BETWEEN 3 AND 80)
);
CREATE INDEX ix_health_doctor_name
  ON health_doctor(root_realm_id,normalized_name,id);
CREATE INDEX ix_health_doctor_review_state
  ON health_doctor(root_realm_id,status,updated_at DESC,id DESC);

CREATE TABLE health_doctor_center (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  center_id uuid NOT NULL,
  affiliation_state text NOT NULL DEFAULT 'PENDING'
    CHECK(affiliation_state IN('PENDING','APPROVED','SUSPENDED','WITHDRAWN')),
  approved_from timestamptz,
  approved_to timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  proposed_by uuid NOT NULL,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,doctor_id,id),
  -- One current source row for each doctor at each physical center.
  -- Changes are versioned and event-audited, never a cloned doctor profile.
  UNIQUE(root_realm_id,doctor_id,center_id),
  FOREIGN KEY(root_realm_id,doctor_id)
    REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(root_realm_id,center_id)
    REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(proposed_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_by,root_realm_id)
    REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(approved_to IS NULL OR approved_from IS NOT NULL
    AND approved_to>approved_from),
  CHECK(affiliation_state<>'APPROVED' OR
    (approved_from IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE INDEX ix_health_doctor_center_by_center
  ON health_doctor_center(root_realm_id,center_id,affiliation_state,doctor_id);
CREATE INDEX ix_health_doctor_center_by_doctor
  ON health_doctor_center(root_realm_id,doctor_id,affiliation_state,center_id);
