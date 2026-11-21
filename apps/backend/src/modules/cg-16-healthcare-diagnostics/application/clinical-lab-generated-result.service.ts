import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import {ClinicalLabResultEvidenceService} from "./clinical-lab-result-evidence.service";
import {PrivateObjectStorage}
 from "../../cg-19-documents-notifications/infrastructure/private-object-storage";
import {renderLaboratoryReport,type LaboratoryReportSource}
 from "../../cg-19-documents-notifications/application/laboratory-report-renderer";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const uuid=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"LAB_RESULT_INVALID_REFERENCE"});
 return v;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Entry={lineRef:string;value:string;unit:string;observation:string};
type SourceLine={id:string;test_name_snapshot:string};
type Order={patient_ref:string;display_order_ref:string;first_name:string;
 last_name:string;virtual_display_id:string;center_name:string};
type Result={id:string;created_at:Date;source_key:string;result_state:string;version_no:number;corrects_revision_ref:string|null};
type Intent={id:string;order_ref:string;center_ref:string;result_revision_ref:string;object_key:string;
 status:string;sha256:string;size_bytes:string;request_digest:string;
 patient_ref:string;request_key:string};
type Generated={result:Result;intent:Intent;pdf:Buffer;sourceDigest:string;correction:boolean};
type Correction={previousReleaseRef:string;reason:string};
function parse(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).length<2||Object.keys(raw).length>3||
  Object.keys(raw).some(k=>!["requestKey","results","correction"].includes(k))||
  !("requestKey" in raw)||
  !("results" in raw))
  throw new BadRequestException({code:"LAB_RESULT_VALUES_REQUIRED"});
 const a=raw as {requestKey:unknown;results:unknown;correction?:unknown};
 let correction:Correction|null=null;
 if(a.correction!==undefined){
  const v=a.correction;
  if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.keys(v).length!==2||!("previousReleaseRef" in v)||
   !("reason" in v)||typeof v.reason!=="string"||
   v.reason.trim().length<8||v.reason.length>500||
   /[\u0000-\u001f\u007f]/.test(v.reason))
   throw new BadRequestException({code:"LAB_CORRECTION_REASON_REQUIRED"});
  correction={previousReleaseRef:uuid(v.previousReleaseRef),reason:v.reason.trim()};
 }
 const requestKey=uuid(a.requestKey);
 if(!Array.isArray(a.results)||a.results.length<1||a.results.length>50)
  throw new BadRequestException({code:"LAB_RESULT_VALUES_REQUIRED"});
 const rows:Entry[]=a.results.map((r:unknown)=>{
  if(!r||typeof r!=="object"||Array.isArray(r)||
   !("lineRef" in r)||!("value" in r)||
   Object.keys(r).some(k=>!["lineRef","value","unit","observation"].includes(k)))
   throw new BadRequestException({code:"LAB_RESULT_LINE_INVALID"});
  const t=r as Record<string,unknown>;
  const lineRef=uuid(t.lineRef);
  if(typeof t.value!=="string"||!t.value.trim()||t.value.length>120||
   (t.unit!==undefined&&(typeof t.unit!=="string"||t.unit.length>32))||
   (t.observation!==undefined&&
    (typeof t.observation!=="string"||t.observation.length>500)))
   throw new BadRequestException({code:"LAB_RESULT_LINE_INVALID"});
  return {lineRef,value:t.value.trim(),unit:String(t.unit??"").trim(),
   observation:String(t.observation??"").trim()};
 }).sort((x,y)=>x.lineRef.localeCompare(y.lineRef));
 if(new Set(rows.map(x=>x.lineRef)).size!==rows.length)
  throw new ConflictException({code:"LAB_RESULT_DUPLICATE_TEST_LINE"});
 return {requestKey,rows,correction};
}
@Injectable()
/** CG16 original staff result entry -> CG19-generated private PDF.
 * Reuses the SAME CG16 result revision, scanner-verified CG19 file,
 * original independent doctor review and patient release. Does not
 * require a pre-made PDF, an analyzer, invented ranges, or digital signing.
 */
export class ClinicalLabGeneratedResultService{
 constructor(@Inject(DATABASE)private readonly pool:Pool,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly evidence:ClinicalLabResultEvidenceService,
  private readonly objects:PrivateObjectStorage){}
 private async tx<T>(work:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.pool.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='15s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await work(c);
   await c.query("COMMIT");open=false;return value;
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{}throw e;
  }finally{c.release();}
 }
 private async original(c:PoolClient,root:string,center:string,order:string){
  const q=await c.query<Order>(
   "SELECT o.patient_ref,o.display_order_ref,p.first_name,p.last_name,"+
   "p.virtual_display_id,center.display_name AS center_name "+
   "FROM lab_order o JOIN cg15_patient p ON p.root_realm_id=o.root_realm_id "+
   "AND p.id=o.patient_ref AND p.profile_status='VERIFIED' "+
   "JOIN health_center center ON center.root_realm_id=o.root_realm_id "+
   "AND center.id=o.center_ref "+
   "WHERE o.root_realm_id=$1 AND o.center_ref=$2 AND o.id=$3",
   [root,center,order]);
  if(!q.rows[0])throw new NotFoundException({
   code:"LAB_RESULT_ORIGINAL_PATIENT_UNAVAILABLE"});
  return q.rows[0];
 }
 /** A correction never changes the already released original PDF.
  * It must follow the LATEST released result, current patient consent,
  * current center and existing CG16 clinical recording permission.
  */
 private async priorReleased(c:PoolClient,root:string,center:string,
  order:string,releaseRef:string){
  const original=await c.query<{patient_ref:string;status:string}>(
   "SELECT patient_ref,status FROM lab_order WHERE root_realm_id=$1 "+
   "AND center_ref=$2 AND id=$3 FOR UPDATE",[root,center,order]);
  if(original.rows[0]?.status!=="RESULT_READY")
   throw new ConflictException({code:"LAB_CORRECTION_ORIGINAL_NOT_READY"});
  const prior=await c.query<{id:string;version_no:number}>(
   "SELECT previous.id,previous.version_no "+
   "FROM cg16_lab_report_release released "+
   "JOIN lab_result_revision previous ON "+
   "previous.root_realm_id=released.root_realm_id "+
   "AND previous.id=released.result_revision_ref "+
   "AND previous.order_ref=released.order_ref "+
   "WHERE released.root_realm_id=$1 AND released.order_ref=$2 "+
   "AND released.center_ref=$3 AND released.id=$4 "+
   "AND previous.result_state='RESULT_READY' "+
   "AND previous.version_no=(SELECT max(latest.version_no) "+
   "FROM lab_result_revision latest WHERE "+
   "latest.root_realm_id=previous.root_realm_id "+
   "AND latest.order_ref=previous.order_ref) "+
   "FOR SHARE OF released,previous",
   [root,order,center,releaseRef]);
  if(!prior.rows[0])
   throw new ConflictException({code:"LAB_CORRECTION_LATEST_RELEASE_REQUIRED"});
  const consent=await c.query(
   "SELECT 1 FROM cg15_patient_consent x WHERE x.root_realm_id=$1 "+
   "AND x.patient_id=$2 AND x.purpose='PATIENT_CARE' AND x.granted "+
   "AND x.revision_no=(SELECT max(last.revision_no) "+
   "FROM cg15_patient_consent last WHERE last.root_realm_id=x.root_realm_id "+
   "AND last.patient_id=x.patient_id AND last.purpose='PATIENT_CARE')",
   [root,original.rows[0].patient_ref]);
  if(!consent.rowCount)
   throw new ConflictException({code:"LAB_CORRECTION_CURRENT_PATIENT_CONSENT_REQUIRED"});
  return prior.rows[0];
 }
 private async lines(c:PoolClient,root:string,order:string){
  const r=await c.query<SourceLine>(
   "SELECT id,test_name_snapshot FROM lab_order_line "+
   "WHERE root_realm_id=$1 AND order_ref=$2 ORDER BY id LIMIT 51",
   [root,order]);
  if(r.rows.length<1||r.rows.length>50)
   throw new ConflictException({code:"LAB_RESULT_TEST_LINES_NOT_READY"});
  return r.rows;
 }
 async eligible(token:string,centerRaw:string,orderRaw:string){
  const center=uuid(centerRaw),order=uuid(orderRaw);
  return this.tx(async c=>{
   const a=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   const orderRow=await c.query<{status:string}>(
    "SELECT status FROM lab_order WHERE root_realm_id=$1 AND "+
    "center_ref=$2 AND id=$3",[a.realmId,center,order]);
   if(!orderRow.rows[0]||!["PROCESSING","RESULT_READY"].includes(
    orderRow.rows[0].status))
    throw new NotFoundException({code:"LAB_RESULT_ORDER_NOT_READY"});
   const original=await this.lines(c,a.realmId,order);
   const latest=await c.query<{
    id:string;result_state:string;source_key:string;operator_account_ref:string;
    corrects_revision_ref:string|null}>(
    "SELECT id,result_state,source_key,operator_account_ref,corrects_revision_ref "+
    "FROM lab_result_revision WHERE root_realm_id=$1 AND order_ref=$2 "+
    "ORDER BY version_no DESC LIMIT 1",
    [a.realmId,order]);
   const row=latest.rows[0];
   let resume:null|{requestKey:string;results:Entry[]}=null;
   if(row&&row.result_state==="DRAFT"&&
    row.operator_account_ref===a.accountId){
    const entered=await c.query<{
     order_line_ref:string;value_text:string;unit_text:string;
     observation_text:string}>(
     "SELECT order_line_ref,value_text,unit_text,observation_text "+
     "FROM lab_result_value WHERE root_realm_id=$1 "+
     "AND result_revision_ref=$2",[a.realmId,row.id]);
    if(entered.rows.length===original.length)
     resume={requestKey:row.source_key,results:entered.rows.map(x=>({
      lineRef:x.order_line_ref,value:x.value_text,
      unit:x.unit_text,observation:x.observation_text
     }))};
   }
   let previousReleaseRef:string|null=null;
   let resumeCorrection:Correction|null=null;
   if(row?.result_state==="RESULT_READY"&&
    orderRow.rows[0].status==="RESULT_READY"){
    const prior=await c.query<{id:string}>(
     "SELECT id FROM cg16_lab_report_release WHERE root_realm_id=$1 "+
     "AND order_ref=$2 AND result_revision_ref=$3",
     [a.realmId,order,row.id]);
    previousReleaseRef=prior.rows[0]?.id??null;
   }
   let correctionDraft:Entry[]|null=null;
   if(previousReleaseRef&&row?.result_state==="RESULT_READY"){
    const values=await c.query<{
     order_line_ref:string;value_text:string;unit_text:string;
     observation_text:string}>(
     "SELECT order_line_ref,value_text,unit_text,observation_text "+
     "FROM lab_result_value WHERE root_realm_id=$1 AND order_ref=$2 "+
     "AND result_revision_ref=$3 ORDER BY order_line_ref LIMIT 51",
     [a.realmId,order,row.id]);
    if(values.rows.length===original.length)
     correctionDraft=values.rows.map(v=>({
      lineRef:v.order_line_ref,value:v.value_text,unit:v.unit_text,
      observation:v.observation_text}));
   }
   if(row?.result_state==="DRAFT"&&resume&&row.corrects_revision_ref){
    const q=await c.query<{prior_release_ref:string;reason:string}>(
     "SELECT prior_release_ref,reason FROM cg16_lab_result_correction "+
     "WHERE root_realm_id=$1 AND result_revision_ref=$2",
     [a.realmId,row.id]);
    if(q.rows[0])resumeCorrection={
     previousReleaseRef:q.rows[0].prior_release_ref,
     reason:q.rows[0].reason};
   }
   const canEnter=orderRow.rows[0].status==="PROCESSING"&&
    (!row||resume!==null)||
    orderRow.rows[0].status==="RESULT_READY"&&
    (Boolean(previousReleaseRef)||Boolean(resumeCorrection));
   return {canEnter,canCorrect:Boolean(previousReleaseRef),
    previousReleaseRef,resumeCorrection,correctionDraft,
    reportReady:row?.result_state==="RESULT_READY",resume,
    tests:original.map(x=>({lineRef:x.id,name:x.test_name_snapshot}))};
  });
 }
 private async prepare(c:PoolClient,token:string,center:string,
  order:string,key:string,values:Entry[],correction:Correction|null):Promise<Generated>{
  const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
  // Preserve the byte/digest contract of earlier generated reports on retry.
  // Corrections have their own explicitly different idempotency source.
  const requestDigest=correction?
   hash(["CG16_GENERATED_LAB_CORRECTION_V1",actor.realmId,
    center,order,values,correction]):
   hash(["CG16_GENERATED_LAB_RESULT_V1",actor.realmId,center,order,values]);
  const prior=await c.query<Intent&{created_at:Date}>(
   "SELECT intent.*,result.created_at FROM cg19_lab_result_intent intent "+
   "JOIN lab_result_revision result ON result.root_realm_id=intent.root_realm_id "+
   "AND result.id=intent.result_revision_ref "+
   "WHERE intent.root_realm_id=$1 AND intent.requested_by=$2 "+
   "AND intent.request_key=$3 FOR UPDATE OF intent",
   [actor.realmId,actor.accountId,key]);
  if(prior.rows[0]&&(prior.rows[0].request_digest!==requestDigest||
   prior.rows[0].order_ref!==order||prior.rows[0].center_ref!==center))
   throw new ConflictException({code:"LAB_RESULT_RETRY_MISMATCH"});
  const existing=prior.rows[0];
  let priorRevision:{id:string;version_no:number}|null=null;
  if(!existing){
   if(correction){
    priorRevision=await this.priorReleased(c,actor.realmId,center,order,
     correction.previousReleaseRef);
   }else{
    await this.evidence.requireProcessingOriginal(c,actor,center,order);
    const already=await c.query(
     "SELECT 1 FROM lab_result_revision WHERE root_realm_id=$1 "+
     "AND order_ref=$2 LIMIT 1",[actor.realmId,order]);
    if(already.rowCount)throw new ConflictException({
     code:"LAB_RESULT_ALREADY_RECORDED"});
   }
  }
  const source=await this.original(c,actor.realmId,center,order);
  const lines=await this.lines(c,actor.realmId,order);
  if(values.length!==lines.length||
   lines.some(x=>!values.some(v=>v.lineRef===x.id)))
   throw new ConflictException({code:"LAB_RESULT_ENTER_ALL_ORDERED_TESTS"});
  const sorted=new Map(values.map(x=>[x.lineRef,x]));
  let result:Result;
  if(existing){
   const q=await c.query<Result>(
    "SELECT id,created_at,source_key,result_state,version_no,corrects_revision_ref FROM lab_result_revision "+
    "WHERE root_realm_id=$1 AND id=$2 AND order_ref=$3",
    [actor.realmId,existing.result_revision_ref,order]);
   if(!q.rows[0]||q.rows[0].source_key!==key)
    throw new ConflictException({code:"LAB_RESULT_ORIGINAL_REVISION_CHANGED"});
   result=q.rows[0];
   const saved=await c.query<{
    order_line_ref:string;value_text:string;unit_text:string;observation_text:string}>(
    "SELECT order_line_ref,value_text,unit_text,observation_text "+
    "FROM lab_result_value WHERE root_realm_id=$1 AND "+
    "result_revision_ref=$2",[actor.realmId,result.id]);
   if(saved.rows.length!==values.length||saved.rows.some(x=>{
    const v=sorted.get(x.order_line_ref);
    return !v||v.value!==x.value_text||v.unit!==x.unit_text||
     v.observation!==x.observation_text;
   }))throw new ConflictException({code:"LAB_RESULT_RETRY_MISMATCH"});
   if(Boolean(result.corrects_revision_ref)!==Boolean(correction))
    throw new ConflictException({code:"LAB_CORRECTION_RETRY_SCOPE_CHANGED"});
   if(correction){
    const cRow=await c.query<{
     prior_release_ref:string;reason:string;prior_result_ref:string}>(
     "SELECT prior_release_ref,reason,prior_result_ref "+
     "FROM cg16_lab_result_correction WHERE root_realm_id=$1 "+
     "AND result_revision_ref=$2",[actor.realmId,result.id]);
    if(!cRow.rows[0]||
     cRow.rows[0].prior_release_ref!==correction.previousReleaseRef||
     cRow.rows[0].reason!==correction.reason||
     cRow.rows[0].prior_result_ref!==result.corrects_revision_ref)
     throw new ConflictException({code:"LAB_CORRECTION_RETRY_SCOPE_CHANGED"});
   }
  }else{
   const stored=await c.query<Result>(
    "INSERT INTO lab_result_revision(root_realm_id,order_ref,version_no,"+
    "operator_account_ref,source_key,corrects_revision_ref) "+
    "VALUES($1,$2,$3,$4,$5,$6) "+
    "RETURNING id,created_at,source_key,result_state,version_no,corrects_revision_ref",
    [actor.realmId,order,(priorRevision?.version_no??0)+1,
     actor.accountId,key,priorRevision?.id??null]);
   result=stored.rows[0];
   if(correction&&priorRevision){
    await c.query(
     "INSERT INTO cg16_lab_result_correction(root_realm_id,order_ref,"+
     "prior_release_ref,prior_result_ref,result_revision_ref,reason,"+
     "created_by_account,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
     [actor.realmId,order,correction.previousReleaseRef,priorRevision.id,
      result.id,correction.reason,actor.accountId,key]);
   }
   for(const v of values){
    await c.query(
     "INSERT INTO lab_result_value(root_realm_id,order_ref,"+
     "result_revision_ref,order_line_ref,value_text,unit_text,observation_text) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7)",
     [actor.realmId,order,result.id,v.lineRef,v.value,v.unit,v.observation]);
   }
  }
  const report:LaboratoryReportSource={
   sourceDigest:requestDigest,orderNumber:source.display_order_ref,
   versionNo:result.version_no,corrected:result.corrects_revision_ref!==null,
   centerName:source.center_name,
   patientName:source.first_name+" "+source.last_name,
   patientDisplayId:source.virtual_display_id,
   recordedAt:result.created_at.toISOString(),
   results:lines.map(x=>({
    testName:x.test_name_snapshot,value:sorted.get(x.id)!.value,
    unit:sorted.get(x.id)!.unit,observation:sorted.get(x.id)!.observation
   }))
  };
  const pdf=await renderLaboratoryReport(report);
  const sha=createHash("sha256").update(pdf).digest("hex");
  if(existing){
   if(existing.sha256!==sha||Number(existing.size_bytes)!==pdf.length)
    throw new ConflictException({code:"LAB_RESULT_GENERATED_PDF_CHANGED"});
   return {result,intent:existing,pdf,sourceDigest:requestDigest,
    correction:result.corrects_revision_ref!==null};
  }
  const intent=await c.query<Intent>(
   "INSERT INTO cg19_lab_result_intent(root_realm_id,order_ref,center_ref,"+
   "patient_ref,result_revision_ref,requested_by,request_key,request_digest,"+
   "mime,size_bytes,sha256,object_key,reserved_until) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,'application/pdf',$9,$10,$11,"+
   "now()+interval '1 day') RETURNING id,result_revision_ref,object_key,"+
   "status,sha256,size_bytes::text AS size_bytes,request_digest,patient_ref,request_key,"+
   "order_ref,center_ref",
   [actor.realmId,order,center,source.patient_ref,result.id,
    actor.accountId,key,requestDigest,pdf.length,sha,
    "careganga/private/cg19/"+actor.realmId+"/lab-generated/"+randomUUID()]);
  await c.query(
   "INSERT INTO cg19_lab_result_event(root_realm_id,intent_ref,"+
   "actor_ref,action) VALUES($1,$2,$3,'GENERATED_INTENT')",
   [actor.realmId,intent.rows[0].id,actor.accountId]);
  return {result,intent:intent.rows[0],pdf,sourceDigest:requestDigest,
   correction:result.corrects_revision_ref!==null};
 }
 async generate(token:string,centerRaw:string,orderRaw:string,body:unknown){
  const center=uuid(centerRaw),order=uuid(orderRaw);
  const input=parse(body);
  const original=await this.tx(c=>this.prepare(
   c,token,center,order,input.requestKey,input.rows,input.correction));
  if(original.intent.status==="VALIDATED"){
   // A saved intent alone is not proof that the scanned PDF remains valid
   // or that the current patient still consents. Reuse CG16's existing
   // original-file/consent verification instead of inventing a second gate.
   const proof=await this.evidence.status(token,center,order,original.intent.id);
   if(proof.status!=="VALIDATED"||!proof.cleanVerified||
    proof.resultRef!==original.result.id||!proof.originalFileRef)
    throw new ConflictException({code:"LAB_RESULT_REPORT_NOT_VERIFIED"});
   return {state:"RESULT_READY",resultRef:original.result.id,
    generated:true,patientReleased:false,replayed:true};
  }
  let verified:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{
   await this.objects.writeVerifiedPrivateDocument({
    objectKey:original.intent.object_key,bytes:original.pdf,
    sha256:original.intent.sha256});
   verified=await this.objects.verifyPrivateObject({
    objectKey:original.intent.object_key,mime:"application/pdf",
    sizeBytes:original.pdf.length,sha256:original.intent.sha256});
  }catch{
   await this.pool.query(
    "UPDATE cg19_lab_result_intent SET status='UNKNOWN',updated_at=now() "+
    "WHERE id=$1 AND status='INITIATED'",[original.intent.id]).catch(()=>undefined);
   return {state:"UNKNOWN",resultRef:original.result.id,
    generated:false,patientReleased:false,
    message:"Secure report generation could not be verified. Retry the same result."};
  }
  if(verified.state!=="CLEAN_VERIFIED"||
   verified.sha256!==original.intent.sha256||
   verified.sizeBytes!==original.pdf.length||
   !verified.objectVersion||!verified.scanProofRef)
   return {state:"UNKNOWN",generated:false,patientReleased:false};
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,center,"lab.results.record");
   const orderRow=await c.query<{status:string}>(
    "SELECT status FROM lab_order WHERE root_realm_id=$1 AND id=$2 "+
    "AND center_ref=$3 FOR UPDATE",[actor.realmId,order,center]);
   const intent=await c.query<Intent>(
    "SELECT id,result_revision_ref,object_key,status,sha256,"+
    "size_bytes::text,request_digest,patient_ref,request_key "+
    "FROM cg19_lab_result_intent WHERE root_realm_id=$1 AND id=$2 "+
    "AND requested_by=$3 FOR UPDATE",
    [actor.realmId,original.intent.id,actor.accountId]);
   if(!intent.rows[0]||intent.rows[0].sha256!==original.intent.sha256||
    intent.rows[0].request_digest!==original.sourceDigest)
    throw new ConflictException({code:"LAB_RESULT_GENERATED_SOURCE_CHANGED"});
   if(intent.rows[0].status==="VALIDATED"&&orderRow.rows[0]?.status==="RESULT_READY")
    return {state:"RESULT_READY",resultRef:original.result.id,
     generated:true,patientReleased:false,replayed:true};
   if(original.correction){
    if(!orderRow.rows[0]||orderRow.rows[0].status!=="RESULT_READY")
     throw new ConflictException({code:"LAB_CORRECTION_ORIGINAL_NO_LONGER_READY"});
    const valid=await c.query(
     "SELECT 1 FROM cg16_lab_result_correction correction "+
     "JOIN cg16_lab_report_release prior ON "+
     "prior.root_realm_id=correction.root_realm_id "+
     "AND prior.id=correction.prior_release_ref "+
     "AND prior.order_ref=correction.order_ref "+
     "AND prior.result_revision_ref=correction.prior_result_ref "+
     "JOIN lab_result_revision next ON "+
     "next.root_realm_id=correction.root_realm_id "+
     "AND next.id=correction.result_revision_ref "+
     "AND next.order_ref=correction.order_ref "+
     "JOIN lab_order o ON o.root_realm_id=correction.root_realm_id "+
     "AND o.id=correction.order_ref AND o.center_ref=$3 "+
     "WHERE correction.root_realm_id=$1 AND correction.order_ref=$2 "+
     "AND correction.result_revision_ref=$4 "+
     "AND correction.created_by_account=$5 "+
     "AND next.result_state='DRAFT' "+
     "AND next.corrects_revision_ref=prior.result_revision_ref "+
     "AND next.version_no=(SELECT max(latest.version_no) "+
     "FROM lab_result_revision latest "+
     "WHERE latest.root_realm_id=next.root_realm_id "+
     "AND latest.order_ref=next.order_ref) "+
     "AND EXISTS(SELECT 1 FROM cg15_patient_consent consent "+
     "WHERE consent.root_realm_id=o.root_realm_id "+
     "AND consent.patient_id=o.patient_ref "+
     "AND consent.purpose='PATIENT_CARE' AND consent.granted "+
     "AND consent.revision_no=(SELECT max(last.revision_no) "+
     "FROM cg15_patient_consent last WHERE "+
     "last.root_realm_id=consent.root_realm_id "+
     "AND last.patient_id=consent.patient_id "+
     "AND last.purpose='PATIENT_CARE'))",
     [actor.realmId,order,center,original.result.id,actor.accountId]);
    if(!valid.rowCount)
     throw new ConflictException({code:"LAB_CORRECTION_SOURCE_CHANGED"});
   }else{
    if(!orderRow.rows[0]||orderRow.rows[0].status!=="PROCESSING")
     throw new ConflictException({code:"LAB_RESULT_ORDER_NO_LONGER_PROCESSING"});
    await this.evidence.requireProcessingOriginal(c,actor,center,order);
   }
   await c.query(
    "UPDATE cg19_lab_result_intent SET status='VALIDATED',"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND status IN('INITIATED','UNKNOWN')",
    [actor.realmId,original.intent.id]);
   const file=await c.query<{id:string}>(
    "INSERT INTO cg19_lab_result_file(root_realm_id,intent_ref,order_ref,"+
    "center_ref,patient_ref,result_revision_ref,sha256,mime,size_bytes,"+
    "object_key,object_version,scan_proof_ref,scan_status,scanned_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,$10,$11,"+
    "'CLEAN_VERIFIED',$12) RETURNING id",
    [actor.realmId,original.intent.id,order,center,
     original.intent.patient_ref,original.result.id,original.intent.sha256,
     original.pdf.length,original.intent.object_key,
     verified.objectVersion,verified.scanProofRef,new Date(verified.verifiedAt)]);
   await c.query(
    "UPDATE lab_result_revision SET result_state='RESULT_READY',"+
    "original_cg19_file_ref=$4,report_digest=$5 "+
    "WHERE root_realm_id=$1 AND order_ref=$2 AND id=$3 AND result_state='DRAFT'",
    [actor.realmId,order,original.result.id,file.rows[0].id,original.intent.sha256]);
   if(!original.correction){
    const next=await c.query<{revision:number}>(
     "UPDATE lab_order SET status='RESULT_READY',revision=revision+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND center_ref=$3 "+
     "AND status='PROCESSING' RETURNING revision",[actor.realmId,order,center]);
    if(!next.rows[0])
     throw new ConflictException({code:"LAB_RESULT_STATE_CHANGED"});
    await c.query(
     "INSERT INTO lab_order_event(root_realm_id,order_ref,source_key,"+
     "actor_ref,event_type,prior_revision,new_revision) "+
     "VALUES($1,$2,$3,$4,'RESULT_FILE_READY',$5,$6)",
     [actor.realmId,order,input.requestKey,actor.accountId,
      next.rows[0].revision-1,next.rows[0].revision]);
   }
   // Correction of a released report keeps the original order RESULT_READY
   // and prior CG19 file untouched; a new revision still requires independent
   // review and explicit patient release.
   await c.query(
    "INSERT INTO cg19_lab_result_event(root_realm_id,intent_ref,"+
    "file_ref,actor_ref,action) VALUES($1,$2,$3,$4,'GENERATED_VERIFIED')",
    [actor.realmId,original.intent.id,file.rows[0].id,actor.accountId]);
   return {state:"RESULT_READY",resultRef:original.result.id,
    generated:true,patientReleased:false,replayed:false};
  });
 }
}
