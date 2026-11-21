import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService}
 from "../../cg-01-identity-access/application/protected-access-owner.service";
import {HealthCenterSupportScopeFacade} from "./health-center-support-scope.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE=/^HPS-[A-F0-9]{12}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{2,79}$/;
const PRICE=/^[1-9][0-9]{0,10}$/;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const id=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException({code:"CG14_OFFER_INVALID"});return v;};
const code=(v:unknown)=>{if(typeof v!=="string"||!CODE.test(v))
 throw new BadRequestException({code:"CG14_OFFER_INVALID"});return v;};
const form=(raw:unknown,keys:string[])=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).length!==keys.length||
  Object.keys(raw).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG14_OFFER_INVALID"});
 return raw as Record<string,unknown>;
};
type Kind="PHARMACY"|"NURSING"|"OT";
type Offer={id:string;public_code:string;center_ref:string;service_kind:Kind;
 item_name:string;description:string;indicative_price_minor:string|null;
 source_digest:string;status:string;created_by_account:string;
 request_key:string;reviewed_by_account:string|null;review_request_key:string|null;
 review_reason:string|null;};
const present=(row:Offer)=>({
 offerCode:row.public_code,serviceKind:row.service_kind,
 name:row.item_name,description:row.description,
 indicativePriceMinor:row.indicative_price_minor,
 currency:"INR" as const,status:row.status,
 priceConfirmedAtPurchase:false,
 benefitEligibilityNotVerified:true,
 guidance:"Indicative public service information only. Actual provider invoice "+
  "and approved patient assistance are verified independently."
});
@Injectable()
export class PartnerPublicOffersService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly reviewer:ProtectedAccessOwnerService,
  private readonly centers:HealthCenterSupportScopeFacade){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await run(c);await c.query("COMMIT");open=false;
   return value;
  }catch(e){
   if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG14_OFFER_DUPLICATE"});
   throw e;
  }finally{c.release()}
 }
 async foundationCenters(token:string){
  const a=await this.sessions.requireAction(token,"health.centers.publish");
  return this.tx(async c=>{
   await this.identity.assertCurrent(c,a,"health.centers.publish");
   const found=await c.query<{centerRef:string;centerName:string}>(
    "SELECT c.id AS \"centerRef\",c.display_name AS \"centerName\" "+
    "FROM health_center c JOIN health_provider p "+
    "ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
    "WHERE c.root_realm_id=$1 AND c.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND p.status='VERIFIED' "+
    "ORDER BY c.display_name,c.id LIMIT 51",[a.realmId]);
   if(found.rows.length>50)
    throw new ConflictException({code:"CG14_OFFER_LIST_LIMIT"});
   return {centers:found.rows,complete:true};
  });
 }
 async assigned(token:string){
  const a=await this.sessions.requireAction(token,"health.centers.draft.edit");
  return this.tx(async c=>{
   const centers=await this.centers.assignedCenters(c,a,"health.centers.draft.edit");
   return {centers};
  });
 }
 private async rows(c:PoolClient,root:string,center:string){
  const query=await c.query<Offer>(
   "SELECT public_code,center_ref,service_kind,item_name,description,"+
   "indicative_price_minor::text,source_digest,status,created_by_account,"+
   "request_key,reviewed_by_account,review_request_key,review_reason "+
   "FROM health_partner_public_offer WHERE root_realm_id=$1 "+
   "AND center_ref=$2 ORDER BY created_at DESC,id DESC LIMIT 51",[root,center]);
  if(query.rows.length>50)throw new ConflictException({code:"CG14_OFFER_LIST_LIMIT"});
  return {offers:query.rows.map(present),complete:true};
 }
 async centerList(token:string,centerRaw:string,foundation=false){
  const center=id(centerRaw);
  return this.tx(async c=>{
   const action=foundation?"health.centers.publish":"health.centers.draft.edit";
   const a=await this.sessions.requireAction(token,action);
   await this.identity.assertCurrent(c,a,action);
   if(foundation)
    await this.centers.assertFoundationCenter(c,a,center,action,false);
   else await this.centers.assertCurrent(c,a,center,action);
   return this.rows(c,a.realmId,center);
  });
 }
 async submit(token:string,centerRaw:string,raw:unknown){
  const center=id(centerRaw);
  const v=form(raw,["requestKey","serviceKind","name","description","indicativePriceMinor"]);
  const key=id(v.requestKey),kind=v.serviceKind;
  if(kind!=="PHARMACY"&&kind!=="NURSING"&&kind!=="OT")
   throw new BadRequestException({code:"CG14_OFFER_INVALID"});
  const name=typeof v.name==="string"?v.name.trim():"";
  const description=typeof v.description==="string"?v.description.trim():"";
  const price=v.indicativePriceMinor===null?null:v.indicativePriceMinor;
  if(name.length<3||name.length>120||/[\u0000-\u001f\u007f]/.test(name)||
   description.length>500||/[\u0000-\u001f\u007f]/.test(description)||
   (price!==null&&(typeof price!=="string"||!PRICE.test(price)||
    BigInt(price)>10000000000n)))
   throw new BadRequestException({code:"CG14_OFFER_INVALID"});
  const sourceDigest=digest(["CG14_PUBLIC_PARTNER_OFFER_V1",center,kind,
   name,description,price]);
  return this.tx(async c=>{
   const a=await this.sessions.requireAction(token,"health.centers.draft.edit");
   await this.centers.assertCurrent(c,a,center,"health.centers.draft.edit");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [a.realmId+":CG14_OFFER:"+a.accountId+":"+key]);
   const previous=await c.query<Offer>(
    "SELECT *,indicative_price_minor::text "+
    "FROM health_partner_public_offer WHERE root_realm_id=$1 "+
    "AND created_by_account=$2 AND request_key=$3 FOR SHARE",
    [a.realmId,a.accountId,key]);
   if(previous.rows[0]){
    if(previous.rows[0].source_digest!==sourceDigest||
      previous.rows[0].center_ref!==center)
     throw new ConflictException({code:"CG14_OFFER_REQUEST_CONFLICT"});
    return {...present(previous.rows[0]),replayed:true};
   }
   const current=await c.query(
    "SELECT 1 FROM health_center_capability cap "+
    "WHERE cap.root_realm_id=$1 AND cap.center_id=$2 "+
    "AND cap.capability_code=$3 FOR SHARE",
    [a.realmId,center,kind==="OT"?"SURGERY":kind]);
   if(!current.rowCount)
    throw new ConflictException({code:"CG14_OFFER_SERVICE_NOT_VERIFIED"});
   const inserted=await c.query<Offer>(
    "INSERT INTO health_partner_public_offer("+
    "root_realm_id,center_ref,service_kind,item_name,description,"+
    "indicative_price_minor,created_by_account,request_key,source_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [a.realmId,center,kind,name,description,price,a.accountId,key,sourceDigest]);
   return {...present(inserted.rows[0]),replayed:false};
  });
 }
 async decision(token:string,centerRaw:string,codeRaw:string,raw:unknown){
  const center=id(centerRaw),item=code(codeRaw);
  const v=form(raw,["requestKey","action","reason","currentPassword"]);
  const key=id(v.requestKey),action=v.action;
  if(!["APPROVE","REJECT","WITHDRAW"].includes(String(action))||
    typeof v.reason!=="string"||v.reason.trim().length<12||
    v.reason.trim().length>500||
    typeof v.currentPassword!=="string"||v.currentPassword.length<8||
    Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"CG14_OFFER_INVALID"});
  const a=await this.sessions.requireAction(token,"health.centers.publish");
  await this.sessions.limitFoundationRootProof(a);
  const reason=String(v.reason),currentPassword=String(v.currentPassword);
  return this.tx(async c=>{
   await this.reviewer.verifyReviewer(c,a,"approvals.review",true);
   await this.identity.assertCurrent(c,a,"health.centers.publish");
   await this.centers.assertFoundationCenter(c,a,center,"health.centers.publish",
    action==="APPROVE");
   const original=await c.query<Offer>(
    "SELECT *,indicative_price_minor::text "+
    "FROM health_partner_public_offer WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND public_code=$3 FOR UPDATE",
    [a.realmId,center,item]);
   const row=original.rows[0];
   if(!row)throw new NotFoundException({code:"CG14_OFFER_UNAVAILABLE"});
   const state=action==="APPROVE"?"APPROVED":
    action==="REJECT"?"REJECTED":"WITHDRAWN";
   if(row.status===state&&row.reviewed_by_account===a.accountId&&
    row.review_request_key===key&&row.review_reason===reason.trim())
    return {...present(row),replayed:true};
   if((row.status!=="PENDING_REVIEW"&&action!=="WITHDRAW")||
      (action==="WITHDRAW"&&row.status!=="APPROVED")||
      row.created_by_account===a.accountId)
    throw new ConflictException({code:"CG14_OFFER_INDEPENDENT_REVIEW_REQUIRED"});
   await this.sessions.requireFreshFoundationRootProof(c,a,currentPassword);
   const result=await c.query<Offer>(
    "UPDATE health_partner_public_offer SET status=$4,"+
    "reviewed_by_account=$5,review_request_key=$6,review_reason=$7,"+
    "reviewed_at=now() WHERE root_realm_id=$1 AND center_ref=$2 "+
    "AND public_code=$3 AND status=$8 RETURNING *",
    [a.realmId,center,item,state,a.accountId,key,reason.trim(),row.status]);
   if(!result.rows[0])throw new ConflictException({code:"CG14_OFFER_REVIEW_CHANGED"});
   return {...present(result.rows[0]),replayed:false};
  });
 }
 async publicList(rawSlug:string){
  if(typeof rawSlug!=="string"||!SLUG.test(rawSlug))
   throw new BadRequestException({code:"CG14_OFFER_INVALID"});
  const q=await this.db.query<{
   service_kind:Kind;item_name:string;description:string;
   indicative_price_minor:string|null
  }>(
   "SELECT offer.service_kind,offer.item_name,offer.description,"+
   "offer.indicative_price_minor::text FROM health_partner_public_offer offer "+
   "JOIN health_center c ON c.root_realm_id=offer.root_realm_id "+
   "AND c.id=offer.center_ref "+
   "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
   "JOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT' "+
   "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
   "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
   "JOIN health_center_revision rev ON rev.root_realm_id=c.root_realm_id "+
   "AND rev.id=pub.verified_center_revision_id AND rev.center_id=c.id "+
   "AND rev.provider_id=p.id "+
   "JOIN cg03_case cg ON cg.realm_id=c.root_realm_id "+
   "AND cg.id=rev.approval_case_ref AND cg.case_kind='HEALTH_CENTER_VERIFICATION' "+
   "AND cg.status='OWNER_COMPLETED' AND cg.health_center_id=c.id "+
   "AND cg.health_center_revision_id=rev.id "+
   "AND cg.health_source_digest=rev.source_digest "+
   "JOIN cg03_case_decision d ON d.id=pub.original_final_decision_ref "+
   "AND d.realm_id=c.root_realm_id AND d.case_id=cg.id "+
   "AND d.action='APPROVE' AND d.actor_id<>cg.proposer_id "+
   "AND d.fresh_password_verified_at IS NOT NULL "+
   "JOIN cg19_stored_file proof ON proof.realm_id=c.root_realm_id "+
   "AND proof.id=rev.proof_file_ref AND proof.owner_kind='CG14_DRAFT' "+
   "AND proof.health_center_id=c.id AND proof.health_provider_id=p.id "+
   "AND proof.scan_status='CLEAN_VERIFIED' AND proof.revoked_at IS NULL "+
   "JOIN cg19_upload_intent intent ON intent.realm_id=proof.realm_id "+
   "AND intent.id=proof.upload_intent_id AND intent.status='VALIDATED' "+
   "AND intent.classification='HEALTH_CENTER_LICENSE' "+
   "JOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id "+
   "AND cap.center_id=c.id AND cap.capability_code=CASE offer.service_kind "+
   "WHEN 'OT' THEN 'SURGERY' ELSE offer.service_kind END "+
   "WHERE c.public_slug=$1 AND c.status='VERIFIED' "+
   "AND c.publication_state='PUBLISHED' AND c.access_state='ENABLED' "+
   "AND p.status='VERIFIED' AND offer.status='APPROVED' "+
   "ORDER BY offer.service_kind,offer.item_name,offer.id LIMIT 51",
   [rawSlug]);
  if(q.rows.length>50)
   throw new ConflictException({code:"CG14_OFFER_LIST_LIMIT"});
  return {items:q.rows.map(x=>({
   serviceKind:x.service_kind,name:x.item_name,
   description:x.description,indicativePriceMinor:x.indicative_price_minor,
   currency:"INR" as const
  })),complete:true,priceConfirmedAtPurchase:false,
   caution:"Listed prices are indicative, not prescriptions, a confirmed "+
    "invoice or guaranteed CareGanga discount. Verified eligibility and "+
    "actual patient payment require the original partner claim process."};
 }
}
