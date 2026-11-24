import {ConflictException,ForbiddenException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import type {InventoryCatalogService} from "./inventory-catalog.service";
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

/** Only current CG12-issued staff may prepare an authentic original
 * stock_operation_draft for a verified physical reward. Existing original
 * CG12 Stock Operations UI + CG19 movement proof confirm this SAME draft.
 */
export async function prepareRewardIssueDraft(tx:PoolClient,
 actor:VerifiedFoundationActor,catalog:InventoryCatalogService,
 redemptionRef:string){
 const found=await tx.query<{holdId:string;issueKey:string;item:string;
  location:string;state:string;recipient:string;kind:string;relationshipRef:string;
  recipientKind:"MEMBER"|"VOLUNTEER"}>(
  "SELECT h.id AS \"holdId\",h.issue_key AS \"issueKey\",h.item_id AS item,"+
  "h.location_id AS location,h.state,r.recipient_account_ref AS recipient,"+
  "r.product_type AS kind,r.relationship_ref AS \"relationshipRef\","+
  "r.relationship_kind AS \"recipientKind\" "+
  "FROM stock_reward_hold h JOIN redemption r "+
  "ON r.root_realm_id=h.root_realm_id AND r.id=h.redemption_id "+
  "WHERE h.root_realm_id=$1 AND h.redemption_id=$2 "+
  "AND r.product_type='PHYSICAL' "+
  "AND ((r.state='HELD' AND h.state='HELD') OR "+
  "(r.state IN('ISSUED_AWAITING_HANDOVER','FULFILLED') AND h.state='ISSUED')) "+
  "FOR SHARE OF r,h",
  [actor.realmId,redemptionRef]);
 const h=found.rows[0];
 if(!h)throw new ConflictException("The real physical reward hold is unavailable.");
 // Current authorized CG12 warehouse scope is required even for a replay.
 const store=await catalog.store(tx,actor,h.location);
 const original=await tx.query<{ref:string;actor:string;status:string}>(
  "SELECT id AS ref,actor_ref AS actor,status FROM stock_operation_draft "+
  "WHERE root_realm_id=$1 AND reward_hold_id=$2",
  [actor.realmId,h.holdId]);
 if(h.state==="ISSUED"){
  // The genuine CG12 confirm transaction has already advanced the original
  // redemption from HELD. Retrieve the same issued operation, NEVER prepare
  // another ISSUE or revalidate an expired recipient merely to read its receipt.
  if(!original.rows[0]||original.rows[0].status!=="CONFIRMED")
   throw new ConflictException("The original confirmed warehouse ISSUE is unavailable.");
  if(original.rows[0].actor!==actor.accountId)
   throw new ForbiddenException("Only the original issuing staff may retrieve this receipt.");
  return {operationRef:original.rows[0].ref,status:"CONFIRMED",
   proofRequired:store.delivery_proof_required,replayed:true};
 }
 // A not-yet-issued reward still requires its genuinely current CG04
 // member/volunteer and matching branch before a staff ISSUE can be prepared.
 const activeRecipient=await eligibleBranch(tx,{
  root:actor.realmId,redemption:redemptionRef,recipient:h.recipient,
  relationship:h.recipientKind,relationshipRef:h.relationshipRef,
  item:h.item,location:h.location,requestKey:h.issueKey
 });
 if(store.branch_ref!==null&&store.branch_ref!==activeRecipient)
  throw new ForbiddenException("The original reward recipient no longer belongs to this warehouse branch.");
 if(original.rows[0]){
  if(original.rows[0].actor!==actor.accountId)
   throw new ForbiddenException("Only the original warehouse issuing staff may complete this draft.");
  if(original.rows[0].status==="CONFIRMED")
   throw new ConflictException("The warehouse confirmed a stale original request; refresh its true reward status.");
  return {operationRef:original.rows[0].ref,status:original.rows[0].status,
   proofRequired:store.delivery_proof_required,replayed:true};
 }
 const hash=createHash("sha256").update(JSON.stringify([
  "CG13_REWARD_STAFF_ISSUE",h.holdId,h.issueKey,h.item,h.location,actor.accountId
 ])).digest("hex");
 const q=await tx.query<{ref:string}>(
  "INSERT INTO stock_operation_draft(root_realm_id,request_key,actor_ref,kind,"+
  "location_id,item_id,unit_code,qty_scale,quantity,recipient_id,"+
  "reason,digest,reward_hold_id) "+
  "VALUES($1,$2,$3,'ISSUE',$4,$5,'PIECE',0,1,$3,"+
  "'Original physical reward warehouse issue',$6,$7) RETURNING id AS ref",
  [actor.realmId,h.issueKey,actor.accountId,h.location,h.item,hash,h.holdId]);
 if(!q.rows[0])throw new ConflictException("Original warehouse ISSUE draft unavailable.");
 return {operationRef:q.rows[0].ref,status:"DRAFT",
  proofRequired:store.delivery_proof_required,replayed:false};
}
