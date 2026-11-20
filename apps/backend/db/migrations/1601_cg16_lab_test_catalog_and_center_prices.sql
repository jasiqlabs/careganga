-- CG-16 US-001: real Lab Test Master, packages and independent center commercial tariffs.
-- All records belong to the existing Foundation root. No CG-15 patient, Lab ERP,
-- settlement, sample or clinical report schema is required for this catalogue.
CREATE TABLE test_category (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 code text NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 100),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,code)
);
CREATE INDEX ix_cg16_category_list ON test_category(root_realm_id,status,display_name,id);

CREATE TABLE diagnostic_test (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 unique_test_code text NOT NULL CHECK(unique_test_code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 category_ref uuid NOT NULL,
 sample_type text NOT NULL CHECK(sample_type IN
  ('BLOOD','URINE','STOOL','SALIVA','SWAB','TISSUE','OTHER','NOT_APPLICABLE')),
 parameters_description text NOT NULL DEFAULT '' CHECK(length(parameters_description)<=2000),
 clinical_description text NOT NULL DEFAULT '' CHECK(length(clinical_description)<=2000),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,unique_test_code),
 FOREIGN KEY(root_realm_id,category_ref) REFERENCES test_category(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg16_test_list ON diagnostic_test(root_realm_id,status,category_ref,name,id);

-- Immutable test snapshots protect historical approved packages and later lab
-- orders against a change to display name/category/clinical description.
CREATE TABLE diagnostic_test_revision (
 root_realm_id uuid NOT NULL,
 test_ref uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 changed_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,test_ref,revision_no),
 FOREIGN KEY(root_realm_id,test_ref) REFERENCES diagnostic_test(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TABLE diagnostic_package (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 unique_package_code text NOT NULL CHECK(unique_package_code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id), UNIQUE(root_realm_id,unique_package_code),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE diagnostic_package_line (
 root_realm_id uuid NOT NULL,
 package_ref uuid NOT NULL,
 package_revision integer NOT NULL CHECK(package_revision>0),
 test_ref uuid NOT NULL,
 test_revision_at_approval integer NOT NULL CHECK(test_revision_at_approval>0),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 order_index integer NOT NULL CHECK(order_index BETWEEN 0 AND 99),
 PRIMARY KEY(root_realm_id,package_ref,package_revision,test_ref),
 UNIQUE(root_realm_id,package_ref,package_revision,order_index),
 FOREIGN KEY(root_realm_id,package_ref) REFERENCES diagnostic_package(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,test_ref,test_revision_at_approval)
  REFERENCES diagnostic_test_revision(root_realm_id,test_ref,revision_no) ON DELETE RESTRICT
);
CREATE TABLE diagnostic_package_revision (
 root_realm_id uuid NOT NULL,
 package_ref uuid NOT NULL,
 revision_no integer NOT NULL CHECK(revision_no>0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 changed_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,package_ref,revision_no),
 FOREIGN KEY(root_realm_id,package_ref) REFERENCES diagnostic_package(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

CREATE TABLE lab_center_test_mapping (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 center_ref uuid NOT NULL,
 test_or_package_kind text NOT NULL CHECK(test_or_package_kind IN ('TEST','PACKAGE')),
 test_ref uuid,
 package_ref uuid,
 publication_state text NOT NULL DEFAULT 'ACTIVE'
  CHECK(publication_state IN ('ACTIVE','INACTIVE')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 CHECK((test_or_package_kind='TEST' AND test_ref IS NOT NULL AND package_ref IS NULL) OR
       (test_or_package_kind='PACKAGE' AND package_ref IS NOT NULL AND test_ref IS NULL)),
 FOREIGN KEY(root_realm_id,center_ref) REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,test_ref) REFERENCES diagnostic_test(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,package_ref) REFERENCES diagnostic_package(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_cg16_center_test
 ON lab_center_test_mapping(root_realm_id,center_ref,test_ref) WHERE test_ref IS NOT NULL;
CREATE UNIQUE INDEX ux_cg16_center_package
 ON lab_center_test_mapping(root_realm_id,center_ref,package_ref) WHERE package_ref IS NOT NULL;
CREATE INDEX ix_cg16_center_mapping
 ON lab_center_test_mapping(root_realm_id,center_ref,publication_state,id);

CREATE TABLE lab_center_price_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 center_test_mapping_ref uuid NOT NULL,
 version_no integer NOT NULL CHECK(version_no>0),
 effective_from timestamptz NOT NULL,
 effective_to timestamptz,
 base_price_minor bigint NOT NULL CHECK(base_price_minor BETWEEN 0 AND 999999999),
 advertised_patient_price_minor bigint NOT NULL CHECK(advertised_patient_price_minor BETWEEN 0 AND base_price_minor),
 price_currency char(3) NOT NULL DEFAULT 'INR' CHECK(price_currency='INR'),
 discount_reason text CHECK(discount_reason IS NULL OR length(discount_reason)<=240),
 status text NOT NULL DEFAULT 'PROPOSED'
  CHECK(status IN ('PROPOSED','APPROVED','REJECTED')),
 proposed_by uuid NOT NULL,
 approved_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 CHECK((status='APPROVED')=(approved_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,center_test_mapping_ref,version_no),
 FOREIGN KEY(root_realm_id,center_test_mapping_ref)
  REFERENCES lab_center_test_mapping(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
-- Real PostgreSQL exclusion rejects conflicting approved effective tariffs,
-- including independently submitted concurrent revisions. Proposals may overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE lab_center_price_version ADD CONSTRAINT cg16_approved_price_no_overlap
 EXCLUDE USING gist (
  root_realm_id WITH =,
  center_test_mapping_ref WITH =,
  tstzrange(effective_from,COALESCE(effective_to,'infinity'::timestamptz),'[)') WITH &&
 ) WHERE (status='APPROVED');
CREATE INDEX ix_cg16_center_price_current
 ON lab_center_price_version(root_realm_id,center_test_mapping_ref,status,effective_from DESC,id);

-- Idempotency: source key is scoped to Foundation+actor, and the fixed digest
-- also pins the business action and payload; never claim success before commit.
CREATE TABLE lab_catalog_command (
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(length(action) BETWEEN 3 AND 60),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 result_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);

-- Historical snapshots never change; authoritative current test/package data
-- changes by CAS revision only. Draft price approval can update once, but an
-- already approved immutable commercial offer cannot be rewritten or deleted.
CREATE FUNCTION cg16_catalog_immutable_snapshot() RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 RAISE EXCEPTION 'Approved diagnostic catalogue history is immutable';
END
$cg16$;
CREATE TRIGGER cg16_test_snapshot_frozen BEFORE UPDATE OR DELETE
 ON diagnostic_test_revision FOR EACH ROW EXECUTE FUNCTION cg16_catalog_immutable_snapshot();
CREATE TRIGGER cg16_package_snapshot_frozen BEFORE UPDATE OR DELETE
 ON diagnostic_package_revision FOR EACH ROW EXECUTE FUNCTION cg16_catalog_immutable_snapshot();
CREATE TRIGGER cg16_package_line_frozen BEFORE UPDATE OR DELETE
 ON diagnostic_package_line FOR EACH ROW EXECUTE FUNCTION cg16_catalog_immutable_snapshot();
CREATE FUNCTION cg16_approved_price_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg16$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='APPROVED' THEN
  RAISE EXCEPTION 'Approved lab pricing is immutable';
 END IF;
 IF NEW.root_realm_id<>OLD.root_realm_id OR
    NEW.center_test_mapping_ref<>OLD.center_test_mapping_ref OR
    NEW.version_no<>OLD.version_no OR NEW.effective_from<>OLD.effective_from OR
    NEW.effective_to IS DISTINCT FROM OLD.effective_to OR
    NEW.base_price_minor<>OLD.base_price_minor OR
    NEW.advertised_patient_price_minor<>OLD.advertised_patient_price_minor OR
    NEW.price_currency<>OLD.price_currency OR
    NEW.proposed_by<>OLD.proposed_by OR
    NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN
  RAISE EXCEPTION 'Proposed lab pricing terms are immutable';
 END IF;
 RETURN NEW;
END
$cg16$;
CREATE TRIGGER cg16_price_immutable BEFORE UPDATE OR DELETE
 ON lab_center_price_version FOR EACH ROW EXECUTE FUNCTION cg16_approved_price_immutable();
