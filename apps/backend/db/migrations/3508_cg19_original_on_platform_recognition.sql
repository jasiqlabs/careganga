-- CG13-US003-QA02: approved DIGITAL on-platform recognition, not a
-- fake gift-card, PDF, shipping label, stock issue, or external entitlement.
-- Original CG19 owns the immutable delivered recognition source. A protected
-- CG01 signed-in, currently eligible recipient must expressly claim it.
ALTER TABLE reward_product ADD COLUMN digital_fulfillment_method text
 NOT NULL DEFAULT 'PENDING_EXTERNAL_PROOF'
 CHECK(digital_fulfillment_method IN('PENDING_EXTERNAL_PROOF','ON_PLATFORM_RECOGNITION'));
ALTER TABLE reward_product ADD CONSTRAINT cg13_digital_delivery_type CHECK(
 product_type='DIGITAL' OR digital_fulfillment_method='PENDING_EXTERNAL_PROOF');
ALTER TABLE reward_product_revision ADD COLUMN digital_fulfillment_method text
 NOT NULL DEFAULT 'PENDING_EXTERNAL_PROOF'
 CHECK(digital_fulfillment_method IN('PENDING_EXTERNAL_PROOF','ON_PLATFORM_RECOGNITION'));
ALTER TABLE reward_product_revision ADD CONSTRAINT cg13_revision_delivery_type CHECK(
 product_type='DIGITAL' OR digital_fulfillment_method='PENDING_EXTERNAL_PROOF');

CREATE TABLE cg19_reward_recognition (
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 redemption_id uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 product_id uuid NOT NULL,
 product_revision integer NOT NULL,
 source_key uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 160),
 description text NOT NULL CHECK(length(description)<=1000),
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,redemption_id),
 FOREIGN KEY(realm_id,redemption_id)
  REFERENCES redemption(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,product_id,product_revision)
  REFERENCES reward_product_revision(root_realm_id,product_id,revision) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_reward_recognition_recipient
 ON cg19_reward_recognition(realm_id,recipient_account_ref,acknowledged_at DESC,id DESC);

CREATE FUNCTION cg19_original_recognition_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM redemption r
  JOIN reward_product_revision p ON p.root_realm_id=r.root_realm_id
   AND p.product_id=r.product_id AND p.revision=r.product_revision
  WHERE r.root_realm_id=NEW.realm_id AND r.id=NEW.redemption_id
   AND r.state='HELD' AND r.product_type='DIGITAL'
   AND r.recipient_account_ref=NEW.recipient_account_ref
   AND r.product_id=NEW.product_id AND r.product_revision=NEW.product_revision
   AND r.request_key=NEW.source_key
   AND p.digital_fulfillment_method='ON_PLATFORM_RECOGNITION'
   AND p.product_type='DIGITAL'
   AND p.name=NEW.title AND p.description=NEW.description
 ) THEN RAISE EXCEPTION 'Original on-platform recognition claim source required'; END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_reward_recognition_source_guard
 BEFORE INSERT ON cg19_reward_recognition
 FOR EACH ROW EXECUTE FUNCTION cg19_original_recognition_source_guard();
CREATE TRIGGER cg19_reward_recognition_immutable
 BEFORE UPDATE OR DELETE ON cg19_reward_recognition
 FOR EACH ROW EXECUTE FUNCTION cg13_immutable_source();
