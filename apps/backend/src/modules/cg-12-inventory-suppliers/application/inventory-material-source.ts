import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {inventoryRef,inventoryQuantity,sourceChanged} from "./inventory-receipt-draft-source";
import {lockStockBalances,type StockDelta} from "./inventory-stock-command";
export const materialHash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export type MaterialRow={id:string;request_no:string;location_id:string;requester_id:string;priority:string;due_date:string;reason:string;status:string;version:number;current_revision:number};
export type MaterialLine={id:string;item_id:string;unit_code:string;qty_scale:number;requested_qty:string;approved_qty:string;held_qty:string;issued_qty:string;name:string;sku:string};
@Injectable()
export class InventoryMaterialSource{
 constructor(private readonly catalog:InventoryCatalogService){}
 async row(tx:PoolClient,a:VerifiedFoundationActor,ref:string,own:boolean,write=false,active=true){
  const r=(await tx.query<MaterialRow>("SELECT *,due_date::text FROM material_request WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,inventoryRef(ref)])).rows[0];
  if(!r)throw new NotFoundException("Material request unavailable");
  if(own&&r.requester_id!==a.accountId)throw new ForbiddenException("Only the requester may change this request");
  await this.catalog.store(tx,a,r.location_id,active);return r;
 }
 async lines(tx:PoolClient,root:string,ref:string){
  return (await tx.query<MaterialLine>("SELECT l.*,i.name,i.sku_norm AS sku FROM material_request_line l JOIN inventory_item i ON i.root_realm_id=l.root_realm_id AND i.id=l.item_id WHERE l.root_realm_id=$1 AND l.request_id=$2 ORDER BY l.item_id LIMIT 50",[root,ref])).rows;
 }
 async liveItems(tx:PoolClient,root:string,lines:MaterialLine[]){
  for(const l of lines)if(!(await tx.query("SELECT id FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[root,l.item_id])).rowCount)throw sourceChanged();
 }
 async snapshot(tx:PoolClient,root:string,r:MaterialRow){
  const lines=await this.lines(tx,root,r.id);
  return {request:r.id,location:r.location_id,requester:r.requester_id,priority:r.priority,date:r.due_date,reason:r.reason,lines:lines.map(l=>({id:l.id,item:l.item_id,unit:l.unit_code,scale:l.qty_scale,quantity:l.requested_qty}))};
 }
 async exact(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,rev:string,n:number,digest:string){
  const v=(await tx.query<{snapshot:unknown;digest:string}>("SELECT snapshot,digest FROM material_request_revision WHERE root_realm_id=$1 AND id=$2 AND request_id=$3 AND revision_no=$4 FOR SHARE",[a.realmId,rev,r.id,n])).rows[0];
  if(!v||v.digest!==digest||r.current_revision!==n||materialHash(await this.snapshot(tx,a.realmId,r))!==digest)throw sourceChanged();
 }
 async view(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow){
  const lines=await this.lines(tx,a.realmId,r.id);
  const label=(await tx.query<{label:string;requester:string}>("SELECT l.label,a.display_name AS requester FROM inventory_location l JOIN account a ON a.id=$3 AND a.realm_id=$1 WHERE l.root_realm_id=$1 AND l.id=$2",[a.realmId,r.location_id,r.requester_id])).rows[0];
  const review=(await tx.query<{id:string;case_number:string;status:string;revision:number}>("SELECT id,case_number,status,revision FROM cg03_case WHERE realm_id=$1 AND material_request_id=$2 AND material_revision_no=$3 AND case_kind='MATERIAL_REQUEST_REVIEW'",[a.realmId,r.id,r.current_revision])).rows[0];
  return {ref:r.id,reference:r.request_no,locationRef:r.location_id,location:label?.label,requester:label?.requester,own:r.requester_id===a.accountId,priority:r.priority,dueDate:r.due_date,reason:r.reason,status:r.status,version:r.version,caseRef:review?.id??null,caseReference:review?.case_number??null,caseStatus:review?.status??null,caseRevision:review?.revision??null,lines:lines.map(l=>({ref:l.id,itemRef:l.item_id,name:l.name,sku:l.sku,unit:l.unit_code,scale:l.qty_scale,requested:l.requested_qty,approved:l.approved_qty,held:l.held_qty,issued:l.issued_qty}))};
 }
 async reserve(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,key:string,allowShortage:boolean){
  const lines=await this.lines(tx,a.realmId,r.id);
  await this.liveItems(tx,a.realmId,lines);
  const ds:StockDelta[]=lines.map((l,i)=>({itemRef:l.item_id,locationRef:r.location_id,unit:l.unit_code,scale:l.qty_scale,delta:l.approved_qty,lineNo:i+1}));
  await lockStockBalances(tx,a.realmId,ds);
  // All-or-none hold; an approved request may honestly remain unreserved.
  const short=await tx.query("SELECT 1 FROM material_request_line l JOIN stock_balance b ON b.root_realm_id=l.root_realm_id AND b.item_id=l.item_id AND b.location_id=$3 WHERE l.root_realm_id=$1 AND l.request_id=$2 AND b.on_hand_qty-b.reserved_qty<l.approved_qty-l.issued_qty-l.held_qty LIMIT 1",[a.realmId,r.id,r.location_id]);
  if(short.rowCount){if(allowShortage)return false;throw new ConflictException({code:"CG12_STOCK_SHORTAGE"});}
  for(const l of lines){
   const q=(await tx.query<{qty:string}>("SELECT (approved_qty-issued_qty-held_qty)::text AS qty FROM material_request_line WHERE root_realm_id=$1 AND id=$2",[a.realmId,l.id])).rows[0].qty;
   if(!/[1-9]/.test(q))continue;
   await tx.query("UPDATE stock_balance SET reserved_qty=reserved_qty+$4::numeric,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3",[a.realmId,l.item_id,r.location_id,q]);
   await tx.query("INSERT INTO stock_hold(root_realm_id,request_line_id,request_id,item_id,location_id,quantity) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(root_realm_id,request_line_id) DO UPDATE SET quantity=stock_hold.quantity+EXCLUDED.quantity",[a.realmId,l.id,r.id,l.item_id,r.location_id,q]);
   await tx.query("UPDATE material_request_line SET held_qty=held_qty+$3::numeric WHERE root_realm_id=$1 AND id=$2",[a.realmId,l.id,q]);
   await tx.query("INSERT INTO stock_hold_event(root_realm_id,request_line_id,request_key,actor_ref,delta,kind) VALUES($1,$2,$3,$4,$5,'RESERVE')",[a.realmId,l.id,key,a.accountId,q]);
  }
  return true;
 }
 async release(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,key:string){
  const lines=await this.lines(tx,a.realmId,r.id);
  await lockStockBalances(tx,a.realmId,lines.map((l,i)=>({itemRef:l.item_id,locationRef:r.location_id,unit:l.unit_code,scale:l.qty_scale,delta:l.held_qty,lineNo:i+1})));
  for(const l of lines){if(!/[1-9]/.test(l.held_qty))continue;
   if(!(await tx.query("UPDATE stock_hold SET quantity=0 WHERE root_realm_id=$1 AND request_line_id=$2 AND quantity=$3::numeric RETURNING request_line_id",[a.realmId,l.id,l.held_qty])).rowCount)throw sourceChanged();
   await tx.query("UPDATE stock_balance SET reserved_qty=reserved_qty-$4::numeric,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3",[a.realmId,l.item_id,r.location_id,l.held_qty]);
   await tx.query("UPDATE material_request_line SET held_qty=0 WHERE root_realm_id=$1 AND id=$2",[a.realmId,l.id]);
   await tx.query("INSERT INTO stock_hold_event(root_realm_id,request_line_id,request_key,actor_ref,delta,kind) VALUES($1,$2,$3,$4,-$5::numeric,'RELEASE')",[a.realmId,l.id,key,a.accountId,l.held_qty]);
  }
 }
}
export function approvedQuantity(v:unknown,scale:number){return v==="0"?"0":inventoryQuantity(v,scale);}
