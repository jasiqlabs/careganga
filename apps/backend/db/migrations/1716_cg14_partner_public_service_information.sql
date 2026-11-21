-- CG14 public approved CENTER content: pharmacy listed medicine, nursing
-- service and OT procedure information. This is NOT CG22/23/24 ERP, stock,
-- prescribing, booking, theatre scheduling, invoice or benefit acceptance.
CREATE TABLE health_partner_public_offer(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 public_code text NOT NULL DEFAULT ('HPS-'||upper(encode(gen_random_bytes(6),'hex')))
  CHECK(public_code ~ '^HPS-[A-F0-9]{12}$'),
 center_ref uuid NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN('PHARMACY','NURSING','OT')),
 item_name text NOT NULL CHECK(char_length(btrim(item_name)) BETWEEN 3 AND 120
  AND item_name !~ '[[:cntrl:]]'),
 normalized_name text GENERATED ALWAYS AS(lower(btrim(item_name))) STORED,
 description text NOT NULL DEFAULT ''
  CHECK(char_length(description)<=500 AND description !~ '[[:cntrl:]]'),
 indicative_price_minor bigint
  CHECK(indicative_price_minor BETWEEN 1 AND 10000000000),
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'PENDING_REVIEW'
  CHECK(status IN('PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
 created_by_account uuid NOT NULL,
 request_key uuid NOT NULL,
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by_account uuid,
 review_request_key uuid,
 reviewed_at timestamptz,
 review_reason text CHECK(review_reason IS NULL OR
  char_length(btrim(review_reason)) BETWEEN 12 AND 500),
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,public_code),
 UNIQUE(root_realm_id,created_by_account,request_key),
 FOREIGN KEY(root_realm_id,center_ref)
  REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by_account,root_realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK((status='PENDING_REVIEW' AND reviewed_by_account IS NULL
  AND reviewed_at IS NULL AND review_request_key IS NULL AND review_reason IS NULL)
 OR (status<>'PENDING_REVIEW' AND reviewed_by_account IS NOT NULL
  AND reviewed_at IS NOT NULL AND review_request_key IS NOT NULL
  AND review_reason IS NOT NULL AND reviewed_by_account<>created_by_account))
);
CREATE UNIQUE INDEX uq_health_partner_current_offer
 ON health_partner_public_offer(root_realm_id,center_ref,service_kind,normalized_name)
 WHERE status IN('PENDING_REVIEW','APPROVED');
CREATE INDEX ix_health_partner_public_offers
 ON health_partner_public_offer(root_realm_id,center_ref,service_kind,item_name,id)
 WHERE status='APPROVED';

CREATE FUNCTION cg14_public_offer_proof() RETURNS trigger LANGUAGE plpgsql AS $cg14$
DECLARE prior health_partner_public_offer%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Historical approved partner service information is immutable'
   USING ERRCODE='P1746';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'PENDING_REVIEW' OR
   NOT EXISTS(
    SELECT 1 FROM health_center c
    JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id
    JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id
     AND cap.center_id=c.id
    JOIN health_center_account_affiliation f ON f.root_realm_id=c.root_realm_id
     AND f.center_id=c.id
    JOIN account a ON a.realm_id=f.root_realm_id AND a.id=f.account_ref
    WHERE c.root_realm_id=NEW.root_realm_id AND c.id=NEW.center_ref
     AND c.status='VERIFIED' AND c.access_state='ENABLED'
     AND p.status='VERIFIED'
     AND cap.capability_code=CASE NEW.service_kind
      WHEN 'OT' THEN 'SURGERY' ELSE NEW.service_kind END
     AND f.status='ACTIVE' AND f.account_ref=NEW.created_by_account
     AND a.status='ACTIVE')
  THEN
   RAISE EXCEPTION 'Only a verified assigned partner may propose a service'
    USING ERRCODE='P1747';
  END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-'status'-'reviewed_by_account'-'review_request_key'-
   'reviewed_at'-'review_reason') IS DISTINCT FROM
    (to_jsonb(OLD)-'status'-'reviewed_by_account'-'review_request_key'-
   'reviewed_at'-'review_reason')
 OR NEW.reviewed_by_account=OLD.created_by_account
 OR NOT ((OLD.status='PENDING_REVIEW' AND NEW.status IN('APPROVED','REJECTED'))
  OR (OLD.status='APPROVED' AND NEW.status='WITHDRAWN'))
 THEN
  RAISE EXCEPTION 'Approved service offer source terms cannot be rewritten'
   USING ERRCODE='P1748';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM account reviewer
  JOIN account_role ar ON ar.realm_id=reviewer.realm_id
   AND ar.account_id=reviewer.id AND ar.revoked_at IS NULL
  JOIN role role ON role.realm_id=ar.realm_id AND role.id=ar.role_id
  WHERE reviewer.realm_id=NEW.root_realm_id
   AND reviewer.id=NEW.reviewed_by_account
   AND reviewer.status='ACTIVE' AND role.active AND role.is_protected)
 THEN
  RAISE EXCEPTION 'Independent protected Foundation publication required'
   USING ERRCODE='P1749';
 END IF;
 IF NEW.status='APPROVED' AND NOT EXISTS(
  SELECT 1 FROM health_center c JOIN health_provider p ON
   p.root_realm_id=c.root_realm_id AND p.id=c.provider_id
  JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id
   AND cap.center_id=c.id
  WHERE c.root_realm_id=NEW.root_realm_id AND c.id=NEW.center_ref
   AND c.status='VERIFIED' AND c.access_state='ENABLED'
   AND p.status='VERIFIED'
   AND cap.capability_code=CASE NEW.service_kind
    WHEN 'OT' THEN 'SURGERY' ELSE NEW.service_kind END)
 THEN RAISE EXCEPTION 'Original verified service is unavailable'
  USING ERRCODE='P1750';
 END IF;
 RETURN NEW;
END $cg14$;
CREATE TRIGGER cg14_partner_public_offer_guard BEFORE INSERT OR UPDATE OR DELETE
 ON health_partner_public_offer FOR EACH ROW EXECUTE FUNCTION cg14_public_offer_proof();
