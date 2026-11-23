-- CG13 US001: real Foundation referral programme and reward catalog.
-- No points/balance/stock/payment/CG04 membership or fake supplier data.
CREATE TABLE referral_program (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 programme_code text NOT NULL CHECK(programme_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 3 AND 120),
 audience text NOT NULL CHECK(audience IN ('MEMBER','VOLUNTEER','BOTH')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 active_policy_version integer NOT NULL CHECK(active_policy_version>0),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 UNIQUE(root_realm_id,programme_code),
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE TABLE referral_policy_version (
 root_realm_id uuid NOT NULL,
 programme_id uuid NOT NULL,
 version_no integer NOT NULL CHECK(version_no>0),
 effective_from timestamptz NOT NULL,
 qualifying_event text NOT NULL CHECK(qualifying_event IN
  ('MEMBERSHIP_ACTIVATED_VERIFIED','VOLUNTEER_APPROVED_ACTIVE')),
 award_points bigint NOT NULL CHECK(award_points BETWEEN 1 AND 1000000000),
 minimum_claim_points bigint NOT NULL CHECK(minimum_claim_points BETWEEN 0 AND 1000000000),
 points_to_inr_display_ratio numeric(16,6) CHECK(points_to_inr_display_ratio>0),
 auto_rank_upgrade boolean NOT NULL DEFAULT true,
 points_expiry_enabled boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,programme_id,version_no),
 FOREIGN KEY(root_realm_id,programme_id) REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
ALTER TABLE referral_program ADD CONSTRAINT fk_cg13_current_policy
 FOREIGN KEY(root_realm_id,id,active_policy_version)
 REFERENCES referral_policy_version(root_realm_id,programme_id,version_no)
 DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE referral_rank_rule (
 root_realm_id uuid NOT NULL,
 programme_id uuid NOT NULL,
 policy_version integer NOT NULL CHECK(policy_version>0),
 sort_order smallint NOT NULL CHECK(sort_order BETWEEN 1 AND 30),
 rank_name text NOT NULL CHECK(length(btrim(rank_name)) BETWEEN 2 AND 70),
 minimum_verified_referrals integer NOT NULL CHECK(minimum_verified_referrals BETWEEN 0 AND 1000000),
 minimum_eligible_points bigint NOT NULL CHECK(minimum_eligible_points BETWEEN 0 AND 1000000000000),
 benefits_summary text NOT NULL DEFAULT '' CHECK(length(benefits_summary)<=350),
 PRIMARY KEY(root_realm_id,programme_id,policy_version,sort_order),
 UNIQUE(root_realm_id,programme_id,policy_version,rank_name),
 FOREIGN KEY(root_realm_id,programme_id,policy_version)
  REFERENCES referral_policy_version(root_realm_id,programme_id,version_no) ON DELETE RESTRICT
);
CREATE INDEX ix_cg13_programme_active
 ON referral_program(root_realm_id,status,audience,display_name,id);
CREATE INDEX ix_cg13_policy_history
 ON referral_policy_version(root_realm_id,programme_id,version_no DESC);
CREATE TABLE reward_product (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,
 programme_id uuid NOT NULL,
 product_type text NOT NULL CHECK(product_type IN ('DIGITAL','PHYSICAL')),
 category text NOT NULL CHECK(length(btrim(category)) BETWEEN 2 AND 80),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 160),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=1000),
 points_price bigint NOT NULL CHECK(points_price BETWEEN 1 AND 1000000000000),
 eligible_audience text NOT NULL CHECK(eligible_audience IN ('MEMBER','VOLUNTEER','BOTH')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
 highlighted boolean NOT NULL DEFAULT false,
 public_visible boolean NOT NULL DEFAULT true,
 approved_image_url text CHECK(approved_image_url IS NULL OR length(approved_image_url)<=500),
 cg12_item_ref uuid,
 cg12_location_ref uuid,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),
 FOREIGN KEY(root_realm_id,programme_id) REFERENCES referral_program(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,cg12_item_ref) REFERENCES inventory_item(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,cg12_location_ref) REFERENCES inventory_location(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(updated_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((product_type='DIGITAL' AND cg12_item_ref IS NULL AND cg12_location_ref IS NULL)
   OR (product_type='PHYSICAL' AND cg12_item_ref IS NOT NULL AND cg12_location_ref IS NOT NULL))
);
CREATE TABLE reward_product_revision (
 root_realm_id uuid NOT NULL,
 product_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 product_type text NOT NULL CHECK(product_type IN('DIGITAL','PHYSICAL')),
 name text NOT NULL,
 category text NOT NULL,
 description text NOT NULL,
 points_price bigint NOT NULL CHECK(points_price>0),
 eligible_audience text NOT NULL,
 status text NOT NULL,
 highlighted boolean NOT NULL,
 public_visible boolean NOT NULL,
 approved_image_url text,
 cg12_item_ref uuid,
 cg12_location_ref uuid,
 changed_by uuid NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,product_id,revision),
 FOREIGN KEY(root_realm_id,product_id) REFERENCES reward_product(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(changed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg13_reward_catalog
 ON reward_product(root_realm_id,programme_id,status,category,name,id);
CREATE TABLE referral_catalog_command (
 root_realm_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 command_kind text NOT NULL CHECK(command_kind IN
  ('PROGRAMME_CREATE','PROGRAMME_POLICY','PROGRAMME_STATUS','PRODUCT_CREATE','PRODUCT_EDIT')),
 source_ref uuid NOT NULL,
 result_version integer NOT NULL CHECK(result_version>0),
 payload_digest char(64) NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,request_key),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE FUNCTION cg13_immutable_source() RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN RAISE EXCEPTION 'Original referral programme audit/revision cannot be edited'; END; $cg13$;
CREATE TRIGGER referral_policy_immutable BEFORE UPDATE OR DELETE ON referral_policy_version
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
CREATE TRIGGER referral_rank_immutable BEFORE UPDATE OR DELETE ON referral_rank_rule
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
CREATE TRIGGER reward_product_revision_immutable BEFORE UPDATE OR DELETE ON reward_product_revision
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
CREATE TRIGGER referral_catalog_command_immutable BEFORE UPDATE OR DELETE ON referral_catalog_command
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
CREATE FUNCTION cg13_programme_current_guard() RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM access_realm WHERE id=NEW.root_realm_id
  AND realm_key='FOUNDATION_ROOT') THEN
  RAISE EXCEPTION 'Only the Foundation may manage referral programmes'; END IF;
 IF TG_OP='UPDATE' AND (
  (NEW.id,NEW.root_realm_id,NEW.programme_code,NEW.created_by,NEW.created_at)
   IS DISTINCT FROM
  (OLD.id,OLD.root_realm_id,OLD.programme_code,OLD.created_by,OLD.created_at)
  OR NEW.version<>OLD.version+1 OR NEW.active_policy_version NOT IN
  (OLD.active_policy_version,OLD.active_policy_version+1)
 ) THEN RAISE EXCEPTION 'Referral programme identity/version cannot be rewritten'; END IF;
 IF TG_OP='INSERT' AND (NEW.version<>1 OR NEW.active_policy_version<>1)
  THEN RAISE EXCEPTION 'Referral programme starts with one policy version'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER referral_programme_guard BEFORE INSERT OR UPDATE ON referral_program
 FOR EACH ROW EXECUTE FUNCTION cg13_programme_current_guard();
CREATE FUNCTION cg13_product_current_guard() RETURNS trigger LANGUAGE plpgsql AS $cg13$
BEGIN
 IF TG_OP='UPDATE' AND (
  (NEW.id,NEW.root_realm_id,NEW.programme_id,NEW.created_by,NEW.created_at)
   IS DISTINCT FROM
  (OLD.id,OLD.root_realm_id,OLD.programme_id,OLD.created_by,OLD.created_at)
  OR NEW.version<>OLD.version+1
 ) THEN RAISE EXCEPTION 'Reward product identity/version cannot be rewritten'; END IF;
 IF TG_OP='INSERT' AND NEW.version<>1 THEN
  RAISE EXCEPTION 'Reward product starts at revision one'; END IF;
 IF NEW.product_type='PHYSICAL' AND NOT EXISTS(
  SELECT 1 FROM inventory_item item JOIN inventory_location loc
    ON loc.root_realm_id=item.root_realm_id
  LEFT JOIN branch b ON b.id=loc.branch_ref AND b.root_realm_id=loc.root_realm_id
  WHERE item.id=NEW.cg12_item_ref AND loc.id=NEW.cg12_location_ref
   AND item.root_realm_id=NEW.root_realm_id
   AND item.status='ACTIVE' AND item.unit_code='PIECE' AND item.qty_scale=0
   AND loc.status='ACTIVE' AND (loc.branch_ref IS NULL OR b.status='ACTIVE')
  FOR SHARE OF item,loc
 ) THEN RAISE EXCEPTION 'Original CG12 ACTIVE whole-piece stock source is required'; END IF;
 RETURN NEW;
END; $cg13$;
CREATE TRIGGER reward_product_current_guard BEFORE INSERT OR UPDATE ON reward_product
 FOR EACH ROW EXECUTE FUNCTION cg13_product_current_guard();
-- Never create points, money, stock, automatic notifications or fictitious ranks.
