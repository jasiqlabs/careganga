-- CG13 US003 QA10/11. CG19 owns the actual recipient acknowledgment,
-- not CG13 request flags or the staff-issued warehouse movement.
-- One CG12 confirmed staff ISSUE + distinct signed-in CG04 recipient proof.
CREATE TABLE cg19_reward_handover (
 realm_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 redemption_id uuid NOT NULL,
 stock_issue_event_id uuid NOT NULL,
 recipient_account_ref uuid NOT NULL,
 source_key uuid NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(realm_id,id),
 UNIQUE(realm_id,redemption_id),
 FOREIGN KEY(realm_id,redemption_id)
  REFERENCES redemption(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(realm_id,stock_issue_event_id)
  REFERENCES stock_event(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(recipient_account_ref,realm_id)
  REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg19_reward_handover_recipient
 ON cg19_reward_handover(realm_id,recipient_account_ref,acknowledged_at DESC,id DESC);

CREATE FUNCTION cg19_reward_handover_source_guard()
 RETURNS trigger LANGUAGE plpgsql AS $cg19$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM redemption r
  JOIN stock_reward_hold h ON h.root_realm_id=r.root_realm_id
   AND h.redemption_id=r.id AND h.state='ISSUED'
  JOIN stock_reward_hold_event h_event
   ON h_event.root_realm_id=h.root_realm_id AND h_event.hold_id=h.id
   AND h_event.event_kind='ISSUED' AND h_event.source_key=h.issue_key
  JOIN stock_event issued ON issued.root_realm_id=h_event.root_realm_id
   AND issued.id=h_event.original_stock_event_id
  JOIN stock_operation_draft op ON op.root_realm_id=issued.root_realm_id
   AND op.id=issued.operation_id AND op.reward_hold_id=h.id
  JOIN inventory_location warehouse ON warehouse.root_realm_id=h.root_realm_id
   AND warehouse.id=h.location_id
  WHERE r.root_realm_id=NEW.realm_id AND r.id=NEW.redemption_id
   AND r.state='ISSUED_AWAITING_HANDOVER' AND r.product_type='PHYSICAL'
   AND r.recipient_account_ref=NEW.recipient_account_ref
   AND r.request_key=NEW.source_key
   AND issued.id=NEW.stock_issue_event_id AND issued.event_kind='ISSUE'
   AND issued.source_event_key=h.issue_key
   AND issued.actor_ref=op.actor_ref AND issued.recipient_id=op.actor_ref
   AND issued.actor_ref<>r.recipient_account_ref
   AND op.status='CONFIRMED'
   AND (NOT warehouse.delivery_proof_required OR EXISTS(
    SELECT 1 FROM cg19_stored_file f
    WHERE f.realm_id=issued.root_realm_id
     AND f.id=issued.movement_proof_ref
     AND f.revision=issued.movement_proof_revision
     AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
     AND f.owner_kind='CG12_MOVEMENT'
     AND f.inventory_operation_id=issued.operation_id))
 ) THEN RAISE EXCEPTION 'Actual staff ISSUE, CG19 evidence and recipient handover source required'; END IF;
 RETURN NEW;
END; $cg19$;
CREATE TRIGGER cg19_reward_handover_source_guard
 BEFORE INSERT ON cg19_reward_handover
 FOR EACH ROW EXECUTE FUNCTION cg19_reward_handover_source_guard();
CREATE TRIGGER cg19_reward_handover_immutable
 BEFORE UPDATE OR DELETE ON cg19_reward_handover FOR EACH ROW
 EXECUTE FUNCTION cg13_immutable_source();
