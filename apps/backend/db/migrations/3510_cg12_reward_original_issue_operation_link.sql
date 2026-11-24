-- Original CG12 stock_operation_draft is the ONLY reward staff ISSUE.
-- Do not create a second warehouse issue master/stock_event balance.
ALTER TABLE stock_operation_draft ADD COLUMN reward_hold_id uuid;
ALTER TABLE stock_operation_draft
 ADD CONSTRAINT fk_cg12_stock_reward_hold_issue
 FOREIGN KEY(root_realm_id,reward_hold_id)
 REFERENCES stock_reward_hold(root_realm_id,id) ON DELETE RESTRICT;
ALTER TABLE stock_operation_draft
 ADD CONSTRAINT cg12_stock_reward_issued_as_real_staff_operation
 CHECK(reward_hold_id IS NULL OR
  (kind='ISSUE' AND request_id IS NULL AND request_line_id IS NULL
   AND original_movement_id IS NULL AND recipient_id=actor_ref
   AND unit_code='PIECE' AND qty_scale=0 AND quantity=1));
CREATE UNIQUE INDEX ux_cg12_original_reward_issue_draft
 ON stock_operation_draft(root_realm_id,reward_hold_id)
 WHERE reward_hold_id IS NOT NULL;
-- The original frozen draft source guard (3005) already disallows changing
-- reward_hold_id after creation, including post-approval or after issue.
