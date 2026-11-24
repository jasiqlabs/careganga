import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {MisProtectedArtifactService}
 from "../../cg-19-documents-notifications/application/mis-protected-artifact.service";
import type {ReportFormat}
 from "../../cg-19-documents-notifications/application/mis-report-renderer";
import {MisReportSourceService,parseSafeReport,type SafeReportRequest}
 from "./mis-report-source.service";
import {MisSavedReportService} from "./mis-saved-report.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"MIS_RUN_INVALID",
  message:"Choose a valid report request."});return v;};
const digest=(v:unknown)=>createHash("sha256")
 .update(JSON.stringify(v)).digest("hex");
type Row={
 id:string;root_realm_id:string;requester_ref:string;
 request_key:string;payload_digest:string;source_key:string;
 safe_request:SafeReportRequest;state:string;artifact_ref:string|null;
 format:ReportFormat|null;saved_ref:string|null;definition_revision:number|null;
 source_as_of:Date|null;result_row_count:number|null;
 original_scope_all:boolean|null;original_scope_branch_refs:string[]|null;
 created_at:Date;updated_at:Date;expires_at:Date;
};
type NewRun={
 requestKey:string;format:ReportFormat;
 savedRef?:string;request?:SafeReportRequest
};
const parse=(raw:unknown):NewRun=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"MIS_RUN_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","format","savedRef","request"].includes(k)))
  throw new BadRequestException({code:"MIS_RUN_INVALID"});
 const requestKey=id(x.requestKey);
 if(x.format!=="PDF"&&x.format!=="XLSX"&&x.format!=="CSV")
  throw new BadRequestException({code:"MIS_RUN_FORMAT_INVALID",field:"format",
   message:"Choose PDF, Excel or CSV."});
 if(Boolean(x.savedRef)===Boolean(x.request))
  throw new BadRequestException({code:"MIS_RUN_INVALID",
   message:"Choose a saved report or the current report configuration."});
 return {requestKey,format:x.format,
  ...(x.savedRef?{savedRef:id(x.savedRef)}:
   {request:parseSafeReport(x.request)})};
};
@Injectable()
export class MisReportRunService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly sources:MisReportSourceService,
  private readonly saved:MisSavedReportService,
  private readonly files:MisProtectedArtifactService){}
 private async actor(token:string){
  await this.sessions.requireAction(token,"mis.reports.view");
  return this.sessions.requireAction(token,"mis.reports.export");
 }
 private summary(row:Row){
  return {ref:row.id,state:row.state,format:row.format,
   createdAt:row.created_at,expiresAt:row.expires_at,
   sourceAsOf:row.source_as_of,
   canDownload:row.state==="READY"&&Boolean(row.artifact_ref)};
 }
 private async current(token:string,ref:string,recipient=false){
  const actor=await this.actor(token);
  const q=await this.db.query<Row>(
   "SELECT r.* FROM cg20_report_run r "+
   "WHERE r.root_realm_id=$1 AND r.id=$2 "+
   "AND (r.requester_ref=$3 OR ($4::boolean AND EXISTS("+
   "SELECT 1 FROM cg20_report_delivery_attempt d "+
   "WHERE d.root_realm_id=r.root_realm_id AND d.run_ref=r.id "+
   "AND d.recipient_account_ref=$3 AND d.state IN('QUEUED','SENT_PENDING','CONFIRMED')"+
   "))) LIMIT 1",[actor.realmId,id(ref),actor.accountId,recipient]);
  const row=q.rows[0];
  if(!row)throw new NotFoundException({code:"MIS_RUN_NOT_FOUND",
   message:"This report is not available."});
  return {row,actor};
 }
 private async validateOriginalScope(token:string,row:Row){
  if(!row.source_key.startsWith("FINANCE_"))return;
  if(row.original_scope_all===null||row.original_scope_branch_refs===null)
   throw new ForbiddenException("The original report scope is not verified. Create a current report.");
  const scope=await this.sources.originalFinanceScope(token,row.safe_request);
  if(!scope||row.original_scope_all&&!scope.all||
    !scope.all&&row.original_scope_branch_refs.some(ref=>!scope.branchRefs.includes(ref)))
   throw new ForbiddenException("Report branch access changed. Create a current report.");
 }
 private async validateSource(token:string,row:Row,originalReady=true){
  if(row.saved_ref){
   const q=await this.db.query<{state:string;current_revision:number}>(
    "SELECT state,current_revision FROM cg20_saved_report WHERE root_realm_id=$1 "+
    "AND id=$2 AND current_revision=$3",
    [row.root_realm_id,row.saved_ref,row.definition_revision]);
   if(q.rows[0]?.state!=="ACTIVE")
    throw new NotFoundException({code:"MIS_RUN_STALE",
     message:"Saved report changed or was retired. Create a fresh report."});
  }
  if(originalReady)await this.validateOriginalScope(token,row);
  // Current original CG-09/CG-15 row, field, branch, center and purpose grants,
  // including sensitive small population suppression.
  const preview=await this.sources.preview(token,row.safe_request);
  if(originalReady)await this.validateOriginalScope(token,row);
  if(preview.state==="PARTIAL")
   throw new BadRequestException({code:"MIS_RUN_PARTIAL",
    message:"This source is incomplete. Narrow filters before exporting."});
  if(preview.state==="SUPPRESSED")
   throw new ForbiddenException({code:"MIS_RUN_SUPPRESSED",
    message:"This report cannot be shared for a small private group."});
  return preview;
 }
 /** One idempotent on-demand run. No report rows are persisted in CG20.
  * The file is not marked READY until CG19 verifies its actual scanned bytes.
  */
 async create(token:string,raw:unknown){
  const actor=await this.actor(token),input=parse(raw);
  let request:SafeReportRequest,savedRef:string|null=null,revision:number|null=null;
  if(input.savedRef){
   const item=await this.saved.authorizedRequest(token,input.savedRef);
   request=parseSafeReport(item.request);savedRef=item.ref;revision=item.revision;
  }else request=parseSafeReport(input.request);
  if(request.kind==="BENEFICIARY_ASSISTANCE_SUMMARY")throw new ForbiddenException({code:"MIS_LIVE_PREVIEW_ONLY",message:"This beneficiary report is available as a current live preview only."});
  const preview=await this.sources.preview(token,request);
  if(preview.state==="PARTIAL")
   throw new BadRequestException({code:"MIS_RUN_PARTIAL",
    message:"Choose a narrower source or period before exporting a partial report."});
  if(preview.state==="SUPPRESSED")
   throw new ForbiddenException({code:"MIS_RUN_SUPPRESSED",
    message:"This report cannot be exported for a small private group."});
  if(preview.nextOffset!==null)
   throw new BadRequestException({code:"MIS_RUN_LIMIT",field:"rows",
    message:"This report has more than 50 entries. Apply a narrower filter first."});
  const originalScope=await this.sources.originalFinanceScope(token,request);
  const identity=digest({request,format:input.format,savedRef,revision});
  const tx=await this.db.connect();let active=false,row:Row,isNew=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL statement_timeout='10s'");
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":cg20-run:"+actor.accountId+":"+input.requestKey]);
   const existing=await tx.query<Row>(
    "SELECT * FROM cg20_report_run WHERE root_realm_id=$1 "+
    "AND requester_ref=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,input.requestKey]);
   if(existing.rows[0]){
    row=existing.rows[0];
    if(row.payload_digest!==identity)
     throw new ConflictException({code:"MIS_RUN_KEY_REUSED",
      message:"This report request was already used with different filters."});
   }else{
    const inserted=await tx.query<Row>(
     "INSERT INTO cg20_report_run(root_realm_id,requester_ref,request_key,"+
     "payload_digest,source_key,safe_request,saved_ref,definition_revision,"+
     "format,run_origin,state) "+
     "VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,'ON_DEMAND','QUEUED') RETURNING *",
     [actor.realmId,actor.accountId,input.requestKey,identity,request.kind,
      JSON.stringify(request),savedRef,revision,input.format]);
    row=inserted.rows[0];isNew=true;
   }
   await tx.query("COMMIT");active=false;
  }catch(e){if(active)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
  // One immutable run ID and one CG19 artifact ID survive lost HTTP
  // acknowledgements, interrupted storage writes and worker restarts.
  // UNKNOWN is not READY: the original object is reconciled by CG19 before
  // any download. A stale RUNNING run becomes reclaimable only after 15 min.
  const recoverable=isNew||row.state==="QUEUED"||row.state==="UNKNOWN"||
   row.state==="RUNNING"&&row.updated_at.getTime()<Date.now()-15*60000;
  if(!recoverable)return {...this.summary(row),replayed:true};
  const claimed=await this.db.query<Row>(
   "UPDATE cg20_report_run SET state='RUNNING',updated_at=now() "+
   "WHERE root_realm_id=$1 AND id=$2 AND requester_ref=$3 "+
   "AND (state IN('QUEUED','UNKNOWN') OR "+
   "(state='RUNNING' AND updated_at<now()-interval '15 minutes')) "+
   "RETURNING *",[actor.realmId,row.id,actor.accountId]);
  if(!claimed.rows[0]){
   const latest=await this.current(token,row.id);
   return {...this.summary(latest.row),replayed:!isNew};
  }
  try{
   // Revalidate scope after durable acceptance, before generating bytes.
   const fresh=await this.validateSource(token,claimed.rows[0],false);
   if(fresh.state==="PARTIAL")
    throw new BadRequestException({code:"MIS_RUN_PARTIAL",
     message:"A report source was unavailable or results were truncated. Narrow the filters."});
   if(fresh.nextOffset!==null)
    throw new BadRequestException({code:"MIS_RUN_LIMIT",field:"rows",
     message:"The source grew beyond 50 entries. Narrow your report filters."});
   if(fresh.state==="EMPTY"){
    const empty=await this.db.query<Row>(
     "UPDATE cg20_report_run SET state='EMPTY',result_row_count=0,"+
     "source_as_of=$3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
     "AND state='RUNNING' RETURNING *",
     [actor.realmId,row.id,fresh.sourceAsOf??null]);
    return {...this.summary(empty.rows[0]),replayed:!isNew};
   }
   const sourceDigest=digest({kind:fresh.kind,view:fresh.view,
    columns:fresh.columns,rows:fresh.rows,scopeLabel:fresh.scopeLabel,
    sourceAsOf:fresh.sourceAsOf??fresh.sourceReadAt});
   const artifact=await this.files.issueFromReport(token,row.id,input.format,{
    label:fresh.label,scopeLabel:fresh.scopeLabel,
    sourceReadAt:fresh.sourceReadAt,sourceAsOf:fresh.sourceAsOf,
    sourceDigest,columns:fresh.columns,rows:fresh.rows});
   if(!artifact.confirmed){
    await this.db.query(
     "UPDATE cg20_report_run SET state='UNKNOWN',updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND state='RUNNING'",
     [actor.realmId,row.id]);
    return {ref:row.id,state:"UNKNOWN",format:input.format,
     canDownload:false,message:"File status is unconfirmed. Refresh before retrying."};
   }
   // A role/scope revoked during object storage must prevent READY response.
   // A newly queued row has no persisted proof until READY: compare against
   // the exact source-granted branches captured before the original render.
   const currentScope=await this.sources.originalFinanceScope(token,request);
   if(originalScope&&(!currentScope||
     originalScope.all&&!currentScope.all||
     !currentScope.all&&originalScope.branchRefs.some(ref=>
      !currentScope.branchRefs.includes(ref))))
    throw new ForbiddenException("Report branch access changed during generation.");
   const post=await this.sources.preview(token,claimed.rows[0].safe_request);
   // Re-read the original source after CG19 finishes the protected file.
   // If authorization, consent or source data changed, old bytes must not
   // become downloadable even though the storage write was confirmed.
   const postDigest=digest({kind:post.kind,view:post.view,
    columns:post.columns,rows:post.rows,scopeLabel:post.scopeLabel});
   const previousDigest=digest({kind:fresh.kind,view:fresh.view,
    columns:fresh.columns,rows:fresh.rows,scopeLabel:fresh.scopeLabel});
   if(postDigest!==previousDigest)
    throw new ConflictException({code:"MIS_RUN_CHANGED",
     message:"The source changed during export. Create a fresh report."});
   const done=await this.db.query<Row>(
    "UPDATE cg20_report_run SET state='READY',artifact_ref=$3,"+
    "source_as_of=$4,result_row_count=$5,original_scope_all=$6,"+
    "original_scope_branch_refs=$7::uuid[],updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='RUNNING' RETURNING *",
    [actor.realmId,row.id,artifact.artifactRef,fresh.sourceAsOf??null,
     fresh.rows.length,originalScope?.all??null,originalScope?.branchRefs??null]);
   if(!done.rows[0])throw new ConflictException({code:"MIS_RUN_CHANGED"});
   return {...this.summary(done.rows[0]),replayed:!isNew};
  }catch(error){
   const isDenied=error instanceof ForbiddenException||
    error instanceof NotFoundException;
   const response=error instanceof ConflictException?error.getResponse():null;
   const uncertain=!!response&&typeof response==="object"&&
    "code" in response&&response.code==="MIS_ARTIFACT_CHANGED";
   // A previously written immutable original CG19 object with a different
   // checksum is UNKNOWN, not a proven failed/missing file. Never create a
   // duplicate object, leak content or return READY on an unverified replay.
   const state=isDenied?"REVOKED":uncertain?"UNKNOWN":"FAILED";
   await this.db.query(
    "UPDATE cg20_report_run SET state=$3,error_class=$4,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='RUNNING'",
    [actor.realmId,row.id,state,
     isDenied?"SOURCE_REVOKED":uncertain?
      "ORIGINAL_ARTIFACT_UNCONFIRMED":"SOURCE_OR_STORAGE_FAILED"]).catch(()=>undefined);
   if(isDenied)throw error;
   return {ref:row.id,state,format:input.format,canDownload:false,
    message:uncertain?
     "The original protected file could not be reconciled. Its status remains unconfirmed; create a new report for current source data.":
     "Unable to confirm the protected report file. Review its status before retrying."};
  }
 }
 async list(token:string){
  const actor=await this.actor(token);
  const runs=await this.db.query<Row>(
   "SELECT * FROM cg20_report_run WHERE root_realm_id=$1 AND requester_ref=$2 "+
   "ORDER BY created_at DESC,id DESC LIMIT 30",
   [actor.realmId,actor.accountId]);
  return {runs:runs.rows.map(r=>this.summary(r))};
 }
 async status(token:string,runRef:string){
  const {row}=await this.current(token,runRef,true);
  if(row.expires_at.getTime()<=Date.now())
   return {...this.summary(row),state:"EXPIRED",canDownload:false};
  // Metadata never grants download rights. A stale RUNNING result is
  // presented as unconfirmed until same-key reconciliation verifies CG19.
  if(row.state==="RUNNING"&&row.updated_at.getTime()<Date.now()-15*60000)
   return {...this.summary(row),state:"UNKNOWN",canDownload:false,
    message:"File creation was interrupted. Retry the original report request to reconcile."};
  return this.summary(row);
 }
 async download(token:string,runRef:string){
  const {row}=await this.current(token,runRef,true);
  if(row.state!=="READY"||!row.artifact_ref||
    row.expires_at.getTime()<=Date.now()||!row.format)
   throw new NotFoundException({code:"MIS_RUN_FILE_UNAVAILABLE",
    message:"This protected report is no longer available."});
  await this.validateSource(token,row);
  const original=await this.files.read(token,row.id);
  // Check original owner read rights again immediately before bytes exit API.
  await this.validateSource(token,row);
  const mime=original.mime;
  return {bytes:original.bytes,mime,
   filename:"CareGanga-Report."+
    (row.format==="PDF"?"pdf":row.format==="XLSX"?"xlsx":"csv")};
 }
}
