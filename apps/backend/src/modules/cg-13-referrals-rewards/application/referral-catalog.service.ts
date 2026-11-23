import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryCatalogService} from "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {eligiblePublishedRewardImageRefs} from "../../cg-19-documents-notifications/application/cms-draft-media.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY=/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,6})?$/;
const bad=(field:string)=>new BadRequestException({code:"CG13_INVALID_INPUT",field});
const CATALOG_PAGE_SIZE=40;
export const catalogPage=(value:unknown):number=>{
 if(value===undefined||value===null||value==="")return 1;
 if(typeof value!=="string"||!(/^[1-9][0-9]{0,3}$/).test(value))throw bad("page");
 return Number(value);
};
const ref=(v:unknown,field="ref"):string=>{
 if(typeof v!=="string"||!UUID.test(v))throw bad(field);return v.toLowerCase();
};
const word=(v:unknown,field:string,min=2,max=160):string=>{
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>max||
  /[\u0000-\u001f\u007f]/.test(v))throw bad(field);
 return v.trim();
};
const optional=(v:unknown,field:string,max=350):string=>{
 if(v===undefined||v===null)return "";
 if(typeof v!=="string"||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw bad(field);
 return v.trim();
};
const integer=(v:unknown,field:string,min=0,max=1000000000000):number=>{
 if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw bad(field);
 return Number(v);
};
const fields=(raw:unknown,allowed:string[]):Record<string,unknown>=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).some(k=>!allowed.includes(k)))throw bad("request");
 return raw as Record<string,unknown>;
};
const choice=<T extends string>(v:unknown,field:string,allowed:readonly T[]):T=>{
 if(typeof v!=="string"||!allowed.includes(v as T))throw bad(field);return v as T;
};
const digest=(data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
const ratio=(v:unknown):string|null=>{
 if(v===undefined||v===null||v==="")return null;
 if(typeof v!=="string"||!MONEY.test(v)||Number(v)<=0||Number(v)>1000000000)
  throw bad("displayInrRatio");
 return v;
};
const bool=(v:unknown,field:string,defaultValue=false):boolean=>{
 if(v===undefined)return defaultValue;
 if(typeof v!=="boolean")throw bad(field);
 return v;
};
const day=(v:unknown):string=>{
 if(typeof v!=="string"||!(/^\d{4}-\d{2}-\d{2}$/).test(v))throw bad("effectiveFrom");
 const dt=new Date(v+"T00:00:00+05:30");
 if(Number.isNaN(dt.valueOf())||new Date(dt.getTime()+19800000).toISOString().slice(0,10)!==v)
  throw bad("effectiveFrom");
 return dt.toISOString();
};
/** Only a current CG19 source-backed published photo may be used. The
 * public URL belongs to CareGanga Web, never an arbitrary external host.
 * Query-time CG19 checks below and CG19 publicBytes validate publication,
 * consent/rights, scan, exact MIME, file size and SHA-256 independently.
 */
const publicMediaOrigin=():string=>{
 const configured=process.env.CG13_PUBLIC_MEDIA_ORIGIN??"";
 try{
  const parsed=new URL(configured);
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||
     parsed.search||parsed.hash||parsed.port||parsed.pathname!=="/"||
     !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(parsed.hostname)||
     parsed.hostname.endsWith(".local")||parsed.hostname.endsWith(".internal"))
   throw Error("invalid origin");
  return parsed.origin;
 }catch{throw bad("imageUrl");}
};
export const imageUrl=(v:unknown):string|null=>{
 if(v===null||v===undefined||v==="")return null;
 if(typeof v!=="string"||v.length>500)throw bad("imageUrl");
 try{
  const parsed=new URL(v);
  if(parsed.origin!==publicMediaOrigin()||parsed.search||parsed.hash||
     parsed.username||parsed.password||parsed.port||
     !/^\/api\/public\/content\/media\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parsed.pathname))
   throw Error("invalid published source");
  return parsed.href;
 }catch{throw bad("imageUrl");}
};
/** Published file identity is all the CG13 domain needs; CG19 owns proof. */
export const rewardImageFileRef=(v:string|null):string|null=>
 v?v.slice(v.lastIndexOf("/")+1).toLowerCase():null;
export const safePublicRewardImage=(v:unknown):string|null=>{
 try{return imageUrl(v);}catch{return null;}
};
type Rank={name:string;verifiedReferrals:number;minimumPoints:number;benefitsSummary:string};
const ranks=(v:unknown):Rank[]=>{
 if(!Array.isArray(v)||v.length<1||v.length>30)throw bad("ranks");
 const names=new Set<string>();
 let prevRef=-1,prevPoints=-1;
 return v.map((r,i)=>{
  const obj=fields(r,["name","verifiedReferrals","minimumPoints","benefitsSummary"]);
  const name=word(obj.name,"ranks["+i+"].name",2,70),
   verifiedReferrals=integer(obj.verifiedReferrals,"verifiedReferrals",0,1000000),
   minimumPoints=integer(obj.minimumPoints,"minimumPoints",0,1000000000000);
  if(names.has(name.toLowerCase())||verifiedReferrals<=prevRef||minimumPoints<prevPoints||
   (i===0&&(verifiedReferrals!==0||minimumPoints!==0)))
   throw bad("ranks");
  names.add(name.toLowerCase());prevRef=verifiedReferrals;prevPoints=minimumPoints;
  return {name,verifiedReferrals,minimumPoints,
   benefitsSummary:optional(obj.benefitsSummary,"benefitsSummary")};
 });
};
type Policy={name:string;audience:"MEMBER"|"VOLUNTEER"|"BOTH";
 effectiveFrom:string;qualifyingEvent:"MEMBERSHIP_ACTIVATED_VERIFIED"|"VOLUNTEER_APPROVED_ACTIVE";
 awardPoints:number;minimumClaimPoints:number;displayInrRatio:string|null;
 autoRankUpgrade:boolean;configuredRanks:Rank[]};
const policy=(o:Record<string,unknown>):Policy=>{
 const audience=choice(o.audience,"audience",["MEMBER","VOLUNTEER","BOTH"] as const),
  qualifyingEvent=choice(o.qualifyingEvent,"qualifyingEvent",
   ["MEMBERSHIP_ACTIVATED_VERIFIED","VOLUNTEER_APPROVED_ACTIVE"] as const);
 if(audience==="MEMBER"&&qualifyingEvent!=="MEMBERSHIP_ACTIVATED_VERIFIED"||
    audience==="VOLUNTEER"&&qualifyingEvent!=="VOLUNTEER_APPROVED_ACTIVE")
  throw bad("qualifyingEvent");
 return {name:word(o.name,"name",3,120),audience,
  effectiveFrom:day(o.effectiveFrom),qualifyingEvent,
  awardPoints:integer(o.awardPoints,"awardPoints",1,1000000000),
  minimumClaimPoints:integer(o.minimumClaimPoints,"minimumClaimPoints",0,1000000000),
  displayInrRatio:ratio(o.displayInrRatio),autoRankUpgrade:bool(o.autoRankUpgrade,"autoRankUpgrade",true),
  configuredRanks:ranks(o.ranks)};
};
type Product={
 programmeRef:string;type:"DIGITAL"|"PHYSICAL";category:string;name:string;
 description:string;pointsPrice:number;eligibleAudience:"MEMBER"|"VOLUNTEER"|"BOTH";
 status:"DRAFT"|"ACTIVE"|"ARCHIVED";highlighted:boolean;publicVisible:boolean;
 approvedImageUrl:string|null;itemRef:string|null;storeRef:string|null;
 digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF"|"ON_PLATFORM_RECOGNITION";
};
const product=(o:Record<string,unknown>):Product=>{
 const type=choice(o.type,"type",["DIGITAL","PHYSICAL"] as const),
  itemRef=o.itemRef===null||o.itemRef===undefined?null:ref(o.itemRef,"itemRef"),
  storeRef=o.storeRef===null||o.storeRef===undefined?null:ref(o.storeRef,"storeRef");
 if((type==="DIGITAL"&&(itemRef||storeRef))||
  (type==="PHYSICAL"&&(!itemRef||!storeRef)))throw bad("physicalStock");
 return {programmeRef:ref(o.programmeRef,"programmeRef"),type,
  category:word(o.category,"category",2,80),name:word(o.name,"name",3,160),
  description:optional(o.description,"description",1000),
  pointsPrice:integer(o.pointsPrice,"pointsPrice",1,1000000000000),
  eligibleAudience:choice(o.eligibleAudience,"eligibleAudience",["MEMBER","VOLUNTEER","BOTH"] as const),
  status:choice(o.status??"DRAFT","status",["DRAFT","ACTIVE","ARCHIVED"] as const),
  highlighted:bool(o.highlighted,"highlighted"),publicVisible:bool(o.publicVisible,"publicVisible",true),
  approvedImageUrl:imageUrl(o.imageUrl),itemRef,storeRef,
  digitalFulfillmentMethod:type==="PHYSICAL"?"PENDING_EXTERNAL_PROOF":
   choice(o.digitalFulfillmentMethod??"PENDING_EXTERNAL_PROOF","digitalFulfillmentMethod",
    ["PENDING_EXTERNAL_PROOF","ON_PLATFORM_RECOGNITION"] as const)};
};
type ProgramRow={id:string;version:number;active_policy_version:number;
 effective_from:string;audience:string;status:string};
@Injectable()
export class ReferralCatalogService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly inventory:InventoryCatalogService){}
 private async run<T>(bearer:string,action:string,
  fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>,read=false){
  const a=await this.sessions.requireAction(bearer,action),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,a,action);
   const result=await fn(tx,a);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   const err=e as {code?:string};
   if(err?.code==="23505")throw new ConflictException({code:"CG13_SOURCE_ALREADY_EXISTS"});
   if(err?.code==="23503"||err?.code==="23514"||err?.code==="P0001")
    throw new ConflictException({code:"CG13_CURRENT_SOURCE_UNAVAILABLE"});
   throw e;
  }finally{tx.release();}
 }
 /** Keep catalog roles independent of unrelated branch-administration grants.
  * run() already checks the exact CG13 action in-session and again in this TX.
  * Catalog records are Foundation-root scoped; CG12 enforces store/branch grants.
  */
 private root(tx:PoolClient,a:VerifiedFoundationActor){
  return this.identity.assertRootSelfSessionCurrent(tx,a);
 }
 private async command(tx:PoolClient,a:VerifiedFoundationActor,
  key:string,kind:string,data:unknown):Promise<{ref:string;version:number;replayed:true}|null>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["CG13:"+a.realmId+":"+key]);
  const d=digest([kind,data]),prior=await tx.query<{
   actor_ref:string;command_kind:string;source_ref:string;result_version:number;
   payload_digest:string}>(
   "SELECT actor_ref,command_kind,source_ref,result_version,payload_digest "+
   "FROM referral_catalog_command WHERE root_realm_id=$1 AND request_key=$2",
   [a.realmId,key]);
  const row=prior.rows[0];
  if(!row)return null;
  if(row.actor_ref!==a.accountId||row.command_kind!==kind||row.payload_digest!==d)
   throw new ConflictException({code:"CG13_REQUEST_KEY_CONFLICT"});
  return {ref:row.source_ref,version:row.result_version,replayed:true};
 }
 private audit(tx:PoolClient,a:VerifiedFoundationActor,key:string,kind:string,
  data:unknown,refId:string,version:number){
  return tx.query(
   "INSERT INTO referral_catalog_command(root_realm_id,actor_ref,request_key,"+
   "command_kind,source_ref,result_version,payload_digest) VALUES($1,$2,$3,$4,$5,$6,$7)",
   [a.realmId,a.accountId,key,kind,refId,version,digest([kind,data])]);
 }
 private async addPolicy(tx:PoolClient,a:VerifiedFoundationActor,
  programId:string,version:number,p:Policy){
  await tx.query(
   "INSERT INTO referral_policy_version(root_realm_id,programme_id,version_no,"+
   "effective_from,qualifying_event,award_points,minimum_claim_points,"+
   "points_to_inr_display_ratio,auto_rank_upgrade,points_expiry_enabled,created_by) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10)",
   [a.realmId,programId,version,p.effectiveFrom,p.qualifyingEvent,p.awardPoints,
    p.minimumClaimPoints,p.displayInrRatio,p.autoRankUpgrade,a.accountId]);
  for(const [i,rank] of p.configuredRanks.entries())
   await tx.query(
    "INSERT INTO referral_rank_rule(root_realm_id,programme_id,policy_version,"+
    "sort_order,rank_name,minimum_verified_referrals,minimum_eligible_points,benefits_summary) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [a.realmId,programId,version,i+1,rank.name,rank.verifiedReferrals,
     rank.minimumPoints,rank.benefitsSummary]);
 }
 async createProgramme(bearer:string,raw:unknown){
  const o=fields(raw,["requestKey","programmeCode","name","audience","effectiveFrom",
   "qualifyingEvent","awardPoints","minimumClaimPoints","displayInrRatio","autoRankUpgrade","ranks"]),
   key=ref(o.requestKey,"requestKey"),p=policy(o),code=word(o.programmeCode,"programmeCode",3,40).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code))throw bad("programmeCode");
  const data={code,...p};
  return this.run(bearer,"referrals.programmes.manage",async(tx,a)=>{
   await this.root(tx,a);
   const prior=await this.command(tx,a,key,"PROGRAMME_CREATE",data);
   if(prior)return prior;
   const q=await tx.query<{id:string}>(
    "INSERT INTO referral_program(root_realm_id,programme_code,display_name,audience,"+
    "active_policy_version,status,created_by,updated_by) "+
    "VALUES($1,$2,$3,$4,1,'ACTIVE',$5,$5) RETURNING id",
    [a.realmId,code,p.name,p.audience,a.accountId]);
   const id=q.rows[0].id;
   await this.addPolicy(tx,a,id,1,p);
   await this.audit(tx,a,key,"PROGRAMME_CREATE",data,id,1);
   return {ref:id,version:1,replayed:false};
  });
 }
 async reviseProgramme(bearer:string,programInput:string,raw:unknown){
  const refId=ref(programInput),o=fields(raw,["requestKey","expectedVersion","name",
   "audience","effectiveFrom","qualifyingEvent","awardPoints","minimumClaimPoints",
   "displayInrRatio","autoRankUpgrade","ranks"]),
   key=ref(o.requestKey,"requestKey"),expected=integer(o.expectedVersion,"expectedVersion",1,2147483600),
   p=policy(o),data={refId,expected,...p};
  return this.run(bearer,"referrals.programmes.manage",async(tx,a)=>{
   await this.root(tx,a);
   const replay=await this.command(tx,a,key,"PROGRAMME_POLICY",data);
   if(replay)return replay;
   const q=await tx.query<ProgramRow>(
    "SELECT p.id,p.version,p.active_policy_version,p.audience,p.status,"+
    "v.effective_from::text FROM referral_program p "+
    "JOIN referral_policy_version v ON v.root_realm_id=p.root_realm_id "+
    "AND v.programme_id=p.id AND v.version_no=p.active_policy_version "+
    "WHERE p.root_realm_id=$1 AND p.id=$2 FOR UPDATE OF p",
    [a.realmId,refId]);
   const original=q.rows[0];
   if(!original)throw new NotFoundException("Programme unavailable");
   if(original.version!==expected||original.status!=="ACTIVE"||
    new Date(p.effectiveFrom)<new Date(original.effective_from))
    throw new ConflictException({code:"CG13_POLICY_STALE"});
   const nextPolicy=original.active_policy_version+1;
   await this.addPolicy(tx,a,refId,nextPolicy,p);
   const updated=await tx.query(
    "UPDATE referral_program SET display_name=$3,audience=$4,"+
    "active_policy_version=$5,version=version+1,updated_by=$6,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND version=$7",
    [a.realmId,refId,p.name,p.audience,nextPolicy,a.accountId,expected]);
   if(updated.rowCount!==1)throw new ConflictException({code:"CG13_POLICY_STALE"});
   await this.audit(tx,a,key,"PROGRAMME_POLICY",data,refId,expected+1);
   return {ref:refId,version:expected+1,replayed:false};
  });
 }
 async changeProgrammeStatus(bearer:string,programInput:string,raw:unknown){
  const refId=ref(programInput),o=fields(raw,["requestKey","expectedVersion","status"]),
   key=ref(o.requestKey,"requestKey"),expected=integer(o.expectedVersion,"expectedVersion",1,2147483600),
   status=choice(o.status,"status",["ACTIVE","INACTIVE"] as const),
   data={refId,expected,status};
  return this.run(bearer,"referrals.programmes.manage",async(tx,a)=>{
   await this.root(tx,a);
   const replay=await this.command(tx,a,key,"PROGRAMME_STATUS",data);
   if(replay)return replay;
   const changed=await tx.query(
    "UPDATE referral_program SET status=$3,version=version+1,updated_by=$4,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND version=$5 RETURNING id",
    [a.realmId,refId,status,a.accountId,expected]);
   if(!changed.rowCount)throw new ConflictException({code:"CG13_PROGRAMME_STALE"});
   await this.audit(tx,a,key,"PROGRAMME_STATUS",data,refId,expected+1);
   return {ref:refId,version:expected+1,replayed:false};
  });
 }
 /** Accept only a same-root published, currently rights-cleared CG19 image.
  * This SELECT uses the caller's transaction and CG19's own publication proof.
  */
 private async requireApprovedImage(tx:PoolClient,a:VerifiedFoundationActor,
  url:string|null):Promise<void>{
  if(!url)return;
  const ref=rewardImageFileRef(url);
  const verified=await eligiblePublishedRewardImageRefs(tx,a.realmId,ref?[ref]:[]);
  if(!ref||!verified.has(ref))
   throw new ConflictException({code:"CG13_MEDIA_UNAVAILABLE"});
 }
 /** Hide withdrawn/unpublished photos before exposing a catalogue page.
  * The CG19 same-origin public bytes endpoint rechecks proof upon image fetch.
  */
 private async approvedPageImages<T extends {imageUrl:unknown}>(
  tx:PoolClient,a:VerifiedFoundationActor,rows:T[]):Promise<(T&{imageUrl:string|null})[]>{
  const checked=rows.map(row=>safePublicRewardImage(row.imageUrl));
  const refs=checked.map(rewardImageFileRef).filter((x):x is string=>!!x);
  const allowed=await eligiblePublishedRewardImageRefs(tx,a.realmId,[...new Set(refs)]);
  return rows.map((row,i)=>{
   const ref=rewardImageFileRef(checked[i]);
   return {...row,imageUrl:ref&&allowed.has(ref)?checked[i]:null};
  });
 }
 private async stockSource(tx:PoolClient,a:VerifiedFoundationActor,p:Product){
  if(p.type!=="PHYSICAL"||p.status==="ARCHIVED")return null;
  await this.identity.assertCurrent(tx,a,"inventory.catalog.view");
  // Original CG12 owner checks live store, location branch and current staff scope.
  await this.inventory.store(tx,a,p.storeRef!,true,false);
  const item=await tx.query<{name:string;unit_code:string}>(
   "SELECT name,unit_code FROM inventory_item WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='ACTIVE' AND unit_code='PIECE' AND qty_scale=0 FOR SHARE",
   [a.realmId,p.itemRef]);
  if(!item.rows[0])throw new ConflictException({code:"CG13_PHYSICAL_ITEM_UNAVAILABLE"});
  const stock=await tx.query<{available:string;onHand:string;reserved:string}>(
   "SELECT GREATEST(on_hand_qty-reserved_qty,0)::text AS available,"+
   "on_hand_qty::text AS \"onHand\",reserved_qty::text AS reserved "+
   "FROM stock_balance WHERE root_realm_id=$1 AND item_id=$2 AND location_id=$3",
   [a.realmId,p.itemRef,p.storeRef]);
  return {label:item.rows[0].name,available:stock.rows[0]?.available??"0",
   onHand:stock.rows[0]?.onHand??"0",reserved:stock.rows[0]?.reserved??"0"};
 }
 private async program(tx:PoolClient,a:VerifiedFoundationActor,id:string,lock=false){
  const q=await tx.query<{id:string;status:string;audience:string;active_policy_version:number}>(
   "SELECT id,status,audience,active_policy_version FROM referral_program "+
   "WHERE root_realm_id=$1 AND id=$2 "+(lock?"FOR UPDATE":"FOR SHARE"),
   [a.realmId,id]);
  if(!q.rows[0])throw new NotFoundException("Programme unavailable");
  return q.rows[0];
 }
 async createProduct(bearer:string,raw:unknown){
  const o=fields(raw,["requestKey","programmeRef","type","category","name",
   "description","pointsPrice","eligibleAudience","status","highlighted",
   "publicVisible","imageUrl","itemRef","storeRef","digitalFulfillmentMethod"]);
  const key=ref(o.requestKey,"requestKey"),p=product(o);
  return this.run(bearer,"rewards.catalog.manage",async(tx,a)=>{
   await this.root(tx,a);
   const prior=await this.command(tx,a,key,"PRODUCT_CREATE",p);
   if(prior)return prior;
   const source=await this.program(tx,a,p.programmeRef);
   if(source.status!=="ACTIVE")throw new ConflictException({code:"CG13_PROGRAMME_INACTIVE"});
   if(source.audience!=="BOTH"&&p.eligibleAudience!=="BOTH"&&
      source.audience!==p.eligibleAudience)throw bad("eligibleAudience");
   if(source.audience!=="BOTH"&&p.eligibleAudience==="BOTH")throw bad("eligibleAudience");
   await this.stockSource(tx,a,p);
   await this.requireApprovedImage(tx,a,p.approvedImageUrl);
   const x=await tx.query<{id:string}>(
    "INSERT INTO reward_product(root_realm_id,programme_id,product_type,category,name,"+
    "description,points_price,eligible_audience,status,highlighted,public_visible,"+
    "approved_image_url,cg12_item_ref,cg12_location_ref,created_by,updated_by,"+
    "digital_fulfillment_method) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16) RETURNING id",
    [a.realmId,p.programmeRef,p.type,p.category,p.name,p.description,p.pointsPrice,
     p.eligibleAudience,p.status,p.highlighted,p.publicVisible,p.approvedImageUrl,
     p.itemRef,p.storeRef,a.accountId,p.digitalFulfillmentMethod]);
   const id=x.rows[0].id;
   await this.saveProductRevision(tx,a,id,1,p);
   await this.audit(tx,a,key,"PRODUCT_CREATE",p,id,1);
   return {ref:id,version:1,replayed:false};
  });
 }
 private async saveProductRevision(tx:PoolClient,a:VerifiedFoundationActor,
  id:string,revision:number,p:Product){
  await tx.query(
   "INSERT INTO reward_product_revision(root_realm_id,product_id,revision,"+
   "product_type,name,category,description,points_price,eligible_audience,status,"+
   "highlighted,public_visible,approved_image_url,cg12_item_ref,cg12_location_ref,changed_by,"+
    "digital_fulfillment_method) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
   [a.realmId,id,revision,p.type,p.name,p.category,p.description,p.pointsPrice,
    p.eligibleAudience,p.status,p.highlighted,p.publicVisible,p.approvedImageUrl,
    p.itemRef,p.storeRef,a.accountId,p.digitalFulfillmentMethod]);
 }
 async reviseProduct(bearer:string,productInput:string,raw:unknown){
  const productRef=ref(productInput),o=fields(raw,["requestKey","expectedVersion",
   "programmeRef","type","category","name","description","pointsPrice",
   "eligibleAudience","status","highlighted","publicVisible","imageUrl","itemRef","storeRef",
    "digitalFulfillmentMethod"]);
  const key=ref(o.requestKey,"requestKey"),expected=integer(o.expectedVersion,"expectedVersion",1,2147483600),
   p=product(o),data={productRef,expected,p};
  return this.run(bearer,"rewards.catalog.manage",async(tx,a)=>{
   await this.root(tx,a);
   const replay=await this.command(tx,a,key,"PRODUCT_EDIT",data);
   if(replay)return replay;
   const old=await tx.query<{version:number;programme_id:string}>(
    "SELECT version,programme_id FROM reward_product WHERE root_realm_id=$1 "+
    "AND id=$2 FOR UPDATE",[a.realmId,productRef]);
   if(!old.rows[0])throw new NotFoundException("Reward product unavailable");
   if(old.rows[0].version!==expected||old.rows[0].programme_id!==p.programmeRef)
    throw new ConflictException({code:"CG13_PRODUCT_STALE"});
   const source=await this.program(tx,a,p.programmeRef);
   if(source.status!=="ACTIVE"&&p.status==="ACTIVE")
    throw new ConflictException({code:"CG13_PROGRAMME_INACTIVE"});
   if(source.audience!=="BOTH"&&p.eligibleAudience!==source.audience)
    throw bad("eligibleAudience");
   await this.stockSource(tx,a,p);
   await this.requireApprovedImage(tx,a,p.approvedImageUrl);
   const changed=await tx.query(
    "UPDATE reward_product SET product_type=$3,category=$4,name=$5,description=$6,"+
    "points_price=$7,eligible_audience=$8,status=$9,highlighted=$10,public_visible=$11,"+
    "approved_image_url=$12,cg12_item_ref=$13,cg12_location_ref=$14,"+
    "version=version+1,updated_by=$15,updated_at=now(),"+
     "digital_fulfillment_method=$17 "+
    "WHERE root_realm_id=$1 AND id=$2 AND version=$16 RETURNING id",
    [a.realmId,productRef,p.type,p.category,p.name,p.description,p.pointsPrice,
     p.eligibleAudience,p.status,p.highlighted,p.publicVisible,p.approvedImageUrl,
     p.itemRef,p.storeRef,a.accountId,expected,p.digitalFulfillmentMethod]);
   if(changed.rowCount!==1)throw new ConflictException({code:"CG13_PRODUCT_STALE"});
   await this.saveProductRevision(tx,a,productRef,expected+1,p);
   await this.audit(tx,a,key,"PRODUCT_EDIT",data,productRef,expected+1);
   return {ref:productRef,version:expected+1,replayed:false};
  });
 }
 async listProgrammes(bearer:string,pageInput?:string){
  const page=catalogPage(pageInput);
  return this.run(bearer,"referrals.programmes.view",async(tx,a)=>{
   await this.root(tx,a);
   const q=await tx.query(
    "SELECT p.id AS ref,p.programme_code AS code,p.display_name AS name,p.audience,p.status,"+
    "p.version,p.active_policy_version AS \"policyVersion\",v.award_points::text AS \"awardPoints\","+
    "v.minimum_claim_points::text AS \"minimumClaimPoints\",to_char(v.effective_from AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS \"effectiveFrom\","+
    "v.qualifying_event AS \"qualifyingEvent\",v.points_to_inr_display_ratio::text AS \"displayInrRatio\","+
    "v.auto_rank_upgrade AS \"autoRankUpgrade\" "+
    "FROM referral_program p JOIN referral_policy_version v ON v.root_realm_id=p.root_realm_id "+
    "AND v.programme_id=p.id AND v.version_no=p.active_policy_version "+
    "WHERE p.root_realm_id=$1 ORDER BY p.display_name,p.id LIMIT $2 OFFSET $3",
    [a.realmId,CATALOG_PAGE_SIZE+1,(page-1)*CATALOG_PAGE_SIZE]);
   return {items:q.rows.slice(0,CATALOG_PAGE_SIZE),hasMore:q.rows.length>CATALOG_PAGE_SIZE,page};
  },true);
 }
 /** A catalogue-only role may select programmes without seeing policy settings. */
 async catalogueProgrammes(bearer:string,pageInput?:string){
  const page=catalogPage(pageInput);
  return this.run(bearer,"rewards.catalog.view",async(tx,a)=>{
   await this.root(tx,a);
   const q=await tx.query(
    "SELECT id AS ref,display_name AS name,status FROM referral_program "+
    "WHERE root_realm_id=$1 ORDER BY display_name,id LIMIT $2 OFFSET $3",
    [a.realmId,CATALOG_PAGE_SIZE+1,(page-1)*CATALOG_PAGE_SIZE]);
   return {items:q.rows.slice(0,CATALOG_PAGE_SIZE),
    hasMore:q.rows.length>CATALOG_PAGE_SIZE,page};
  },true);
 }
 async programmeDetail(bearer:string,programInput:string){
  const id=ref(programInput);
  return this.run(bearer,"referrals.programmes.view",async(tx,a)=>{
   await this.root(tx,a);
   const q=await tx.query(
    "SELECT p.id AS ref,p.programme_code AS code,p.display_name AS name,p.audience,p.status,p.version,"+
    "p.active_policy_version AS \"policyVersion\",to_char(v.effective_from AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS \"effectiveFrom\","+
    "v.qualifying_event AS \"qualifyingEvent\",v.award_points::text AS \"awardPoints\","+
    "v.minimum_claim_points::text AS \"minimumClaimPoints\","+
    "v.points_to_inr_display_ratio::text AS \"displayInrRatio\","+
    "v.auto_rank_upgrade AS \"autoRankUpgrade\" "+
    "FROM referral_program p JOIN referral_policy_version v ON v.root_realm_id=p.root_realm_id "+
    "AND v.programme_id=p.id AND v.version_no=p.active_policy_version "+
    "WHERE p.root_realm_id=$1 AND p.id=$2",[a.realmId,id]);
   if(!q.rows[0])throw new NotFoundException("Programme unavailable");
   const tiers=await tx.query(
    "SELECT rank_name AS name,minimum_verified_referrals AS \"verifiedReferrals\","+
    "minimum_eligible_points::text AS \"minimumPoints\","+
    "benefits_summary AS \"benefitsSummary\",sort_order AS \"sortOrder\" "+
    "FROM referral_rank_rule WHERE root_realm_id=$1 AND programme_id=$2 "+
    "AND policy_version=$3 ORDER BY sort_order",
    [a.realmId,id,(q.rows[0] as {policyVersion:number}).policyVersion]);
   const applied=await tx.query<{version_no:number}>(
    "SELECT version_no FROM referral_policy_version "+
    "WHERE root_realm_id=$1 AND programme_id=$2 AND effective_from<=now() "+
    "ORDER BY effective_from DESC,version_no DESC LIMIT 1",[a.realmId,id]);
   const currentVersion=applied.rows[0]?.version_no??null;
   const effectiveRanks=currentVersion===null?[]:
    currentVersion===(q.rows[0] as {policyVersion:number}).policyVersion?tiers.rows:
    (await tx.query(
     "SELECT rank_name AS name,minimum_verified_referrals AS \"verifiedReferrals\","+
     "minimum_eligible_points::text AS \"minimumPoints\","+
     "benefits_summary AS \"benefitsSummary\",sort_order AS \"sortOrder\" "+
     "FROM referral_rank_rule WHERE root_realm_id=$1 AND programme_id=$2 "+
     "AND policy_version=$3 ORDER BY sort_order",
     [a.realmId,id,currentVersion])).rows;
   return {...q.rows[0],ranks:tiers.rows,effectiveRanks,
    effectivePolicyVersion:currentVersion};
  },true);
 }
 async listProducts(bearer:string,programInput:string,pageInput?:string,
  searchInput?:string,categoryInput?:string){
  const programId=ref(programInput),page=catalogPage(pageInput);
  const search=optional(searchInput,"search",100).toLowerCase();
  const category=optional(categoryInput,"category",80);
  return this.run(bearer,"rewards.catalog.view",async(tx,a)=>{
   await this.root(tx,a);
   await this.program(tx,a,programId);
   const scope=await this.inventory.rewardStoreScope(tx,a);
   const q=await tx.query(
    "SELECT p.id AS ref,p.programme_id AS \"programmeRef\",p.product_type AS type,p.category,p.name,"+
    "p.description,p.points_price::text AS \"pointsPrice\",p.eligible_audience AS \"eligibleAudience\","+
    "p.status,p.highlighted,p.public_visible AS \"publicVisible\",p.approved_image_url AS \"imageUrl\","+
    "p.cg12_item_ref AS \"itemRef\",p.cg12_location_ref AS \"storeRef\",p.version "+
    "FROM reward_product p LEFT JOIN inventory_location loc ON "+
    "loc.root_realm_id=p.root_realm_id AND loc.id=p.cg12_location_ref "+
    "LEFT JOIN branch branch ON branch.root_realm_id=loc.root_realm_id "+
    "AND branch.id=loc.branch_ref "+
    "WHERE p.root_realm_id=$1 AND p.programme_id=$2 AND "+
    "(p.product_type='DIGITAL' OR "+
    "(loc.status='ACTIVE' AND "+
    "(loc.scope_kind='FOUNDATION' AND $5::boolean OR "+
    "loc.scope_kind='BRANCH' AND branch.status='ACTIVE' AND "+
    "($5::boolean OR branch.id=ANY($6::uuid[]))))) "+
    "AND ($7::text='' OR strpos(lower(p.name || ' ' || p.category || ' ' || p.description),$7)>0) "+
    "AND ($8::text='' OR p.category=$8) "+
    "ORDER BY p.created_at DESC,p.id DESC LIMIT $3 OFFSET $4",
    [a.realmId,programId,CATALOG_PAGE_SIZE+1,(page-1)*CATALOG_PAGE_SIZE,
     scope.full,scope.branches,search,category]);
   return {items:await this.approvedPageImages(tx,a,
     q.rows.slice(0,CATALOG_PAGE_SIZE) as {imageUrl:unknown}[]),
    hasMore:q.rows.length>CATALOG_PAGE_SIZE,page};
  },true);
 }
 /** Distinct current categories from the SAME permitted product source as listProducts. */
 async productCategories(bearer:string,programInput:string){
  const programId=ref(programInput);
  return this.run(bearer,"rewards.catalog.view",async(tx,a)=>{
   await this.root(tx,a);await this.program(tx,a,programId);
   const scope=await this.inventory.rewardStoreScope(tx,a);
   const q=await tx.query<{category:string}>(
    "SELECT DISTINCT p.category FROM reward_product p "+
    "LEFT JOIN inventory_location loc ON loc.root_realm_id=p.root_realm_id "+
    "AND loc.id=p.cg12_location_ref "+
    "LEFT JOIN branch br ON br.root_realm_id=loc.root_realm_id AND br.id=loc.branch_ref "+
    "WHERE p.root_realm_id=$1 AND p.programme_id=$2 AND "+
    "(p.product_type='DIGITAL' OR (loc.status='ACTIVE' AND "+
    "(loc.scope_kind='FOUNDATION' AND $3::boolean OR "+
    "loc.scope_kind='BRANCH' AND br.status='ACTIVE' AND "+
    "($3::boolean OR br.id=ANY($4::uuid[]))))) "+
    "ORDER BY p.category LIMIT 201",
    [a.realmId,programId,scope.full,scope.branches]);
   return {items:q.rows.slice(0,200).map(v=>v.category),
    hasMore:q.rows.length>200};
  },true);
 }
 /** B11: scoped ORIGINAL ledger aggregates only; no applicant/member PII
  * and no invented US003 redemption totals. Every branch choice is CG02-owned.
  */
 async adminSummary(bearer:string,programmeInput:string){
  const id=ref(programmeInput);
  return this.run(bearer,"referrals.programmes.view",async(tx,a)=>{
   await this.root(tx,a);await this.program(tx,a,id);
   const scope=await this.inventory.rewardStoreScope(tx,a);
   const from=" FROM points_account wallet "+
    "LEFT JOIN member m ON m.root_realm_id=wallet.root_realm_id "+
    "AND m.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='MEMBER' "+
    "LEFT JOIN volunteer v ON v.root_realm_id=wallet.root_realm_id "+
    "AND v.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='VOLUNTEER' "+
    "WHERE wallet.root_realm_id=$1 AND wallet.programme_id=$2 "+
    "AND ($3::boolean OR COALESCE(m.branch_ref,v.branch_ref)=ANY($4::uuid[]))";
   const args=[a.realmId,id,scope.full,scope.branches];
   const totals=await tx.query<{
    activeReferrers:string;successfulReferrals:string;earnedPoints:string;
    netPoints:string
   }>(
    "SELECT COUNT(*) FILTER(WHERE "+
    "(wallet.referrer_kind='MEMBER' AND m.status='ACTIVE' AND EXISTS("+
    "SELECT 1 FROM membership_term term WHERE term.root_realm_id=m.root_realm_id "+
    "AND term.member_id=m.id AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
    "AND (term.expires_on IS NULL OR term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date))) "+
    "OR (wallet.referrer_kind='VOLUNTEER' AND v.status='ACTIVE' "+
    "AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)))::text "+
    "AS \"activeReferrers\","+
    "COALESCE(SUM(wallet.qualified_referrals),0)::text AS \"successfulReferrals\","+
    "COALESCE(SUM(wallet.earned_points),0)::text AS \"earnedPoints\","+
    "COALESCE(SUM(wallet.earned_points-wallet.reversed_points),0)::text AS \"netPoints\""+
    from,args);
   const ranks=await tx.query<{kind:string;rank:string|null;count:string;
    referrals:string;points:string;lastActivity:string|null}>(
    "SELECT wallet.referrer_kind AS kind,wallet.current_rank_name AS rank,"+
    "COUNT(*)::text AS count,COALESCE(SUM(wallet.qualified_referrals),0)::text AS referrals,"+
    "COALESCE(SUM(wallet.earned_points-wallet.reversed_points),0)::text AS points,"+
    "MAX(wallet.updated_at) AS \"lastActivity\""+
    from+" GROUP BY wallet.referrer_kind,wallet.current_rank_name "+
    "ORDER BY wallet.referrer_kind,wallet.current_rank_name LIMIT 61",args);
   // Genuine CG13 DIGITAL pending/cancelled/fulfilled totals. A physical
   // gift or unverified digital entitlement is NEVER counted as delivered.
   // Same original CG02 current branch scope as the qualification ledger.
   const redemptions=await tx.query<{
    pending:string;cancelled:string;fulfilled:string;total:string;spentPoints:string
   }>(
    "SELECT COUNT(*) FILTER(WHERE r.state='HELD')::text AS pending,"+
    "COUNT(*) FILTER(WHERE r.state='CANCELLED')::text AS cancelled,"+
    "COUNT(*) FILTER(WHERE r.state='FULFILLED')::text AS fulfilled,"+
    "COUNT(*)::text AS total,"+
    "COALESCE(SUM(spent.points_delta),0)::text AS \"spentPoints\" FROM redemption r "+
    "JOIN points_account wallet ON wallet.root_realm_id=r.root_realm_id "+
    "AND wallet.id=r.points_account_id "+
    "LEFT JOIN points_event spent ON spent.root_realm_id=r.root_realm_id "+
    "AND spent.redemption_id=r.id AND spent.event_kind='POINTS_SPENT' "+
    "LEFT JOIN member m ON m.root_realm_id=wallet.root_realm_id "+
    "AND m.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='MEMBER' "+
    "LEFT JOIN volunteer v ON v.root_realm_id=wallet.root_realm_id "+
    "AND v.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='VOLUNTEER' "+
    "WHERE r.root_realm_id=$1 AND r.programme_id=$2 "+
    "AND ($3::boolean OR COALESCE(m.branch_ref,v.branch_ref)=ANY($4::uuid[]))",
    args);
   return {metrics:totals.rows[0]??{activeReferrers:"0",successfulReferrals:"0",
    earnedPoints:"0",netPoints:"0"},rankCounts:ranks.rows,
    rankCountsTruncated:ranks.rows.length>60,
    redemptionMetrics:redemptions.rows[0]??{
     pending:"0",cancelled:"0",fulfilled:"0",total:"0",spentPoints:"0"},
    redemptionMetricsAvailable:true,
    notice:"Verified referral points and source-recorded digital reward requests only; held rewards are not delivered."};
  },true);
 }
 /** B14/B15: genuine source-backed redemption history, paged and scoped
  * by the CURRENT original CG02 branch access. No person contact, UUID, CG12
  * supplier/warehouse private data or fictitious fulfillment is returned.
  */
 async adminRedemptions(bearer:string,programmeInput:string,
  pageInput?:string,statusInput?:string,searchInput?:string,
  fromInput?:string,toInput?:string){
  const programme=ref(programmeInput),page=catalogPage(pageInput);
  const status=statusInput??"ALL";
  if(!["ALL","HELD","CANCELLED","FULFILLMENT_PENDING","FULFILLED"].includes(status))
   throw bad("status");
  const search=optional(searchInput,"search",80).toLowerCase();
  const day=(v:string|undefined)=>{
   if(!v)return null;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||
    Number.isNaN(Date.parse(v+"T00:00:00Z"))||
    new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
    throw bad("date");
   return v;
  };
  const from=day(fromInput),to=day(toInput);
  if(from&&to&&from>to)throw bad("date");
  return this.run(bearer,"rewards.catalog.view",async(tx,a)=>{
   await this.root(tx,a);
   await this.program(tx,a,programme);
   const scope=await this.inventory.rewardStoreScope(tx,a);
   const rows=await tx.query<{
    kind:string;name:string;productName:string;pointsCost:string;
    status:string;requestedAt:string
   }>(
    "SELECT wallet.referrer_kind AS kind,"+
    "COALESCE(m.display_name,v.display_name) AS name,"+
    "product.name AS \"productName\",r.points_cost::text AS \"pointsCost\","+
    "r.state AS status,r.requested_at AS \"requestedAt\" "+
    "FROM redemption r JOIN points_account wallet "+
    "ON wallet.root_realm_id=r.root_realm_id AND wallet.id=r.points_account_id "+
    "JOIN reward_product_revision product ON product.root_realm_id=r.root_realm_id "+
    "AND product.product_id=r.product_id AND product.revision=r.product_revision "+
    "LEFT JOIN member m ON m.root_realm_id=wallet.root_realm_id "+
    "AND m.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='MEMBER' "+
    "LEFT JOIN volunteer v ON v.root_realm_id=wallet.root_realm_id "+
    "AND v.id=wallet.referrer_relationship_ref AND wallet.referrer_kind='VOLUNTEER' "+
    "WHERE r.root_realm_id=$1 AND r.programme_id=$2 "+
    "AND ($3::boolean OR COALESCE(m.branch_ref,v.branch_ref)=ANY($4::uuid[])) "+
    "AND ($5::text='ALL' OR r.state=$5) "+
    "AND ($6::text='' OR strpos(lower(COALESCE(m.display_name,v.display_name)||' '||product.name),$6)>0) "+
    "AND ($7::date IS NULL OR (r.requested_at AT TIME ZONE 'Asia/Kolkata')::date >= $7::date) "+
    "AND ($8::date IS NULL OR (r.requested_at AT TIME ZONE 'Asia/Kolkata')::date <= $8::date) "+
    "ORDER BY r.requested_at DESC,r.id DESC LIMIT 26 OFFSET $9",
    [a.realmId,programme,scope.full,scope.branches,status,search,from,to,(page-1)*25]);
   return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25,page,
    notice:"Statuses come from verified original redemption and immutable points holds, never from a requested fulfillment flag."};
  },true);
 }
 async stockOptions(bearer:string){
  return this.run(bearer,"rewards.catalog.manage",async(tx,a)=>{
   await this.root(tx,a);
   await this.identity.assertCurrent(tx,a,"inventory.catalog.view");
   const stores=await this.inventory.permittedRewardStores(tx,a);
   const items=await tx.query(
    "SELECT id AS ref,name FROM inventory_item "+
    "WHERE root_realm_id=$1 AND status='ACTIVE' AND unit_code='PIECE' AND qty_scale=0 "+
    "ORDER BY name,id LIMIT 100",[a.realmId]);
   return {items:stores.length?items.rows:[],stores,
    notice:"Only your currently permitted active stores are shown. Reward changes never adjust inventory."};
  },true);
 }
 async stockPreview(bearer:string,itemInput:string,storeInput:string){
  const itemRef=ref(itemInput,"itemRef"),storeRef=ref(storeInput,"storeRef");
  return this.run(bearer,"rewards.catalog.view",async(tx,a)=>{
   await this.root(tx,a);
   const found=await this.stockSource(tx,a,{
    programmeRef:"",type:"PHYSICAL",category:"",name:"",description:"",
    pointsPrice:1,eligibleAudience:"BOTH",status:"ACTIVE",
    highlighted:false,publicVisible:false,approvedImageUrl:null,itemRef,storeRef});
   if(!found)throw new ServiceUnavailableException("Original CG12 stock unavailable");
   return {itemName:found.label,availableQuantity:found.available,
    onHandQuantity:found.onHand,reservedQuantity:found.reserved,
    stockStatus:Number(found.available)>0?"AVAILABLE":"OUT_OF_STOCK",
    notice:"Read-only original CG12 available quantity. No warehouse stock is changed."};
  },true);
 }
 async publicEligibleCatalog(bearer:string,pageInput?:string,
  searchInput?:string,categoryInput?:string){
  const page=catalogPage(pageInput);
  const search=optional(searchInput,"search",100).toLowerCase();
  const category=optional(categoryInput,"category",80);
  const a=await this.sessions.verifySession(bearer),tx=await this.db.connect();
  try{
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
   await this.identity.assertRootSelfSessionCurrent(tx,a);
   const audiences=await tx.query<{kind:string}>(
    "SELECT 'MEMBER' AS kind FROM member m JOIN membership_term t "+
    "ON t.root_realm_id=m.root_realm_id AND t.member_id=m.id "+
    "WHERE m.root_realm_id=$1 AND m.account_ref=$2 AND m.status='ACTIVE' "+
    "AND (m.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b "+
    "WHERE b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref "+
    "AND b.status='ACTIVE')) "+
    "AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
    "AND (t.expires_on IS NULL OR t.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date) "+
    "UNION SELECT 'VOLUNTEER' AS kind FROM volunteer v "+
    "WHERE v.root_realm_id=$1 AND v.account_ref=$2 AND v.status='ACTIVE' "+
    "AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)",
    [a.realmId,a.accountId]);
   const kinds=audiences.rows.map(v=>v.kind);
   const q=await tx.query(
    "SELECT p.id AS ref,p.programme_id AS \"programmeRef\",p.product_type AS type,"+
    "p.category,p.name,p.description,p.points_price::text AS \"pointsPrice\","+
    "p.version,p.eligible_audience AS \"eligibleAudience\","+
    "pr.audience AS \"programmeAudience\","+
    "p.approved_image_url AS \"imageUrl\",p.highlighted,"+
    "CASE WHEN p.product_type='DIGITAL' THEN 'NO_STOCK_REQUIRED' "+
    "WHEN item.status='ACTIVE' AND item.unit_code='PIECE' AND item.qty_scale=0 "+
    "AND loc.status='ACTIVE' "+
    "AND (loc.branch_ref IS NULL OR br.status='ACTIVE') "+
    "AND COALESCE(bal.on_hand_qty-bal.reserved_qty,0)>0 THEN 'AVAILABLE' "+
    "ELSE 'OUT_OF_STOCK' END AS availability "+
    "FROM reward_product p JOIN referral_program pr ON pr.id=p.programme_id "+
    "AND pr.root_realm_id=p.root_realm_id "+
    "JOIN LATERAL (SELECT pv.version_no,pv.effective_from FROM referral_policy_version pv "+
    "WHERE pv.root_realm_id=pr.root_realm_id AND pv.programme_id=pr.id "+
    "AND pv.effective_from<=now() "+
    "ORDER BY pv.effective_from DESC,pv.version_no DESC LIMIT 1) policy ON true "+
    "LEFT JOIN inventory_item item ON item.root_realm_id=p.root_realm_id AND item.id=p.cg12_item_ref "+
    "LEFT JOIN inventory_location loc ON loc.root_realm_id=p.root_realm_id AND loc.id=p.cg12_location_ref "+
    "LEFT JOIN branch br ON br.root_realm_id=loc.root_realm_id AND br.id=loc.branch_ref "+
    "LEFT JOIN stock_balance bal ON bal.root_realm_id=p.root_realm_id "+
    "AND bal.item_id=p.cg12_item_ref AND bal.location_id=p.cg12_location_ref "+
    "WHERE p.root_realm_id=$1 AND p.status='ACTIVE' AND p.public_visible "+
    "AND pr.status='ACTIVE' AND policy.effective_from<=now() "+
    "AND (p.eligible_audience='BOTH' AND cardinality($2::text[])>0 "+
    "OR p.eligible_audience=ANY($2::text[])) "+
    "AND (pr.audience='BOTH' OR pr.audience=ANY($2::text[])) "+
    "AND ($5::text='' OR strpos(lower(p.name || ' ' || p.category || ' ' || p.description),$5)>0) "+
    "AND ($6::text='' OR p.category=$6) "+
    "ORDER BY p.highlighted DESC,p.created_at DESC,p.id DESC LIMIT $3 OFFSET $4",
    [a.realmId,kinds,CATALOG_PAGE_SIZE+1,(page-1)*CATALOG_PAGE_SIZE,search,category]);
   const categories=await tx.query<{category:string}>(
    "SELECT DISTINCT p.category FROM reward_product p "+
    "JOIN referral_program pr ON pr.root_realm_id=p.root_realm_id AND pr.id=p.programme_id "+
    "JOIN LATERAL (SELECT pv.version_no,pv.effective_from FROM referral_policy_version pv "+
    "WHERE pv.root_realm_id=pr.root_realm_id AND pv.programme_id=pr.id "+
    "AND pv.effective_from<=now() "+
    "ORDER BY pv.effective_from DESC,pv.version_no DESC LIMIT 1) policy ON true "+
    "WHERE p.root_realm_id=$1 AND p.status='ACTIVE' AND p.public_visible "+
    "AND pr.status='ACTIVE' AND policy.effective_from<=now() "+
    "AND ((p.eligible_audience='BOTH' AND cardinality($2::text[])>0) "+
    "OR p.eligible_audience=ANY($2::text[])) "+
    "AND (pr.audience='BOTH' OR pr.audience=ANY($2::text[])) "+
    "ORDER BY p.category LIMIT 201",[a.realmId,kinds]);
   const safeItems=await this.approvedPageImages(tx,a,
     q.rows.slice(0,CATALOG_PAGE_SIZE) as {imageUrl:unknown}[]);
   await tx.query("COMMIT");
   return {eligibleRelationships:kinds,items:safeItems,
    categories:categories.rows.slice(0,200).map(v=>v.category),
    categoriesTruncated:categories.rows.length>200,
    hasMore:q.rows.length>CATALOG_PAGE_SIZE,page,
    notice:kinds.length?"Points are not cash. Products require genuine earned CG13 points before redemption.":
     "An active original CG04 membership or volunteer relationship is required."};
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   throw e;
  }finally{tx.release();}
 }
}
