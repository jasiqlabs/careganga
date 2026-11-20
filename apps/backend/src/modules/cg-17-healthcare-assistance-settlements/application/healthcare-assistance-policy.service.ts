import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthcarePolicyApprovalService}
 from "../../cg-03-registration-approvals/application/healthcare-policy-approval.service";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MONEY=/^(0|[1-9]\d{0,10})$/;
const serviceKinds=["CONSULTATION","LAB","PHARMACY","NURSING","OT"] as const;
type Kind=(typeof serviceKinds)[number];
type Mode="PERCENT"|"FIXED";
type Revision={
 id:string;policy_ref:string;center_ref:string;doctor_ref:string|null;
 service_kind:Kind;revision_no:number;valid_from:Date;valid_until:Date;
 mode:Mode;percent_basis_points:number|null;fixed_minor:string|null;
 cap_minor:string;eligibility:string;approval_state:string;created_at:Date;
 actor_ref:string;approved_case_ref:string|null;approved_decision_ref:string|null;
 request_digest:string;request_key:string;source_digest:string;
 review_case_ref?:string|null;review_status?:string|null
};
const uuid=(x:unknown)=>{
 if(typeof x!=="string"||!ID.test(x))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID_REFERENCE"});
 return x;
};
const canonical=(x:unknown,keys:string[])=>{
 if(!x||typeof x!=="object"||Array.isArray(x)||
    Object.keys(x).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
 return x as Record<string,unknown>;
};
const time=(v:unknown)=>{
 if(typeof v!=="string"||!ISO.test(v)||!Number.isFinite(Date.parse(v))||
    new Date(v).toISOString()!==v)
  throw new BadRequestException({code:"ASSISTANCE_POLICY_DATES_INVALID"});
 return new Date(v);
};
const money=(v:unknown)=>{
 if(typeof v!=="string"||!MONEY.test(v)||
  BigInt(v)<1n||BigInt(v)>10000000000n)
  throw new BadRequestException({code:"ASSISTANCE_POLICY_AMOUNT_INVALID"});
 return v;
};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const fromInput=(raw:unknown)=>{
 const d=canonical(raw,["requestKey","policyRef","expectedRevision","centerRef",
  "doctorRef","serviceKind","validFrom","validUntil","mode",
  "percentBasisPoints","fixedMinor","capMinor"]);
 const requestKey=uuid(d.requestKey),centerRef=uuid(d.centerRef);
 const policyRef=d.policyRef==null?null:uuid(d.policyRef);
 const expectedValue=d.expectedRevision??0;
 if(typeof expectedValue!=="number"||!Number.isSafeInteger(expectedValue))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
 const expected=expectedValue;
 if(expected<0||
   expected>2147483646||Boolean(policyRef)!==(expected>0)||
   !serviceKinds.includes(d.serviceKind as Kind)||
   !["PERCENT","FIXED"].includes(String(d.mode)))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
 const doctorRef=d.doctorRef===null||d.doctorRef===undefined?null:uuid(d.doctorRef);
 const from=time(d.validFrom),until=time(d.validUntil);
 if(until<=from)throw new BadRequestException({code:"ASSISTANCE_POLICY_DATES_INVALID"});
 const mode=d.mode as Mode;
 const bps=mode==="PERCENT"?Number(d.percentBasisPoints):null;
 if(mode==="PERCENT"&&(typeof d.percentBasisPoints!=="number"||
    !Number.isInteger(d.percentBasisPoints)||
    bps===null||bps<1||bps>10000||d.fixedMinor!==undefined))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_PERCENT_INVALID"});
 if(mode==="FIXED"&&d.percentBasisPoints!==undefined)
  throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
 const fixed=mode==="FIXED"?money(d.fixedMinor):null;
 const cap=money(d.capMinor);
 if(fixed!==null&&BigInt(fixed)>BigInt(cap))
  throw new BadRequestException({code:"ASSISTANCE_POLICY_CAP_INVALID"});
 return {requestKey,policyRef,expected,centerRef,doctorRef,
  serviceKind:d.serviceKind as Kind,mode,bps,fixed,cap,from,until,
  eligibility:"VERIFIED_PATIENT_CARE" as const};
};
const view=(r:Revision)=>({
 policyRef:r.policy_ref,revisionRef:r.id,centerRef:r.center_ref,
 doctorRef:r.doctor_ref,serviceKind:r.service_kind,revision:r.revision_no,
 validFrom:new Date(r.valid_from).toISOString(),
 validUntil:new Date(r.valid_until).toISOString(),
 mode:r.mode,percentBasisPoints:r.percent_basis_points,
 fixedMinor:r.fixed_minor,capMinor:r.cap_minor,currency:"INR",
 eligibility:r.eligibility,status:r.approval_state,
 current:new Date(r.valid_from).getTime()<=Date.now()&&
  new Date(r.valid_until).getTime()>Date.now()&&r.approval_state==="ACTIVE",
 approvedByIndependentReview:!!r.approved_case_ref&&!!r.approved_decision_ref,
 createdAt:new Date(r.created_at).toISOString(),
 reviewCaseRef:r.review_case_ref??null,reviewStatus:r.review_status??null
});

/** CG17 US001: configure real center/doctor assistance policy WITHOUT
 * creating a patient booking, paying a provider, or advertising screenshot
 * discounts. 100% needs the original CG03 exception finalizer (not yet
 * delivered): the source stays PENDING_APPROVAL, never patient effective.
 */
@Injectable()
export class HealthcareAssistancePolicyService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly approval:HealthcarePolicyApprovalService){}
 private async tx<T>(job:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const v=await job(c);await c.query("COMMIT");open=false;return v;
  }catch(e){
   if(open)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
     (e.code==="23505"||e.code==="23P01"))
    throw new ConflictException({code:"ASSISTANCE_POLICY_OVERLAP_OR_REPLAY"});
   throw e;
  }finally{c.release();}
 }
 private async actor(c:PoolClient,bearer:string,
  action:"healthcare.assistance.policies.view"|
   "healthcare.assistance.policies.manage"){
  const user=await this.sessions.requireAction(bearer,action);
  await this.identity.assertCurrent(c,user,action);
  return user;
 }
 private async requireCenter(c:PoolClient,root:string,center:string){
  const q=await c.query<{name:string}>(
   "SELECT center.display_name AS name FROM health_center center "+
   "JOIN health_provider provider ON provider.root_realm_id=center.root_realm_id "+
   "AND provider.id=center.provider_id "+
   "WHERE center.root_realm_id=$1 AND center.id=$2 "+
   "AND center.status='VERIFIED' AND center.access_state='ENABLED' "+
   "AND provider.status='VERIFIED' FOR SHARE OF center,provider",
   [root,center]);
  if(!q.rows[0])throw new NotFoundException({code:"ASSISTANCE_CENTER_NOT_VERIFIED"});
  return q.rows[0];
 }
 private async requireDoctor(c:PoolClient,root:string,center:string,doctor:string){
  const q=await c.query<{name:string}>(
   "SELECT d.full_name AS name FROM health_doctor_center membership "+
   "JOIN health_doctor d ON d.root_realm_id=membership.root_realm_id "+
   "AND d.id=membership.doctor_id "+
   "JOIN health_center center ON center.root_realm_id=membership.root_realm_id "+
   "AND center.id=membership.center_id "+
   "JOIN health_doctor_revision revision ON revision.root_realm_id=d.root_realm_id "+
   "AND revision.doctor_id=d.id "+
   "AND revision.revision_no=(SELECT max(latest.revision_no) "+
   "FROM health_doctor_revision latest WHERE latest.root_realm_id=d.root_realm_id "+
   "AND latest.doctor_id=d.id) "+
   "JOIN cg03_case reviewed ON reviewed.realm_id=revision.root_realm_id "+
   "AND reviewed.id=revision.approval_case_ref "+
   "AND reviewed.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
   "AND reviewed.health_doctor_id=d.id AND "+
   "reviewed.health_doctor_revision_id=revision.id "+
   "AND reviewed.health_source_digest=revision.source_digest "+
   "AND reviewed.status='OWNER_COMPLETED' "+
   "JOIN cg03_case_decision decision ON decision.realm_id=reviewed.realm_id "+
   "AND decision.case_id=reviewed.id AND decision.action='APPROVE' "+
   "AND decision.actor_id<>reviewed.proposer_id "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "JOIN cg19_stored_file proof ON proof.realm_id=revision.root_realm_id "+
   "AND proof.id=revision.proof_file_ref AND proof.owner_kind='CG14_DOCTOR' "+
   "AND proof.health_doctor_id=d.id AND proof.scan_status='CLEAN_VERIFIED' "+
   "AND proof.revoked_at IS NULL "+
   "WHERE membership.root_realm_id=$1 AND membership.center_id=$2 "+
   "AND membership.doctor_id=$3 AND membership.affiliation_state='APPROVED' "+
   "AND membership.approved_from<=now() "+
   "AND (membership.approved_to IS NULL OR membership.approved_to>now()) "+
   "AND d.status='VERIFIED' AND "+
   "d.professional_license_valid_through >= "+
   "(now() AT TIME ZONE center.time_zone)::date "+
   "AND revision.source_snapshot->>'professionalLicenseValidThrough' = "+
   "to_char(d.professional_license_valid_through,'YYYY-MM-DD') "+
   "FOR SHARE OF membership,d,center,revision,proof",
   [root,center,doctor]);
  if(!q.rows[0])throw new NotFoundException({code:"ASSISTANCE_DOCTOR_NOT_VERIFIED"});
  return q.rows[0];
 }
 async options(bearer:string){
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.view");
   const centers=await c.query<{centerRef:string;name:string}>(
    "SELECT center.id AS \"centerRef\",center.display_name AS name "+
    "FROM health_center center JOIN health_provider p ON "+
    "p.root_realm_id=center.root_realm_id AND p.id=center.provider_id "+
    "WHERE center.root_realm_id=$1 AND center.status='VERIFIED' "+
    "AND center.access_state='ENABLED' AND p.status='VERIFIED' "+
    "ORDER BY center.display_name,center.id LIMIT 101",[actor.realmId]);
   if(centers.rows.length>100)
    throw new ConflictException({code:"ASSISTANCE_CENTER_LIST_LIMIT"});
   return {centers:centers.rows,serviceKinds:serviceKinds.map(kind=>({
    kind,canActivate:kind==="CONSULTATION"}))};
  });
 }
 async doctors(bearer:string,rawCenter:string){
  const center=uuid(rawCenter);
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.view");
   await this.requireCenter(c,actor.realmId,center);
   // Single bounded source-backed selector. Do not N+1 private CG14 proof
   // reads for 100 doctors (or expose unverified/revoked practitioners).
   const result=await c.query<{doctorRef:string;name:string}>(
    "SELECT d.id AS \"doctorRef\",d.full_name AS name "+
    "FROM health_doctor_center affiliation "+
    "JOIN health_doctor d ON d.root_realm_id=affiliation.root_realm_id "+
    "AND d.id=affiliation.doctor_id "+
    "JOIN health_center center ON center.root_realm_id=affiliation.root_realm_id "+
    "AND center.id=affiliation.center_id "+
    "WHERE affiliation.root_realm_id=$1 AND affiliation.center_id=$2 "+
    "AND affiliation.affiliation_state='APPROVED' "+
    "AND affiliation.approved_from<=now() AND "+
    "(affiliation.approved_to IS NULL OR affiliation.approved_to>now()) "+
    "AND d.status='VERIFIED' AND d.professional_license_valid_through >= "+
    "(now() AT TIME ZONE center.time_zone)::date "+
    "AND EXISTS(SELECT 1 FROM health_doctor_revision revision "+
    "JOIN cg03_case review ON review.realm_id=revision.root_realm_id "+
    "AND review.id=revision.approval_case_ref "+
    "AND review.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
    "AND review.health_doctor_id=d.id "+
    "AND review.health_doctor_revision_id=revision.id "+
    "AND review.health_source_digest=revision.source_digest "+
    "AND review.status='OWNER_COMPLETED' "+
    "JOIN cg03_case_decision decision ON decision.realm_id=review.realm_id "+
    "AND decision.case_id=review.id AND decision.action='APPROVE' "+
    "AND decision.actor_id<>review.proposer_id "+
    "AND decision.fresh_password_verified_at IS NOT NULL "+
    "JOIN cg19_stored_file proof ON proof.realm_id=revision.root_realm_id "+
    "AND proof.id=revision.proof_file_ref "+
    "AND proof.owner_kind='CG14_DOCTOR' AND proof.health_doctor_id=d.id "+
    "AND proof.scan_status='CLEAN_VERIFIED' AND proof.revoked_at IS NULL "+
    "WHERE revision.root_realm_id=d.root_realm_id "+
    "AND revision.doctor_id=d.id AND "+
    "revision.revision_no=(SELECT max(latest.revision_no) "+
    "FROM health_doctor_revision latest "+
    "WHERE latest.root_realm_id=d.root_realm_id AND latest.doctor_id=d.id) "+
    "AND revision.source_snapshot->>'professionalLicenseValidThrough' = "+
    "to_char(d.professional_license_valid_through,'YYYY-MM-DD')) "+
    "ORDER BY d.full_name,d.id LIMIT 101",[actor.realmId,center]);
   if(result.rows.length>100)
    throw new ConflictException({code:"ASSISTANCE_DOCTOR_LIST_LIMIT"});
   return {doctors:result.rows};
  });
 }
 /** Read-only CG14 consultation fee / actual effective CG17 rule arithmetic.
  * Patient eligibility remains UNVERIFIED until CG15 and US002 accept
  * the actual patient/service source. Never write a charge or promised award.
  */
 async preview(bearer:string,centerRaw:string,doctorRaw:string){
  const center=uuid(centerRaw),doctor=uuid(doctorRaw);
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.view");
   await this.requireCenter(c,actor.realmId,center);
   await this.requireDoctor(c,actor.realmId,center,doctor);
   const assoc=await c.query<{id:string}>(
    "SELECT id FROM health_doctor_center WHERE root_realm_id=$1 "+
    "AND center_id=$2 AND doctor_id=$3 AND affiliation_state='APPROVED' "+
    "AND approved_from<=now() AND "+
    "(approved_to IS NULL OR approved_to>now())",
    [actor.realmId,center,doctor]);
   if(!assoc.rows[0])
    throw new NotFoundException({code:"ASSISTANCE_DOCTOR_NOT_VERIFIED"});
   const fee=await c.query<{id:string;version:number;minor:string}>(
    "SELECT id,version,amount_minor::text AS minor FROM health_center_fee "+
    "WHERE root_realm_id=$1 AND doctor_center_id=$2 "+
    "AND fee_kind='CONSULTATION' AND consultation_mode='IN_PERSON' "+
    "AND status='APPROVED' AND effective_from<=now() "+
    "AND (effective_to IS NULL OR effective_to>now()) "+
    "ORDER BY effective_from DESC,id DESC LIMIT 1",
    [actor.realmId,assoc.rows[0].id]);
   if(!fee.rows[0])return {state:"NO_APPROVED_FEE" as const,
    eligiblePatientVerified:false};
   const policies=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision "+
    "WHERE root_realm_id=$1 AND center_ref=$2 "+
    "AND service_kind='CONSULTATION' "+
    "AND (doctor_ref=$3 OR doctor_ref IS NULL) "+
    "AND approval_state='ACTIVE' AND valid_from<=now() AND valid_until>now() "+
    "ORDER BY (doctor_ref IS NOT NULL) DESC,valid_from DESC,id DESC LIMIT 1",
    [actor.realmId,center,doctor]);
   const policy=policies.rows[0];
   const gross=BigInt(fee.rows[0].minor);
   if(!policy)return {state:"NO_EFFECTIVE_POLICY" as const,
    grossMinor:gross.toString(),currency:"INR" as const,
    actualFeeRef:fee.rows[0].id,actualFeeVersion:fee.rows[0].version,
    eligiblePatientVerified:false};
   const cap=BigInt(policy.cap_minor);
   const proposed=policy.mode==="PERCENT"&&policy.percent_basis_points!==null?
    (gross*BigInt(policy.percent_basis_points)+5000n)/10000n:
    BigInt(policy.fixed_minor??"0");
   const support=proposed<cap?proposed:cap;
   const bounded=support<gross?support:gross;
   return {state:"POLICY_ESTIMATE_ONLY" as const,
    grossMinor:gross.toString(),estimatedSupportMinor:bounded.toString(),
    estimatedPatientDueMinor:(gross-bounded).toString(),
    actualFeeRef:fee.rows[0].id,actualFeeVersion:fee.rows[0].version,
    policyRevisionRef:policy.id,policyRevision:policy.revision_no,
    currency:"INR" as const,eligiblePatientVerified:false,
    caution:"Not a confirmed patient entitlement or accepted charge. "+
     "CG15 patient eligibility, service and consent must be verified before any award."};
  });
 }
 async list(bearer:string,rawCenter:string){
  const center=uuid(rawCenter);
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.view");
   await this.requireCenter(c,actor.realmId,center);
   const q=await c.query<Revision>(
    "SELECT policy.*,review.id AS review_case_ref,review.status AS review_status "+
    "FROM healthcare_policy_revision policy "+
    "LEFT JOIN cg03_case review ON review.realm_id=policy.root_realm_id "+
    "AND review.case_kind='CG17_POLICY_EXCEPTION' "+
    "AND review.cg17_policy_revision_id=policy.id "+
    "WHERE policy.root_realm_id=$1 AND policy.center_ref=$2 "+
    "ORDER BY policy.created_at DESC,policy.id DESC LIMIT 101",
    [actor.realmId,center]);
   if(q.rows.length>100)
    throw new ConflictException({code:"ASSISTANCE_POLICY_LIST_LIMIT"});
   return {centerRef:center,policies:q.rows.map(view)};
  });
 }
 async submit(bearer:string,raw:unknown){
  const v=fromInput(raw);
  const full=v.mode==="PERCENT"&&v.bps===10000;
  // Optional US005/006 future clinical ERP owners may have configured
  // internal policies, but not any eligible source to make them public.
  const active=v.serviceKind==="CONSULTATION"&&!full;
  const state=active?"ACTIVE":"PENDING_APPROVAL";
  const hash=digest(["CG17_POLICY_V1",v.centerRef,v.doctorRef,
   v.serviceKind,v.policyRef,v.expected,v.from.toISOString(),
   v.until.toISOString(),v.mode,v.bps,v.fixed,v.cap,v.eligibility]);
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.manage");
   await this.requireCenter(c,actor.realmId,v.centerRef);
   if(v.doctorRef)await this.requireDoctor(c,actor.realmId,v.centerRef,v.doctorRef);
   const unique=v.centerRef+":"+v.serviceKind+":"+(v.doctorRef??"CENTER");
   // One source scope lock and one request lock, no global Foundation lock.
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+unique]);
   const priorRequest=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,v.requestKey]);
   if(priorRequest.rows[0]){
    if(priorRequest.rows[0].request_digest!==hash)
     throw new ConflictException({code:"ASSISTANCE_POLICY_REQUEST_CONFLICT"});
    return {...view(priorRequest.rows[0]),replayed:true};
   }
   if(v.policyRef){
    const previous=await c.query<Revision>(
     "SELECT * FROM healthcare_policy_revision "+
     "WHERE root_realm_id=$1 AND policy_ref=$2 "+
     "ORDER BY revision_no DESC LIMIT 1 FOR UPDATE",
     [actor.realmId,v.policyRef]);
    const old=previous.rows[0];
    if(!old||old.center_ref!==v.centerRef||
      old.doctor_ref!==v.doctorRef||old.service_kind!==v.serviceKind||
      old.revision_no!==v.expected||old.approval_state!=="ACTIVE")
     throw new ConflictException({code:"ASSISTANCE_POLICY_REVISION_CHANGED"});
    // Pending protected full-support revision never silently withdraws
    // currently effective assistance before an independent CG03 approval.
    if(active)await c.query(
     "UPDATE healthcare_policy_revision SET approval_state='SUPERSEDED',"+
     "changed_by=$3,changed_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND approval_state='ACTIVE'",
     [actor.realmId,old.id,actor.accountId]);
   }else if(v.expected!==0){
    throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
   }
   const policyRef=v.policyRef??randomUUID();
   const version=v.expected+1;
   const row=await c.query<Revision>(
    "INSERT INTO healthcare_policy_revision(root_realm_id,policy_ref,"+
    "center_ref,doctor_ref,service_kind,revision_no,valid_from,valid_until,"+
    "mode,percent_basis_points,fixed_minor,cap_minor,eligibility,"+
    "approval_state,actor_ref,request_key,request_digest,source_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) "+
    "RETURNING *",
    [actor.realmId,policyRef,v.centerRef,v.doctorRef,v.serviceKind,version,
     v.from,v.until,v.mode,v.bps,v.fixed,v.cap,v.eligibility,state,
     actor.accountId,v.requestKey,hash,hash]);
   let caseRef:string|null=null;
   if(full){
    const review=await this.approval.create(c,actor,{
     kind:"CG17_POLICY_EXCEPTION",policyRevisionRef:row.rows[0].id,
     revisionNo:version,digest:hash,requestKey:v.requestKey,
     centerRef:v.centerRef});
    caseRef=review.caseRef;
   }
   return {...view(row.rows[0]),caseRef,replayed:false,
    warning:active?undefined:"This request is not effective or publicly available. "+
     (full?"An original protected CG03 full-coverage approval is required.":
      "This service's original source and eligibility integration is not ready.")};
  });
 }
 /** Owner finalization. A legitimate independent current CG03 decision
  * is necessary but not sufficient: a fresh Foundation root password and
  * original CG17 center/doctor source must also be verified atomically.
  */
 async activate(bearer:string,caseRaw:string,raw:unknown){
  const caseRef=uuid(caseRaw),data=canonical(raw,["currentPassword"]);
  if(typeof data.currentPassword!=="string"||
     data.currentPassword.length<8||
     Buffer.byteLength(data.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"ASSISTANCE_APPROVAL_INVALID"});
  const actor=await this.sessions.requireAction(
   bearer,"healthcare.assistance.policies.manage");
  await this.sessions.limitFoundationRootProof(actor);
  return this.tx(async c=>{
   await this.identity.assertCurrent(c,actor,
    "healthcare.assistance.policies.manage");
   const q=await c.query<{status:string;cg17_policy_revision_id:string;
    cg17_policy_version:number;cg17_policy_digest:string;
    proposer_id:string;request_key:string}>(
    "SELECT status,cg17_policy_revision_id,cg17_policy_version,"+
    "cg17_policy_digest,proposer_id,request_key "+
    "FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG17_POLICY_EXCEPTION'",
    [actor.realmId,caseRef]);
   const review=q.rows[0];
   if(!review)throw new NotFoundException({code:"ASSISTANCE_APPROVAL_UNAVAILABLE"});
   const current=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision WHERE root_realm_id=$1 "+
    "AND id=$2 AND revision_no=$3 AND source_digest=$4",
    [actor.realmId,review.cg17_policy_revision_id,
     review.cg17_policy_version,review.cg17_policy_digest]);
   const proposed=current.rows[0];
   if(!proposed)throw new ConflictException({code:"ASSISTANCE_APPROVAL_CHANGED"});
   await this.requireCenter(c,actor.realmId,proposed.center_ref);
   if(proposed.doctor_ref)
    await this.requireDoctor(c,actor.realmId,proposed.center_ref,proposed.doctor_ref);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+proposed.center_ref+":"+proposed.service_kind+":"+
     (proposed.doctor_ref??"CENTER")]);
   const locked=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision WHERE root_realm_id=$1 "+
    "AND id=$2 FOR UPDATE",[actor.realmId,proposed.id]);
   const original=locked.rows[0];
   if(!original||original.source_digest!==review.cg17_policy_digest||
     original.revision_no!==review.cg17_policy_version)
    throw new ConflictException({code:"ASSISTANCE_APPROVAL_CHANGED"});
   await this.sessions.requireFreshFoundationRootProof(
    c,actor,data.currentPassword);
   // Recover a lost response from the actual committed CG03 status, not
   // an unlocked case snapshot read before another owner's transaction.
   const latestCase=await c.query<{status:string}>(
    "SELECT status FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG17_POLICY_EXCEPTION'",
    [actor.realmId,caseRef]);
   const currentCaseStatus=latestCase.rows[0]?.status;
   if(original.approval_state==="ACTIVE"&&
      original.approved_case_ref===caseRef&&currentCaseStatus==="OWNER_COMPLETED")
    return {...view(original),replayed:true};
   if(currentCaseStatus!=="PENDING_OWNER"||
     original.approval_state!=="PENDING_APPROVAL"||
     original.mode!=="PERCENT"||original.percent_basis_points!==10000||
     original.service_kind!=="CONSULTATION"||
     review.proposer_id!==original.actor_ref||
     new Date(original.valid_until)<=new Date())
    throw new ConflictException({code:"ASSISTANCE_APPROVAL_NOT_READY"});
   const source={kind:"CG17_POLICY_EXCEPTION" as const,
    policyRevisionRef:original.id,revisionNo:original.revision_no,
    digest:original.source_digest,requestKey:review.request_key,
    centerRef:original.center_ref,caseRef};
   const decision=await this.approval.approved(c,actor,source);
   // Existing policy remains active until this exact protected case
   // finalizes. Supersession + activation + CG03 final status are one TX.
   const previous=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision "+
    "WHERE root_realm_id=$1 AND policy_ref=$2 "+
    "AND id<>$3 AND approval_state='ACTIVE' FOR UPDATE",
    [actor.realmId,original.policy_ref,original.id]);
   if(previous.rows.length>1)
    throw new ConflictException({code:"ASSISTANCE_APPROVAL_AMBIGUOUS"});
   if(previous.rows[0]){
    if(previous.rows[0].revision_no!==original.revision_no-1)
     throw new ConflictException({code:"ASSISTANCE_APPROVAL_CHANGED"});
    await c.query(
     "UPDATE healthcare_policy_revision SET approval_state='SUPERSEDED',"+
     "changed_by=$3,changed_at=now() WHERE root_realm_id=$1 "+
     "AND id=$2 AND approval_state='ACTIVE'",
     [actor.realmId,previous.rows[0].id,actor.accountId]);
   }
   const approved=await c.query<Revision>(
    "UPDATE healthcare_policy_revision SET approval_state='ACTIVE',"+
    "approved_case_ref=$3,approved_decision_ref=$4,"+
    "changed_by=$5,changed_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND approval_state='PENDING_APPROVAL' "+
    "RETURNING *",
    [actor.realmId,original.id,caseRef,decision,actor.accountId]);
   if(!approved.rows[0])
    throw new ConflictException({code:"ASSISTANCE_APPROVAL_CHANGED"});
   await this.approval.finish(c,actor,caseRef);
   return {...view(approved.rows[0]),replayed:false};
  });
 }
 async withdraw(bearer:string,rawPolicy:string,raw:unknown){
  const policyRef=uuid(rawPolicy);
  const v=canonical(raw,["expectedRevision"]);
  if(typeof v.expectedRevision!=="number"||
     !Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<1)
   throw new BadRequestException({code:"ASSISTANCE_POLICY_INVALID"});
  return this.tx(async c=>{
   const actor=await this.actor(c,bearer,"healthcare.assistance.policies.manage");
   const q=await c.query<Revision>(
    "SELECT * FROM healthcare_policy_revision "+
    "WHERE root_realm_id=$1 AND policy_ref=$2 AND approval_state='ACTIVE' "+
    "ORDER BY revision_no DESC LIMIT 1",[actor.realmId,policyRef]);
   const old=q.rows[0];
   if(!old||old.revision_no!==v.expectedRevision||old.approval_state!=="ACTIVE")
    throw new ConflictException({code:"ASSISTANCE_POLICY_REVISION_CHANGED"});
   await this.requireCenter(c,actor.realmId,old.center_ref);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+old.center_ref+":"+old.service_kind+":"+
     (old.doctor_ref??"CENTER")]);
   const done=await c.query<Revision>(
    "UPDATE healthcare_policy_revision SET approval_state='WITHDRAWN',"+
    "changed_by=$3,changed_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND approval_state='ACTIVE' AND revision_no=$4 RETURNING *",
    [actor.realmId,old.id,actor.accountId,v.expectedRevision]);
   if(!done.rows[0])
    throw new ConflictException({code:"ASSISTANCE_POLICY_REVISION_CHANGED"});
   return view(done.rows[0]);
  });
 }
}
