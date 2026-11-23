-- CG19 owns the original verified identity proof for actual CG04 volunteer application U15-U17.
-- No patient/employee identity or generic public file link is substituted.
CREATE TABLE cg19_volunteer_file_intent(
 realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL,application_version integer NOT NULL CHECK(application_version>0),
 requested_by uuid NOT NULL,request_key uuid NOT NULL,
 request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 classification text NOT NULL CHECK(classification IN('VOLUNTEER_IDENTITY_PROOF','VOLUNTEER_PORTRAIT')),
 mime text NOT NULL CHECK(mime IN('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 char(64) NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE,storage_reservation_ref text,
 reserved_until timestamptz NOT NULL,status text NOT NULL DEFAULT 'INITIATED' CHECK(status IN('INITIATED','UNKNOWN','VALIDATED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),UNIQUE(realm_id,requested_by,request_key),UNIQUE(realm_id,id,application_id,application_version),
 FOREIGN KEY(realm_id,application_id) REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(requested_by,realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(classification<>'VOLUNTEER_PORTRAIT' OR mime<>'application/pdf')
);
CREATE INDEX ix_cg19_volunteer_intent_app ON cg19_volunteer_file_intent(realm_id,application_id,application_version,status);
CREATE TABLE cg19_volunteer_private_file(
 realm_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),application_id uuid NOT NULL,
 application_version integer NOT NULL,intent_id uuid NOT NULL,classification text NOT NULL,mime text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),sha256 char(64) NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 object_key text NOT NULL UNIQUE,object_version text NOT NULL CHECK(char_length(object_version) BETWEEN 1 AND 160),
 scan_proof_ref text NOT NULL CHECK(char_length(scan_proof_ref) BETWEEN 8 AND 160),
 scan_status text NOT NULL CHECK(scan_status='CLEAN_VERIFIED'),scanned_at timestamptz NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),UNIQUE(realm_id,intent_id),UNIQUE(realm_id,id,application_id,application_version),
 FOREIGN KEY(realm_id,intent_id,application_id,application_version) REFERENCES cg19_volunteer_file_intent(realm_id,id,application_id,application_version) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg19_volunteer_file_active_kind ON cg19_volunteer_private_file(realm_id,application_id,classification) WHERE revoked_at IS NULL;
CREATE TABLE cg19_volunteer_file_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),realm_id uuid NOT NULL,application_id uuid NOT NULL,
 intent_id uuid NOT NULL,file_id uuid,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('UPLOAD_INITIATED','UPLOAD_VERIFIED','UPLOAD_REJECTED','FILE_REVOKED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(realm_id,intent_id) REFERENCES cg19_volunteer_file_intent(realm_id,id),
 FOREIGN KEY(realm_id,file_id) REFERENCES cg19_volunteer_private_file(realm_id,id),
 FOREIGN KEY(actor_ref,realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(realm_id,application_id) REFERENCES volunteer_application(root_realm_id,id)
);
CREATE TRIGGER cg19_volunteer_file_event_immutable BEFORE UPDATE OR DELETE ON cg19_volunteer_file_event FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();
CREATE FUNCTION cg19_volunteer_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Protected upload history is retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status IN('VALIDATED','REJECTED') OR (to_jsonb(NEW)-'status'-'storage_reservation_ref'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'storage_reservation_ref'-'updated_at') THEN
   RAISE EXCEPTION 'Protected upload source is immutable'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=NEW.realm_id AND a.id=NEW.application_id
   AND a.applicant_account_ref=NEW.requested_by AND a.status IN('DRAFT','RETURNED') AND a.version=NEW.application_version FOR SHARE)
  THEN RAISE EXCEPTION 'The application changed. Refresh the current draft'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_volunteer_intent_write BEFORE INSERT OR UPDATE OR DELETE ON cg19_volunteer_file_intent FOR EACH ROW EXECUTE FUNCTION cg19_volunteer_intent_guard();
CREATE FUNCTION cg19_volunteer_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Protected document history is retained'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW.revoked_at IS NOT NULL OR NOT EXISTS(
   SELECT 1 FROM cg19_volunteer_file_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.intent_id
    AND i.application_id=NEW.application_id AND i.application_version=NEW.application_version AND i.status='VALIDATED'
    AND (i.classification,i.mime,i.size_bytes,i.sha256,i.object_key)=(NEW.classification,NEW.mime,NEW.size_bytes,NEW.sha256,NEW.object_key)
    AND i.reserved_until>now() FOR SHARE)
   THEN RAISE EXCEPTION 'Original verified upload does not match'; END IF;
 ELSE
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revision<>OLD.revision+1
   OR (to_jsonb(NEW)-'revision'-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revision'-'revoked_at')
   OR NOT EXISTS(SELECT 1 FROM volunteer_application a WHERE a.root_realm_id=NEW.realm_id AND a.id=NEW.application_id AND a.status IN('DRAFT','RETURNED') FOR SHARE)
   THEN RAISE EXCEPTION 'Submitted proof cannot be replaced'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_volunteer_file_write BEFORE INSERT OR UPDATE OR DELETE ON cg19_volunteer_private_file FOR EACH ROW EXECUTE FUNCTION cg19_volunteer_file_guard();
