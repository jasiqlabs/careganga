import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** CG12 owns the original ISSUE stock event and its warehouse projection.
 * This CG13 consumer runs in that SAME original CG12 confirmed-issue TX.
 * A staff warehouse ISSUE is NOT a recipient handover or points spend.
 */
export async function recordCommittedRewardStockIssue(tx:PoolClient,source:{
 root:string;redemption:string;stockEvent:string;hold:string
}){
 const proof=await tx.query<{id:string}>(
  "SELECT r.id FROM redemption r "+
  "JOIN stock_reward_hold h ON h.root_realm_id=r.root_realm_id "+
  "AND h.redemption_id=r.id "+
  "JOIN stock_reward_hold_event receipt ON receipt.root_realm_id=h.root_realm_id "+
  "AND receipt.hold_id=h.id AND receipt.event_kind='ISSUED' "+
  "AND receipt.original_stock_event_id=$3 "+
  "JOIN stock_event event ON event.root_realm_id=receipt.root_realm_id "+
  "AND event.id=receipt.original_stock_event_id "+
  "JOIN stock_operation_draft op ON op.root_realm_id=event.root_realm_id "+
  "AND op.id=event.operation_id "+
  "WHERE r.root_realm_id=$1 AND r.id=$2 AND h.id=$4 "+
  "AND r.state='HELD' AND r.product_type='PHYSICAL' "+
  "AND h.state='ISSUED' AND receipt.source_key=h.issue_key "+
  "AND event.event_kind='ISSUE' AND event.source_event_key=h.issue_key "+
  "AND op.reward_hold_id=h.id AND op.kind='ISSUE' AND op.status='CONFIRMED' "+
  "AND event.recipient_id=op.actor_ref AND event.actor_ref=op.actor_ref",
  [source.root,source.redemption,source.stockEvent,source.hold]);
 if(!proof.rows[0])throw new ConflictException(
  "Only the actual original confirmed CG12 staff warehouse issue can advance this reward.");
 const updated=await tx.query(
  "UPDATE redemption SET state='ISSUED_AWAITING_HANDOVER',revision=revision+1 "+
  "WHERE root_realm_id=$1 AND id=$2 AND state='HELD' AND product_type='PHYSICAL'",
  [source.root,source.redemption]);
 if(updated.rowCount!==1)throw new ConflictException(
  "Original physical reward status changed before warehouse issue could commit.");
 return {state:"ISSUED_AWAITING_HANDOVER" as const,sourceEvent:source.stockEvent};
}
