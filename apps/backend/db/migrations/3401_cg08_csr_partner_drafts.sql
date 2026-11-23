-- CG08 US001: one real root-isolated CSR organization with an immutable branch
-- origin. This is a private draft source; no partner is verified or published by
-- creating a record. CG03/CG19 add original review and proof in later migrations.
CREATE TABLE csr_partner (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 branch_ref uuid,
 legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 2 AND 200),
 legal_name_norm text GENERATED ALWAYS AS (lower(btrim(legal_name))) STORED,
 registration_reference text CHECK(registration_reference IS NULL OR length(registration_reference) BETWEEN 3 AND 100),
 contact_name text NOT NULL CHECK(length(btrim(contact_name)) BETWEEN 2 AND 160),
 contact_email text CHECK(contact_email IS NULL OR (length(contact_email) BETWEEN 5 AND 254 AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+
 contact_mobile text CHECK(contact_mobile IS NULL OR contact_mobile ~ '^\+91[6-9][0-9]{9}$'),
 support_summary text NOT NULL CHECK(length(btrim(support_summary)) BETWEEN 5 AND 1000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','RETURNED','SUBMITTED','APPROVED','REJECTED','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,legal_name_norm),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(contact_mobile IS NOT NULL OR contact_email IS NOT NULL)
);
CREATE INDEX ix_cg08_partner_scope ON csr_partner(root_realm_id,branch_ref,status,updated_at DESC,id);
CREATE TABLE csr_partner_command (
 root_realm_id uuid NOT NULL,request_key uuid NOT NULL,
 partner_id uuid NOT NULL,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','CANCEL')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 result_version integer NOT NULL CHECK(result_version>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg08_partner_command_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'CSR partner command history cannot be edited';
END; $$;
CREATE TRIGGER cg08_partner_command_no_change BEFORE UPDATE OR DELETE ON csr_partner_command
 FOR EACH ROW EXECUTE FUNCTION cg08_partner_command_immutable();
CREATE FUNCTION cg08_partner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm WHERE id=NEW.root_realm_id AND realm_key='FOUNDATION_ROOT') THEN
  RAISE EXCEPTION 'CSR organization requires a Foundation root';
 END IF;
 IF NEW.branch_ref IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM branch WHERE id=NEW.branch_ref AND root_realm_id=NEW.root_realm_id
   AND status='ACTIVE' FOR SHARE
 ) THEN RAISE EXCEPTION 'CSR organization needs a current active branch'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status <> 'DRAFT' OR NEW.version<>1 THEN RAISE EXCEPTION 'CSR draft must begin unapproved'; END IF;
 ELSE
  IF (NEW.id,NEW.root_realm_id,NEW.branch_ref,NEW.created_by,NEW.created_at) IS DISTINCT FROM
     (OLD.id,OLD.root_realm_id,OLD.branch_ref,OLD.created_by,OLD.created_at)
     OR NEW.version<>OLD.version+1 OR OLD.status NOT IN('DRAFT','RETURNED')
     OR NEW.status NOT IN('DRAFT','INACTIVE')
     THEN RAISE EXCEPTION 'CSR original source or revision cannot be rewritten'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg08_partner_write_guard BEFORE INSERT OR UPDATE ON csr_partner
 FOR EACH ROW EXECUTE FUNCTION cg08_partner_guard();
)),
 contact_mobile text CHECK(contact_mobile IS NULL OR contact_mobile ~ '^\+91[6-9][0-9]{9}$'),
 support_summary text NOT NULL CHECK(length(btrim(support_summary)) BETWEEN 5 AND 1000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','RETURNED','SUBMITTED','APPROVED','REJECTED','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 2147483647),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,legal_name_norm),
 FOREIGN KEY(branch_ref,root_realm_id) REFERENCES branch(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(contact_mobile IS NOT NULL OR contact_email IS NOT NULL)
);
CREATE INDEX ix_cg08_partner_scope ON csr_partner(root_realm_id,branch_ref,status,updated_at DESC,id);
CREATE TABLE csr_partner_command (
 root_realm_id uuid NOT NULL,request_key uuid NOT NULL,
 partner_id uuid NOT NULL,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','EDIT','CANCEL')),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 result_version integer NOT NULL CHECK(result_version>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(root_realm_id,partner_id) REFERENCES csr_partner(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg08_partner_command_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'CSR partner command history cannot be edited';
END; $$;
CREATE TRIGGER cg08_partner_command_no_change BEFORE UPDATE OR DELETE ON csr_partner_command
 FOR EACH ROW EXECUTE FUNCTION cg08_partner_command_immutable();
CREATE FUNCTION cg08_partner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm WHERE id=NEW.root_realm_id AND realm_key='FOUNDATION_ROOT') THEN
  RAISE EXCEPTION 'CSR organization requires a Foundation root';
 END IF;
 IF NEW.branch_ref IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM branch WHERE id=NEW.branch_ref AND root_realm_id=NEW.root_realm_id
   AND status='ACTIVE' FOR SHARE
 ) THEN RAISE EXCEPTION 'CSR organization needs a current active branch'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status <> 'DRAFT' OR NEW.version<>1 THEN RAISE EXCEPTION 'CSR draft must begin unapproved'; END IF;
 ELSE
  IF (NEW.id,NEW.root_realm_id,NEW.branch_ref,NEW.created_by,NEW.created_at) IS DISTINCT FROM
     (OLD.id,OLD.root_realm_id,OLD.branch_ref,OLD.created_by,OLD.created_at)
     OR NEW.version<>OLD.version+1 OR OLD.status NOT IN('DRAFT','RETURNED')
     OR NEW.status NOT IN('DRAFT','INACTIVE')
     THEN RAISE EXCEPTION 'CSR original source or revision cannot be rewritten'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg08_partner_write_guard BEFORE INSERT OR UPDATE ON csr_partner
 FOR EACH ROW EXECUTE FUNCTION cg08_partner_guard();
