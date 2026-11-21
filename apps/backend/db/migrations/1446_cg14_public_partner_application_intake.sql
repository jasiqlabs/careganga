-- CG14 partner-first US001: anonymous pending application *intake*, not a
-- second verified provider/doctor master or a CG03 approval/CG17 payment.
-- Public callers never create health_provider, health_doctor, account or grants.
CREATE TABLE health_partner_application (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 reference_code text NOT NULL
  CHECK(reference_code ~ '^CGPA-[0-9A-F]{12}$'),
 receipt_digest char(64) NOT NULL
  CHECK(receipt_digest ~ '^[a-f0-9]{64}$'),
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL
  CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 partner_type text NOT NULL
  CHECK(partner_type IN('HOSPITAL','CLINIC','DIAGNOSTIC_LAB',
   'DOCTOR','PHARMACY','NURSING','SURGERY_CENTER')),
 applicant_name text NOT NULL
  CHECK(char_length(btrim(applicant_name)) BETWEEN 2 AND 180),
 contact_name text NOT NULL
  CHECK(char_length(btrim(contact_name)) BETWEEN 2 AND 120),
 contact_phone text NOT NULL
  CHECK(contact_phone ~ '^[+]?[0-9]{10,15}$'),
 contact_email text
  CHECK(contact_email IS NULL OR char_length(contact_email) BETWEEN 5 AND 180),
 registration_number text
  CHECK(registration_number IS NULL OR char_length(registration_number)<=120),
 address_line text NOT NULL
  CHECK(char_length(btrim(address_line)) BETWEEN 5 AND 300),
 district_name text NOT NULL
  CHECK(char_length(btrim(district_name)) BETWEEN 2 AND 100),
 state_name text NOT NULL
  CHECK(char_length(btrim(state_name)) BETWEEN 2 AND 100),
 pin_code char(6) NOT NULL CHECK(pin_code ~ '^[1-9][0-9]{5}$'),
 consent_version text NOT NULL DEFAULT 'PARTNER_INTAKE_V1'
  CHECK(consent_version='PARTNER_INTAKE_V1'),
 received_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'PENDING'
  CHECK(status IN('PENDING','IN_REVIEW','RETURNED','DECLINED','LINKED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647),
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text CHECK(review_note IS NULL OR char_length(review_note)<=500),
 linked_provider_id uuid,
 linked_doctor_id uuid,
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,reference_code),
 UNIQUE(root_realm_id,receipt_digest),
 UNIQUE(root_realm_id,request_key),
 FOREIGN KEY(reviewed_by,root_realm_id) REFERENCES account(id,realm_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,linked_provider_id)
  REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,linked_doctor_id)
  REFERENCES health_doctor(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((status='LINKED')=
  (linked_provider_id IS NOT NULL OR linked_doctor_id IS NOT NULL)),
 CHECK(linked_provider_id IS NULL OR linked_doctor_id IS NULL),
 CHECK(status<>'LINKED' OR reviewed_by IS NOT NULL),
 CHECK((reviewed_by IS NULL)=(reviewed_at IS NULL))
);
CREATE INDEX ix_health_partner_application_queue ON health_partner_application
 (root_realm_id,status,received_at DESC,id DESC);
CREATE INDEX ix_health_partner_application_original_provider
 ON health_partner_application(root_realm_id,linked_provider_id)
 WHERE linked_provider_id IS NOT NULL;
CREATE INDEX ix_health_partner_application_original_doctor
 ON health_partner_application(root_realm_id,linked_doctor_id)
 WHERE linked_doctor_id IS NOT NULL;
-- No public index by phone/email or guessing reference code; anonymous status
-- lookup requires a 256-bit bearer receipt whose hash alone is persisted.
-- Do not insert fake verification/discount/payout on application creation.
