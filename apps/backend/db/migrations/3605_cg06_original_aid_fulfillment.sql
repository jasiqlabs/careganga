-- One original CG12 operation or CG09 voucher per approved aid allocation.
-- A prepared operation, warehouse ISSUE, or unpaid voucher is not a delivery.
CREATE TABLE assistance_fulfillment(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,assistance_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN('ISSUE','RETURN','PAYMENT')),
 request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 actor_ref uuid NOT NULL,quantity numeric(18,3),amount_minor bigint,
 stock_operation_ref uuid,voucher_ref uuid,voucher_revision integer,return_of_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,id),UNIQUE(root_realm_id,id,assistance_id),UNIQUE(root_realm_id,actor_ref,request_key),
 UNIQUE(root_realm_id,stock_operation_ref),UNIQUE(root_realm_id,voucher_ref),
 FOREIGN KEY(root_realm_id,assistance_id) REFERENCES assistance_case(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(root_realm_id,stock_operation_ref) REFERENCES stock_operation_draft(root_realm_id,id),
 FOREIGN KEY(voucher_ref,root_realm_id) REFERENCES finance_voucher(id,root_realm_id),
 FOREIGN KEY(root_realm_id,return_of_ref,assistance_id) REFERENCES assistance_fulfillment(root_realm_id,id,assistance_id),
 CHECK(((action IN('ISSUE','RETURN') AND quantity>0 AND stock_operation_ref IS NOT NULL AND num_nonnulls(amount_minor,voucher_ref,voucher_revision)=0 AND (action='RETURN')=(return_of_ref IS NOT NULL))
 OR (action='PAYMENT' AND amount_minor>0 AND voucher_ref IS NOT NULL AND voucher_revision=1 AND num_nonnulls(quantity,stock_operation_ref,return_of_ref)=0)) IS TRUE)
);
CREATE INDEX ix_cg06_fulfillment_aid ON assistance_fulfillment(root_realm_id,assistance_id,created_at,id);
CREATE TRIGGER cg06_fulfillment_immutable BEFORE UPDATE OR DELETE ON assistance_fulfillment FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();
CREATE TABLE assistance_delivery_event(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL,assistance_id uuid NOT NULL,fulfillment_id uuid NOT NULL,actor_ref uuid NOT NULL,
 action text NOT NULL CHECK(action IN('DELIVERED','RETURNED','PAID','REVERSED')),
 request_key uuid NOT NULL,request_digest char(64) NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 stock_event_ref uuid,journal_ref uuid,proof_ref uuid,proof_revision integer,proof_source_revision integer,
 beneficiary_id uuid NOT NULL,
 at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),UNIQUE(root_realm_id,fulfillment_id,action),
 UNIQUE(root_realm_id,stock_event_ref),UNIQUE(root_realm_id,journal_ref),UNIQUE(root_realm_id,proof_ref),
 FOREIGN KEY(root_realm_id,fulfillment_id,assistance_id) REFERENCES assistance_fulfillment(root_realm_id,id,assistance_id),
 FOREIGN KEY(root_realm_id,beneficiary_id) REFERENCES beneficiary(root_realm_id,id),
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id),
 FOREIGN KEY(root_realm_id,stock_event_ref) REFERENCES stock_event(root_realm_id,id),
 FOREIGN KEY(journal_ref,root_realm_id) REFERENCES journal(id,root_realm_id),
 FOREIGN KEY(proof_ref,root_realm_id,beneficiary_id,proof_source_revision) REFERENCES cg19_stored_file(id,realm_id,beneficiary_id,proposal_revision),
 CHECK(((action IN('DELIVERED','RETURNED') AND stock_event_ref IS NOT NULL AND journal_ref IS NULL)
 OR (action IN('PAID','REVERSED') AND journal_ref IS NOT NULL AND stock_event_ref IS NULL)) IS TRUE),
 CHECK(num_nonnulls(proof_ref,proof_revision,proof_source_revision)=3 AND proof_revision>0)
);
CREATE INDEX ix_cg06_delivery_aid ON assistance_delivery_event(root_realm_id,assistance_id,at,id);
CREATE TRIGGER cg06_delivery_immutable BEFORE UPDATE OR DELETE ON assistance_delivery_event FOR EACH ROW EXECUTE FUNCTION cg06_immutable_event();
-- Aid-linked vouchers may not be repurposed by a generic voucher edit.
CREATE FUNCTION cg06_aid_voucher_identity() RETURNS trigger LANGUAGE plpgsql AS $aid$
BEGIN
 IF EXISTS(SELECT 1 FROM assistance_fulfillment WHERE root_realm_id=OLD.root_realm_id AND voucher_ref=OLD.id)
 AND (TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status','approval_case_id','proof_file_id','proof_file_revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','approval_case_id','proof_file_id','proof_file_revision','updated_at'])) THEN
 RAISE EXCEPTION 'Original assistance payment source cannot be repurposed';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $aid$;
CREATE TRIGGER cg06_aid_voucher_identity BEFORE UPDATE OR DELETE ON finance_voucher FOR EACH ROW EXECUTE FUNCTION cg06_aid_voucher_identity();
-- Independent approval is mandatory before any original owner allocation.
CREATE FUNCTION cg06_aid_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $aid$
DECLARE a assistance_case%ROWTYPE; total numeric; source stock_operation_draft%ROWTYPE; v finance_voucher%ROWTYPE;
BEGIN
 SELECT * INTO a FROM assistance_case WHERE root_realm_id=NEW.root_realm_id AND id=NEW.assistance_id FOR UPDATE;
 IF NOT FOUND OR a.state<>'APPROVED' OR NOT EXISTS(SELECT 1 FROM cg03_case c WHERE c.realm_id=a.root_realm_id AND c.id=a.approval_case_ref AND c.case_kind='ASSISTANCE_REVIEW' AND c.assistance_review_ref=a.id AND c.assistance_source_digest=a.source_digest AND c.status='OWNER_COMPLETED') THEN RAISE EXCEPTION 'Original assistance release is not approved' USING ERRCODE='23514'; END IF;
 IF NEW.action IN('ISSUE','RETURN') THEN
  SELECT * INTO source FROM stock_operation_draft WHERE root_realm_id=NEW.root_realm_id AND id=NEW.stock_operation_ref;
  IF a.kind<>'MATERIAL' OR NOT FOUND OR source.status<>'DRAFT' OR source.request_key<>NEW.request_key OR (source.kind,source.item_id,source.location_id,source.unit_code,source.qty_scale,source.quantity,source.actor_ref) IS DISTINCT FROM (NEW.action,a.item_ref,a.location_ref,a.unit_code,a.qty_scale,NEW.quantity,NEW.actor_ref) THEN RAISE EXCEPTION 'Stock allocation differs from original aid' USING ERRCODE='23514'; END IF;
  IF NEW.action='ISSUE' THEN
   SELECT COALESCE(sum(quantity),0) INTO total FROM assistance_fulfillment WHERE root_realm_id=NEW.root_realm_id AND assistance_id=NEW.assistance_id AND action='ISSUE';
   IF total+NEW.quantity>a.requested_qty THEN RAISE EXCEPTION 'Aid quantity exceeds approval' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT COALESCE(sum(quantity),0) INTO total FROM assistance_fulfillment WHERE root_realm_id=NEW.root_realm_id AND return_of_ref=NEW.return_of_ref AND action='RETURN';
   IF NOT EXISTS(SELECT 1 FROM assistance_fulfillment original JOIN assistance_delivery_event d ON d.root_realm_id=original.root_realm_id AND d.fulfillment_id=original.id AND d.action='DELIVERED' JOIN stock_movement m ON m.root_realm_id=d.root_realm_id AND m.stock_event_id=d.stock_event_ref WHERE original.root_realm_id=NEW.root_realm_id AND original.id=NEW.return_of_ref AND original.assistance_id=NEW.assistance_id AND original.action='ISSUE' AND m.id=source.original_movement_id AND original.quantity>=total+NEW.quantity) THEN RAISE EXCEPTION 'Return exceeds original delivered stock' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  SELECT * INTO v FROM finance_voucher WHERE root_realm_id=NEW.root_realm_id AND id=NEW.voucher_ref;
  IF a.kind<>'FINANCIAL' OR NOT FOUND OR v.voucher_type<>'PAYMENT' OR v.status<>'DRAFT' OR v.version<>NEW.voucher_revision OR v.total_minor<>NEW.amount_minor OR v.branch_id IS DISTINCT FROM a.branch_ref OR v.created_by<>NEW.actor_ref THEN RAISE EXCEPTION 'Payment allocation differs from original aid' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO total FROM assistance_fulfillment WHERE root_realm_id=NEW.root_realm_id AND assistance_id=NEW.assistance_id AND action='PAYMENT';
  IF total+NEW.amount_minor>a.requested_minor THEN RAISE EXCEPTION 'Aid amount exceeds approval' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $aid$;
CREATE TRIGGER cg06_aid_allocation_guard BEFORE INSERT ON assistance_fulfillment FOR EACH ROW EXECUTE FUNCTION cg06_aid_allocation_guard();

-- Enforce exact original movement/payment and clean consent-bound evidence even
-- if an application caller bypasses its TypeScript pre-check.
CREATE FUNCTION cg06_aid_delivery_guard() RETURNS trigger LANGUAGE plpgsql AS $aid$
DECLARE a assistance_case%ROWTYPE; f assistance_fulfillment%ROWTYPE;
BEGIN
 SELECT * INTO a FROM assistance_case WHERE root_realm_id=NEW.root_realm_id AND id=NEW.assistance_id FOR SHARE;
 SELECT * INTO f FROM assistance_fulfillment WHERE root_realm_id=NEW.root_realm_id AND id=NEW.fulfillment_id AND assistance_id=a.id FOR SHARE;
 IF NOT FOUND OR a.state<>'APPROVED' OR a.beneficiary_id<>NEW.beneficiary_id THEN RAISE EXCEPTION 'Original aid allocation required' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM beneficiary b JOIN cg19_stored_file p ON p.realm_id=b.root_realm_id AND p.beneficiary_id=b.id JOIN cg19_upload_intent u ON u.realm_id=p.realm_id AND u.id=p.upload_intent_id
 WHERE b.root_realm_id=NEW.root_realm_id AND b.id=a.beneficiary_id AND b.consent_revoked_at IS NULL AND b.lifecycle_state='ACTIVE' AND b.verification_state='VERIFIED' AND b.branch_scope_id IS NOT DISTINCT FROM a.branch_ref
 AND p.id=NEW.proof_ref AND p.revision=NEW.proof_revision AND p.proposal_revision=NEW.proof_source_revision AND p.proposal_revision=b.profile_revision AND p.revoked_at IS NULL AND p.scan_status='CLEAN_VERIFIED' AND u.status='VALIDATED' AND p.created_at>=f.created_at) THEN RAISE EXCEPTION 'Current clean handover proof required' USING ERRCODE='23514'; END IF;
 IF NEW.action IN('DELIVERED','RETURNED') THEN
  IF f.action<>CASE WHEN NEW.action='DELIVERED' THEN 'ISSUE' ELSE 'RETURN' END OR NOT EXISTS(SELECT 1 FROM stock_operation_draft o JOIN stock_event e ON e.root_realm_id=o.root_realm_id AND e.operation_id=o.id JOIN stock_movement m ON m.root_realm_id=e.root_realm_id AND m.stock_event_id=e.id WHERE o.root_realm_id=NEW.root_realm_id AND o.id=f.stock_operation_ref AND o.status='CONFIRMED' AND e.id=NEW.stock_event_ref AND e.event_kind=f.action AND m.event_kind=f.action AND m.item_id=a.item_ref AND m.location_id=a.location_ref AND m.signed_qty=CASE WHEN f.action='ISSUE' THEN -f.quantity ELSE f.quantity END) THEN RAISE EXCEPTION 'Exact stock movement required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.action='PAID' THEN
  IF f.action<>'PAYMENT' OR NOT EXISTS(SELECT 1 FROM finance_voucher v JOIN finance_voucher_posting p ON p.root_realm_id=v.root_realm_id AND p.voucher_id=v.id AND p.voucher_revision=v.version JOIN journal j ON j.root_realm_id=p.root_realm_id AND j.id=p.journal_id JOIN finance_voucher_payment_verification pay ON pay.root_realm_id=v.root_realm_id AND pay.voucher_id=v.id AND pay.voucher_revision=v.version WHERE v.root_realm_id=NEW.root_realm_id AND v.id=f.voucher_ref AND v.version=f.voucher_revision AND v.status='POSTED' AND v.total_minor=f.amount_minor AND j.id=NEW.journal_ref AND j.status='POSTED' AND j.posting_kind='VOUCHER' AND pay.status='VERIFIED' AND pay.amount_minor=f.amount_minor) THEN RAISE EXCEPTION 'Exact posted verified payment required' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Finance recovery requires original owner verification' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $aid$;
CREATE TRIGGER cg06_aid_delivery_guard BEFORE INSERT ON assistance_delivery_event FOR EACH ROW EXECUTE FUNCTION cg06_aid_delivery_guard();
