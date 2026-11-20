import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {ConsultationChargeSourceFacade,type Cg15ChargeSource,
 type Cg15HoldQuoteSource}
 from "../../cg-15-patients-appointments/application/consultation-charge-source.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MONEY=/^(0|[1-9]\d{0,10})$/;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CONSULTATION_CHARGE_INVALID_REFERENCE"});
 return v;
};
const amount=(v:unknown)=>{
 if(typeof v!=="string"||!MONEY.test(v)||BigInt(v)>10000000000n)
  throw new BadRequestException({code:"CONSULTATION_CHARGE_AMOUNT_INVALID"});
 return v;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Policy={id:string;source_digest:string;mode:"PERCENT"|"FIXED";
 percent_basis_points:number|null;fixed_minor:string|null;cap_minor:string};
type Charge={id:string;root_realm_id:string;source_kind:string;
 source_ref:string;source_version:number;source_digest:string;
 center_ref:string;patient_ref:string;doctor_ref:string;association_ref:string;
 fee_revision_ref:string;fee_version:number;policy_revision_ref:string|null;
 gross_minor:string;support_minor:string;due_minor:string;currency:string;
 collection_state:string;accepted_at:Date;request_digest:string;
 accepted_by_account:string;patient_consent_revision:number};
type Expected={requestKey:string;grossMinor:string;supportMinor:string;
 dueMinor:string;feeVersion:number;sourceVersion:number;policyRevisionRef:string|null};
const input=(raw:unknown):Expected=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"CONSULTATION_CHARGE_INVALID"});
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["requestKey","grossMinor","supportMinor",
   "dueMinor","feeVersion","sourceVersion","policyRevisionRef"].includes(k))||
   typeof v.feeVersion!=="number"||
   !Number.isSafeInteger(v.feeVersion)||v.feeVersion<1||
   typeof v.sourceVersion!=="number"||
   !Number.isSafeInteger(v.sourceVersion)||v.sourceVersion<1)
  throw new BadRequestException({code:"CONSULTATION_CHARGE_INVALID"});
 const policy=v.policyRevisionRef==null?null:id(v.policyRevisionRef);
 return {requestKey:id(v.requestKey),grossMinor:amount(v.grossMinor),
  supportMinor:amount(v.supportMinor),dueMinor:amount(v.dueMinor),
  feeVersion:v.feeVersion,sourceVersion:v.sourceVersion,policyRevisionRef:policy};
};
const exposed=(c:Charge,source:Cg15ChargeSource)=>({
 chargeRef:c.id,sourceKind:"CG15_CONSULTATION" as const,
 bookingRef:c.source_ref,centerRef:c.center_ref,
 grossMinor:c.gross_minor,foundationSupportMinor:c.support_minor,
 patientPayableMinor:c.due_minor,currency:"INR" as const,
 feeVersion:c.fee_version,sourceVersion:c.source_version,
 policyRevisionRef:c.policy_revision_ref,
 state:source.bookingState==="CANCELLED"?"SOURCE_CANCELLED":
  source.sourceVersion!==c.source_version||source.centerRef!==c.center_ref||
  source.doctorRef!==c.doctor_ref||source.feeMinor!==c.gross_minor?
   "SOURCE_CHANGED_REVIEW_REQUIRED":"PATIENT_DUE",
 collectionVerified:false,foundationLiabilityCreated:false,
 acceptedAt:c.accepted_at.toISOString(),
 acceptanceHistorical:true
});
type QuoteSource=Cg15HoldQuoteSource|Cg15ChargeSource;
@Injectable()
export class ConsultationPatientChargeService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly identity:SessionService,
  private readonly scope:FoundationStructureIdentityFacade,
  private readonly cg15:ConsultationChargeSourceFacade){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.pool.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await run(c);
   await c.query("COMMIT");open=false;return result;
  }catch(e){
   if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
     (e.code==="23505"||e.code==="23P01"))
    throw new ConflictException({code:"CONSULTATION_CHARGE_ALREADY_EXISTS"});
   throw e;
  }finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,center?:string,
  write=false):Promise<VerifiedFoundationActor>{
  const a=center?
   await this.identity.requireAction(token,write?
    "healthcare.assistance.charges.accept":"healthcare.assistance.charges.view"):
   await this.identity.verifySession(token);
  if(center)await this.scope.assertCurrent(c,a,write?
   "healthcare.assistance.charges.accept":"healthcare.assistance.charges.view");
  else await this.scope.assertPatientSessionCurrent(c,a);
  return a;
 }
 private async policy(c:PoolClient,realm:string,source:QuoteSource,
  at:Date):Promise<Policy|null>{
  const q=await c.query<Policy>(
   "SELECT id,source_digest,mode,percent_basis_points,"+
   "fixed_minor::text,cap_minor::text "+
   "FROM healthcare_policy_revision "+
   "WHERE root_realm_id=$1 AND center_ref=$2 AND "+
   "service_kind='CONSULTATION' "+
   "AND (doctor_ref=$3 OR doctor_ref IS NULL) "+
   "AND valid_from<=$4 AND valid_until>$4 "+
   "AND activated_at IS NOT NULL AND activated_at<=$4 "+
   "AND (approval_state='ACTIVE' OR "+
   "(approval_state IN('SUPERSEDED','WITHDRAWN') AND changed_at>$4)) "+
   "ORDER BY (doctor_ref IS NOT NULL) DESC,valid_from DESC,id DESC LIMIT 1",
   [realm,source.centerRef,source.doctorRef,at]);
  return q.rows[0]??null;
 }
 private split(source:QuoteSource,policy:Policy|null){
  const gross=BigInt(source.feeMinor);
  let support=0n;
  if(policy){
   const tentative=policy.mode==="PERCENT"?
    (gross*BigInt(policy.percent_basis_points??0)+5000n)/10000n:
    BigInt(policy.fixed_minor??"0");
   const cap=BigInt(policy.cap_minor);
   support=tentative<cap?tentative:cap;
   if(support>gross)support=gross;
  }
  return {grossMinor:gross.toString(),foundationSupportMinor:support.toString(),
   patientPayableMinor:(gross-support).toString(),currency:"INR" as const,
   feeVersion:source.feeVersion,policyRevisionRef:policy?.id??null,
   state:policy?"QUOTED_NOT_ACCEPTED" as const:
    "NO_EFFECTIVE_ASSISTANCE" as const,
   patientCareIdentityAndConsentVerified:true,
   patientCollectionVerified:false,foundationLiabilityCreated:false,
   taxBreakdownUnavailableFromCG14:true};
 }
 async quoteHold(token:string,rawHold:string,rawCenter?:string){
  const hold=id(rawHold),center=rawCenter===undefined?undefined:id(rawCenter);
  return this.tx(async c=>{
   const actor=await this.actor(c,token,center);
   const source=await this.cg15.hold(c,actor,hold,center);
   const rule=await this.policy(c,actor.realmId,source,new Date());
   return {...this.split(source,rule),holdRef:source.holdRef,
    expiresAt:source.expiresAt.toISOString(),
    message:"Current unaccepted quote. Original CG15 booking and CG17 "+
     "acceptance are still required. No patient payment is verified."};
  });
 }
 async previewBooking(token:string,rawBooking:string,rawCenter?:string){
  const booking=id(rawBooking),center=rawCenter===undefined?undefined:id(rawCenter);
  return this.tx(async c=>{
   const actor=await this.actor(c,token,center);
   const source=await this.cg15.booking(c,actor,booking,center,true);
   const stored=await c.query<Charge>(
    "SELECT * FROM patient_charge WHERE root_realm_id=$1 AND "+
    "source_kind='CG15_CONSULTATION' AND source_ref=$2 AND line_ref='CONSULTATION'",
    [actor.realmId,booking]);
   if(stored.rows[0])
    return {...exposed(stored.rows[0],source),accepted:true};
   if(source.bookingState==="CANCELLED"||source.bookingState==="NO_SHOW"||
     source.collectionState==="NOT_COLLECTIBLE")
    return {accepted:false,state:"NOT_COLLECTIBLE" as const};
   // A newly quoted charge requires the same current CG14 verification
   // as actual CG15 consultation booking. Historical accepted rows do not.
   await this.cg15.booking(c,actor,booking,center,false);
   const policy=await this.policy(c,actor.realmId,source,source.bookedAt);
   return {...this.split(source,policy),accepted:false,
    bookingRef:source.sourceRef,sourceVersion:source.sourceVersion,
    message:"Original confirmed appointment amount only. "+
     "Acceptance creates no payment or Foundation payable."};
  });
 }
 async accept(token:string,rawBooking:string,raw:unknown,rawCenter?:string){
  const booking=id(rawBooking),center=rawCenter===undefined?undefined:id(rawCenter);
  const expected=input(raw);
  const key=sha(["CG17_ACCEPTED_CONSULTATION_V1",booking,expected]);
  return this.tx(async c=>{
   const actor=await this.actor(c,token,center,true);
   // Per-original appointment lock; two client channels never create
   // two charged consultation effects from the same CG15 reservation.
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":CG15_CONSULTATION:"+booking]);
   const source=await this.cg15.booking(c,actor,booking,center,true);
   const previous=await c.query<Charge>(
    "SELECT * FROM patient_charge WHERE root_realm_id=$1 "+
    "AND source_kind='CG15_CONSULTATION' AND source_ref=$2 "+
    "AND line_ref='CONSULTATION' FOR SHARE",[actor.realmId,booking]);
   if(previous.rows[0]){
    const row=previous.rows[0];
    if(row.accepted_by_account!==actor.accountId||
       row.request_digest!==key)
     throw new ConflictException({code:"CONSULTATION_ALREADY_ACCEPTED"});
    return {...exposed(row,source),accepted:true,replayed:true};
   }
   const retry=await c.query<Charge>(
    "SELECT * FROM patient_charge WHERE root_realm_id=$1 "+
    "AND accepted_by_account=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,expected.requestKey]);
   if(retry.rows[0])
    throw new ConflictException({code:"CONSULTATION_REQUEST_KEY_IN_USE"});
   if(source.bookingState==="CANCELLED"||source.bookingState==="NO_SHOW"||
      source.collectionState==="NOT_COLLECTIBLE")
    throw new ConflictException({code:"CONSULTATION_NOT_COLLECTIBLE"});
   await this.cg15.booking(c,actor,booking,center,false);
   const policy=await this.policy(c,actor.realmId,source,source.bookedAt);
   const calculated=this.split(source,policy);
   if(calculated.grossMinor!==expected.grossMinor||
      calculated.foundationSupportMinor!==expected.supportMinor||
      calculated.patientPayableMinor!==expected.dueMinor||
      calculated.policyRevisionRef!==expected.policyRevisionRef||
      calculated.feeVersion!==expected.feeVersion||
      source.sourceVersion!==expected.sourceVersion)
    throw new ConflictException({code:"CONSULTATION_QUOTE_CHANGED"});
   const sourceHash=sha(["CG15_CONSULTATION",source.sourceRef,
    source.sourceVersion,source.patientRef,source.doctorRef,
    source.centerRef,source.associationRef,source.feeRef,
    source.feeVersion,source.feeMinor,source.consentRevision,
    source.bookedAt.toISOString()]);
   const saved=await c.query<Charge>(
    "INSERT INTO patient_charge(root_realm_id,source_ref,source_version,"+
    "source_digest,center_ref,patient_ref,doctor_ref,association_ref,"+
    "fee_revision_ref,fee_version,policy_revision_ref,"+
    "patient_consent_revision,gross_minor,support_minor,due_minor,"+
    "accepted_by_account,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) "+
    "RETURNING *",
    [actor.realmId,booking,source.sourceVersion,sourceHash,
     source.centerRef,source.patientRef,source.doctorRef,source.associationRef,
     source.feeRef,source.feeVersion,policy?.id??null,
     source.consentRevision,calculated.grossMinor,
     calculated.foundationSupportMinor,calculated.patientPayableMinor,
     actor.accountId,expected.requestKey,key]);
   return {...exposed(saved.rows[0],source),accepted:true,replayed:false};
  });
 }
}
