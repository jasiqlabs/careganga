import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthVerifiedCenterDoctorFacade}
 from "../../cg-14-healthcare-network/application/health-verified-center-doctor.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const INVOICE=/^[A-Za-z0-9][A-Za-z0-9 /._-]{1,59}$/;
const MONEY=/^[1-9][0-9]{0,10}$/;
type Kind="PHARMACY"|"NURSING"|"OT";
type Claim={
 id:string;public_code:string;center_ref:string;service_kind:Kind;
 invoice_number:string;service_local_date:string;
 quoted_gross_minor:string;estimated_support_minor:string;
 estimated_patient_due_minor:string;state:string;submitted_at:Date;
 source_digest:string
};
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const ref=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_INVALID"});
 return v;
};
const form=(raw:unknown)=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_INVALID"});
 const v=raw as Record<string,unknown>;
 const keys=["requestKey","centerRef","serviceKind","invoiceNumber",
  "serviceDate","invoiceFileRef","completionFileRef","grossMinor"];
 if(Object.keys(v).length<7||Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_INVALID"});
 const key=ref(v.requestKey),center=ref(v.centerRef),
  invoiceFile=ref(v.invoiceFileRef);
 const kind=v.serviceKind;
 if(kind!=="PHARMACY"&&kind!=="NURSING"&&kind!=="OT")
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_INVALID"});
 const proof=v.completionFileRef===undefined||v.completionFileRef===null?
  null:ref(v.completionFileRef);
 if((kind==="PHARMACY"&&proof!==null)||
    (kind!=="PHARMACY"&&(proof===null||proof===invoiceFile)))
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_PROOF_REQUIRED"});
 const invoice=typeof v.invoiceNumber==="string"?v.invoiceNumber.trim():"";
 if(!INVOICE.test(invoice)||typeof v.serviceDate!=="string"||
   !DATE.test(v.serviceDate)||!Number.isFinite(Date.parse(v.serviceDate+"T00:00:00Z"))||
   new Date(v.serviceDate+"T00:00:00Z").toISOString().slice(0,10)!==v.serviceDate||
   typeof v.grossMinor!=="string"||!MONEY.test(v.grossMinor)||
   BigInt(v.grossMinor)>10000000000n)
  throw new BadRequestException({code:"CG17_PARTNER_CLAIM_INVALID"});
 return {key,center,kind,invoice,serviceDate:v.serviceDate,
  invoiceFile,proof,gross:v.grossMinor};
};
const present=(row:Claim)=>({
 claimCode:row.public_code,centerRef:row.center_ref,
 serviceKind:row.service_kind,invoiceNumber:row.invoice_number,
 serviceDate:row.service_local_date,quotedGrossMinor:row.quoted_gross_minor,
 estimatedFoundationMinor:row.estimated_support_minor,
 estimatedPatientPayableMinor:row.estimated_patient_due_minor,
 state:"PENDING_VERIFICATION" as const,invoiceVerified:false,
 serviceCompletionVerified:false,patientPaymentVerified:false,
 foundationLiabilityPosted:false,foundationSettled:false,
 submittedAt:new Date(row.submitted_at).toISOString(),
 guidance:"Your scanned documents have been received for review. "+
  "The invoice, actual service, patient payment and Foundation contribution "+
  "have not been independently verified or approved."
});
/** CG17 original source for ERP-OFF patient-submitted partner evidence.
 * Authenticated current patient and CG19 CLEAN_VERIFIED scanner metadata
 * are mandatory. PENDING is not a customer receipt or approved liability.
 * No shadow patient, clinic, doctor, object store, ERP or money ledger.
 */
@Injectable()
export class PartnerServiceClaimService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly verified:HealthVerifiedCenterDoctorFacade,
  private readonly centers:HealthCenterSupportScopeFacade){}
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let begun=false;
  try{
   await c.query("BEGIN");begun=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await fn(c);
   await c.query("COMMIT");begun=false;return result;
  }catch(e){
   if(begun)try{await c.query("ROLLBACK");}catch{}
   const errorCode=e&&typeof e==="object"&&"code" in e?e.code:null;
   if(errorCode==="23505")
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_DUPLICATE_INVOICE"});
   if(errorCode==="P1726"||errorCode==="P1727")
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_CENTER_UNAVAILABLE"});
   if(errorCode==="P1728")
    throw new NotFoundException({code:"CG17_PARTNER_CLAIM_PATIENT_UNAVAILABLE"});
   if(errorCode==="P1729")
    throw new BadRequestException({code:"CG17_PARTNER_CLAIM_PROOF_REQUIRED"});
   if(errorCode==="P1730"||errorCode==="P1731")
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_POLICY_UNAVAILABLE"});
   if(errorCode==="P1725")
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_SOURCE_FROZEN"});
   throw e;
  }finally{c.release()}
 }
 private async owned(c:PoolClient,root:string,account:string){
  const p=await c.query<{id:string}>(
   "SELECT patient.id FROM cg15_patient_account_link own "+
   "JOIN cg15_patient patient ON patient.root_realm_id=own.root_realm_id "+
   "AND patient.id=own.patient_id "+
   "JOIN account active ON active.id=own.account_id "+
   "AND active.realm_id=own.root_realm_id "+
   "WHERE own.root_realm_id=$1 AND own.account_id=$2 "+
   "AND own.revoked_at IS NULL AND active.status='ACTIVE' "+
   "AND patient.profile_status='VERIFIED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
   "WHERE proof.root_realm_id=patient.root_realm_id "+
   "AND proof.patient_id=patient.id) "+
   "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=patient.root_realm_id "+
   "AND consent.patient_id=patient.id AND consent.purpose='PATIENT_CARE' "+
   "ORDER BY consent.revision_no DESC LIMIT 1)=true "+
   "FOR SHARE OF own,patient,active",
   [root,account]);
  if(!p.rows[0])throw new NotFoundException({code:"CG17_PARTNER_CLAIM_PATIENT_UNAVAILABLE"});
  return p.rows[0].id;
 }
 /** Patient choices are current verified business names, never typed IDs.
  * A published offer is only a possible estimate until source verification.
  */
 async options(token:string){
  const actor=await this.sessions.verifySession(token);
  return this.tx(async c=>{
   await this.owned(c,actor.realmId,actor.accountId);
   const rows=await c.query<{
    centerRef:string;centerName:string;kind:Kind}>(
    "SELECT center.id AS \"centerRef\",center.display_name AS \"centerName\","+
    "policy.service_kind AS kind FROM healthcare_policy_revision policy "+
    "JOIN health_center center ON center.root_realm_id=policy.root_realm_id "+
    "AND center.id=policy.center_ref AND center.status='VERIFIED' "+
    "AND center.access_state='ENABLED' "+
    "JOIN health_provider provider ON provider.root_realm_id=center.root_realm_id "+
    "AND provider.id=center.provider_id AND provider.status='VERIFIED' "+
    "JOIN health_center_capability cap ON cap.root_realm_id=center.root_realm_id "+
    "AND cap.center_id=center.id AND cap.capability_code=CASE policy.service_kind "+
    "WHEN 'OT' THEN 'SURGERY' ELSE policy.service_kind END "+
    "WHERE policy.root_realm_id=$1 "+
    "AND policy.service_kind IN('PHARMACY','NURSING','OT') "+
    "AND policy.doctor_ref IS NULL AND policy.approval_state='ACTIVE' "+
    "AND policy.activated_at IS NOT NULL AND policy.activated_at<=now() "+
    "AND policy.valid_from<=now() AND policy.valid_until>now() "+
    "ORDER BY center.display_name,policy.service_kind,center.id LIMIT 101",
    [actor.realmId]);
   if(rows.rows.length>100)
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_LIST_LIMIT"});
   return {services:rows.rows,complete:true,
    guidance:"Only currently verified partners are shown. A policy estimate "+
     "does not approve your bill, completed care or Foundation reimbursement."};
  });
 }
 /** Only currently authorized Foundation or own-center partner staff.
  * No patient identity, bank destination, private file URL or technical IDs
  * in the projection. Pending quotes are never aggregated as payable.
  */
 private async centerClaims(c:PoolClient,root:string,center:string){
  const result=await c.query<Claim>(
   "SELECT public_code,center_ref,service_kind,invoice_number,"+
   "service_local_date::text,quoted_gross_minor::text,"+
   "estimated_support_minor::text,estimated_patient_due_minor::text,"+
   "state,submitted_at,source_digest FROM cg17_partner_service_claim "+
   "WHERE root_realm_id=$1 AND center_ref=$2 "+
   "ORDER BY submitted_at DESC,id DESC LIMIT 51",
   [root,center]);
  if(result.rows.length>50)
   throw new ConflictException({code:"CG17_PARTNER_CLAIM_LIST_LIMIT"});
  return {claims:result.rows.map(present),
   pendingCount:result.rows.length,approvedFoundationMinor:"0",
   reimbursableFoundationMinor:"0",paidFoundationMinor:"0",
   foundationPaymentVerified:false,complete:true,
   guidance:"Scanned patient evidence is awaiting independent verification. "+
    "No amount on this screen is approved or payable to the partner."};
 }
 async foundationCenter(token:string,centerRaw:string){
  const center=ref(centerRaw);
  return this.tx(async c=>{
   const actor=await this.sessions.requireAction(token,
    "healthcare.assistance.liabilities.view");
   await this.centers.assertFoundationCenter(c,actor,center,
    "healthcare.assistance.liabilities.view",false);
   return this.centerClaims(c,actor.realmId,center);
  });
 }
 async ownCenter(token:string,centerRaw:string){
  const center=ref(centerRaw);
  return this.tx(async c=>{
   const actor=await this.sessions.requireAction(token,
    "healthcare.assistance.settlements.view");
   await this.centers.assertCurrent(c,actor,center,
    "healthcare.assistance.settlements.view");
   return this.centerClaims(c,actor.realmId,center);
  });
 }
 async mine(token:string){
  const actor=await this.sessions.verifySession(token);
  return this.tx(async c=>{
   const patient=await this.owned(c,actor.realmId,actor.accountId);
   const items=await c.query<Claim>(
    "SELECT claim.public_code,claim.center_ref,claim.service_kind,"+
    "claim.invoice_number,claim.service_local_date::text,"+
    "claim.quoted_gross_minor::text,claim.estimated_support_minor::text,"+
    "claim.estimated_patient_due_minor::text,claim.state,claim.submitted_at,"+
    "claim.source_digest FROM cg17_partner_service_claim claim "+
    "WHERE claim.root_realm_id=$1 AND claim.patient_ref=$2 "+
    "ORDER BY claim.submitted_at DESC,claim.id DESC LIMIT 51",
    [actor.realmId,patient]);
   if(items.rows.length>50)
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_LIST_LIMIT"});
   return {claims:items.rows.map(present),complete:true};
  });
 }
 async submit(token:string,raw:unknown){
  const v=form(raw),actor=await this.sessions.verifySession(token);
  return this.tx(async c=>{
   const patient=await this.owned(c,actor.realmId,actor.accountId);
   await this.verified.eligibleService(c,actor.realmId,v.center,v.kind);
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":PARTNER_CLAIM:"+actor.accountId+":"+v.key]);
   const sourceDigest=sha(["CG17_ERP_OFF_PATIENT_CLAIM_V1",actor.realmId,patient,
    v.center,v.kind,v.invoice.toLowerCase(),v.serviceDate,
    v.invoiceFile,v.proof,v.gross]);
   const previous=await c.query<Claim>(
    "SELECT *,service_local_date::text,quoted_gross_minor::text,"+
    "estimated_support_minor::text,estimated_patient_due_minor::text "+
    "FROM cg17_partner_service_claim WHERE root_realm_id=$1 "+
    "AND requested_by_account=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,v.key]);
   if(previous.rows[0]){
    if(previous.rows[0].source_digest!==sourceDigest)
     throw new ConflictException({code:"CG17_PARTNER_CLAIM_REQUEST_CONFLICT"});
    return {...present(previous.rows[0]),replayed:true};
   }
   const files=await c.query<{id:string;classification:string}>(
    "SELECT f.id,f.classification FROM cg19_patient_private_file f "+
    "JOIN cg19_patient_file_intent intent ON intent.id=f.intent_id "+
    "AND intent.realm_id=f.realm_id AND intent.status='VALIDATED' "+
    "WHERE f.realm_id=$1 AND f.patient_id=$2 "+
    "AND f.id=ANY($3::uuid[]) AND f.revoked_at IS NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' FOR SHARE OF f,intent",
    [actor.realmId,patient,[v.invoiceFile,...(v.proof?[v.proof]:[])]]);
   if(files.rows.length!==(v.proof?2:1)||
    !files.rows.some(f=>f.id===v.invoiceFile&&
     f.classification==="PATIENT_PARTNER_INVOICE")||
    v.proof&&!files.rows.some(f=>f.id===v.proof&&
     f.classification==="PATIENT_PARTNER_SERVICE_PROOF"))
    throw new BadRequestException({code:"CG17_PARTNER_CLAIM_PROOF_REQUIRED"});
   const policy=await c.query<{
    id:string;mode:string;percent_basis_points:number|null;
    fixed_minor:string|null;cap_minor:string;time_zone:string}>(
    "SELECT policy.id,policy.mode,policy.percent_basis_points,"+
    "policy.fixed_minor::text,policy.cap_minor::text,center.time_zone "+
    "FROM healthcare_policy_revision policy "+
    "JOIN health_center center ON center.root_realm_id=policy.root_realm_id "+
    "AND center.id=policy.center_ref "+
    "WHERE policy.root_realm_id=$1 AND policy.center_ref=$2 "+
    "AND policy.service_kind=$3 AND policy.doctor_ref IS NULL "+
    "AND policy.approval_state='ACTIVE' AND policy.activated_at IS NOT NULL "+
    "AND policy.activated_at<=now() "+
    "AND policy.valid_from<=now() AND policy.valid_until>now() "+
    "AND $4::date >= (policy.valid_from AT TIME ZONE center.time_zone)::date "+
    "AND $4::date <= (policy.valid_until AT TIME ZONE center.time_zone)::date "+
    "AND $4::date <= (now() AT TIME ZONE center.time_zone)::date "+
    "ORDER BY policy.valid_from DESC,policy.id DESC LIMIT 2 FOR SHARE OF policy,center",
    [actor.realmId,v.center,v.kind,v.serviceDate]);
   if(policy.rows.length!==1)
    throw new ConflictException({code:"CG17_PARTNER_CLAIM_POLICY_UNAVAILABLE"});
   const p=policy.rows[0],gross=BigInt(v.gross);
   const provisional=p.mode==="PERCENT"&&p.percent_basis_points!==null?
    (gross*BigInt(p.percent_basis_points)+5000n)/10000n:
    BigInt(p.fixed_minor??"0");
   const support=[provisional,BigInt(p.cap_minor),gross]
    .reduce((min,n)=>n<min?n:min);
   const inserted=await c.query<Claim>(
    "INSERT INTO cg17_partner_service_claim(root_realm_id,center_ref,"+
    "patient_ref,service_kind,invoice_number,service_local_date,"+
    "invoice_file_ref,completion_file_ref,policy_revision_ref,"+
    "quoted_gross_minor,estimated_support_minor,estimated_patient_due_minor,"+
    "source_digest,requested_by_account,request_key) "+
    "VALUES($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14,$15) "+
    "RETURNING public_code,center_ref,service_kind,invoice_number,"+
    "service_local_date::text,quoted_gross_minor::text,"+
    "estimated_support_minor::text,estimated_patient_due_minor::text,"+
    "state,submitted_at,source_digest",
    [actor.realmId,v.center,patient,v.kind,v.invoice,v.serviceDate,
     v.invoiceFile,v.proof,p.id,gross.toString(),support.toString(),
     (gross-support).toString(),sourceDigest,actor.accountId,v.key]);
   return {...present(inserted.rows[0]),replayed:false};
  });
 }
}
