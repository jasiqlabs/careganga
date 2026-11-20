import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ConsultationCompletionSourceFacade,type OriginalCompletedConsultation}
 from "../../cg-15-patients-appointments/application/consultation-completion-source.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(raw:unknown)=>{
 if(typeof raw!=="string"||!ID.test(raw))
  throw new BadRequestException({code:"HEALTHCARE_LIABILITY_SOURCE_INVALID"});
 return raw;
};
const sha=(input:unknown)=>createHash("sha256").update(JSON.stringify(input)).digest("hex");
type Charge={
 id:string;source_ref:string;source_terms_version:number;
 source_start_at:Date;source_end_at:Date;center_ref:string;
 doctor_ref:string;patient_ref:string;association_ref:string;
 policy_revision_ref:string|null;source_digest:string;
 gross_minor:string;support_minor:string;due_minor:string;
 currency:string;accepted_at:Date
};
type Policy={
 id:string;center_ref:string;doctor_ref:string|null;
 service_kind:string;approval_state:string;activated_at:Date|null;
 approved_case_ref:string|null;approved_decision_ref:string|null;
 mode:string;percent_basis_points:number|null;source_digest:string;
 valid_from:Date;valid_until:Date;currency:string
};
type Liability={id:string;center_ref:string;source_ref:string;
 charge_ref:string;award_ref:string;completion_event_ref:string;
 amount_minor:string;service_completed_at:Date;source_digest:string;
 created_at:Date};
type Effect={id:string;posting_state:string;original_cg09_ref:string|null};
@Injectable()
export class CompletedConsultationLiabilityService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly completed:ConsultationCompletionSourceFacade){}
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
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"HEALTHCARE_LIABILITY_ALREADY_RECORDED"});
   throw e;
  }finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,action:
  "healthcare.assistance.liabilities.view"|
  "healthcare.assistance.liabilities.manage"){
  const a=await this.sessions.requireAction(token,action);
  await this.identity.assertCurrent(c,a,action);
  return a;
 }
 async eligibleCenters(token:string){
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.view");
   return this.centers.eligibleFoundationCenters(c,a,
    "healthcare.assistance.liabilities.view");
  });
 }
 async completedOptions(token:string,centerRaw:string){
  const center=id(centerRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.view");
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.view",true);
   const original=await this.completed.eligibleCompletedOptions(c,a,center);
   const refs=original.rows.map(x=>x.appointmentRef);
   if(!refs.length)return {appointments:[],complete:original.complete};
   const q=await c.query<{source_ref:string;support_minor:string;
    liability_ref:string|null}>(
    "SELECT charge.source_ref,charge.support_minor::text,"+
    "l.id AS liability_ref FROM patient_charge charge "+
    "LEFT JOIN foundation_liability l ON l.root_realm_id=charge.root_realm_id "+
    "AND l.charge_ref=charge.id "+
    "WHERE charge.root_realm_id=$1 AND charge.center_ref=$2 "+
    "AND charge.source_kind='CG15_CONSULTATION' "+
    "AND charge.charge_state='ACCEPTED' AND charge.support_minor>0 "+
    "AND charge.source_ref=ANY($3::uuid[])",
    [a.realmId,center,refs]);
   const byRef=new Map(q.rows.map(x=>[x.source_ref,x]));
   return {appointments:original.rows.filter(x=>byRef.has(x.appointmentRef))
    .map(x=>({...x,approvedSupportMinor:byRef.get(x.appointmentRef)!.support_minor,
     state:byRef.get(x.appointmentRef)!.liability_ref?
      "APPROVED_LIABILITY":"READY_TO_RECOGNIZE"})),
    complete:original.complete};
  });
 }
 private async charge(c:PoolClient,root:string,center:string,booking:string){
  const q=await c.query<Charge>(
   "SELECT id,source_ref,source_terms_version,source_start_at,source_end_at,"+
   "center_ref,doctor_ref,patient_ref,association_ref,policy_revision_ref,"+
   "source_digest,gross_minor::text,support_minor::text,due_minor::text,"+
   "currency,accepted_at FROM patient_charge "+
   "WHERE root_realm_id=$1 AND center_ref=$2 AND source_ref=$3 "+
   "AND source_kind='CG15_CONSULTATION' AND line_ref='CONSULTATION' "+
   "AND charge_state='ACCEPTED' FOR SHARE",[root,center,booking]);
  if(!q.rows[0]||q.rows[0].currency!=="INR")
   throw new NotFoundException({code:"HEALTHCARE_LIABILITY_CHARGE_UNAVAILABLE"});
  return q.rows[0];
 }
 private assertOriginal(charge:Charge,source:OriginalCompletedConsultation){
  if(source.appointmentRef!==charge.source_ref||
   source.centerRef!==charge.center_ref||
   source.patientRef!==charge.patient_ref||
   source.doctorRef!==charge.doctor_ref||
   source.associationRef!==charge.association_ref||
   source.termsRevision!==charge.source_terms_version||
   source.startAt.getTime()!==charge.source_start_at.getTime()||
   source.endAt.getTime()!==charge.source_end_at.getTime()||
   source.completedAt.getTime()<charge.accepted_at.getTime()||
   BigInt(charge.gross_minor)!==
    BigInt(charge.support_minor)+BigInt(charge.due_minor))
   throw new ConflictException({code:"HEALTHCARE_LIABILITY_SOURCE_CHANGED"});
 }
 private async policy(c:PoolClient,root:string,charge:Charge){
  if(!charge.policy_revision_ref)
   throw new ConflictException({code:"HEALTHCARE_LIABILITY_NO_APPROVED_POLICY"});
  const q=await c.query<Policy>(
   "SELECT id,center_ref,doctor_ref,service_kind,approval_state,"+
   "activated_at,approved_case_ref,approved_decision_ref,mode,"+
   "percent_basis_points,source_digest,valid_from,valid_until,currency "+
   "FROM healthcare_policy_revision WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
   [root,charge.policy_revision_ref]);
  const p=q.rows[0],accepted=charge.accepted_at.getTime();
  if(!p||p.service_kind!=="CONSULTATION"||
   !["ACTIVE","SUPERSEDED","WITHDRAWN"].includes(p.approval_state)||
   !p.activated_at||p.activated_at.getTime()>accepted||
   accepted<p.valid_from.getTime()||accepted>=p.valid_until.getTime()||
   p.center_ref!==charge.center_ref||
   (p.doctor_ref!==null&&p.doctor_ref!==charge.doctor_ref)||
   p.currency!=="INR"||
   (p.mode==="PERCENT"&&p.percent_basis_points===10000&&
    (!p.approved_case_ref||!p.approved_decision_ref)))
   throw new ConflictException({code:"HEALTHCARE_LIABILITY_POLICY_UNAPPROVED"});
  return p;
 }
 private async existing(c:PoolClient,root:string,center:string,booking:string){
  const q=await c.query<Liability&{effect_state:string;original_cg09_ref:string|null}>(
   "SELECT l.id,l.center_ref,l.source_ref,l.charge_ref,l.award_ref,"+
   "l.completion_event_ref,l.amount_minor::text,l.service_completed_at,"+
   "l.source_digest,l.created_at,e.posting_state AS effect_state,"+
   "e.original_cg09_ref FROM foundation_liability l "+
   "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
   "AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL' "+
   "WHERE l.root_realm_id=$1 AND l.center_ref=$2 "+
   "AND l.source_kind='CG15_CONSULTATION' AND l.source_ref=$3",
   [root,center,booking]);
  return q.rows[0]??null;
 }
 private view(liability:Liability&{effect_state:string;original_cg09_ref:string|null}){
  return {state:"APPROVED_LIABILITY" as const,
   centerRef:liability.center_ref,liabilityRef:liability.id,
   amountMinor:liability.amount_minor,currency:"INR" as const,
   originalServiceCompletedAt:liability.service_completed_at.toISOString(),
   postingState:liability.effect_state,
   foundationJournalPosted:liability.effect_state==="POSTED"&&
    liability.original_cg09_ref!==null,
   providerSettled:false,centerPatientCollectionNotUsed:true};
 }
 async status(token:string,centerRaw:string,bookingRaw:string){
  const center=id(centerRaw),booking=id(bookingRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.view");
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.view",false);
   const row=await this.existing(c,a.realmId,center,booking);
   return row?this.view(row):{state:"NOT_RECOGNIZED",
    foundationJournalPosted:false,providerSettled:false};
  });
 }
 /** Recognize one approved obligation from an immutable CG15 completed event
  * and immutable accepted CG17 policy-backed split. Does NOT require US003/004.
  * No CGI, journal, bank transfer, provider settlement or email asserted.
  */
 async recognize(token:string,centerRaw:string,bookingRaw:string,raw:unknown){
  const center=id(centerRaw),booking=id(bookingRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).length!==1||!("requestKey" in raw))
   throw new BadRequestException({code:"HEALTHCARE_LIABILITY_REQUEST_INVALID"});
  const key=id((raw as {requestKey:unknown}).requestKey);
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.manage");
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",true);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [a.realmId+":CG17_LIABILITY:"+booking]);
   const charge=await this.charge(c,a.realmId,center,booking);
   // A true zero-support accepted consultation has no Foundation payable.
   if(BigInt(charge.support_minor)===0n)
    return {state:"NO_APPROVED_SUPPORT" as const,
     foundationJournalPosted:false,providerSettled:false};
   const source=await this.completed.completed(c,a,center,booking);
   this.assertOriginal(charge,source);
   const policy=await this.policy(c,a.realmId,charge);
   const awardDigest=sha(["CG17_ORIGINAL_AWARD_V1",a.realmId,charge.id,
    charge.source_digest,policy.id,policy.source_digest,charge.support_minor]);
   const liabilityDigest=sha(["CG17_COMPLETED_LIABILITY_V1",awardDigest,
    source.completionEventRef,source.completionDigest,source.completedAt.toISOString()]);
   const prior=await this.existing(c,a.realmId,center,booking);
   if(prior){
    if(prior.source_digest!==liabilityDigest||
     BigInt(prior.amount_minor)!==BigInt(charge.support_minor)||
     prior.completion_event_ref!==source.completionEventRef)
     throw new ConflictException({code:"HEALTHCARE_LIABILITY_SOURCE_CONFLICT"});
    return {...this.view(prior),replayed:true};
   }
   const award=await c.query<{id:string}>(
    "INSERT INTO assistance_award(root_realm_id,charge_ref,center_ref,"+
    "policy_revision_ref,approved_case_ref,approved_support_minor,"+
    "source_digest,approved_by_account,request_key) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    [a.realmId,charge.id,center,policy.id,policy.approved_case_ref,
     charge.support_minor,awardDigest,a.accountId,key]);
   const stored=await c.query<Liability>(
    "INSERT INTO foundation_liability(root_realm_id,center_ref,source_kind,"+
    "source_ref,completion_event_ref,award_ref,charge_ref,service_completed_at,"+
    "amount_minor,source_digest,created_by_account) "+
    "VALUES($1,$2,'CG15_CONSULTATION',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [a.realmId,center,booking,source.completionEventRef,award.rows[0].id,
     charge.id,source.completedAt,charge.support_minor,liabilityDigest,a.accountId]);
   await c.query(
    "INSERT INTO cg17_financial_effect(root_realm_id,liability_ref,effect_kind,"+
    "source_kind,source_ref,source_revision,idempotency_key,amount_minor,"+
    "source_digest) VALUES($1,$2,'LIABILITY_ACCRUAL',"+
    "'CG15_CONSULTATION',$3,1,$4,$5,$6)",
    [a.realmId,stored.rows[0].id,booking,source.completionEventRef,
     charge.support_minor,liabilityDigest]);
   return {...this.view({...stored.rows[0],amount_minor:charge.support_minor,
    effect_state:"PENDING",original_cg09_ref:null}),replayed:false};
  });
 }
}
