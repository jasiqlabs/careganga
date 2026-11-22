import {Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {InventoryMaterialApprovalService} from "../../cg-03-registration-approvals/application/inventory-material-approval.service";
import {InventoryCatalogService} from "./inventory-catalog.service";
import {InventoryMaterialSource,materialHash,type MaterialRow} from "./inventory-material-source";
import {inventoryRef,inventoryInput,inventoryDate,inventoryText,inventoryQuantity,receiptInvalid,sourceChanged} from "./inventory-receipt-draft-source";
export function parseMaterialDraft(raw:unknown){
 const x=inventoryInput(raw,["requestKey","locationRef","priority","dueDate","reason","lines","expectedVersion"]),priority=x.priority;
 if(typeof priority!=="string"||!["LOW","NORMAL","HIGH","URGENT"].includes(priority)||!Array.isArray(x.lines)||x.lines.length<1||x.lines.length>50)throw receiptInvalid();
 const lines=x.lines.map(v=>{const l=inventoryInput(v,["itemRef","unit","quantity"]);if(typeof l.unit!=="string"||!["PIECE","KG","LITER"].includes(l.unit))throw receiptInvalid();return {itemRef:inventoryRef(l.itemRef),unit:l.unit,quantity:inventoryQuantity(l.quantity,l.unit==="PIECE"?0:3)};}).sort((a,b)=>a.itemRef.localeCompare(b.itemRef));
 if(new Set(lines.map(l=>l.itemRef)).size!==lines.length)throw receiptInvalid();
 return {key:inventoryRef(x.requestKey),location:inventoryRef(x.locationRef),priority,date:inventoryDate(x.dueDate),reason:inventoryText(x.reason,3,500),lines,expected:x.expectedVersion};
}
function parseAction(raw:unknown){const x=inventoryInput(raw,["requestKey","expectedVersion"]);if(typeof x.expectedVersion!=="number"||!Number.isSafeInteger(x.expectedVersion)||x.expectedVersion<1)throw receiptInvalid();return {key:inventoryRef(x.requestKey),expected:x.expectedVersion};}
@Injectable()
export class InventoryMaterialService{
 constructor(private readonly catalog:InventoryCatalogService,private readonly source:InventoryMaterialSource,private readonly approval:InventoryMaterialApprovalService){}
 private async replay(tx:PoolClient,a:VerifiedFoundationActor,key:string,h:string,ref?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":material:"+key]);
  const p=(await tx.query<{request_id:string;actor_ref:string;digest:string;result:Record<string,unknown>}>("SELECT * FROM material_request_command WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];
  if(!p)return null;
  if(p.actor_ref!==a.accountId||p.digest!==h||(ref&&p.request_id!==ref))throw sourceChanged();
  await this.source.row(tx,a,p.request_id,true,false,false);return p.result;
 }
 private async record(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,key:string,h:string){
  const result=await this.source.view(tx,a,r);
  await tx.query("INSERT INTO material_request_command(root_realm_id,request_key,request_id,actor_ref,digest,result) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[a.realmId,key,r.id,a.accountId,h,JSON.stringify(result)]);return result;
 }
 private async writeLines(tx:PoolClient,a:VerifiedFoundationActor,r:MaterialRow,v:ReturnType<typeof parseMaterialDraft>){
  for(const l of v.lines){
   const item=(await tx.query<{unit_code:string;qty_scale:number}>("SELECT unit_code,qty_scale FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,l.itemRef])).rows[0];
   if(!item||item.unit_code!==l.unit)throw receiptInvalid();
   await tx.query("INSERT INTO material_request_line(root_realm_id,request_id,item_id,unit_code,qty_scale,requested_qty) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,r.id,l.itemRef,l.unit,item.qty_scale,inventoryQuantity(l.quantity,item.qty_scale)]);
  }
 }
 async save(token:string,raw:unknown,refInput?:string){
  const v=parseMaterialDraft(raw),ref=refInput?inventoryRef(refInput):null,h=materialHash(["DRAFT",ref,v]);
  return this.catalog.run(token,"inventory.requests.manage",async(tx,a)=>{
   const prior=await this.replay(tx,a,v.key,h,ref??undefined);if(prior)return prior;
   await this.catalog.store(tx,a,v.location);
   let r:MaterialRow;
   if(ref){
    r=await this.source.row(tx,a,ref,true,true);
    if(r.version!==v.expected||!["DRAFT","RETURNED"].includes(r.status)||v.location!==r.location_id)throw sourceChanged();
    await tx.query("DELETE FROM material_request_line WHERE root_realm_id=$1 AND request_id=$2",[a.realmId,ref]);
    r=(await tx.query<MaterialRow>("UPDATE material_request SET priority=$3,due_date=$4,reason=$5,status='DRAFT',version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 RETURNING *,due_date::text",[a.realmId,ref,v.priority,v.date,v.reason])).rows[0];
   }else{
    if(v.expected!==undefined)throw receiptInvalid();
    r=(await tx.query<MaterialRow>("INSERT INTO material_request(root_realm_id,request_no,location_id,requester_id,priority,due_date,reason) VALUES($1,'CG-MR-'||lpad(nextval('inventory_request_public_sequence')::text,8,'0'),$2,$3,$4,$5,$6) RETURNING *,due_date::text",[a.realmId,v.location,a.accountId,v.priority,v.date,v.reason])).rows[0];
   }
   await this.writeLines(tx,a,r,v);return this.record(tx,a,r,v.key,h);
  });
 }
 async action(token:string,refInput:string,kind:"submit"|"reserve"|"cancel",raw:unknown){
  const ref=inventoryRef(refInput),x=parseAction(raw),h=materialHash([kind,ref,x.expected]);
  return this.catalog.run(token,"inventory.requests.manage",async(tx,a)=>{
   const prior=await this.replay(tx,a,x.key,h,ref);if(prior)return prior;
   let r=await this.source.row(tx,a,ref,true,true,kind!=="cancel");
   if(r.version!==x.expected)throw sourceChanged();let status:string;
   if(kind==="submit"){
    if(r.status!=="DRAFT")throw sourceChanged();
    await this.source.liveItems(tx,a.realmId,await this.source.lines(tx,a.realmId,r.id));
    const snapshot=await this.source.snapshot(tx,a.realmId,r),digest=materialHash(snapshot),n=r.current_revision+1;
    const rev=(await tx.query<{id:string}>("INSERT INTO material_request_revision(root_realm_id,request_id,revision_no,digest,snapshot) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id",[a.realmId,ref,n,digest,JSON.stringify(snapshot)])).rows[0];
    r=(await tx.query<MaterialRow>("UPDATE material_request SET current_revision=$3 WHERE root_realm_id=$1 AND id=$2 RETURNING *,due_date::text",[a.realmId,ref,n])).rows[0];
    await this.approval.submit(tx,a,r,rev.id,n,digest,x.key);status="SUBMITTED";
   }else if(kind==="reserve"){
    if(r.status!=="APPROVED_UNRESERVED")throw sourceChanged();
    const c=(await tx.query<{material_revision_id:string;material_revision_no:number;material_digest:string}>("SELECT material_revision_id,material_revision_no,material_digest FROM cg03_case WHERE realm_id=$1 AND material_request_id=$2 AND material_revision_no=$3 AND case_kind='MATERIAL_REQUEST_REVIEW' AND status='OWNER_COMPLETED' FOR SHARE",[a.realmId,ref,r.current_revision])).rows[0];
    if(!c)throw sourceChanged();await this.source.exact(tx,a,r,c.material_revision_id,c.material_revision_no,c.material_digest);
    await this.source.reserve(tx,a,r,x.key,false);status="HELD";
   }else{
    if(!["DRAFT","RETURNED","SUBMITTED","APPROVED_UNRESERVED","HELD"].includes(r.status))throw sourceChanged();
    await this.approval.cancel(tx,a,r);if(r.status==="HELD")await this.source.release(tx,a,r,x.key);status="CANCELLED";
   }
   r=(await tx.query<MaterialRow>("UPDATE material_request SET status=$3,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 RETURNING *,due_date::text",[a.realmId,ref,status])).rows[0];
   return this.record(tx,a,r,x.key,h);
  });
 }
 async list(token:string,locationInput:unknown,query:Record<string,unknown>,review=false){
  const location=inventoryRef(locationInput),offset=Number(query.offset??0),status=String(query.status??"ALL"),priority=String(query.priority??"ALL"),q=inventoryText(query.q??"",0,80).toLowerCase(),from=query.from?inventoryDate(query.from):null,to=query.to?inventoryDate(query.to):null;
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||!["ALL","DRAFT","SUBMITTED","RETURNED","REJECTED","APPROVED_UNRESERVED","HELD","PARTIAL","FULFILLED","CANCELLED"].includes(status)||!["ALL","LOW","NORMAL","HIGH","URGENT"].includes(priority)||(from&&to&&from>to))throw receiptInvalid();
  return this.catalog.run(token,review?"inventory.requests.review":"inventory.requests.view",async(tx,a)=>{
   await this.catalog.store(tx,a,location,false);
   const params=[a.realmId,location,review,a.accountId,status,priority,q,from,to,offset];
   const rows=await tx.query<MaterialRow>("SELECT r.*,r.due_date::text FROM material_request r WHERE root_realm_id=$1 AND location_id=$2 AND ($3::boolean OR requester_id=$4) AND ($5='ALL' OR status=$5) AND ($6='ALL' OR priority=$6) AND ($7='' OR strpos(lower(request_no),$7)>0 OR EXISTS(SELECT 1 FROM material_request_line l JOIN inventory_item i ON i.root_realm_id=l.root_realm_id AND i.id=l.item_id WHERE l.root_realm_id=r.root_realm_id AND l.request_id=r.id AND strpos(lower(i.name),$7)>0)) AND ($8::date IS NULL OR created_at::date>=$8) AND ($9::date IS NULL OR created_at::date<=$9) ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $10",params);
   const counts=(await tx.query("SELECT count(*)::integer AS total,count(*) FILTER(WHERE status='SUBMITTED')::integer AS pending,count(*) FILTER(WHERE status IN('APPROVED_UNRESERVED','HELD','PARTIAL','FULFILLED'))::integer AS approved,count(*) FILTER(WHERE status='REJECTED')::integer AS rejected FROM material_request WHERE root_realm_id=$1 AND location_id=$2 AND ($3::boolean OR requester_id=$4)",params.slice(0,4))).rows[0];
   const items=[];for(const row of rows.rows.slice(0,25))items.push(await this.source.view(tx,a,row));
   return {items,counts,offset,hasMore:rows.rows.length>25};
  });
 }
}
