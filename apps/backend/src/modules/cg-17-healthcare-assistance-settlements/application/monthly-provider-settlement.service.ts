import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(raw:unknown)=>{if(typeof raw!=="string"||!ID.test(raw))
 throw new BadRequestException({code:"CG17_SETTLEMENT_INVALID_REFERENCE"});return raw;};
const month=(raw:unknown)=>{
 if(typeof raw!=="string"||!/^(20[2-9]\d)-(0[1-9]|1[0-2])$/.test(raw))
  throw new BadRequestException({code:"CG17_SETTLEMENT_INVALID_MONTH"});
 return raw+"-01";
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const minor=(s:string)=>{
 if(typeof s!=="string"||!/^[1-9][0-9]{0,10}$/.test(s))
  throw new ConflictException({code:"CG17_SETTLEMENT_INVALID_AMOUNT"});
 return BigInt(s);
};
type Candidate={
 liability_ref:string;amount_minor:string;effect_ref:string;
 liability_digest:string;effect_digest:string;original_cg09_ref:string
};
type Claim={
 id:string;center_ref:string;provider_ref:string;period_start:string;
 state:"PROPOSED"|"APPROVED"|"PARTIALLY_SETTLED"|"SETTLED";
 revision:number;approved_total_minor:string;paid_minor:string;
 source_digest:string;destination_file_ref:string;
 destination_version:number;destination_masked_label:string;
 proposed_by:string;reviewed_by:string|null;
 reviewed_at:Date|null
};
@Injectable()
/** Actual CG17 monthly Foundation claim, not a disbursement.
 * All amounts derive from immutable genuinely CG09-posted CG15 completion
 * effects, not center patient money, mock commission or any future ERP.
 */
export class MonthlyProviderSettlementService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly centers:HealthCenterSupportScopeFacade){}
 private async tx<T>(work:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let begun=false;
  try{
   await c.query("BEGIN");begun=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await work(c);await c.query("COMMIT");begun=false;
   return value;
  }catch(e){
   if(begun)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG17_SETTLEMENT_ALREADY_EXISTS"});
   throw e;
  }finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,action:
  "healthcare.assistance.settlements.view"|
  "healthcare.assistance.settlements.manage"|
  "healthcare.assistance.settlements.review"){
  const a=await this.sessions.requireAction(token,action);
  await this.identity.assertCurrent(c,a,action);
  // The Foundation-wide ledger must never be available to a partner
  // representative merely granted own-center settlement.view.
  await this.identity.assertCurrent(c,a,"health.providers.finance.view");
  if(action==="healthcare.assistance.settlements.review")
   await this.identity.assertCurrent(c,a,"approvals.review");
  return a;
 }
 private async candidate(c:PoolClient,root:string,center:string,period:string,
  forClaim:boolean){
  const rows=await c.query<Candidate>(
   "SELECT l.id AS liability_ref,l.amount_minor::text,e.id AS effect_ref,"+
   "l.source_digest AS liability_digest,e.source_digest AS effect_digest,"+
   "e.original_cg09_ref FROM foundation_liability l "+
   "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
   "AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL' "+
   "AND e.posting_state='POSTED' AND e.original_cg09_ref IS NOT NULL "+
   "AND e.amount_minor=l.amount_minor AND e.source_digest=l.source_digest "+
   "JOIN journal j ON j.id=e.original_cg09_ref "+
   "AND j.root_realm_id=e.root_realm_id AND j.status='POSTED' "+
   "AND j.source_owner='CG-09' AND j.posting_kind='GENERAL' "+
   "AND j.source_ref=e.id AND j.immutable_source_event_key=e.idempotency_key "+
   "AND j.immutable_payload_digest=e.source_digest "+
   "AND j.posting_date=l.service_local_date "+
    "AND j.reversal_of_id IS NULL AND NOT EXISTS ("+
    "SELECT 1 FROM journal offset_j WHERE offset_j.root_realm_id=j.root_realm_id "+
    "AND offset_j.reversal_of_id=j.id AND offset_j.status='POSTED') "+
   "WHERE l.root_realm_id=$1 AND l.center_ref=$2 "+
   "AND l.source_kind='CG15_CONSULTATION' "+
   "AND l.service_local_date >=$3::date "+
   "AND l.service_local_date <($3::date+interval '1 month') "+
   (forClaim?
    "AND NOT EXISTS(SELECT 1 FROM provider_settlement_line line "+
    "WHERE line.root_realm_id=l.root_realm_id AND line.liability_ref=l.id) ":"")+
   "ORDER BY l.id LIMIT 101 FOR SHARE OF l,e,j",
   [root,center,period]);
  if(rows.rows.length>100)
   throw new ConflictException({code:"CG17_SETTLEMENT_MONTH_REQUIRES_BOUNDED_REVIEW"});
  return rows.rows;
 }
 private async claim(c:PoolClient,root:string,center:string,period:string,
  lock:boolean){
  const q=await c.query<Claim>(
   "SELECT id,center_ref,provider_ref,period_start::text,state,revision,"+
   "approved_total_minor::text,paid_minor::text,source_digest,"+
   "destination_file_ref,destination_version,destination_masked_label,"+
   "proposed_by,reviewed_by,reviewed_at FROM provider_settlement "+
   "WHERE root_realm_id=$1 AND center_ref=$2 AND period_start=$3::date "+
   (lock?"FOR UPDATE":"FOR SHARE"),
   [root,center,period]);
  return q.rows[0]??null;
 }
 private view(c:Claim){
  const total=minor(c.approved_total_minor),paid=BigInt(c.paid_minor);
  if(paid<0n||paid>total)
   throw new ConflictException({code:"CG17_SETTLEMENT_INVALID_LEDGER"});
  return {settlementRef:c.id,centerRef:c.center_ref,
   month:c.period_start.slice(0,7),revision:c.revision,
   approvedFoundationMinor:c.approved_total_minor,actualPaidMinor:c.paid_minor,
   outstandingMinor:(total-paid).toString(),currency:"INR" as const,
   state:c.state,
   independentlyApproved:c.state!=="PROPOSED",
   paidVerified:c.state==="SETTLED",
   patientCollectionNotFoundationIncome:true,
   reviewedAt:c.reviewed_at?.toISOString()??null};
 }
 /** H17 real source breakdown: eligible services completed in this selected
  * center/month; center payments are VERIFIED to date for THOSE services
  * (not necessarily received inside the calendar month). No patient IDs.
  * Nothing in this read writes a journal or determines provider commission.
  */
 private async breakdown(c:PoolClient,root:string,center:string,period:string){
  const result=await c.query<{
   gross_minor:string;patient_due_minor:string;
   foundation_liability_minor:string;verified_center_minor:string;
   center_refund_minor:string}>(
   "WITH services AS (SELECT liability.charge_ref,"+
   "liability.amount_minor,charge.gross_minor,charge.due_minor "+
   "FROM foundation_liability liability "+
   "JOIN patient_charge charge ON charge.root_realm_id=liability.root_realm_id "+
   "AND charge.id=liability.charge_ref AND charge.center_ref=liability.center_ref "+
   "WHERE liability.root_realm_id=$1 AND liability.center_ref=$2 "+
   "AND liability.service_local_date >=$3::date "+
   "AND liability.service_local_date <($3::date+interval '1 month') "+
   "AND NOT EXISTS (SELECT 1 FROM cg17_liability_correction corrected "+
   "WHERE corrected.root_realm_id=liability.root_realm_id "+
   "AND corrected.liability_ref=liability.id)) "+
   "SELECT (SELECT coalesce(sum(gross_minor),0) FROM services)::text "+
   "AS gross_minor,(SELECT coalesce(sum(due_minor),0) FROM services)::text "+
   "AS patient_due_minor,"+
   "(SELECT coalesce(sum(amount_minor),0) FROM services)::text "+
   "AS foundation_liability_minor,"+
   "(SELECT coalesce(sum(collect.amount_minor),0) FROM center_collection collect "+
   "JOIN services s ON s.charge_ref=collect.charge_ref "+
   "WHERE collect.root_realm_id=$1 AND collect.center_ref=$2 "+
   "AND collect.verification_state IN('VERIFIED_CASH','VERIFIED_PROVIDER'))::text "+
   "AS verified_center_minor,"+
   "(SELECT coalesce(sum(adjustment.refund_minor),0) "+
   "FROM center_collection_adjustment adjustment "+
   "JOIN center_collection collect ON collect.root_realm_id=adjustment.root_realm_id "+
   "AND collect.id=adjustment.collection_ref "+
   "JOIN services s ON s.charge_ref=collect.charge_ref "+
   "WHERE adjustment.root_realm_id=$1 AND collect.center_ref=$2)::text "+
   "AS center_refund_minor",
   [root,center,period]);
  const v=result.rows[0];
  if(!v)throw new ConflictException({code:"CG17_SETTLEMENT_BREAKDOWN_UNAVAILABLE"});
  const verified=BigInt(v.verified_center_minor),
   refunds=BigInt(v.center_refund_minor);
  if(verified<refunds||refunds<0n)
   throw new ConflictException({code:"CG17_SETTLEMENT_CENTER_RECEIPT_CONFLICT"});
  return {
   centerGrossServicesMinor:v.gross_minor,
   patientPayableMinor:v.patient_due_minor,
   patientCollectedVerifiedMinor:(verified-refunds).toString(),
   patientRefundedMinor:refunds.toString(),
   foundationApprovedLiabilityMinor:v.foundation_liability_minor,
   collectionsScope:"VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES" as const
  };
 }
 async eligibleCenters(token:string){
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.settlements.view");
   return this.centers.eligibleFoundationCenters(c,a,
    "healthcare.assistance.settlements.view");
  });
 }
 async statement(token:string,centerRaw:string,monthRaw:string){
  const center=id(centerRaw),period=month(monthRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.settlements.view");
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.settlements.view",false);
   const breakdown=await this.breakdown(c,a.realmId,center,period);
   const saved=await this.claim(c,a.realmId,center,period,false);
   if(saved){
    const view=this.view(saved);
    if(saved.state==="PROPOSED")return {...view,
     eligibleAccruedMinor:view.approvedFoundationMinor,
     proposedClaimMinor:view.approvedFoundationMinor,
     approvedFoundationMinor:"0",outstandingMinor:"0",
     ...breakdown};
    return {...view,eligibleAccruedMinor:"0",proposedClaimMinor:"0",
     ...breakdown};
   }
   // An unapproved view is a truthful aggregate only; it never creates a due.
   const rows=await this.candidate(c,a.realmId,center,period,false);
   return {month:period.slice(0,7),state:"NOT_PREPARED",
    postedLiabilities:rows.length,
    eligibleAccruedMinor:rows.reduce(
     (sum,x)=>sum+minor(x.amount_minor),0n).toString(),
    proposedClaimMinor:"0",approvedFoundationMinor:"0",
    actualPaidMinor:"0",outstandingMinor:"0",
    paidVerified:false,patientCollectionNotFoundationIncome:true,
    ...breakdown};
  });
 }
 /** Center Portal read projection of the SAME original Foundation claim.
  * CG14 owns center scope; CG17 owns only the source-backed finance numbers.
  * No claims, approvals, bank details, or Foundation-wide center discovery.
  */
 async ownCenters(token:string){
  return this.tx(async c=>{
   const actor=await this.sessions.requireAction(token,
    "healthcare.assistance.settlements.view");
   const centers=await this.centers.assignedCenters(c,actor,
    "healthcare.assistance.settlements.view");
   return {centers};
  });
 }
 async ownCenterStatement(token:string,centerRaw:string,monthRaw:string){
  const center=id(centerRaw),period=month(monthRaw);
  return this.tx(async c=>{
   const a=await this.sessions.requireAction(token,
    "healthcare.assistance.settlements.view");
   await this.centers.assertCurrent(c,a,center,
    "healthcare.assistance.settlements.view");
   const breakdown=await this.breakdown(c,a.realmId,center,period);
   const claim=await this.claim(c,a.realmId,center,period,false);
   if(claim){
    const view=this.view(claim);
    const approved=claim.state!=="PROPOSED";
    // Proposal is NOT an approved or outstanding payable. Keep that
    // amount visible only in a separately named proposed/awaiting field.
    return {month:view.month,state:view.state,
     proposedClaimMinor:approved?"0":view.approvedFoundationMinor,
     eligibleAccruedMinor:approved?"0":view.approvedFoundationMinor,
     approvedFoundationMinor:approved?view.approvedFoundationMinor:"0",
     actualPaidMinor:approved?view.actualPaidMinor:"0",
     outstandingMinor:approved?view.outstandingMinor:"0",
     paidVerified:approved&&view.paidVerified,
     ...breakdown,patientCollectionNotFoundationIncome:true};
   }
   const rows=await this.candidate(c,a.realmId,center,period,false);
   return {month:period.slice(0,7),state:"NOT_PREPARED",
    eligibleAccruedMinor:rows.reduce((sum,x)=>sum+minor(x.amount_minor),0n).toString(),
    approvedFoundationMinor:"0",actualPaidMinor:"0",outstandingMinor:"0",
    paidVerified:false,patientCollectionNotFoundationIncome:true,...breakdown};
  });
 }
 async propose(token:string,centerRaw:string,monthRaw:string,raw:unknown){
  const center=id(centerRaw),period=month(monthRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==1||!("requestKey" in raw))
   throw new BadRequestException({code:"CG17_SETTLEMENT_INVALID_REQUEST"});
  const key=id((raw as {requestKey:unknown}).requestKey);
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.settlements.manage");
   const destination=await this.centers.verifiedFoundationSettlementDestination(
    c,a,center,"healthcare.assistance.settlements.manage");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [a.realmId+":CG17_SETTLEMENT:"+center+":"+period]);
   const existing=await this.claim(c,a.realmId,center,period,true);
   if(existing){
    const q=await c.query<{proposed_request_key:string}>(
     "SELECT proposed_request_key FROM provider_settlement "+
     "WHERE root_realm_id=$1 AND id=$2",
     [a.realmId,existing.id]);
    if(q.rows[0]?.proposed_request_key!==key)
     throw new ConflictException({code:"CG17_SETTLEMENT_ALREADY_PREPARED"});
    return {...this.view(existing),replayed:true};
   }
   const candidates=await this.candidate(c,a.realmId,center,period,true);
   if(!candidates.length)
    throw new NotFoundException({code:"CG17_SETTLEMENT_NO_POSTED_OBLIGATIONS"});
   const total=candidates.reduce((n,x)=>n+minor(x.amount_minor),0n);
   if(total<1n||total>10000000000n)
    throw new ConflictException({code:"CG17_SETTLEMENT_AMOUNT_LIMIT"});
   const sourceDigest=sha(["CG17_MONTHLY_PROVIDER_CLAIM_V1",a.realmId,
    center,period,destination.providerRef,destination.fileRef,
    destination.version,candidates.map(x=>[
     x.liability_ref,x.amount_minor,x.effect_ref,x.effect_digest,
     x.original_cg09_ref])]);
   const saved=await c.query<Claim>(
    "INSERT INTO provider_settlement(root_realm_id,center_ref,provider_ref,"+
    "period_start,period_end,approved_total_minor,source_digest,"+
    "destination_file_ref,destination_version,destination_masked_label,"+
    "proposed_by,proposed_request_key) VALUES($1,$2,$3,$4::date,"+
    "($4::date+interval '1 month')::date,$5,$6,$7,$8,$9,$10,$11) "+
    "RETURNING id,center_ref,provider_ref,period_start::text,state,revision,"+
    "approved_total_minor::text,paid_minor::text,source_digest,"+
    "destination_file_ref,destination_version,destination_masked_label,"+
    "proposed_by,reviewed_by,reviewed_at",
    [a.realmId,center,destination.providerRef,period,total.toString(),
     sourceDigest,destination.fileRef,destination.version,
     destination.maskedLabel,a.accountId,key]);
   const claim=saved.rows[0];
   for(const row of candidates){
    await c.query(
     "INSERT INTO provider_settlement_line(root_realm_id,settlement_ref,"+
     "center_ref,liability_ref,amount_minor,original_effect_ref) "+
     "VALUES($1,$2,$3,$4,$5,$6)",
     [a.realmId,claim.id,center,row.liability_ref,row.amount_minor,
      row.effect_ref]);
   }
   return {...this.view(claim),replayed:false};
  });
 }
 async review(token:string,centerRaw:string,monthRaw:string,raw:unknown){
  const center=id(centerRaw),period=month(monthRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==2||!("requestKey" in raw)||
    !("expectedRevision" in raw))
   throw new BadRequestException({code:"CG17_SETTLEMENT_REVIEW_INVALID"});
  const key=id((raw as {requestKey:unknown}).requestKey);
  const revision=(raw as {expectedRevision:unknown}).expectedRevision;
  if(!Number.isSafeInteger(revision)||Number(revision)<1)
   throw new BadRequestException({code:"CG17_SETTLEMENT_REVIEW_INVALID_REVISION"});
  return this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.settlements.review");
   const destination=await this.centers.verifiedFoundationSettlementDestination(
    c,a,center,"healthcare.assistance.settlements.review");
   const saved=await this.claim(c,a.realmId,center,period,true);
   if(!saved)throw new NotFoundException({code:"CG17_SETTLEMENT_CLAIM_NOT_FOUND"});
   if(saved.state!=="PROPOSED"){
    const existing=await c.query<{reviewed_request_key:string|null}>(
     "SELECT reviewed_request_key FROM provider_settlement "+
     "WHERE root_realm_id=$1 AND id=$2",
     [a.realmId,saved.id]);
    if(saved.reviewed_by===a.accountId&&
     existing.rows[0]?.reviewed_request_key===key)
     return {...this.view(saved),replayed:true};
    throw new ConflictException({code:"CG17_SETTLEMENT_ALREADY_REVIEWED"});
   }
   if(saved.revision!==revision||saved.proposed_by===a.accountId)
    throw new ConflictException({code:"CG17_SETTLEMENT_INDEPENDENT_REVIEW_REQUIRED"});
   if(destination.providerRef!==saved.provider_ref||
    destination.fileRef!==saved.destination_file_ref||
    destination.version!==saved.destination_version||
    destination.maskedLabel!==saved.destination_masked_label)
    throw new ConflictException({code:"CG17_SETTLEMENT_BANK_PROOF_CHANGED"});
   const current=await c.query<Candidate>(
    "SELECT line.liability_ref,line.amount_minor::text,e.id AS effect_ref,"+
    "l.source_digest AS liability_digest,e.source_digest AS effect_digest,"+
    "e.original_cg09_ref FROM provider_settlement_line line "+
    "JOIN foundation_liability l ON l.root_realm_id=line.root_realm_id "+
    "AND l.id=line.liability_ref AND l.center_ref=line.center_ref "+
    "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
    "AND e.id=line.original_effect_ref AND e.liability_ref=l.id "+
    "AND e.effect_kind='LIABILITY_ACCRUAL' AND e.posting_state='POSTED' "+
    "AND e.original_cg09_ref IS NOT NULL "+
    "AND e.amount_minor=l.amount_minor AND e.source_digest=l.source_digest "+
    "JOIN journal j ON j.id=e.original_cg09_ref "+
    "AND j.root_realm_id=e.root_realm_id AND j.status='POSTED' "+
    "AND j.source_owner='CG-09' AND j.posting_kind='GENERAL' "+
    "AND j.source_ref=e.id AND j.immutable_source_event_key=e.idempotency_key "+
    "AND j.immutable_payload_digest=e.source_digest "+
    "AND j.posting_date=l.service_local_date "+
    "AND j.reversal_of_id IS NULL AND NOT EXISTS ("+
    "SELECT 1 FROM journal offset_j WHERE offset_j.root_realm_id=j.root_realm_id "+
    "AND offset_j.reversal_of_id=j.id AND offset_j.status='POSTED') "+
    "WHERE line.root_realm_id=$1 AND line.settlement_ref=$2 "+
    "AND line.center_ref=$3 AND l.service_local_date >=$4::date "+
    "AND l.service_local_date <($4::date+interval '1 month') "+
    "ORDER BY line.liability_ref LIMIT 101 FOR SHARE OF line,l,e,j",
    [a.realmId,saved.id,center,period]);
   if(current.rows.length<1||current.rows.length>100)
    throw new ConflictException({code:"CG17_SETTLEMENT_LINES_CHANGED"});
   const sum=current.rows.reduce((n,x)=>n+minor(x.amount_minor),0n);
   const digest=sha(["CG17_MONTHLY_PROVIDER_CLAIM_V1",a.realmId,
    center,period,destination.providerRef,destination.fileRef,
    destination.version,current.rows.map(x=>[
     x.liability_ref,x.amount_minor,x.effect_ref,x.effect_digest,
     x.original_cg09_ref])]);
   if(sum.toString()!==saved.approved_total_minor||
    digest!==saved.source_digest)
    throw new ConflictException({code:"CG17_SETTLEMENT_ORIGINAL_SOURCE_CHANGED"});
   const changed=await c.query<Claim>(
    "UPDATE provider_settlement SET state='APPROVED',revision=revision+1,"+
    "reviewed_by=$4,reviewed_at=now(),reviewed_request_key=$5 "+
    "WHERE root_realm_id=$1 AND center_ref=$2 AND id=$3 "+
    "AND state='PROPOSED' AND revision=$6 "+
    "RETURNING id,center_ref,provider_ref,period_start::text,state,revision,"+
    "approved_total_minor::text,paid_minor::text,source_digest,"+
    "destination_file_ref,destination_version,destination_masked_label,"+
    "proposed_by,reviewed_by,reviewed_at",
    [a.realmId,center,saved.id,a.accountId,key,revision]);
   if(!changed.rows[0])
    throw new ConflictException({code:"CG17_SETTLEMENT_REVIEW_RACE"});
   return {...this.view(changed.rows[0]),replayed:false};
  });
 }
}
