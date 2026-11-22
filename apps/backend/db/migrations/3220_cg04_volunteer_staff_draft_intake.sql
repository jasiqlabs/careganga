-- U14 original staff Add Volunteer / CSV import is UNVERIFIED DRAFT intake only.
-- No CG01 account, consent, CG03 decision, CG19 proof, employee or active volunteer is created.
CREATE TABLE volunteer_staff_import_batch(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_digest char(64) NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 row_count integer NOT NULL CHECK(row_count BETWEEN 1 AND 200),
 imported_count integer NOT NULL CHECK(imported_count BETWEEN 0 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg04_staff_import_immutable BEFORE UPDATE OR DELETE ON volunteer_staff_import_batch
 FOR EACH ROW EXECUTE FUNCTION cg04_tier_history_immutable();

CREATE TABLE volunteer_staff_intake_draft(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL,
 first_name text NOT NULL CHECK(length(btrim(first_name)) BETWEEN 1 AND 100),
 last_name text NOT NULL CHECK(length(btrim(last_name)) BETWEEN 1 AND 100),
 contact_mobile text NOT NULL CHECK(contact_mobile~'^\+91[6-9][0-9]{9}$'),
 city text NOT NULL DEFAULT '' CHECK(length(city)<=120),
 state text NOT NULL DEFAULT 'UNVERIFIED_DRAFT' CHECK(state='UNVERIFIED_DRAFT'),
 linked_application_id uuid,
 linked_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,id),UNIQUE(root_realm_id,contact_mobile),
 FOREIGN KEY(root_realm_id,batch_id) REFERENCES volunteer_staff_import_batch(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,linked_application_id) REFERENCES volunteer_application(root_realm_id,id) ON DELETE RESTRICT,
 CHECK((linked_application_id IS NULL)=(linked_at IS NULL))
);
CREATE INDEX ix_cg04_staff_intake_batch ON volunteer_staff_intake_draft(root_realm_id,batch_id,id);
CREATE INDEX ix_cg04_staff_intake_current ON volunteer_staff_intake_draft(root_realm_id,expires_at DESC,created_at DESC,id)
 WHERE linked_application_id IS NULL;
CREATE FUNCTION cg04_staff_intake_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Unverified intake must be removed through approved privacy retention'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.linked_application_id IS NOT NULL OR NEW.linked_application_id IS NULL OR NEW.linked_at IS NULL
   OR (NEW.root_realm_id,NEW.id,NEW.batch_id,NEW.first_name,NEW.last_name,NEW.contact_mobile,
     NEW.city,NEW.state,NEW.expires_at,NEW.created_at)
    IS DISTINCT FROM (OLD.root_realm_id,OLD.id,OLD.batch_id,OLD.first_name,OLD.last_name,OLD.contact_mobile,
     OLD.city,OLD.state,OLD.expires_at,OLD.created_at)
  THEN RAISE EXCEPTION 'Staff intake candidate cannot be converted without real applicant self registration'; END IF;
  IF NOT EXISTS(SELECT 1 FROM volunteer_application app
    WHERE app.root_realm_id=NEW.root_realm_id AND app.id=NEW.linked_application_id AND app.contact_mobile=NEW.contact_mobile
     AND app.consent_version='VOLUNTEER_V1' AND app.consented_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Verified self application and consent required before intake link'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg04_staff_intake_write BEFORE UPDATE OR DELETE ON volunteer_staff_intake_draft
 FOR EACH ROW EXECUTE FUNCTION cg04_staff_intake_guard();
