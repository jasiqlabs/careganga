-- CG-19 client Master Email Template & Workflow v2.0.
-- Importable source drafts only: no business events, recipients or PDFs are
-- synthesized. Existing CG03/NOTICE/CG15 messaging remains unchanged.
-- A future owner integration must explicitly approve, version and wire each
-- verified event/attachment before any delivery can occur.
CREATE TABLE cg19_client_email_template (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 template_code text NOT NULL
  CHECK(template_code ~ '^CG-(MEM|VOL|DON|REF|EMP|DES|PROM|SAL|SUP)-[0-9]{3}$'),
 owner_kind text NOT NULL
  CHECK(owner_kind IN('MEM','VOL','DON','REF','EMP','DES','PROM','SAL','SUP')),
 version integer NOT NULL CHECK(version>=1),
 language_code text NOT NULL DEFAULT 'en' CHECK(language_code='en'),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
 trigger_rule text NOT NULL CHECK(length(trigger_rule) BETWEEN 8 AND 900),
 recipient_rule text NOT NULL CHECK(length(recipient_rule)<=500),
 subject text NOT NULL CHECK(length(subject) BETWEEN 3 AND 240),
 body text NOT NULL CHECK(length(body) BETWEEN 8 AND 12000),
 attachment_rule text NOT NULL CHECK(length(attachment_rule) BETWEEN 5 AND 1500),
 placeholder_names text[] NOT NULL DEFAULT '{}'::text[],
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'SOURCE_DRAFT' CHECK(status='SOURCE_DRAFT'),
 enabled boolean NOT NULL DEFAULT false CHECK(enabled=false),
 imported_by uuid NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(realm_id,template_code,version),
 UNIQUE(id,realm_id),
 FOREIGN KEY(imported_by,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(cardinality(placeholder_names)<=40)
);
CREATE INDEX ix_cg19_client_email_template_catalog
 ON cg19_client_email_template(realm_id,owner_kind,template_code,version DESC);
COMMENT ON TABLE cg19_client_email_template IS
 'Client v2 source copy imported as disabled drafts; NOT live notification or email events.';
