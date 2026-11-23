import {ConflictException,ForbiddenException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** CG12 original same-Postgres stock_balance owner. Only backend CG13 owner
 * calls this inside an authenticated CG04 recipient redemption transaction.
 * Never accepts an unaudited caller-supplied stock quantity, storage balance,
 * warehouse entity, CG12 operator role or customer identity from the browser.
 */
export type RewardHoldSource={
 root:string;redemption:string;recipient:string;
 relationship:"MEMBER"|"VOLUNTEER";relationshipRef:string;
 item:string;location:string;requestKey:string
};
type Warehouse={branchRef:string|null;status:string;unit:string;scale:number};
async function eligibleBranch(tx:PoolClient,s:RewardHoldSource){
 if(s.relationship==="MEMBER"){
  const row=await tx.query<{branchRef:string|null}>(
   "SELECT m.branch_ref AS \"branchRef\" FROM member m "+
   "WHERE m.root_realm_id=$1 AND m.id=$2 AND m.account_ref=$3 "+
   "AND m.status='ACTIVE' AND EXISTS("+
   "SELECT 1 FROM membership_term t WHERE t.root_realm_id=m.root_realm_id "+
   "AND t.member_id=m.id AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
   "AND (t.expires_on IS NULL OR t.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date))",
   [s.root,s.relationshipRef,s.recipient]);
  if(!row.rows[0])throw new ForbiddenException("Current verified membership is required.");
  return row.rows[0].branchRef;
 }
 const row=await tx.query<{branchRef:string|null}>(
  "SELECT v.branch_ref AS \"branchRef\" FROM volunteer v "+
  "WHERE v.root_realm_id=$1 AND v.id=$2 AND v.account_ref=$3 "+
  "AND v.status='ACTIVE' AND "+
  "cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)",
  [s.root,s.relationshipRef,s.recipient]);
 if(!row.rows[0])throw new ForbiddenException("Current verified volunteer is required.");
 return row.rows[0].branchRef;
}
export async function reserveRewardStock(tx:PoolClient,s:RewardHoldSource){
 const memberBranch=await eligibleBranch(tx,s);
 const stock=await tx.query<Warehouse>(
  "SELECT l.branch_ref AS \"branchRef\",l.status,i.unit_code AS unit,"+
  "i.qty_scale AS scale FROM inventory_location l "+
  "JOIN inventory_item i ON i.root_realm_id=l.root_realm_id "+
  "AND i.id=$3 AND i.status='ACTIVE' "+
  "LEFT JOIN branch branch ON branch.root_realm_id=l.root_realm_id "+
  "AND branch.id=l.branch_ref "+
  "WHERE l.root_realm_id=$1 AND l.id=$2 AND l.status='ACTIVE' "+
  "AND (l.branch_ref IS NULL OR branch.status='ACTIVE') FOR SHARE OF l,i",
  [s.root,s.location,s.item]);
 const item=stock.rows[0];
 if(!item||item.unit!=="PIECE"||item.scale!==0)
  throw new ConflictException("The original warehouse item is not an eligible one-piece reward.");
 if(item.branchRef&&item.branchRef!==memberBranch)
  throw new ForbiddenException("This reward must use your verified Foundation branch.");
 // Exact same CG12 stock_balance lock and projected reserved_qty as all
 // other physical stock movements and material requests.
 await tx.query(
  "INSERT INTO stock_balance(root_realm_id,item_id,location_id) "+
  "VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
  [s.root,s.item,s.location]);
 const balance=await tx.query<{available:string}>(
  "SELECT (on_hand_qty-reserved_qty)::text AS available "+
  "FROM stock_balance WHERE root_realm_id=$1 AND item_id=$2 "+
  "AND location_id=$3 FOR UPDATE",
  [s.root,s.item,s.location]);
 if(!balance.rows[0]||Number(balance.rows[0].available)<1)
  throw new ConflictException("The original warehouse item is out of stock.");
 const update=await tx.query(
  "UPDATE stock_balance SET reserved_qty=reserved_qty+1,version=version+1,"+
  "updated_at=now() WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 "+
  "AND on_hand_qty-reserved_qty>=1 RETURNING version",
  [s.root,s.item,s.location]);
 if(update.rowCount!==1)throw new ConflictException("The last warehouse item was reserved first.");
 const created=await tx.query<{id:string}>(
  "INSERT INTO stock_reward_hold(root_realm_id,redemption_id,item_id,location_id,"+
  "recipient_account_ref,request_key) VALUES($1,$2,$3,$4,$5,$6) "+
  "RETURNING id",
  [s.root,s.redemption,s.item,s.location,s.recipient,s.requestKey]);
 if(!created.rows[0])throw new ConflictException("Original stock reservation was not recorded.");
 await tx.query(
  "INSERT INTO stock_reward_hold_event(root_realm_id,hold_id,event_kind,"+
  "source_key,actor_account_ref) VALUES($1,$2,'RESERVED',$3,$4)",
  [s.root,created.rows[0].id,s.requestKey,s.recipient]);
 return {holdRef:created.rows[0].id,status:"HELD" as const};
}

/** Exact compensating original CG12 reservation release. No positive
 * stock_movement is fabricated: the unit was HELD, not issued from warehouse.
 */
export async function releaseRewardStock(tx:PoolClient,s:{
 root:string;redemption:string;recipient:string
}){
 const hold=await tx.query<{id:string;item:string;location:string;
  status:string;requestKey:string}>(
  "SELECT id,item_id AS item,location_id AS location,state AS status,"+
  "request_key AS \"requestKey\" FROM stock_reward_hold "+
  "WHERE root_realm_id=$1 AND redemption_id=$2 AND recipient_account_ref=$3",
  [s.root,s.redemption,s.recipient]);
 const item=hold.rows[0];
 if(!item)throw new ConflictException("Original reward warehouse hold is unavailable.");
 if(item.status==="RELEASED")return {status:"RELEASED" as const,replayed:true};
 if(item.status!=="HELD")throw new ConflictException("Issued items need a verified warehouse return.");
 await tx.query(
  "SELECT version FROM stock_balance WHERE root_realm_id=$1 "+
  "AND item_id=$2 AND location_id=$3 FOR UPDATE",
  [s.root,item.item,item.location]);
 const exact=await tx.query<{state:string}>(
  "SELECT state FROM stock_reward_hold WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
  [s.root,item.id]);
 if(exact.rows[0]?.state!=="HELD")
  throw new ConflictException("Original warehouse reservation has changed.");
 const updated=await tx.query(
  "UPDATE stock_balance SET reserved_qty=reserved_qty-1,version=version+1,"+
  "updated_at=now() WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 "+
  "AND reserved_qty>=1 RETURNING version",
  [s.root,item.item,item.location]);
 if(updated.rowCount!==1)throw new ConflictException("Original reserved stock projection differs.");
 const released=await tx.query(
  "UPDATE stock_reward_hold SET state='RELEASED',revision=revision+1,"+
  "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND state='HELD'",
  [s.root,item.id]);
 if(released.rowCount!==1)throw new ConflictException("Warehouse reservation has changed.");
 await tx.query(
  "INSERT INTO stock_reward_hold_event(root_realm_id,hold_id,event_kind,"+
  "source_key,actor_account_ref) VALUES($1,$2,'RELEASED',$3,$4)",
  [s.root,item.id,item.requestKey,s.recipient]);
 return {status:"RELEASED" as const,replayed:false};
}
