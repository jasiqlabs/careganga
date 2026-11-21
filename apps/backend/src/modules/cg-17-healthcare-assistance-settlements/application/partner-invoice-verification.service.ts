import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {PrivateObjectStorage} from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService}
 from "../../cg-01-identity-access/application/protected-access-owner.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import type {VerifiedFoundationActor} from
 "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE=/^CG-[A-F0-9]{14}$/;
const MONEY=/^(0|[1-9][0-9]{0,10})$/;
const SHA=/^[a-f0-9]{64}$/;
const safeRef=(s:unknown)=>{if(typeof s!=="string"||!ID.test(s))
 throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});return s;};
const safeCode=(s:unknown)=>{if(typeof s!=="string"||!CODE.test(s))
 throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});return s;};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const money=(v:unknown)=>{if(typeof v!=="string"||!MONEY.test(v)||
 BigInt(v)>10000000000n)
 throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});return v;};
const body=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||
  Object.keys(v).some(k=>!keys.includes(k))||
  Object.keys(v).length!==keys.length)
  throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});
 return v as Record<string,unknown>;
};
type Claim={
 id:string;public_code:string;root_realm_id:string;patient_ref:string;
 center_ref:string;source_digest:string;policy_revision_ref:string;
 service_local_date:string;service_kind:"PHARMACY"|"NURSING"|"OT"|"LAB";
 invoice_file_ref:string;completion_file_ref:string|null;payment_file_ref:string|null;
 quoted_gross_minor:string;estimated_patient_due_minor:string;
 estimated_support_minor:string;requested_by_account:string;
};
type Attest={id:string;claim_ref:string;center_ref:string;patient_ref:string;
 collected_minor:string;payment_method:string;payment_file_ref:string|null;
 evidence_digest:string;attested_by_account:string;request_key:string;request_digest:string};
type Decision={id:string;outcome:"APPROVED"|"REJECTED";request_key:string;
 reviewed_by_account:string;decision_digest:string;reviewed_at:Date;
 approved_support_minor:string;accepted_patient_paid_minor:string};
const show=(c:Claim,a:Attest|null,d:Decision|null,liability:boolean,posted:boolean)=>({
 claimCode:c.public_code,serviceKind:c.service_kind,
 serviceDate:c.service_local_date,quotedGrossMinor:c.quoted_gross_minor,
 estimatedFoundationMinor:c.estimated_support_minor,
 estimatedPatientPayableMinor:c.estimated_patient_due_minor,
 paymentEvidenceSubmitted:!!c.payment_file_ref,
 partnerAttestedPatientMinor:a?.collected_minor??"0",
 state:d?.outcome==="APPROVED"?"APPROVED_AWAITING_FINANCE":
  d?.outcome==="REJECTED"?"REJECTED":
  a?"PARTNER_ATTESTED":"PENDING_VERIFICATION",
 foundationApprovedMinor:d?.outcome==="APPROVED"?d.approved_support_minor:"0",
 foundationLiabilityRecognized:liability,
 foundationJournalPosted:posted,
 providerPaidVerified:false,
 evidenceVerified:d?.outcome==="APPROVED",
 partnerPaymentBasis:a?.payment_method??null,
 caution:d?.outcome==="APPROVED"?
  "Independent evidence accepted. Foundation bank reimbursement remains separate.":
  "The scan or partner attestation alone does not approve financial assistance."
});
/** CG17 original mandatory service-source validation, no store, ERP, or
 * fake CG15 doctor appointment. Foundation protected reviewer accepts only
 * actual already-submitted CG19 private evidence and distinct partner attestor.
 */
@Injectable()
export class PartnerInvoiceVerificationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly files:PrivateObjectStorage){}
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let begun=false;
  try{
   await c.query("BEGIN");begun=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const r=await fn(c);await c.query("COMMIT");begun=false;return r;
  }catch(e){
   if(begun)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_ALREADY_DECIDED"});
   const dbCode=e&&typeof e==="object"&&"code" in e?e.code:null;
   if(typeof dbCode==="string"&&/^P17(3[2-9]|4[0-5])$/.test(dbCode))
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_SOURCE_CHANGED"});
   throw e;
  }finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,action:
  "healthcare.assistance.charges.accept"|
  "healthcare.assistance.liabilities.manage"|
  "healthcare.assistance.liabilities.view"|
  "healthcare.assistance.settlements.view"){
  const actor=await this.sessions.requireAction(token,action);
  await this.identity.assertCurrent(c,actor,action);
  return actor;
 }
 private async claim(c:PoolClient,root:string,center:string,code:string,lock=false){
  const q=await c.query<Claim>(
   "SELECT *,service_local_date::text,quoted_gross_minor::text,"+
   "estimated_patient_due_minor::text,estimated_support_minor::text "+
   "FROM cg17_partner_service_claim WHERE root_realm_id=$1 "+
   "AND center_ref=$2 AND public_code=$3 "+
   (lock?"FOR UPDATE":"FOR SHARE"),
   [root,center,code]);
  if(!q.rows[0])throw new NotFoundException({code:"CG17_PARTNER_REVIEW_UNAVAILABLE"});
  return q.rows[0];
 }
 private async linked(c:PoolClient,root:string,claim:string){
  const attest=await c.query<Attest>(
   "SELECT *,collected_minor::text FROM cg17_partner_invoice_attestation "+
   "WHERE root_realm_id=$1 AND claim_ref=$2 FOR SHARE",[root,claim]);
  const decision=await c.query<Decision>(
   "SELECT *,approved_support_minor::text,accepted_patient_paid_minor::text "+
   "FROM cg17_partner_invoice_decision WHERE root_realm_id=$1 "+
   "AND claim_ref=$2 FOR SHARE",[root,claim]);
  const l=await c.query<{state:string;posting_state:string}>(
   "SELECT l.state,e.posting_state FROM foundation_liability l "+
   "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
   "AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL' "+
   "WHERE l.root_realm_id=$1 AND l.source_kind='CG17_PARTNER_SERVICE' "+
   "AND l.source_ref=$2",[root,claim]);
  return {attest:attest.rows[0]??null,decision:decision.rows[0]??null,
   liability:(l.rowCount??0)>0,posted:l.rows[0]?.posting_state==="POSTED"};
 }
 async status(token:string,centerRaw:string,codeRaw:string,own=false){
  const center=safeRef(centerRaw),code=safeCode(codeRaw);
  return this.tx(async c=>{
   const action=own?"healthcare.assistance.settlements.view":
    "healthcare.assistance.liabilities.view";
   const actor=await this.actor(c,token,action);
   if(own)await this.centers.assertCurrent(c,actor,center,action);
   else await this.centers.assertFoundationCenter(c,actor,center,action,false);
   const claim=await this.claim(c,actor.realmId,center,code);
   const state=await this.linked(c,actor.realmId,claim.id);
   let canAttest=false,canDecide=false;
   if(own){
    try{
     await this.sessions.requireAction(token,"healthcare.assistance.charges.accept");
     await this.centers.assertCurrent(c,actor,center,
      "healthcare.assistance.charges.accept");
     canAttest=!state.attest&&!state.decision;
    }catch{/* View-only partner accounts cannot attest. */}
   }else{
    try{
     await this.sessions.requireAction(token,"healthcare.assistance.liabilities.manage");
     await this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true);
     canDecide=!!state.attest&&!state.decision&&
      state.attest.attested_by_account!==actor.accountId&&
      claim.requested_by_account!==actor.accountId;
    }catch{/* Review permission and protected account are mandatory. */}
   }
   return {...show(claim,state.attest,state.decision,state.liability,state.posted),
    canAttest,canDecide};
  });
 }
 /** Secure original CG19 file by claim code, not patient/file UUID.
  * Reads only for currently protected independent Foundation reviewers.
  * Recheck the permission, original scan and revocation after remote IO.
  */
 async evidence(token:string,centerRaw:string,codeRaw:string,kindRaw:string){
  const center=safeRef(centerRaw),code=safeCode(codeRaw);
  const kind=kindRaw;
  if(kind!=="invoice"&&kind!=="completion"&&kind!=="payment")
   throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});
  const original=await this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.manage");
   await this.protectedOwner.verifyReviewer(c,a,"approvals.review",true);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",false);
   const claim=await this.claim(c,a.realmId,center,code);
   const att=await c.query<{attested_by_account:string;attested_at:Date}>(
    "SELECT attested_by_account,attested_at "+
    "FROM cg17_partner_invoice_attestation WHERE root_realm_id=$1 "+
    "AND claim_ref=$2 FOR SHARE",[a.realmId,claim.id]);
   if(!att.rows[0]||att.rows[0].attested_by_account===a.accountId||
    claim.requested_by_account===a.accountId)
    throw new ForbiddenException({code:"CG17_PARTNER_REVIEW_UNAVAILABLE"});
   const file=kind==="invoice"?claim.invoice_file_ref:
    kind==="completion"?claim.completion_file_ref:claim.payment_file_ref;
   const classification=kind==="invoice"?"PATIENT_PARTNER_INVOICE":
    kind==="completion"?"PATIENT_PARTNER_SERVICE_PROOF":"PATIENT_PARTNER_PAYMENT_PROOF";
   if(!file)throw new NotFoundException({code:"CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"});
   const row=await c.query<{
    id:string;intent_id:string;patient_id:string;classification:string;
    mime:string;size_bytes:string;sha256:string;object_key:string;
    object_version:string;revision:number
   }>(
    "SELECT f.id,f.intent_id,f.patient_id,f.classification,f.mime,"+
    "f.size_bytes::text,f.sha256,f.object_key,f.object_version,f.revision "+
    "FROM cg19_patient_private_file f "+
    "JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id "+
    "AND i.id=f.intent_id AND i.status='VALIDATED' "+
    "WHERE f.realm_id=$1 AND f.patient_id=$2 AND f.id=$3 "+
    "AND f.classification=$4 AND f.scan_status='CLEAN_VERIFIED' "+
    "AND f.revoked_at IS NULL FOR SHARE OF f,i",
    [a.realmId,claim.patient_ref,file,classification]);
   if(!row.rows[0])
    throw new NotFoundException({code:"CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"});
   return {actor:a,claim,kind,file:row.rows[0]};
  });
  const expected=original.file;
  const bytes=await this.files.readVerifiedPrivateObject({
   objectKey:expected.object_key,objectVersion:expected.object_version,
   maxBytes:Number(expected.size_bytes)});
  if(!Buffer.isBuffer(bytes)||bytes.length!==Number(expected.size_bytes)||
   createHash("sha256").update(bytes).digest("hex")!==expected.sha256)
   throw new ConflictException({code:"CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"});
  await this.tx(async c=>{
   const a=await this.actor(c,token,"healthcare.assistance.liabilities.manage");
   if(a.realmId!==original.actor.realmId||a.accountId!==original.actor.accountId)
    throw new ForbiddenException({code:"CG17_PARTNER_REVIEW_UNAVAILABLE"});
   await this.protectedOwner.verifyReviewer(c,a,"approvals.review",true);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",false);
   const claim=await this.claim(c,a.realmId,center,code);
   const currentFile=original.kind==="invoice"?claim.invoice_file_ref:
    original.kind==="completion"?claim.completion_file_ref:claim.payment_file_ref;
   if(claim.id!==original.claim.id||currentFile!==expected.id||
      claim.source_digest!==original.claim.source_digest)
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_SOURCE_CHANGED"});
   const row=await c.query<{revision:number;object_version:string}>(
    "SELECT f.revision,f.object_version FROM cg19_patient_private_file f "+
    "JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id "+
    "AND i.id=f.intent_id AND i.status='VALIDATED' "+
    "WHERE f.realm_id=$1 AND f.patient_id=$2 AND f.id=$3 "+
    "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' FOR SHARE OF f,i",
    [a.realmId,claim.patient_ref,expected.id]);
   if(!row.rows[0]||row.rows[0].revision!==expected.revision||
      row.rows[0].object_version!==expected.object_version)
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"});
   await c.query(
    "INSERT INTO cg19_patient_file_event(realm_id,patient_id,intent_id,"+
    "file_id,actor_account_id,action) "+
    "VALUES($1,$2,$3,$4,$5,'PARTNER_CLAIM_REVIEW_READ')",
    [a.realmId,claim.patient_ref,expected.intent_id,expected.id,a.accountId]);
  });
  return {bytes,mime:expected.mime};
 }
 async attest(token:string,centerRaw:string,codeRaw:string,raw:unknown){
  const center=safeRef(centerRaw),code=safeCode(codeRaw);
  const v=body(raw,["requestKey","collectedMinor","paymentMethod",
   "invoiceChecked","servicePerformed"]);
  const key=safeRef(v.requestKey),amount=money(v.collectedMinor);
  const method=v.paymentMethod;
  if(!["CASH_ATTESTED","ELECTRONIC_EVIDENCE"].includes(String(method))||
    v.invoiceChecked!==true||v.servicePerformed!==true)
   throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});
  return this.tx(async c=>{
   const actor=await this.actor(c,token,"healthcare.assistance.charges.accept");
   await this.centers.assertCurrent(c,actor,center,
    "healthcare.assistance.charges.accept");
   const claim=await this.claim(c,actor.realmId,center,code,true);
   if(claim.requested_by_account===actor.accountId||
      claim.estimated_patient_due_minor!==amount||
      method==="ELECTRONIC_EVIDENCE"&&!claim.payment_file_ref)
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_SOURCE_CHANGED"});
   const inputHash=hash(["CG17_PARTNER_ATTEST_REQUEST_V1",claim.source_digest,
    amount,method,claim.payment_file_ref]);
   const prior=await c.query<Attest>(
    "SELECT *,collected_minor::text FROM cg17_partner_invoice_attestation "+
    "WHERE root_realm_id=$1 AND claim_ref=$2 FOR SHARE",
    [actor.realmId,claim.id]);
   if(prior.rows[0]){
    if(prior.rows[0].attested_by_account!==actor.accountId||
       prior.rows[0].request_key!==key||prior.rows[0].request_digest!==inputHash)
     throw new ConflictException({code:"CG17_PARTNER_REVIEW_ALREADY_DECIDED"});
    const state=await this.linked(c,actor.realmId,claim.id);
    return {...show(claim,state.attest,state.decision,state.liability,state.posted),
     replayed:true};
   }
   const verified=await c.query<{id:string;classification:string;sha256:string}>(
    "SELECT f.id,f.classification,f.sha256 FROM cg19_patient_private_file f "+
    "JOIN cg19_patient_file_intent i ON i.realm_id=f.realm_id "+
    "AND i.id=f.intent_id AND i.status='VALIDATED' "+
    "WHERE f.realm_id=$1 AND f.patient_id=$2 "+
    "AND f.id=ANY($3::uuid[]) AND f.revoked_at IS NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' FOR SHARE OF f,i",
    [actor.realmId,claim.patient_ref,
     [claim.invoice_file_ref,...(claim.completion_file_ref?[claim.completion_file_ref]:[]),
      ...(claim.payment_file_ref?[claim.payment_file_ref]:[])]]);
   const matches=(file:string|null,classification:string)=>
    !file||verified.rows.some(x=>x.id===file&&x.classification===classification);
   if(!matches(claim.invoice_file_ref,"PATIENT_PARTNER_INVOICE")||
      !matches(claim.completion_file_ref,"PATIENT_PARTNER_SERVICE_PROOF")||
      !matches(claim.payment_file_ref,"PATIENT_PARTNER_PAYMENT_PROOF"))
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"});
   const evidenceHash=hash(["CG17_PARTNER_SOURCE_ATTEST_V1",claim.source_digest,
    amount,method,
    verified.rows.filter(x=>[
     claim.invoice_file_ref,claim.completion_file_ref,claim.payment_file_ref
    ].includes(x.id)).sort((a,b)=>a.id.localeCompare(b.id))
     .map(x=>[x.id,x.classification,x.sha256])]);
   const saved=await c.query<Attest>(
    "INSERT INTO cg17_partner_invoice_attestation("+
    "root_realm_id,claim_ref,center_ref,patient_ref,collected_minor,"+
    "payment_method,payment_file_ref,service_performed,invoice_checked,"+
    "evidence_digest,attested_by_account,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,true,true,$8,$9,$10,$11) RETURNING *",
    [actor.realmId,claim.id,center,claim.patient_ref,amount,method,
     claim.payment_file_ref,evidenceHash,actor.accountId,key,inputHash]);
   return {...show(claim,saved.rows[0],null,false,false),replayed:false};
  });
 }
 async decide(token:string,centerRaw:string,codeRaw:string,raw:unknown){
  const center=safeRef(centerRaw),code=safeCode(codeRaw);
  const v=body(raw,["requestKey","action","reason","currentPassword"]);
  const key=safeRef(v.requestKey),action=v.action;
  if(action!=="APPROVE"&&action!=="REJECT"||
   typeof v.reason!=="string"||v.reason.trim().length<12||
   v.reason.trim().length>500||/[\u0000-\u001f\u007f]/.test(v.reason)||
   typeof v.currentPassword!=="string"||v.currentPassword.length<8||
   Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"CG17_PARTNER_REVIEW_INVALID"});
  const actor=await this.sessions.requireAction(token,
   "healthcare.assistance.liabilities.manage");
  await this.sessions.limitFoundationRootProof(actor);
  const reason=String(v.reason),currentPassword=String(v.currentPassword);
  return this.tx(async c=>{
   await this.identity.assertCurrent(c,actor,"healthcare.assistance.liabilities.manage");
   await this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true);
   await this.centers.assertFoundationCenter(c,actor,center,
    "healthcare.assistance.liabilities.manage",action==="APPROVE");
   const claim=await this.claim(c,actor.realmId,center,code,true);
   const prior=await this.linked(c,actor.realmId,claim.id);
   const decisionDigest=hash(["CG17_PARTNER_REVIEW_V1",claim.source_digest,
    prior.attest?.evidence_digest??null,action,reason.trim()]);
   if(prior.decision){
    if(prior.decision.reviewed_by_account!==actor.accountId||
      prior.decision.request_key!==key||
      prior.decision.decision_digest!==decisionDigest)
     throw new ConflictException({code:"CG17_PARTNER_REVIEW_ALREADY_DECIDED"});
    return {...show(claim,prior.attest,prior.decision,prior.liability,prior.posted),
     replayed:true};
   }
   const att=prior.attest;
   if(!att||att.attested_by_account===actor.accountId||
      claim.requested_by_account===actor.accountId||
      att.collected_minor!==claim.estimated_patient_due_minor||
      !SHA.test(claim.source_digest)||!SHA.test(att.evidence_digest))
    throw new ConflictException({code:"CG17_PARTNER_REVIEW_SOURCE_CHANGED"});
   // No generic review flag. CG01 re-authenticates an active protected
   // Foundation-root account against its ORIGINAL current password.
   await this.sessions.requireFreshFoundationRootProof(c,actor,currentPassword);
   const support=action==="APPROVE"?claim.estimated_support_minor:"0";
   const decision=await c.query<Decision>(
    "INSERT INTO cg17_partner_invoice_decision("+
    "root_realm_id,claim_ref,attestation_ref,center_ref,outcome,"+
    "reviewed_by_account,original_claim_digest,original_evidence_digest,"+
    "accepted_gross_minor,accepted_patient_paid_minor,approved_support_minor,"+
    "reason,request_key,decision_digest,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()) "+
    "RETURNING *",
    [actor.realmId,claim.id,att.id,center,action,actor.accountId,
     claim.source_digest,att.evidence_digest,claim.quoted_gross_minor,
     att.collected_minor,support,reason.trim(),key,decisionDigest]);
   if(action==="APPROVE"){
    const liabilityDigest=createHash("sha256").update([
     "CG17_PARTNER_LIABILITY_V1",claim.source_digest,
     att.evidence_digest,decisionDigest].join("|")).digest("hex");
    const liability=await c.query<{id:string}>(
     "INSERT INTO foundation_liability(root_realm_id,center_ref,source_kind,"+
     "source_ref,partner_claim_ref,partner_decision_ref,award_ref,"+
     "charge_ref,completion_event_ref,service_completed_at,service_local_date,"+
     "amount_minor,source_digest,created_by_account) "+
     "VALUES($1,$2,'CG17_PARTNER_SERVICE',$3,$3,$4,NULL,NULL,NULL,NULL,"+
     "$5::date,$6,$7,$8) RETURNING id",
     [actor.realmId,center,claim.id,decision.rows[0].id,
      claim.service_local_date,support,liabilityDigest,actor.accountId]);
    await c.query(
     "INSERT INTO cg17_financial_effect(root_realm_id,liability_ref,"+
     "effect_kind,source_kind,source_ref,source_revision,"+
     "idempotency_key,amount_minor,source_digest) "+
     "VALUES($1,$2,'LIABILITY_ACCRUAL','CG17_PARTNER_SERVICE',"+
     "$3,1,$4,$5,$6)",
     [actor.realmId,liability.rows[0].id,claim.id,randomUUID(),
      support,liabilityDigest]);
   }
   return {...show(claim,att,decision.rows[0],action==="APPROVE",false),
    replayed:false};
  });
 }
}
