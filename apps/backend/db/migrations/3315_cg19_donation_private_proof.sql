-- CG19 original private donor A17 proof: never a bank match, journal or
-- verified payment. This is solely a malware-scanned uploaded attachment.
CREATE TABLE cg19_donation_private_proof(
 root_realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 donation_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 mime text NOT NULL CHECK(mime IN('application/pdf','image/jpeg','image/png')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
 expected_sha256 char(64) NOT NULL CHECK(expected_sha256~'^[a-f0-9]{64}$'),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 40 AND 400),
 state text NOT NULL DEFAULT 'RESERVED' CHECK(state IN('RESERVED','UNKNOWN','VALIDATED','REJECTED')),
 object_version text,
 scan_proof_ref text,
 scanned_at timestamptz,
 reserved_until timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,requested_by,request_key),
 UNIQUE(root_realm_id,object_key),
 FOREIGN KEY(root_realm_id,donation_id) REFERENCES donation(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((state='VALIDATED' AND object_version IS NOT NULL AND scan_proof_ref IS NOT NULL
    AND scanned_at IS NOT NULL)
 OR (state<>'VALIDATED' AND object_version IS NULL AND scan_proof_ref IS NULL
    AND scanned_at IS NULL))
);
CREATE INDEX ix_cg19_donation_private_proof
 ON cg19_donation_private_proof(root_realm_id,donation_id,state,created_at DESC,id DESC);
CREATE FUNCTION cg19_donation_proof_source_guard() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original donor proof cannot be deleted'; END IF;
 IF TG_OP='INSERT' AND NEW.state<>'RESERVED'
 THEN RAISE EXCEPTION 'New donor proof must await actual malware scan'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id OR
   NEW.id IS DISTINCT FROM OLD.id OR NEW.donation_id IS DISTINCT FROM OLD.donation_id OR
   NEW.requested_by IS DISTINCT FROM OLD.requested_by OR
   NEW.request_key IS DISTINCT FROM OLD.request_key OR
   NEW.request_digest IS DISTINCT FROM OLD.request_digest OR
   NEW.mime IS DISTINCT FROM OLD.mime OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
   NEW.expected_sha256 IS DISTINCT FROM OLD.expected_sha256 OR
   NEW.object_key IS DISTINCT FROM OLD.object_key OR
   NEW.reserved_until IS DISTINCT FROM OLD.reserved_until OR
   NEW.created_at IS DISTINCT FROM OLD.created_at OR
   OLD.state NOT IN('RESERVED','UNKNOWN') OR
   NEW.state NOT IN('UNKNOWN','VALIDATED','REJECTED') OR
   (OLD.object_version IS NOT NULL AND NEW.object_version IS DISTINCT FROM OLD.object_version)
  THEN RAISE EXCEPTION 'Donor attachment cannot be retargeted or rewritten'; END IF;
 END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_donation_proof_guard
 BEFORE INSERT OR UPDATE OR DELETE ON cg19_donation_private_proof
 FOR EACH ROW EXECUTE FUNCTION cg19_donation_proof_source_guard();
