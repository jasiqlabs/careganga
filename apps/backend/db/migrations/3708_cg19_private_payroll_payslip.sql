-- Source-specific CG19 issuance lifecycle, using existing protected storage provider.
CREATE TABLE cg19_payroll_payslip(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),root_realm_id uuid NOT NULL,line_ref uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest~'^[0-9a-f]{64}$'),
 issued_by uuid NOT NULL,object_key text NOT NULL UNIQUE,object_version text,content_sha256 char(64),content_length integer,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','UNKNOWN','ISSUED')),
 created_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,line_ref,source_digest),
 FOREIGN KEY(root_realm_id,line_ref) REFERENCES payroll_line(root_realm_id,id),
 FOREIGN KEY(issued_by,root_realm_id) REFERENCES account(id,realm_id),
 CHECK((status='ISSUED' AND object_version IS NOT NULL AND content_sha256~'^[0-9a-f]{64}$' AND content_length BETWEEN 100 AND 10485760 AND issued_at IS NOT NULL) OR (status IN('PENDING','UNKNOWN') AND num_nonnulls(object_version,content_sha256,content_length,issued_at)=0))
);
CREATE FUNCTION cg19_guard_payroll_payslip() RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original payslip issuance is retained'; END IF;
 IF TG_OP='INSERT' AND NEW.status<>'PENDING' THEN RAISE EXCEPTION 'Original private issuance required'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status='ISSUED' OR (to_jsonb(NEW)-ARRAY['status','object_version','content_sha256','content_length','issued_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','object_version','content_sha256','content_length','issued_at','updated_at']) OR NEW.status NOT IN('UNKNOWN','ISSUED'))
 THEN RAISE EXCEPTION 'Original payslip source cannot change'; END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_payroll_payslip_guard BEFORE INSERT OR UPDATE OR DELETE ON cg19_payroll_payslip FOR EACH ROW EXECUTE FUNCTION cg19_guard_payroll_payslip();
