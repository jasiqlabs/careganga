-- CG17 US004 / CG19 document evidence: one private receipt per actual
-- authenticated, attested center CASH collection. NOT Foundation revenue,
-- not a provider-settled UPI/card payment or an unverified screenshot.
-- Reuses the same CG19 private create-only storage/scanning adapter.
CREATE TABLE cg19_center_patient_receipt_document(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 collection_ref uuid NOT NULL,
 charge_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 center_display_name varchar(160) NOT NULL CHECK(length(btrim(center_display_name)) BETWEEN 1 AND 160),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 issued_by_account uuid NOT NULL,
 issue_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'PENDING'
   CHECK(status IN('PENDING','UNKNOWN','ISSUED')),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 24 AND 255),
 object_version text,
 content_sha256 char(64),
 content_length integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 issued_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,collection_ref),
 UNIQUE(root_realm_id,issued_by_account,issue_key),
 FOREIGN KEY(root_realm_id,collection_ref,charge_ref)
   REFERENCES center_collection(root_realm_id,id,charge_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,charge_ref,center_ref)
   REFERENCES patient_charge(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by_account,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(
  (status='ISSUED' AND object_version IS NOT NULL AND
   content_sha256 ~ '^[a-f0-9]{64}$' AND
   content_length BETWEEN 1 AND 10485760 AND issued_at IS NOT NULL)
  OR (status IN('PENDING','UNKNOWN') AND object_version IS NULL
    AND content_sha256 IS NULL AND content_length IS NULL AND issued_at IS NULL)
 ),
 CHECK(object_version IS NULL OR length(object_version) BETWEEN 1 AND 160)
);
CREATE INDEX ix_cg19_center_patient_receipt_lookup
 ON cg19_center_patient_receipt_document(root_realm_id,center_ref,charge_ref,
 collection_ref) WHERE status='ISSUED';

CREATE FUNCTION cg19_center_receipt_identity_frozen() RETURNS trigger
 LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' OR
  (to_jsonb(NEW)-'status'-'object_version'-'content_sha256'-
    'content_length'-'issued_at'-'updated_at') IS DISTINCT FROM
  (to_jsonb(OLD)-'status'-'object_version'-'content_sha256'-
    'content_length'-'issued_at'-'updated_at') OR
  OLD.status='ISSUED' OR
  (OLD.status='UNKNOWN' AND NEW.status='PENDING') OR
  (NEW.status='ISSUED' AND (
     NEW.object_version IS NULL OR NEW.content_sha256 IS NULL
     OR NEW.content_length IS NULL OR NEW.issued_at IS NULL))
 THEN
  RAISE EXCEPTION 'Original center patient receipt issuance is immutable';
 END IF;
 RETURN NEW;
END $cg19$;
CREATE TRIGGER cg19_center_patient_receipt_frozen
 BEFORE UPDATE OR DELETE ON cg19_center_patient_receipt_document
 FOR EACH ROW EXECUTE FUNCTION cg19_center_receipt_identity_frozen();

-- Patient charge/cash evidence remains CG17-owned. This CG19 private PDF
-- record is an original document, never a second payment ledger or CG09 row.
