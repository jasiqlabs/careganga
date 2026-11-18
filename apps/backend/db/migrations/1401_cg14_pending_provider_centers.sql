-- CG-14 US-001: pending provider and operating centers only.
-- No CG-03 verification, public publication, CG-15 bookings, CG-17 settlements or
-- speculative ERP/doctor rows. All records are Foundation-root scoped.
CREATE TABLE health_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  provider_code text NOT NULL CHECK(provider_code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
  legal_name text NOT NULL CHECK(char_length(btrim(legal_name)) BETWEEN 2 AND 180),
  normalized_name text NOT NULL,
  provider_type text NOT NULL CHECK(provider_type IN
    ('HOSPITAL','CLINIC','DIAGNOSTIC_LAB','PHARMACY','NURSING','OTHER')),
  contact_name text NOT NULL CHECK(char_length(btrim(contact_name)) BETWEEN 2 AND 120),
  contact_phone text NOT NULL CHECK(contact_phone ~ '^[+]?[0-9]{10,15}$'),
  contact_email text CHECK(contact_email IS NULL OR char_length(contact_email) BETWEEN 5 AND 180),
  registration_ref text CHECK(registration_ref IS NULL OR char_length(registration_ref)<=120),
  status text NOT NULL DEFAULT 'PENDING' CHECK(status='PENDING'),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,provider_code),
  FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK(normalized_name=lower(btrim(legal_name)))
);
CREATE INDEX ix_health_provider_list
  ON health_provider(root_realm_id,status,normalized_name,id);

CREATE TABLE health_center (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL,
  center_code text NOT NULL CHECK(center_code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
  display_name text NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 2 AND 160),
  center_type text NOT NULL CHECK(center_type IN
    ('HOSPITAL','CLINIC','DIAGNOSTIC_LAB','PHARMACY','NURSING','OTHER')),
  address_line text NOT NULL CHECK(char_length(btrim(address_line)) BETWEEN 5 AND 500),
  state_ref uuid NOT NULL,
  district_ref uuid NOT NULL,
  block_ref uuid,
  pin_code char(6) NOT NULL CHECK(pin_code ~ '^[1-9][0-9]{5}$'),
  latitude numeric(9,6) CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
  time_zone text NOT NULL CHECK(char_length(time_zone) BETWEEN 3 AND 64),
  public_phone text CHECK(public_phone IS NULL OR public_phone ~ '^[+]?[0-9]{10,15}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK(status='PENDING'),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,provider_id,center_code),
  FOREIGN KEY(root_realm_id,provider_id)
    REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(state_ref,root_realm_id)
    REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(district_ref,root_realm_id)
    REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(block_ref,root_realm_id)
    REFERENCES geography_area(id,root_realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_center_by_provider ON health_center(root_realm_id,provider_id,id);

CREATE TABLE health_center_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  center_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  open_local time NOT NULL,
  close_local time NOT NULL,
  service_type text NOT NULL DEFAULT 'GENERAL' CHECK
    (service_type IN('GENERAL','CONSULTATION','DIAGNOSTICS','PHARMACY','NURSING')),
  CHECK(open_local < close_local),
  UNIQUE(root_realm_id,id),
  UNIQUE(root_realm_id,center_id,weekday,service_type,open_local),
  FOREIGN KEY(root_realm_id,center_id)
    REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_center_hours_center ON health_center_hours(root_realm_id,center_id,weekday);

CREATE TABLE health_center_capability (
  root_realm_id uuid NOT NULL,
  center_id uuid NOT NULL,
  capability_code text NOT NULL CHECK(capability_code IN
    ('CONSULTATION','DIAGNOSTICS','PHARMACY','NURSING','SURGERY','EMERGENCY')),
  declared_state text NOT NULL DEFAULT 'DECLARED' CHECK(declared_state='DECLARED'),
  PRIMARY KEY(root_realm_id,center_id,capability_code),
  FOREIGN KEY(root_realm_id,center_id)
    REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT
);
-- Descriptive service flags only. They never activate an ERP, booking or payment.

CREATE TABLE health_center_account_affiliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  center_id uuid NOT NULL,
  account_ref uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_EDIT'
    CHECK(status IN('PENDING_EDIT','REVOKED')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647),
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(root_realm_id,id),
  FOREIGN KEY(root_realm_id,center_id) REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(account_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(assigned_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((status='REVOKED')=(revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_health_center_active_account
  ON health_center_account_affiliation(root_realm_id,center_id,account_ref)
  WHERE status='PENDING_EDIT';
CREATE INDEX ix_health_center_account_own
  ON health_center_account_affiliation(root_realm_id,account_ref,center_id)
  WHERE status='PENDING_EDIT';

-- The destination itself is NEVER copied into CG-14. Only CG-19 secure-file
-- identity and a caller-supplied masked label may be persisted here.
CREATE TABLE health_provider_finance_ref (
  root_realm_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  protected_file_ref uuid NOT NULL,
  masked_label text NOT NULL CHECK(char_length(masked_label) BETWEEN 4 AND 60),
  version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(root_realm_id,provider_id),
  FOREIGN KEY(root_realm_id,provider_id) REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(protected_file_ref,root_realm_id)
    REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TABLE health_network_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  action_key text NOT NULL CHECK(char_length(action_key) BETWEEN 3 AND 60),
  request_key uuid NOT NULL,
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  result_ref uuid,
  result_version integer CHECK(result_version IS NULL OR result_version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_realm_id,actor_ref,action_key,request_key),
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  CHECK((result_ref IS NULL)=(result_version IS NULL))
);
CREATE TABLE health_network_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_realm_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  provider_id uuid NOT NULL,
  center_id uuid,
  action_key text NOT NULL,
  version integer NOT NULL CHECK(version>0),
  command_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(root_realm_id,provider_id)
    REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(root_realm_id,center_id)
    REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
  FOREIGN KEY(command_id) REFERENCES health_network_command(id) ON DELETE RESTRICT
);
CREATE INDEX ix_health_network_events ON health_network_event(root_realm_id,provider_id,occurred_at DESC,id DESC);
CREATE FUNCTION health_network_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Health network audit history cannot be changed';
END $$;
CREATE TRIGGER health_network_event_write_once
  BEFORE UPDATE OR DELETE ON health_network_event
  FOR EACH ROW EXECUTE FUNCTION health_network_event_immutable();
