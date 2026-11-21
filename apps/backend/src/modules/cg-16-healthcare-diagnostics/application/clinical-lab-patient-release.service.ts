import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import {HealthLabProfessionalReviewSourceFacade}
 from "../../cg-14-healthcare-network/application/health-lab-professional-review-source.facade";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"LAB_RELEASE_INVALID_REFERENCE"});
 return v;
};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Approved={
 review_ref:string;order_ref:string;result_ref:string;
 file_ref:string;report_digest:string;result_version:number;
 reviewer_account_ref:string;reviewer_doctor_ref:string;
 reviewer_revision_ref:string;patient_ref:string;center_ref:string;
 file_sha:string;object_key:string;object_version:string;
 size_bytes:string;order_status:string
};
type Release={id:string;order_ref:string;result_revision_ref:string;
 professional_review_ref:string;original_cg19_file_ref:string;
 report_digest:string;patient_ref:string;center_ref:string;
 clinician_account_ref:string;release_key:string;release_digest:string;
 released_at:Date;display_order_ref?:string;version_no?:number;
 superseded?:boolean};
type OriginalDownload=Release&{
 object_key:string;object_version:string;size_bytes:string;
 file_sha:string;scan_status:string
};
@Injectable()
/** Simple CG16 US002 release of the same already-approved private PDF.
 * The earlier licensed reviewer approval already verified the clinician's
 * password. No second password, signing provider or automatic messaging.
 */
export class ClinicalLabPatientReleaseService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly professionals:HealthLabProfessionalReviewSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async tx<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const v=await fn(c);await c.query("COMMIT");started=false;return v;
  }catch(e){if(started)try{await c.query("ROLLBACK")}catch{}throw e;}
  finally{c.release();}
 }
 private async source(c:PoolClient,actor:VerifiedFoundationActor,
  center:string,order:string){
  const q=await c.query<Approved>(
   "SELECT review.id AS review_ref,review.order_ref,"+
   "review.result_revision_ref AS result_ref,"+
   "review.original_cg19_file_ref AS file_ref,review.report_digest,"+
   "review.result_version,review.reviewer_account_ref,"+
   "review.reviewer_doctor_ref,review.reviewer_revision_ref,"+
   "o.patient_ref,o.center_ref,o.status AS order_status,"+
   "file.sha256 AS file_sha,file.object_key,file.object_version,"+
   "file.size_bytes::text "+
   "FROM cg16_lab_result_professional_review review "+
   "JOIN lab_result_revision result ON "+
   "result.root_realm_id=review.root_realm_id "+
   "AND result.id=review.result_revision_ref AND result.order_ref=review.order_ref "+
   "JOIN lab_order o ON o.root_realm_id=result.root_realm_id "+
   "AND o.id=result.order_ref "+
   "JOIN cg19_lab_result_file file ON file.root_realm_id=result.root_realm_id "+
   "AND file.id=review.original_cg19_file_ref "+
   "AND file.result_revision_ref=result.id AND file.order_ref=o.id "+
   "JOIN cg19_lab_result_intent intent ON intent.root_realm_id=file.root_realm_id "+
   "AND intent.id=file.intent_ref AND intent.status='VALIDATED' "+
   "WHERE review.root_realm_id=$1 AND review.order_ref=$2 "+
   "AND o.center_ref=$3 AND o.status='RESULT_READY' "+
   "AND review.decision='APPROVE' AND result.result_state='RESULT_READY' "+
   "AND result.report_digest=review.report_digest "+
   "AND result.original_cg19_file_ref=file.id "+
   "AND result.version_no=review.result_version "+
   "AND result.version_no=(SELECT max(latest.version_no) "+
   "FROM lab_result_revision latest WHERE latest.root_realm_id=result.root_realm_id "+
   "AND latest.order_ref=result.order_ref) "+
   "AND file.sha256=result.report_digest "+
   "AND file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL "+
   "FOR SHARE OF review,result,o,file,intent",
   [actor.realmId,order,center]);
  if(!q.rows[0])throw new NotFoundException({
   code:"LAB_RELEASE_APPROVED_ORIGINAL_REPORT_REQUIRED"});
  return q.rows[0];
 }
 async state(token:string,centerRaw:string,orderRaw:string){
  const center=id(centerRaw),order=id(orderRaw);
  return this.tx(async c=>{
   const a=await this.admission.requireCurrent(c,token,center,"lab.report.release");
   const clinician=await this.professionals.assertCurrent(c,a,center,"lab.report.release");
   const approved=await this.source(c,a,center,order);
   if(approved.reviewer_account_ref!==a.accountId||
    approved.reviewer_doctor_ref!==clinician.doctorRef)
    throw new ForbiddenException({code:"LAB_RELEASE_ORIGINAL_REVIEWER_REQUIRED"});
   const found=await c.query<Release>(
    "SELECT * FROM cg16_lab_report_release WHERE root_realm_id=$1 "+
    "AND result_revision_ref=$2",[a.realmId,approved.result_ref]);
   const notices=found.rows[0]?await c.query<{channel:string;state:string}>(
    "SELECT channel,state FROM cg19_notification "+
    "WHERE realm_id=$1 AND source_kind='CG16_LAB_RELEASE' "+
    "AND cg16_lab_report_release_id=$2 AND "+
    "channel IN('IN_APP','EMAIL','SMS') LIMIT 3",
    [a.realmId,found.rows[0].id]):null;
   const notificationStates=(notices?.rows??[]).map(n=>({
    channel:n.channel,state:n.state
   }));
   return {resultRef:approved.result_ref,resultVersion:approved.result_version,
    reportDigest:approved.report_digest,
    releaseState:found.rows[0]?"RELEASED":"AWAITING_RELEASE",
    patientDownloadAvailable:!!found.rows[0],
    notificationStates,
    notificationDelivered:notificationStates.some(n=>
     n.channel!=="IN_APP"&&n.state==="DELIVERED")};
  });
 }
 async release(token:string,centerRaw:string,orderRaw:string,raw:unknown){
  const center=id(centerRaw),order=id(orderRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==3||!("requestKey" in raw)||
    !("resultRef" in raw)||!("reportDigest" in raw))
   throw new BadRequestException({code:"LAB_RELEASE_INVALID_REQUEST"});
  const o=raw as Record<string,unknown>;
  const key=id(o.requestKey),result=id(o.resultRef);
  if(typeof o.reportDigest!=="string"||!SHA.test(o.reportDigest))
   throw new BadRequestException({code:"LAB_RELEASE_INVALID_ATTESTATION"});
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.report.release");
   const clinician=await this.professionals.assertCurrent(
    c,actor,center,"lab.report.release");
   // Serialize only the same original laboratory order, not the whole center.
   await c.query("SELECT id FROM lab_order WHERE root_realm_id=$1 "+
    "AND id=$2 AND center_ref=$3 FOR UPDATE",[actor.realmId,order,center]);
   const source=await this.source(c,actor,center,order);
   if(source.result_ref!==result||source.report_digest!==o.reportDigest||
    source.reviewer_account_ref!==actor.accountId||
    source.reviewer_doctor_ref!==clinician.doctorRef||
    source.reviewer_revision_ref!==clinician.reviewRevisionRef)
    throw new ConflictException({code:"LAB_RELEASE_CLINICIAN_OR_REPORT_CHANGED"});
   const existing=await c.query<Release>(
    "SELECT * FROM cg16_lab_report_release WHERE root_realm_id=$1 "+
    "AND result_revision_ref=$2 FOR SHARE",
    [actor.realmId,source.result_ref]);
   const sum=digest(["CG16_PROFESSIONAL_ATTESTED_RELEASE_V1",
    actor.realmId,center,order,source.result_ref,source.review_ref,
    source.file_ref,source.report_digest,actor.accountId,clinician.doctorRef]);
   if(existing.rows[0]){
    const x=existing.rows[0];
    if(x.clinician_account_ref!==actor.accountId||x.release_key!==key||
     x.release_digest!==sum)
     throw new ConflictException({code:"LAB_RELEASE_ALREADY_EXISTS"});
    return {releaseRef:x.id,releaseState:"RELEASED",
     patientDownloadAvailable:true,notificationDelivered:false,replayed:true};
   }
   const consent=await c.query(
    "SELECT 1 FROM cg15_patient_consent consent "+
    "WHERE consent.root_realm_id=$1 AND consent.patient_id=$2 "+
    "AND consent.purpose='PATIENT_CARE' AND consent.granted=true "+
    "AND consent.revision_no=(SELECT max(last.revision_no) "+
    "FROM cg15_patient_consent last WHERE last.root_realm_id=$1 "+
    "AND last.patient_id=$2 AND last.purpose='PATIENT_CARE')",
    [actor.realmId,source.patient_ref]);
   if(!consent.rowCount)throw new ForbiddenException({
    code:"LAB_PATIENT_CONSENT_REQUIRED"});
   const added=await c.query<{id:string}>(
    "INSERT INTO cg16_lab_report_release(root_realm_id,order_ref,"+
    "result_revision_ref,professional_review_ref,original_cg19_file_ref,"+
    "report_digest,patient_ref,center_ref,clinician_account_ref,"+
    "clinician_doctor_ref,clinician_revision_ref,release_key,"+
    "release_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id",
    [actor.realmId,order,source.result_ref,source.review_ref,
     source.file_ref,source.report_digest,source.patient_ref,center,
     actor.accountId,clinician.doctorRef,clinician.reviewRevisionRef,key,sum]);
   return {releaseRef:added.rows[0].id,releaseState:"RELEASED",
    patientDownloadAvailable:true,notificationDelivered:false,replayed:false};
  });
 }
 /** Patient ownership and current care consent are checked on EVERY read.
  * Historical reading is independent of the optional LAB_ERP feature switch.
  */
 private async mine(c:PoolClient,actor:VerifiedFoundationActor){
  const owned=await c.query<{id:string}>(
   "SELECT p.id FROM cg15_patient p JOIN cg15_patient_account_link link "+
   "ON link.root_realm_id=p.root_realm_id AND link.patient_id=p.id "+
   "AND link.account_id=$2 AND link.revoked_at IS NULL "+
   "JOIN account a ON a.id=link.account_id AND a.realm_id=link.root_realm_id "+
   "WHERE p.root_realm_id=$1 AND p.profile_status='VERIFIED' "+
   "AND a.status='ACTIVE' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
   "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_consent consent "+
   "WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
   "AND consent.purpose='PATIENT_CARE' AND consent.granted=true "+
   "AND consent.revision_no=(SELECT max(last.revision_no) "+
   "FROM cg15_patient_consent last WHERE "+
   "last.root_realm_id=consent.root_realm_id "+
   "AND last.patient_id=consent.patient_id AND last.purpose='PATIENT_CARE')) "+
   "FOR SHARE OF p,link,a",[actor.realmId,actor.accountId]);
  if(!owned.rows.length||owned.rows.length>1)
   throw new ForbiddenException({code:"LAB_PATIENT_REPORT_ACCOUNT_UNAVAILABLE"});
  return owned.rows[0].id;
 }
 async patientReports(token:string){
  const actor=await this.sessions.verifySession(token);
  return this.tx(async c=>{
   const patient=await this.mine(c,actor);
   const rows=await c.query<Release>(
    "SELECT release.id,release.order_ref,release.result_revision_ref,"+
    "release.released_at,original_order.display_order_ref,result.version_no,"+
    "EXISTS(SELECT 1 FROM cg16_lab_report_release newer "+
    "JOIN lab_result_revision later ON "+
    "later.root_realm_id=newer.root_realm_id "+
    "AND later.id=newer.result_revision_ref "+
    "WHERE newer.root_realm_id=release.root_realm_id "+
    "AND newer.order_ref=release.order_ref "+
    "AND later.version_no>result.version_no) AS superseded "+
    "FROM cg16_lab_report_release release "+
    "JOIN lab_result_revision result ON result.root_realm_id=release.root_realm_id "+
    "AND result.id=release.result_revision_ref "+
    "JOIN lab_order original_order ON original_order.root_realm_id=release.root_realm_id "+
    "AND original_order.id=release.order_ref AND original_order.patient_ref=release.patient_ref "+
    "JOIN cg19_lab_result_file file ON file.root_realm_id=release.root_realm_id "+
    "AND file.id=release.original_cg19_file_ref "+
    "AND file.revoked_at IS NULL AND file.scan_status='CLEAN_VERIFIED' "+
    "WHERE release.root_realm_id=$1 AND release.patient_ref=$2 "+
    "ORDER BY release.released_at DESC,release.id DESC LIMIT 51",
    [actor.realmId,patient]);
   return {reports:rows.rows.slice(0,50).map(x=>({
    releaseRef:x.id,orderLabel:x.display_order_ref,
    reportVersion:x.version_no,releasedAt:x.released_at.toISOString(),
    superseded:x.superseded===true,approvedByClinician:true
   })),complete:rows.rows.length<=50};
  });
 }
 private async authorizedDownload(c:PoolClient,actor:VerifiedFoundationActor,
  releaseRef:string){
  const patient=await this.mine(c,actor);
  const q=await c.query<OriginalDownload>(
   "SELECT release.*,file.object_key,file.object_version,"+
   "file.size_bytes::text,file.sha256 AS file_sha,file.scan_status "+
   "FROM cg16_lab_report_release release "+
   "JOIN lab_result_revision result ON "+
   "result.root_realm_id=release.root_realm_id "+
   "AND result.id=release.result_revision_ref "+
   "JOIN cg19_lab_result_file file ON "+
   "file.root_realm_id=release.root_realm_id "+
   "AND file.id=release.original_cg19_file_ref "+
   "AND file.result_revision_ref=result.id "+
   "JOIN cg19_lab_result_intent intent ON intent.root_realm_id=file.root_realm_id "+
   "AND intent.id=file.intent_ref AND intent.status='VALIDATED' "+
   "WHERE release.root_realm_id=$1 AND release.patient_ref=$2 "+
   "AND release.id=$3 AND file.revoked_at IS NULL "+
   "AND file.scan_status='CLEAN_VERIFIED' "+
   "AND result.report_digest=release.report_digest "+
   "AND file.sha256=release.report_digest "+
   "AND result.original_cg19_file_ref=file.id "+
   "FOR SHARE OF release,result,file,intent",
   [actor.realmId,patient,releaseRef]);
  if(!q.rows[0])throw new NotFoundException({code:"LAB_PATIENT_REPORT_UNAVAILABLE"});
  return q.rows[0];
 }
 async patientPdf(token:string,releaseRaw:string):Promise<Buffer>{
  const release=id(releaseRaw);
  const actor=await this.sessions.verifySession(token);
  const original=await this.tx(c=>this.authorizedDownload(c,actor,release));
  const size=Number(original.size_bytes);
  if(!Number.isSafeInteger(size)||size<5||size>10485760)
   throw new ConflictException({code:"LAB_PATIENT_REPORT_FILE_INVALID"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:original.object_key,objectVersion:original.object_version,
   maxBytes:10485760});
  if(bytes.length!==size||bytes.subarray(0,4).toString("ascii")!=="%PDF"||
   digestBytes(bytes)!==original.report_digest)
   throw new ConflictException({code:"LAB_PATIENT_REPORT_FILE_CHANGED"});
  await this.tx(async c=>{
   const rechecked=await this.authorizedDownload(c,actor,release);
   if(rechecked.report_digest!==original.report_digest||
    rechecked.object_version!==original.object_version)
    throw new ConflictException({code:"LAB_PATIENT_REPORT_FILE_CHANGED"});
   await c.query(
    "INSERT INTO cg16_lab_patient_report_access("+
    "root_realm_id,release_ref,patient_account_ref) VALUES($1,$2,$3)",
    [actor.realmId,release,actor.accountId]);
  });
  return bytes;
 }
}
const digestBytes=(data:Buffer)=>createHash("sha256").update(data).digest("hex");
