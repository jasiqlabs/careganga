import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
export type StockDelta={itemRef:string;locationRef:string;unit:string;scale:number;delta:string;lineNo:number;reservedDelta?:string};
/** Single command path for immutable movement + projection. All callers use
 * the same ordered balance locks. Quantity arithmetic remains PostgreSQL NUMERIC. */
export async function lockStockBalances(tx:PoolClient,root:string,deltas:readonly StockDelta[]){
 const keys=[...new Map(deltas.map(d=>[d.itemRef+"|"+d.locationRef,d])).values()].sort((a,b)=>(a.itemRef+"|"+a.locationRef).localeCompare(b.itemRef+"|"+b.locationRef));
 for(const d of keys){
  await tx.query("INSERT INTO stock_balance(root_realm_id,item_id,location_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[root,d.itemRef,d.locationRef]);
  await tx.query("SELECT version FROM stock_balance WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 FOR UPDATE",[root,d.itemRef,d.locationRef]);
 }
}
export async function applyStockMovements(tx:PoolClient,root:string,eventRef:string,kind:string,deltas:readonly StockDelta[]){
 for(const d of deltas){
  const q=await tx.query("UPDATE stock_balance SET on_hand_qty=on_hand_qty+$4::numeric,reserved_qty=reserved_qty+$5::numeric,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 AND reserved_qty+$5::numeric>=0 AND on_hand_qty+$4::numeric>=reserved_qty+$5::numeric RETURNING version",[root,d.itemRef,d.locationRef,d.delta,d.reservedDelta??"0"]);
  if(!q.rows[0])throw new ConflictException({code:"CG12_STOCK_SHORTAGE"});
  await tx.query("INSERT INTO stock_movement(root_realm_id,stock_event_id,event_kind,item_id,location_id,signed_qty,unit_code,qty_scale,source_line_no) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[root,eventRef,kind,d.itemRef,d.locationRef,d.delta,d.unit,d.scale,d.lineNo]);
 }
}
