import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes,randomUUID} from "node:crypto";
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
export function parseInventoryThreshold(value:unknown,scale:number){
 if(typeof value!=="string"||!/^\d{1,15}(?:\.\d{1,3})?$/.test(value))throw new BadRequestException({code:"CG12_QUANTITY_INVALID"});
 const normalized=value.replace(/(\.\d*?[1-9])0+$/,"$1").replace(/\.0+$/,"").replace(/^0+(?=\d)/,"");
 if((normalized.split(".")[1]?.length??0)>scale)throw new BadRequestException({code:"CG12_QUANTITY_INVALID"});
 return normalized;
}
export function parseInventoryItem(value:unknown){
 const x=input(value,["requestKey","sku","name","category","description","unit","scale","threshold"]);
 const unit=x.unit,scale=x.scale;
 if(typeof unit!=="string"||!["PIECE","KG","LITER"].includes(unit)||typeof scale!=="number"||!Number.isInteger(scale)||scale<0||scale>3||(unit==="PIECE"&&scale!==0))throw new BadRequestException({code:"CG12_UNIT_INVALID"});
 const threshold=parseInventoryThreshold(x.threshold,scale);
 return {requestKey:uuid(x.requestKey),sku:code(x.sku),name:clean(x.name,2,160),category:clean(x.category,1,80),description:clean(x.description??"",0,500),unit,scale,threshold};
}
export function parseInventorySupplier(value:unknown){
 const x=input(value,["requestKey","code","legalName","displayName","category"]);
 return {requestKey:uuid(x.requestKey),code:code(x.code),legalName:clean(x.legalName,2,160),displayName:clean(x.displayName,2,160),category:clean(x.category,1,80)};
}
export function parseInventoryLocation(value:unknown){
 const x=input(value,["requestKey","code","label","branchRef","receiptProofRequired","deliveryProofRequired","adjustmentReviewRequired"]);
 if(["receiptProofRequired","deliveryProofRequired","adjustmentReviewRequired"].some(k=>x[k]!==undefined&&typeof x[k]!=="boolean"))throw new BadRequestException({code:"CG12_CATALOG_INVALID"});
 return {requestKey:uuid(x.requestKey),code:code(x.code),label:clean(x.label,2,160),branchRef:x.branchRef===null?null:uuid(x.branchRef),receiptProofRequired:x.receiptProofRequired as boolean|undefined,deliveryProofRequired:x.deliveryProofRequired as boolean|undefined,adjustmentReviewRequired:x.adjustmentReviewRequired as boolean|undefined};
}
type Kind="ITEM"|"SUPPLIER"|"LOCATION";
type PrivateSupplier={phone:string;email:string;address:string;taxRef:string};
function privateSupplier(v:unknown):PrivateSupplier{
 const x=input(v,["phone","email","address","taxRef"]);
 const phone=clean(x.phone??"",0,20),email=clean(x.email??"",0,254),address=clean(x.address??"",0,500),taxRef=clean(x.taxRef??"",0,40);
 if(phone&&!/^\+?[0-9]{10,15}$/.test(phone)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||taxRef&&!/^[A-Za-z0-9-]+$/.test(taxRef))throw new BadRequestException({code:"CG12_CATALOG_INVALID"});
 return {phone,email,address,taxRef};
}
function supplierKey(){const key=Buffer.from(process.env.CG12_SUPPLIER_ENCRYPTION_KEY??"","base64");if(key.length!==32)throw new ServiceUnavailableException("Protected supplier details unavailable");return key;}
function encryptSupplier(v:PrivateSupplier,realm:string,ref:string,version:number){const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",supplierKey(),nonce);cipher.setAAD(Buffer.from(realm+"|"+ref+"|"+version));const ciphertext=Buffer.concat([cipher.update(JSON.stringify(v),"utf8"),cipher.final()]);return [ciphertext.toString("base64url"),nonce.toString("base64url"),cipher.getAuthTag().toString("base64url")];}
function decryptSupplier(row:{ciphertext:string;nonce:string;tag:string;version:number},realm:string,ref:string){
 try{const cipher=createDecipheriv("aes-256-gcm",supplierKey(),Buffer.from(row.nonce,"base64url"));cipher.setAAD(Buffer.from(realm+"|"+ref+"|"+row.version));cipher.setAuthTag(Buffer.from(row.tag,"base64url"));return privateSupplier(JSON.parse(Buffer.concat([cipher.update(Buffer.from(row.ciphertext,"base64url")),cipher.final()]).toString("utf8")));}catch{throw new ServiceUnavailableException("Protected supplier details unavailable");}
}
const version=(v:unknown,allowZero=false)=>{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<(allowZero?0:1)||v>=2147483647)throw new BadRequestException({code:"CG12_CATALOG_INVALID"});return v;};
const stale=()=>new ConflictException({code:"CG12_STALE"});

@Injectable()
export class InventoryCatalogService {
 constructor(@Inject(DATABASE) private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade){}
 async run<T>(token:string,action:string,work:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>){
  const a=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.assertCurrent(tx,a,action);const result=await work(tx,a);await tx.query("COMMIT");return result;}
  catch(e){await tx.query("ROLLBACK");if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")throw new ConflictException({code:"CG12_DUPLICATE_CODE"});throw e;}finally{tx.release();}
 }
 async rootAdmin(tx:PoolClient,a:VerifiedFoundationActor){
  try{await this.identity.assertCurrent(tx,a,"foundation.branches.admin");return true;}catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async requireScope(tx:PoolClient,a:VerifiedFoundationActor,branch:string|null){
  const full=await this.rootAdmin(tx,a);
  if(branch===null){if(!full)throw new ForbiddenException("Your role cannot manage the Foundation store");return;}
  const q=await tx.query("SELECT id FROM branch WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE' AND ($3::boolean OR manager_account_ref=$4) FOR SHARE",[branch,a.realmId,full,a.accountId]);
  if(!q.rowCount)throw new ForbiddenException("The selected branch is not permitted or active");
 }
 private async command(tx:PoolClient,a:VerifiedFoundationActor,kind:string,key:string,digest:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.realmId+":"+key]);
  const q=await tx.query<{source_ref:string;source_kind:string;actor_ref:string;payload_digest:string;result_version:number}>("SELECT source_ref,source_kind,actor_ref,payload_digest,result_version FROM inventory_audit WHERE root_realm_id=$1 AND event_key=$2",[a.realmId,key]);
  const p=q.rows[0];if(!p)return null;
  if(p.actor_ref!==a.accountId||p.source_kind!==kind||p.payload_digest!==digest)throw new ConflictException({code:"CG12_COMMAND_CHANGED"});
  return {ref:p.source_ref,version:p.result_version,replayed:true};
 }
 private async audit(tx:PoolClient,a:VerifiedFoundationActor,kind:string,ref:string,key:string,digest:string,v:number){
  await tx.query("INSERT INTO inventory_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,a.accountId,kind,ref,key,digest,v]);
  return {ref,version:v,replayed:false};
 }
 async store(tx:PoolClient,a:VerifiedFoundationActor,ref:string,active=true,write=false){
  const row=(await tx.query<{branch_ref:string|null;status:string;version:number;receipt_proof_required:boolean;delivery_proof_required:boolean;adjustment_review_required:boolean}>("SELECT branch_ref,status,version,receipt_proof_required,delivery_proof_required,adjustment_review_required FROM inventory_location WHERE root_realm_id=$1 AND id=$2 "+(write?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref])).rows[0];
  if(!row||(active&&row.status!=="ACTIVE"))throw new NotFoundException("Store unavailable");
  await this.requireScope(tx,a,row.branch_ref);return row;
 }
 async detail(token:string,kind:Kind,refInput:unknown){
  const ref=uuid(refInput);
  return this.run(token,"inventory.catalog.manage",async(tx,a)=>{
   if(kind==="LOCATION")await this.store(tx,a,ref,false);else await this.requireScope(tx,a,null);
   const sql=kind==="ITEM"?"SELECT id AS ref,sku_norm AS sku,name,category,description,unit_code AS unit,qty_scale AS scale,low_stock_threshold::text AS threshold,status,version FROM inventory_item":kind==="SUPPLIER"?"SELECT id AS ref,supplier_code_norm AS code,display_name AS name,legal_name AS \"legalName\",category,status,version FROM inventory_supplier":"SELECT id AS ref,location_code_norm AS code,label AS name,branch_ref AS \"branchRef\",receipt_proof_required AS \"receiptProofRequired\",delivery_proof_required AS \"deliveryProofRequired\",adjustment_review_required AS \"adjustmentReviewRequired\",status,version FROM inventory_location";
   const q=await tx.query(sql+" WHERE root_realm_id=$1 AND id=$2",[a.realmId,ref]);if(!q.rows[0])throw new NotFoundException("Catalog record unavailable");return q.rows[0];
  });
 }
 async update(token:string,kind:Kind,refInput:unknown,raw:unknown){
  const ref=uuid(refInput),v=input(raw,["requestKey","expectedVersion","status","sku","name","category","description","unit","scale","threshold","code","displayName","legalName","label","branchRef","receiptProofRequired","deliveryProofRequired","adjustmentReviewRequired"]);
  const {expectedVersion,status,...body}=v,expected=version(expectedVersion);
  if(typeof status!=="string"||!(kind==="SUPPLIER"?["ACTIVE","BLOCKED"]:["ACTIVE","INACTIVE"]).includes(status))throw new BadRequestException({code:"CG12_CATALOG_INVALID"});
  const parsed=kind==="ITEM"?parseInventoryItem(body):kind==="SUPPLIER"?parseInventorySupplier(body):parseInventoryLocation(body);
  const digest=createHash("sha256").update(JSON.stringify({kind,ref,expected,status,parsed})).digest("hex");
  return this.run(token,"inventory.catalog.manage",async(tx,a)=>{
   const location=kind==="LOCATION"?await this.store(tx,a,ref,false,true):null;if(!location)await this.requireScope(tx,a,null);
   const replay=await this.command(tx,a,kind,parsed.requestKey,digest);if(replay)return replay;
   let q;
   if(kind==="ITEM"){
    const x=parsed as ReturnType<typeof parseInventoryItem>;
    // Canonical unit and precision are immutable once created, so later movements cannot be relabelled.
    q=await tx.query("UPDATE inventory_item SET name=$3,category=$4,description=$5,low_stock_threshold=$6,status=$7,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$8 AND sku_norm=$9 AND unit_code=$10 AND qty_scale=$11 RETURNING version",[a.realmId,ref,x.name,x.category,x.description,x.threshold,status,expected,x.sku,x.unit,x.scale]);
   }else if(kind==="SUPPLIER"){
    const x=parsed as ReturnType<typeof parseInventorySupplier>;
    q=await tx.query("UPDATE inventory_supplier SET legal_name=$3,display_name=$4,category=$5,status=$6,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$7 AND supplier_code_norm=$8 RETURNING version",[a.realmId,ref,x.legalName,x.displayName,x.category,status,expected,x.code]);
   }else{
    const x=parsed as ReturnType<typeof parseInventoryLocation>;
    if(location&&!await this.rootAdmin(tx,a)&&((x.receiptProofRequired!==undefined&&x.receiptProofRequired!==location.receipt_proof_required)||(x.deliveryProofRequired!==undefined&&x.deliveryProofRequired!==location.delivery_proof_required)||(x.adjustmentReviewRequired!==undefined&&x.adjustmentReviewRequired!==location.adjustment_review_required)))throw new ForbiddenException("Only Foundation administration may change warehouse evidence and review policies");
    q=await tx.query("UPDATE inventory_location SET label=$3,status=$4,receipt_proof_required=COALESCE($8::boolean,receipt_proof_required),delivery_proof_required=COALESCE($9::boolean,delivery_proof_required),adjustment_review_required=COALESCE($10::boolean,adjustment_review_required),version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$5 AND location_code_norm=$6 AND branch_ref IS NOT DISTINCT FROM $7::uuid RETURNING version",[a.realmId,ref,x.label,status,expected,x.code,x.branchRef,x.receiptProofRequired??null,x.deliveryProofRequired??null,x.adjustmentReviewRequired??null]);
   }
   if(!q.rows[0])throw stale();return this.audit(tx,a,kind,ref,parsed.requestKey,digest,q.rows[0].version);
  });
 }
 async threshold(token:string,raw:unknown){
  const x=input(raw,["requestKey","itemRef","locationRef","expectedVersion","threshold"]),key=uuid(x.requestKey),item=uuid(x.itemRef),loc=uuid(x.locationRef),expected=version(x.expectedVersion,true),qty=parseInventoryThreshold(x.threshold,3);
  const digest=createHash("sha256").update(JSON.stringify({item,loc,expected,qty})).digest("hex");
  return this.run(token,"inventory.catalog.manage",async(tx,a)=>{
   await this.store(tx,a,loc);
   const replay=await this.command(tx,a,"THRESHOLD",key,digest);if(replay)return replay;
   const r=(await tx.query<{qty_scale:number}>("SELECT qty_scale FROM inventory_item WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,item])).rows[0];
   if(!r)throw new BadRequestException({code:"CG12_QUANTITY_INVALID"});
   parseInventoryThreshold(qty,r.qty_scale);
   const q=expected===0?await tx.query("INSERT INTO inventory_item_location_policy(root_realm_id,item_id,location_id,threshold) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING version",[a.realmId,item,loc,qty]):await tx.query("UPDATE inventory_item_location_policy SET threshold=$4,version=version+1 WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3 AND version=$5 RETURNING version",[a.realmId,item,loc,qty,expected]);
   if(!q.rows[0])throw stale();return this.audit(tx,a,"THRESHOLD",item,key,digest,q.rows[0].version);
  });
 }
 async readSupplierPrivate(token:string,raw:unknown){
  const ref=uuid(raw);return this.run(token,"inventory.supplier.private.manage",async(tx,a)=>{
   await this.requireScope(tx,a,null);
   const s=await tx.query("SELECT 1 FROM inventory_supplier WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,ref]);if(!s.rowCount)throw new NotFoundException("Supplier unavailable");
   const row=(await tx.query<{ciphertext:string;nonce:string;tag:string;version:number}>("SELECT ciphertext,nonce,tag,version FROM inventory_supplier_private WHERE root_realm_id=$1 AND supplier_id=$2",[a.realmId,ref])).rows[0];
   const details=row?decryptSupplier(row,a.realmId,ref):{phone:"",email:"",address:"",taxRef:""};
   if(row)await this.audit(tx,a,"SUPPLIER_PRIVATE_READ",ref,randomUUID(),createHash("sha256").update("private-read|"+ref+"|"+row.version).digest("hex"),row.version);
   return {details,version:row?.version??0};
  });
 }
 async writeSupplierPrivate(token:string,rawRef:unknown,raw:unknown){
  const ref=uuid(rawRef),x=input(raw,["requestKey","expectedVersion","details"]),key=uuid(x.requestKey),expected=version(x.expectedVersion,true),details=privateSupplier(x.details);
  
  return this.run(token,"inventory.supplier.private.manage",async(tx,a)=>{
   await this.requireScope(tx,a,null);
   const s=await tx.query("SELECT 1 FROM inventory_supplier WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,ref]);if(!s.rowCount)throw new NotFoundException("Supplier unavailable");
   const digest=createHmac("sha256",supplierKey()).update(JSON.stringify({ref,expected,details})).digest("hex");
   const replay=await this.command(tx,a,"SUPPLIER_PRIVATE",key,digest);if(replay)return replay;
   const v=expected+1,[ciphertext,nonce,tag]=encryptSupplier(details,a.realmId,ref,v);
   const q=expected===0?await tx.query("INSERT INTO inventory_supplier_private(root_realm_id,supplier_id,ciphertext,nonce,tag,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING version",[a.realmId,ref,ciphertext,nonce,tag,v]):await tx.query("UPDATE inventory_supplier_private SET ciphertext=$3,nonce=$4,tag=$5,version=$6 WHERE root_realm_id=$1 AND supplier_id=$2 AND version=$7 RETURNING version",[a.realmId,ref,ciphertext,nonce,tag,v,expected]);
   if(!q.rows[0])throw stale();return this.audit(tx,a,"SUPPLIER_PRIVATE",ref,key,digest,v);
  });
 }
 async options(token:string){
  return this.run(token,"inventory.catalog.view",async(tx,a)=>{
   const full=await this.rootAdmin(tx,a);
   const branches=await tx.query<{id:string;name:string}>("SELECT id,name FROM branch WHERE root_realm_id=$1 AND status='ACTIVE' AND ($2::boolean OR manager_account_ref=$3) ORDER BY name,id LIMIT 100",[a.realmId,full,a.accountId]);
   const stores=await tx.query<{id:string;label:string;location_code_norm:string;scope_kind:string}>("SELECT l.id,l.label,l.location_code_norm,l.scope_kind FROM inventory_location l LEFT JOIN branch b ON b.id=l.branch_ref AND b.root_realm_id=l.root_realm_id WHERE l.root_realm_id=$1 AND l.status='ACTIVE' AND (l.scope_kind='FOUNDATION' AND $2::boolean OR l.scope_kind='BRANCH' AND b.status='ACTIVE' AND ($2::boolean OR b.manager_account_ref=$3)) ORDER BY l.label,l.id LIMIT 100",[a.realmId,full,a.accountId]);
   // Shared Foundation catalog is readable only when root-admin or at least one eligible warehouse is present.
   const permitted=full||stores.rows.length>0;
   const locationRows=await tx.query<{id:string;label:string;location_code_norm:string;scope_kind:string;status:string}>("SELECT l.id,l.label,l.location_code_norm,l.scope_kind,l.status FROM inventory_location l LEFT JOIN branch b ON b.id=l.branch_ref AND b.root_realm_id=l.root_realm_id WHERE l.root_realm_id=$1 AND (l.scope_kind='FOUNDATION' AND $2::boolean OR l.scope_kind='BRANCH' AND b.status='ACTIVE' AND ($2::boolean OR b.manager_account_ref=$3)) ORDER BY l.label,l.id LIMIT 100",[a.realmId,full,a.accountId]);
   const totals=permitted?await tx.query<{items:number;suppliers:number;warehouses:number}>(`
    SELECT (SELECT COUNT(*)::integer FROM inventory_item WHERE root_realm_id=$1) AS items,
     (SELECT COUNT(*)::integer FROM inventory_supplier WHERE root_realm_id=$1) AS suppliers,
     (SELECT COUNT(*)::integer FROM inventory_location l LEFT JOIN branch b ON b.id=l.branch_ref AND b.root_realm_id=l.root_realm_id
      WHERE l.root_realm_id=$1 AND l.status='ACTIVE' AND (l.scope_kind='FOUNDATION' AND $2::boolean OR l.scope_kind='BRANCH' AND b.status='ACTIVE' AND ($2::boolean OR b.manager_account_ref=$3))) AS warehouses`,[a.realmId,full,a.accountId]):null;
   const categories=permitted?await tx.query<{label:string;count:number}>("SELECT category AS label,COUNT(*)::integer AS count FROM inventory_item WHERE root_realm_id=$1 GROUP BY category ORDER BY COUNT(*) DESC,category LIMIT 10",[a.realmId]):null;
   return {canManageFoundation:full,branches:branches.rows.map(x=>({ref:x.id,label:x.name})),stores:stores.rows.map(x=>({ref:x.id,label:x.label,code:x.location_code_norm,scope:x.scope_kind})),locations:locationRows.rows.map(x=>({ref:x.id,label:x.label,code:x.location_code_norm,scope:x.scope_kind,status:x.status})),summary:totals?.rows[0]??null,categories:categories?.rows??[]};
  });
 }
 async list(token:string,kind:Kind,locationInput:unknown,searchInput:unknown,offsetInput:unknown,statusInput?:unknown){
  const offset=Number(offsetInput??0),search=clean(searchInput??"",0,80).toLowerCase(),status=statusInput??"ALL";
  if(typeof status!=="string"||!(kind==="ITEM"?["ALL","ACTIVE","INACTIVE"]:["ALL","ACTIVE","BLOCKED"]).includes(status))throw new BadRequestException({code:"CG12_CATALOG_INVALID"});
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
    const q=await tx.query("SELECT i.id AS ref,i.sku_norm AS sku,i.name,i.category,i.description,i.unit_code AS unit,i.qty_scale AS scale,i.low_stock_threshold::text AS threshold,i.status,i.version,COALESCE(p.threshold,i.low_stock_threshold)::text AS \"storeThreshold\",COALESCE(p.version,0) AS \"thresholdVersion\", COALESCE(sb.on_hand_qty,0)::text AS \"onHand\",COALESCE(sb.reserved_qty,0)::text AS reserved,(COALESCE(sb.on_hand_qty,0)-COALESCE(sb.reserved_qty,0))::text AS available FROM inventory_item i LEFT JOIN stock_balance sb ON sb.root_realm_id=i.root_realm_id AND sb.item_id=i.id AND sb.location_id=$4::uuid LEFT JOIN inventory_item_location_policy p ON p.root_realm_id=i.root_realm_id AND p.item_id=i.id AND p.location_id=$4::uuid WHERE i.root_realm_id=$1 AND ($2='' OR strpos(lower(i.name),$2)>0 OR strpos(lower(i.sku_norm),$2)>0 OR strpos(lower(i.category),$2)>0) AND ($5='ALL' OR i.status=$5) ORDER BY i.name,i.id LIMIT 26 OFFSET $3",[a.realmId,search,offset,locationInput||null,status]);
    return {items:q.rows.slice(0,25),hasMore:q.rows.length>25,offset};
   }
   const q=await tx.query("SELECT id AS ref,supplier_code_norm AS code,display_name AS name,category,status,version FROM inventory_supplier WHERE root_realm_id=$1 AND ($2='' OR strpos(lower(display_name),$2)>0 OR strpos(lower(supplier_code_norm),$2)>0 OR strpos(lower(category),$2)>0) AND ($4='ALL' OR status=$4) ORDER BY display_name,id LIMIT 26 OFFSET $3",[a.realmId,search,offset,status]);
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
    if(!await this.rootAdmin(tx,a)&&(x.receiptProofRequired===true||x.deliveryProofRequired===true||x.adjustmentReviewRequired===false))throw new ForbiddenException("Only Foundation administration may change warehouse evidence and review policies");
    row=(await tx.query<{id:string;version:number}>("INSERT INTO inventory_location(root_realm_id,location_code_norm,label,branch_ref,scope_kind,receipt_proof_required,delivery_proof_required,adjustment_review_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version",[a.realmId,x.code,x.label,x.branchRef,x.branchRef?"BRANCH":"FOUNDATION",x.receiptProofRequired??false,x.deliveryProofRequired??false,x.adjustmentReviewRequired??true])).rows[0];
   }
   await tx.query("INSERT INTO inventory_audit(root_realm_id,actor_ref,source_kind,source_ref,event_key,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,a.accountId,kind,row.id,parsed.requestKey,digest,row.version]);
   return {ref:row.id,version:row.version,replayed:false};
  });
 }
}
