import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid inventory record");return v;};
const clean=(v:unknown,min:number,max:number)=>{if(typeof v!=="string"||/[\u0000-\u001f\u007f]/.test(v)||v.trim().length<min||v.trim().length>max)throw new BadRequestException({code:"CG12_CATALOG_INVALID"});return v.trim();};
const code=(v:unknown)=>{const x=clean(v,1,40).toUpperCase();if(!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(x))throw new BadRequestException("Use a valid item or supplier code");return x;};
const input=(v:unknown,keys:string[])=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new BadRequestException({code:"CG12_CATALOG_INVALID"});return v as Record<string,unknown>;};
export function parseInventoryItem(value:unknown){
 const x=input(value,["requestKey","sku","name","category","description","unit","scale","threshold"]);
 const unit=x.unit,scale=x.scale;
 if(typeof unit!=="string"||!["PIECE","KG","LITER"].includes(unit)||typeof scale!=="number"||!Number.isInteger(scale)||scale<0||scale>3||(unit==="PIECE"&&scale!==0))throw new BadRequestException({code:"CG12_UNIT_INVALID"});
 const threshold=x.threshold;
 if(typeof threshold!=="string"||!/^\d{1,15}(?:\.\d{1,3})?$/.test(threshold)||(threshold.split(".")[1]?.length??0)>scale)throw new BadRequestException({code:"CG12_QUANTITY_INVALID"});
 return {requestKey:uuid(x.requestKey),sku:code(x.sku),name:clean(x.name,2,160),category:clean(x.category,1,80),description:clean(x.description??"",0,500),unit,scale,threshold};
}
export function parseInventorySupplier(value:unknown){
 const x=input(value,["requestKey","code","legalName","displayName","category"]);
 return {requestKey:uuid(x.requestKey),code:code(x.code),legalName:clean(x.legalName,2,160),displayName:clean(x.displayName,2,160),category:clean(x.category,1,80)};
}
export function parseInventoryLocation(value:unknown){
 const x=input(value,["requestKey","code","label","branchRef"]);
 return {requestKey:uuid(x.requestKey),code:code(x.code),label:clean(x.label,2,160),branchRef:x.branchRef===null?null:uuid(x.branchRef)};
}
type Kind="ITEM"|"SUPPLIER"|"LOCATION";
@Injectable()
export class InventoryCatalogService {
 constructor(@Inject(DATABASE) private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade){}
 private async run<T>(token:string,action:string,work:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>){
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);const result=await work(tx,a);await tx.query("COMMIT");return result;}
  catch(e){await tx.query("ROLLBACK");if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")throw new ConflictException({code:"CG12_DUPLICATE_CODE"});throw e;}finally{tx.release();}
 }
 private async rootAdmin(tx:PoolClient,a:VerifiedFoundationActor){
  try{await this.identity.assertCurrent(tx,a,"foundation.branches.admin");return true;}catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async requireScope(tx:PoolClient,a:VerifiedFoundationActor,branch:string|null){
  const full=await this.rootAdmin(tx,a);
  if(branch===null){if(!full)throw new ForbiddenException("Your role cannot manage the Foundation store");return;}
  const q=await tx.query("SELECT id FROM branch WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE' AND ($3::boolean OR manager_account_ref=$4) FOR SHARE",[branch,a.realmId,full,a.accountId]);
  if(!q.rowCount)throw new ForbiddenException("The selected branch is not permitted or active");
 }
 async options(token:string){
  return this.run(token,"inventory.catalog.view",async(tx,a)=>{
   const full=await this.rootAdmin(tx,a);
   const branches=await tx.query<{id:string;name:string}>("SELECT id,name FROM branch WHERE root_realm_id=$1 AND status='ACTIVE' AND ($2::boolean OR manager_account_ref=$3) ORDER BY name,id LIMIT 100",[a.realmId,full,a.accountId]);
   const stores=await tx.query<{id:string;label:string;location_code_norm:string;scope_kind:string}>("SELECT l.id,l.label,l.location_code_norm,l.scope_kind FROM inventory_location l LEFT JOIN branch b ON b.id=l.branch_ref AND b.root_realm_id=l.root_realm_id WHERE l.root_realm_id=$1 AND l.status='ACTIVE' AND (l.scope_kind='FOUNDATION' AND $2::boolean OR l.scope_kind='BRANCH' AND b.status='ACTIVE' AND ($2::boolean OR b.manager_account_ref=$3)) ORDER BY l.label,l.id LIMIT 100",[a.realmId,full,a.accountId]);
   return {canManageFoundation:full,branches:branches.rows.map(x=>({ref:x.id,label:x.name})),stores:stores.rows.map(x=>({ref:x.id,label:x.label,code:x.location_code_norm,scope:x.scope_kind}))};
  });
 }
 async list(token:string,kind:Kind,locationInput:unknown,searchInput:unknown,offsetInput:unknown){
  const offset=Number(offsetInput??0),search=clean(searchInput??"",0,80).toLowerCase();
  if(!Number.isInteger(offset)||offset<0||offset>10000)throw new BadRequestException("Choose a valid catalog page");
  return this.run(token,"inventory.catalog.view",async(tx,a)=>{
   const full=await this.rootAdmin(tx,a);
   if(locationInput!==undefined&&locationInput!==""){
    const loc=await tx.query<{branch_ref:string|null}>("SELECT branch_ref FROM inventory_location WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE' FOR SHARE",[uuid(locationInput),a.realmId]);
    if(!loc.rows[0])throw new NotFoundException("Store is unavailable");
    await this.requireScope(tx,a,loc.rows[0].branch_ref);
   }else if(!full)throw new ForbiddenException("Choose a permitted store");
   // Foundation-wide catalog master; non-root users must select a current permitted real store.
   if(kind==="ITEM"){
    const q=await tx.query("SELECT id AS ref,sku_norm AS sku,name,category,description,unit_code AS unit,qty_scale AS scale,low_stock_threshold::text AS threshold,status,version FROM inventory_item WHERE root_realm_id=$1 AND ($2='' OR strpos(lower(name),$2)>0 OR strpos(lower(sku_norm),$2)>0) ORDER BY name,id LIMIT 26 OFFSET $3",[a.realmId,search,offset]);
    return {items:q.rows.slice(0,25),hasMore:q.rows.length>25,offset};
   }
   const q=await tx.query("SELECT id AS ref,supplier_code_norm AS code,display_name AS name,category,status,version FROM inventory_supplier WHERE root_realm_id=$1 AND ($2='' OR strpos(lower(display_name),$2)>0 OR strpos(lower(supplier_code_norm),$2)>0) ORDER BY display_name,id LIMIT 26 OFFSET $3",[a.realmId,search,offset]);
   return {items:q.rows.slice(0,25),hasMore:q.rows.length>25,offset};
  });
 }
 async create(token:string,kind:Kind,raw:unknown){
  const parsed=kind==="ITEM"?parseInventoryItem(raw):kind==="SUPPLIER"?parseInventorySupplier(raw):parseInventoryLocation(raw);
  const digest=createHash("sha256").update(JSON.stringify({kind,parsed})).digest("hex");
  return this.run(token,"inventory.catalog.manage",async(tx,a)=>{
   if(kind==="LOCATION")await this.requireScope(tx,a,(parsed as ReturnType<typeof parseInventoryLocation>).branchRef);
   else await this.requireScope(tx,a,null);
   // Serialize same source key before checking replay; no duplicate command effect.
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+parsed.requestKey]);
   const prior=await tx.query<{source_ref:string;source_kind:string;actor_ref:string;payload_digest:string;result_version:number}>("SELECT source_ref,source_kind,actor_ref,payload_digest,result_version FROM inventory_audit WHERE root_realm_id=$1 AND event_key=$2",[a.realmId,parsed.requestKey]);
   if(prior.rows[0]){
    const p=prior.rows[0];if(p.actor_ref!==a.accountId||p.source_kind!==kind||p.payload_digest!==digest)throw new ConflictException({code:"CG12_COMMAND_CHANGED"});
    return {ref:p.source_ref,version:p.result_version,replayed:true};
   }
   let row:{id:string;version:number};
   if(kind==="ITEM"){
    const x=parsed as ReturnType<typeof parseInventoryItem>;
    row=(await tx.query<{id:string;version:number}>("INSERT INTO inventory_item(root_realm_id,sku_norm,name,category,description,unit_code,qty_scale,low_stock_threshold) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version",[a.realmId,x.sku,x.name,x.category,x.description,x.unit,x.scale,x.threshold])).rows[0];
   }else if(kind==="SUPPLIER"){
    const x=parsed as ReturnType<typeof parseInventorySupplier>;
    row=(await tx.query<{id:string;version:number}>("INSERT INTO inventory_supplier(root_realm_id,supplier_code_norm,legal_name,display_name,category) VALUES($1,$2,$3,$4,$5) RETURNING id,version",[a.realmId,x.code,x.legalName,x.displayName,x.category])).rows[0];
   }else{
    const x=parsed as ReturnType<typeof parseInventoryLocation>;
    row=(await tx.query<{id:string;version:number}>("INSERT INTO inventory_location(root_realm_id,location_code_norm,label,branch_ref,scope_kind) VALUES($1,$2,$3,$4,$5) RETURNING id,version",[a.realmId,x.code,x.label,x.branchRef,x.branchRef?"BRANCH":"FOUNDATION"])).rows[0];
   }
   await tx.query("INSERT INTO inventory_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,a.accountId,kind,row.id,parsed.requestKey,digest,row.version]);
   return {ref:row.id,version:row.version,replayed:false};
  });
 }
}
