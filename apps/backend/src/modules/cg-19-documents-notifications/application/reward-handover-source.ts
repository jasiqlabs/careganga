import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** CG19 original recipient-acknowledgment source for a PHYSICAL reward.
 * Called ONLY from the authenticated current CG04 recipient's same-transaction
 * redemption flow. CG19 SQL source guard independently requires a genuine
 * CG12 confirmed staff ISSUE and its original proof, rather than a status
 * boolean or staff-issued event being misrepresented as delivery.
 */
export async function recordAcknowledgedPhysicalRewardHandover(
 tx:PoolClient,source:{
  root:string;redemption:string;recipient:string;requestKey:string
 }):Promise<{id:string}>{
 const inserted=await tx.query<{id:string}>(
  "INSERT INTO cg19_reward_handover(realm_id,redemption_id,"+
  "stock_issue_event_id,recipient_account_ref,source_key) "+
  "SELECT r.root_realm_id,r.id,issued.original_stock_event_id,"+
  "r.recipient_account_ref,r.request_key FROM redemption r "+
  "JOIN stock_reward_hold hold ON hold.root_realm_id=r.root_realm_id "+
  "AND hold.redemption_id=r.id AND hold.state='ISSUED' "+
  "JOIN stock_reward_hold_event issued ON issued.root_realm_id=hold.root_realm_id "+
  "AND issued.hold_id=hold.id AND issued.event_kind='ISSUED' "+
  "AND issued.source_key=hold.issue_key "+
  "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.recipient_account_ref=$3 "+
  "AND r.request_key=$4 AND r.state='ISSUED_AWAITING_HANDOVER' "+
  "AND r.product_type='PHYSICAL' RETURNING id",
  [source.root,source.redemption,source.recipient,source.requestKey]);
 if(!inserted.rows[0])throw new ConflictException(
  "The original confirmed warehouse issue and verified recipient handover proof are unavailable.");
 return {id:inserted.rows[0].id};
}
