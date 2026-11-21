import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthLabProfessionalReviewSourceFacade}
 from "../../cg-14-healthcare-network/application/health-lab-professional-review-source.facade";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const id=(x:unknown)=>{if(typeof x!=="string"||!ID.test(x))
 throw new BadRequestException({code:"LAB_PROFESSIONAL_SOURCE_INVALID"});return x;};
type Report={
 result_ref:string;version_no:number;state:string;operator_account_ref:string;
 file_ref:string;report_digest:string;sha256:string;scan_status:string;
 object_key:string;object_version:string;size_bytes:string;
 order_status:string;center_ref:string
};
type Approval={id:string;request_digest:string;result_revision_ref:string;
 decision:string;reviewer_account_ref:string};
type Decision={requestKey:string;resultRef:string;expectedVersion:number;
 reportDigest:string;decision:"APPROVE"|"REJECT";decisionNote:string;
 currentPassword:string};
function parse(raw:unknown):Decision{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"LAB_PROFESSIONAL_SOURCE_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","resultRef","expectedVersion",
  "reportDigest","decision","decisionNote","currentPassword"].includes(k))||
  !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1||
  Number(x.expectedVersion)>100||
  typeof x.reportDigest!=="string"||!SHA.test(x.reportDigest)||
  !["APPROVE","REJECT"].includes(String(x.decision))||
  typeof x.decisionNote!=="string"||
  x.decisionNote.trim().length<12||x.decisionNote.trim().length>1000||
  typeof x.currentPassword!=="string"||x.currentPassword.length<8||
  Buffer.byteLength(x.currentPassword,"utf8")>1024)
  throw new BadRequestException({code:"LAB_PROFESSIONAL_SOURCE_INVALID"});
 return {requestKey:id(x.requestKey),resultRef:id(x.resultRef),
  expectedVersion:Number(x.expectedVersion),reportDigest:x.reportDigest,
  decision:x.decision as "APPROVE"|"REJECT",
  decisionNote:x.decisionNote.trim(),currentPassword:x.currentPassword};
}
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

/** CG16 original qualified clinician review, NOT CG03 commercial price review.
 * This makes no report visible to a patient and cannot issue a legal document.
 * Current CG14 professional credential and CG15 care purpose remain source-owned.
 */
@Injectable()
export class ClinicalLabProfessionalReviewService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly professionals:HealthLabProfessionalReviewSourceFacade,
  private readonly objects:PrivateObjectStorage){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let begun=false;
  try{
   await c.query("BEGIN");begun=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await run(c);
   await c.query("COMMIT");begun=false;return value;
  }catch(e){if(begun)try{await c.query("ROLLBACK")}catch{};throw e;}
  finally{c.release();}
 }
 private async source(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,order:string):Promise<Report>{
  const q=await c.query<Report>(
   "SELECT result.id AS result_ref,result.version_no,result.result_state AS state,"+
   "result.operator_account_ref,result.report_digest,"+
   "file.id AS file_ref,file.sha256,file.scan_status,"+
   "file.object_key,file.object_version,file.size_bytes::text AS size_bytes,"+
   "o.status AS order_status,o.center_ref "+
   "FROM lab_order o JOIN lab_result_revision result ON "+
   "result.root_realm_id=o.root_realm_id AND result.order_ref=o.id "+
   "JOIN cg19_lab_result_file file ON file.root_realm_id=result.root_realm_id "+
   "AND file.result_revision_ref=result.id "+
   "AND file.id=result.original_cg19_file_ref "+
   "JOIN cg19_lab_result_intent intent ON intent.root_realm_id=file.root_realm_id "+
   "AND intent.id=file.intent_ref AND intent.status='VALIDATED' "+
   "WHERE o.root_realm_id=$1 AND o.id=$2 AND o.center_ref=$3 "+
   "AND result.result_state='RESULT_READY' AND o.status='RESULT_READY' "+
   "AND file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL "+
   "AND file.sha256=result.report_digest "+
   "AND result.version_no=(SELECT max(last.version_no) "+
   "FROM lab_result_revision last WHERE last.root_realm_id=o.root_realm_id "+
   "AND last.order_ref=o.id) "+
   "FOR SHARE OF o,result,file,intent",
   [actor.realmId,order,center]);
  const found=q.rows[0];
  if(!found)throw new NotFoundException({code:"LAB_PROFESSIONAL_REPORT_NOT_READY"});
  const consent=await c.query(
   "SELECT 1 FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=$1 AND consent.patient_id=("+
   "SELECT patient_ref FROM lab_order WHERE root_realm_id=$1 AND id=$2) "+
   "AND consent.purpose='PATIENT_CARE' AND consent.granted=true "+
   "AND consent.revision_no=(SELECT max(last.revision_no) "+
   "FROM cg15_patient_consent last WHERE last.root_realm_id=consent.root_realm_id "+
   "AND last.patient_id=consent.patient_id AND last.purpose='PATIENT_CARE')",
   [actor.realmId,order]);
  if(!consent.rowCount)
   throw new ForbiddenException({code:"LAB_PATIENT_CONSENT_REQUIRED"});
  return found;
 }
 private async qualified(c:PoolClient,actor:VerifiedFoundationActor,
  center:string){
  const professional=await this.professionals.assertCurrent(
   c,actor,center,"lab.report.review");
  // Credential existence and current licence are real CG14 source checks.
  // Clinical discipline-specific reviewer/test mapping still requires
  // a separately approved policy; this review source cannot be released
  // or displayed as final patient report by itself.
  return professional;
 }
 async reviewable(token:string,centerRaw:string,orderRaw:string){
  const center=id(centerRaw),order=id(orderRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.report.review");
   await this.qualified(c,actor,center);
   const report=await this.source(c,actor,center,order);
   const found=await c.query<{decision:string;reviewed_at:Date}>(
    "SELECT decision,reviewed_at FROM cg16_lab_result_professional_review "+
    "WHERE root_realm_id=$1 AND result_revision_ref=$2",
    [actor.realmId,report.result_ref]);
   const release=await c.query(
    "SELECT 1 FROM cg16_lab_report_release "+
    "WHERE root_realm_id=$1 AND result_revision_ref=$2",
    [actor.realmId,report.result_ref]);
   return {resultRef:report.result_ref,resultVersion:report.version_no,
    reportDigest:report.report_digest,hasReview:!!found.rows[0],
    reviewDecision:found.rows[0]?.decision??null,
    patientRelease:release.rowCount?"RELEASED":"NOT_ISSUED",
    notificationDelivery:"NOT_SENT"};
  });
 }
 /** The only copy available for a professional review is read through the
  * original protected CG19 adapter. A successful scanner check and download
  * still do not count as reviewer approval or a patient release.
  */
 async reviewerFile(token:string,centerRaw:string,orderRaw:string):Promise<Buffer>{
  const center=id(centerRaw),order=id(orderRaw);
  const context=await this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.report.review");
   await this.qualified(c,actor,center);
   const report=await this.source(c,actor,center,order);
   return {actor,report};
  });
  const f=context.report;
  const size=Number(f.size_bytes);
  if(!Number.isSafeInteger(size)||size<1||size>10485760)
   throw new ConflictException({code:"LAB_PROFESSIONAL_FILE_INVALID"});
  const bytes=await this.objects.readVerifiedPrivateObject({
   objectKey:f.object_key,objectVersion:f.object_version,maxBytes:10485760});
  if(bytes.length!==size||bytes.subarray(0,4).toString("ascii")!=="%PDF"||
    digestBytes(bytes)!==f.report_digest)
   throw new ConflictException({code:"LAB_PROFESSIONAL_FILE_INVALID"});
  await this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.report.review");
   await this.qualified(c,actor,center);
   const current=await this.source(c,actor,center,order);
   if(current.result_ref!==f.result_ref||current.file_ref!==f.file_ref||
     current.report_digest!==f.report_digest)
    throw new ConflictException({code:"LAB_PROFESSIONAL_REPORT_CHANGED"});
   await c.query(
    "INSERT INTO cg16_lab_review_file_access(root_realm_id,result_revision_ref,"+
    "original_cg19_file_ref,reviewer_account_ref,report_digest) "+
    "VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [actor.realmId,f.result_ref,f.file_ref,actor.accountId,f.report_digest]);
  });
  return bytes;
 }
 async decide(token:string,centerRaw:string,orderRaw:string,raw:unknown){
  const center=id(centerRaw),order=id(orderRaw),decision=parse(raw);
  const currentActor=await this.sessions.requireAction(token,"lab.report.review");
  await this.sessions.limitClinicalProfessionalProof(currentActor);
  const sum=digest(["CG16_LAB_PROFESSIONAL_REVIEW_V1",center,order,
   decision.resultRef,decision.expectedVersion,decision.reportDigest,
   decision.decision,decision.decisionNote]);
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.report.review");
   const doctor=await this.qualified(c,actor,center);
   await this.sessions.requireClinicalProfessionalProof(
    c,actor,decision.currentPassword);
   const prior=await c.query<Approval>(
    "SELECT id,request_digest,result_revision_ref,decision,reviewer_account_ref "+
    "FROM cg16_lab_result_professional_review WHERE root_realm_id=$1 "+
    "AND reviewer_account_ref=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,decision.requestKey]);
   if(prior.rows[0]){
    const row=prior.rows[0];
    if(row.request_digest!==sum||row.result_revision_ref!==decision.resultRef)
     throw new ConflictException({code:"LAB_PROFESSIONAL_REVIEW_REQUEST_CONFLICT"});
    return {reviewRef:row.id,decision:row.decision,
     professionallyReviewed:true,patientReleased:false,replayed:true};
   }
   const source=await this.source(c,actor,center,order);
   if(source.result_ref!==decision.resultRef||
     source.version_no!==decision.expectedVersion||
     source.report_digest!==decision.reportDigest)
    throw new ConflictException({code:"LAB_PROFESSIONAL_REVIEW_STALE"});
   if(source.operator_account_ref===actor.accountId)
    throw new ForbiddenException({code:"LAB_PROFESSIONAL_SELF_APPROVAL_FORBIDDEN"});
   const seen=await c.query(
    "SELECT 1 FROM cg16_lab_review_file_access WHERE root_realm_id=$1 "+
    "AND result_revision_ref=$2 AND reviewer_account_ref=$3 "+
    "AND original_cg19_file_ref=$4 AND report_digest=$5",
    [actor.realmId,source.result_ref,actor.accountId,source.file_ref,
     source.report_digest]);
   if(!seen.rowCount)
    throw new ForbiddenException({code:"LAB_PROFESSIONAL_FILE_MUST_BE_REVIEWED"});
   const inserted=await c.query<{id:string}>(
    "INSERT INTO cg16_lab_result_professional_review("+
    "root_realm_id,order_ref,result_revision_ref,original_cg19_file_ref,"+
    "report_digest,result_version,operator_account_ref,reviewer_account_ref,"+
    "reviewer_doctor_ref,reviewer_revision_ref,reviewer_license_proof_ref,"+
    "reviewer_affiliation_ref,reviewer_license_valid_through,"+
    "decision,decision_note,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) "+
    "ON CONFLICT DO NOTHING RETURNING id",
    [actor.realmId,order,source.result_ref,source.file_ref,source.report_digest,
     source.version_no,source.operator_account_ref,actor.accountId,doctor.doctorRef,
     doctor.reviewRevisionRef,doctor.proofRef,doctor.centerAffiliationRef,
     doctor.licensedThrough,decision.decision,decision.decisionNote,
     decision.requestKey,sum]);
   if(!inserted.rows[0]){
    // Two identical retry requests can race on the unique review key.
    // Read the actual winner and return an idempotent replay only when its
    // protected source digest, decision and exact revision all match.
    const winner=await c.query<Approval>(
     "SELECT id,request_digest,result_revision_ref,decision,reviewer_account_ref "+
     "FROM cg16_lab_result_professional_review WHERE root_realm_id=$1 "+
     "AND reviewer_account_ref=$2 AND request_key=$3",
     [actor.realmId,actor.accountId,decision.requestKey]);
    if(winner.rows[0]?.request_digest===sum&&
       winner.rows[0].result_revision_ref===decision.resultRef&&
       winner.rows[0].decision===decision.decision)
     return {reviewRef:winner.rows[0].id,decision:decision.decision,
      professionallyReviewed:true,patientReleased:false,replayed:true};
    throw new ConflictException({code:"LAB_PROFESSIONAL_REVIEW_ALREADY_DECIDED"});
   }
   return {reviewRef:inserted.rows[0].id,decision:decision.decision,
    professionallyReviewed:true,patientReleased:false,replayed:false};
  });
 }
}
function digestBytes(bytes:Buffer){
 return createHash("sha256").update(bytes).digest("hex");
}
