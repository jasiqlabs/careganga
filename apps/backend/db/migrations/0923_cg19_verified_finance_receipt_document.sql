-- CG-19 US-004 original issued Finance receipt PDF; encrypted private provider owns bytes.
-- A PDF is not bank verification, posted money or a delivery receipt.
CREATE TABLE cg19_finance_receipt_document(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 receipt_id uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 issue_key uuid NOT NULL,
 issued_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','UNKNOWN','ISSUED','REVOKED')),
 object_key text NOT NULL CHECK(char_length(object_key) BETWEEN 20 AND 300),
 object_version text,
 content_sha256 char(64),
 content_length integer CHECK(content_length IS NULL OR content_length BETWEEN 100 AND 10485760),
 issued_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,receipt_id),
 UNIQUE(root_realm_id,issued_by,issue_key),
 UNIQUE(id,root_realm_id),
 FOREIGN KEY(receipt_id,root_realm_id) REFERENCES finance_invoice_receipt(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(
  (status IN('PENDING','UNKNOWN') AND object_version IS NULL AND content_sha256 IS NULL
   AND content_length IS NULL AND issued_at IS NULL AND revoked_at IS NULL)
  OR (status='ISSUED' AND object_version IS NOT NULL AND content_sha256 IS NOT NULL
   AND content_length IS NOT NULL AND issued_at IS NOT NULL AND revoked_at IS NULL)
  OR (status='REVOKED' AND object_version IS NOT NULL AND content_sha256 IS NOT NULL
   AND content_length IS NOT NULL AND issued_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX ix_cg19_receipt_issue ON cg19_finance_receipt_document
 (root_realm_id,status,created_at DESC,id DESC);
CREATE FUNCTION cg19_receipt_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original issued document cannot be deleted' USING ERRCODE='P0923';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'PENDING' THEN
   RAISE EXCEPTION 'Only an original pending document may be created' USING ERRCODE='P0923';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id
  OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id
  OR NEW.source_version<>OLD.source_version OR
  NEW.source_digest IS DISTINCT FROM OLD.source_digest OR
  NEW.issue_key IS DISTINCT FROM OLD.issue_key OR
  NEW.issued_by IS DISTINCT FROM OLD.issued_by OR
  NEW.object_key IS DISTINCT FROM OLD.object_key OR
  NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Original receipt document identity cannot change' USING ERRCODE='P0923';
 END IF;
 IF OLD.status IN('PENDING','UNKNOWN') AND NEW.status IN('UNKNOWN','ISSUED')
   AND OLD.object_version IS NULL AND OLD.content_sha256 IS NULL
 THEN RETURN NEW;
 END IF;
 IF OLD.status='ISSUED' AND NEW.status='REVOKED'
   AND NEW.object_version IS NOT DISTINCT FROM OLD.object_version
   AND NEW.content_sha256 IS NOT DISTINCT FROM OLD.content_sha256
   AND NEW.content_length IS NOT DISTINCT FROM OLD.content_length
   AND NEW.issued_at IS NOT DISTINCT FROM OLD.issued_at AND NEW.revoked_at IS NOT NULL
 THEN RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Issued receipt bytes are immutable' USING ERRCODE='P0923';
END; $$;
CREATE TRIGGER cg19_receipt_issue_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg19_finance_receipt_document
 FOR EACH ROW EXECUTE FUNCTION cg19_receipt_document_guard();
