import {Inject,Injectable,OnModuleInit,OnModuleDestroy,Logger,
 ForbiddenException,NotFoundException,UnauthorizedException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {MisReportSourceService,parseSafeReport}
 from "../application/mis-report-source.service";
import {MisProtectedArtifactService}
 from "../../cg-19-documents-notifications/application/mis-protected-artifact.service";
import {MisReportNoticeService}
 from "../../cg-19-documents-notifications/application/mis-report-notice.service";
import {nextScheduleOccurrence} from "../application/mis-report-schedule.service";

type Schedule={
 root_realm_id:string;id:string;owner_account_ref:string;
 recipient_account_ref:string;saved_ref:string;saved_revision:number;cadence:string;
 timezone:string;local_time:string;weekday:number|null;monthday:number|null;
 annual_month:number|null;next_due_utc:Date;revision:number;
 state:string
};
type ReadyRun={
 root_realm_id:string;id:string;requester_ref:string;
 saved_ref:string;definition_revision:number;safe_request:unknown;
 occurrence_due_utc:Date;state:string;retry_count:number;format:"PDF"|"XLSX"|"CSV";
 artifact_ref:string|null;source_key:string;original_project_digest:string|null;
 original_scope_all:boolean|null;original_scope_branch_refs:string[]|null
};
type Delivery={
 root_realm_id:string;id:string;run_ref:string;recipient_account_ref:string;
 attempts:number;state:string
};
/**
 * Due-index only, bounded original CG-20 work. Never enumerates tenants,
 * stores a session token, invents a recipient, or sends raw report content.
 * Any worker may crash at any point: the run occurrence unique key, original
 * CG19 object key and original notification uniqueness retain one outcome.
 * An unfinished object write becomes UNKNOWN rather than an invented READY.
 */
@Injectable()
export class MisReportScheduleWorker implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(MisReportScheduleWorker.name);
 private timer:ReturnType<typeof setInterval>|null=null;
 private stopped=false;
 private executing=false;
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly sources:MisReportSourceService,
  private readonly files:MisProtectedArtifactService,
  private readonly notices:MisReportNoticeService){}

 onModuleInit(){
  this.stopped=false;
  // Periodic due-index scans are small and do not inspect idle tenant rows.
  this.timer=setInterval(()=>{void this.tick();},60000);
  this.timer.unref?.();
  void this.tick();
 }
 async onModuleDestroy(){
  this.stopped=true;
  if(this.timer){clearInterval(this.timer);this.timer=null;}
 }
 private async claimDue():Promise<boolean>{
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query("SET LOCAL statement_timeout='7s'");
   await tx.query("SET LOCAL lock_timeout='2s'");
   const q=await tx.query<Schedule>(
    "SELECT * FROM cg20_report_schedule "+
    "WHERE state='ACTIVE' AND next_due_utc<=now() "+
    "ORDER BY next_due_utc,id LIMIT 1 FOR UPDATE SKIP LOCKED");
   const schedule=q.rows[0];
   if(!schedule){await tx.query("COMMIT");open=false;return false;}
   const def=await tx.query<{source_key:string;view_kind:string;safe_request:unknown;
    current_revision:number;state:string}>(
    "SELECT d.source_key,d.view_kind,d.safe_request,s.current_revision,s.state "+
    "FROM cg20_saved_report s JOIN cg20_report_definition d "+
    "ON d.root_realm_id=s.root_realm_id AND d.id=s.definition_ref "+
    "AND d.revision=s.current_revision "+
    "WHERE s.root_realm_id=$1 AND s.id=$2 AND "+
    "s.owner_account_ref=$3 LIMIT 1",
    [schedule.root_realm_id,schedule.saved_ref,schedule.owner_account_ref]);
   const item=def.rows[0];
   // Only own-authority, approved posted summary can run unattended.
   if(!item||item.state!=="ACTIVE"||
      !(item.source_key==="FINANCE_POSTED_SUMMARY"&&item.view_kind==="SUMMARY"||item.source_key==="PROJECT_STATUS_REPORT"&&item.view_kind==="TABLE")||
      item.current_revision!==schedule.saved_revision||
      schedule.owner_account_ref!==schedule.recipient_account_ref){
    await tx.query(
     "UPDATE cg20_report_schedule SET state='PAUSED',revision=revision+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
     [schedule.root_realm_id,schedule.id]);
    await tx.query("COMMIT");open=false;return true;
   }
   const request=parseSafeReport(item.safe_request);
   if(request.kind!==item.source_key||request.view!==item.view_kind||request.offset!==0){
    await tx.query(
     "UPDATE cg20_report_schedule SET state='PAUSED',revision=revision+1,"+
     "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
     [schedule.root_realm_id,schedule.id]);
    await tx.query("COMMIT");open=false;return true;
   }
   const next=nextScheduleOccurrence(schedule,new Date());
   const due=schedule.next_due_utc;
   const key=randomUUID(),safeJson=JSON.stringify(request);
   const digest=createHash("sha256").update(JSON.stringify({
    request,format:"PDF",savedRef:schedule.saved_ref,
    revision:item.current_revision,occurrence:due.toISOString()
   })).digest("hex");
   await tx.query(
    "INSERT INTO cg20_report_run(root_realm_id,requester_ref,"+
    "request_key,payload_digest,source_key,safe_request,saved_ref,"+
    "definition_revision,format,run_origin,schedule_ref,"+
    "occurrence_due_utc,state) "+
    "VALUES($1,$2,$3,$4,$10,$5::jsonb,$6,"+
    "$7,'PDF','SCHEDULED',$8,$9,'QUEUED') "+
    "ON CONFLICT DO NOTHING",
    [schedule.root_realm_id,schedule.owner_account_ref,key,digest,
     safeJson,schedule.saved_ref,item.current_revision,schedule.id,due,request.kind]);
   await tx.query(
    "UPDATE cg20_report_schedule SET next_due_utc=$3,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='ACTIVE'",
    [schedule.root_realm_id,schedule.id,next]);
   await tx.query("COMMIT");open=false;return true;
  }catch(e){
   if(open)await tx.query("ROLLBACK").catch(()=>undefined);
   throw e;
  }finally{tx.release();}
 }
 private async claimQueued():Promise<ReadyRun|null>{
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query("SET LOCAL statement_timeout='7s'");
   const found=await tx.query<ReadyRun>(
    "SELECT r.* FROM cg20_report_run r "+
    "WHERE r.run_origin='SCHEDULED' "+
    "AND r.state IN('QUEUED','UNKNOWN') AND r.retry_count<3 "+
    "AND r.expires_at>now() "+
    "ORDER BY r.created_at,r.id LIMIT 1 FOR UPDATE SKIP LOCKED");
   const row=found.rows[0];
   if(!row){await tx.query("COMMIT");open=false;return null;}
   await tx.query(
    "UPDATE cg20_report_run SET state='RUNNING',"+
    "retry_count=retry_count+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 "+
    "AND state IN('QUEUED','UNKNOWN') AND retry_count<3",
    [row.root_realm_id,row.id]);
   await tx.query("COMMIT");open=false;
   return {...row,state:"RUNNING"};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);
   throw e;}finally{tx.release();}
 }
 private async runStillAuthorized(row:ReadyRun):Promise<boolean>{
  await this.sessions.requireScheduledMisAction(
   row.root_realm_id,row.requester_ref,"mis.reports.view");
  await this.sessions.requireScheduledMisAction(
   row.root_realm_id,row.requester_ref,"mis.reports.export");
  await this.sessions.requireScheduledMisAction(
   row.root_realm_id,row.requester_ref,"mis.reports.schedule");
  if(row.source_key==="PROJECT_STATUS_REPORT"){
   await this.sessions.requireScheduledMisAction(row.root_realm_id,row.requester_ref,"projects.view");
   await this.sessions.requireScheduledMisAction(row.root_realm_id,row.requester_ref,"projects.export");
  }else if(row.source_key==="FINANCE_POSTED_SUMMARY")await this.sessions.requireScheduledMisAction(row.root_realm_id,row.requester_ref,"finance.reports.view");
  else throw new ForbiddenException("Scheduled source unavailable");
  await this.sessions.requireScheduledMisAction(
   row.root_realm_id,row.requester_ref,"communications.notifications.view");
  const a=await this.db.query(
   "SELECT 1 FROM cg20_report_run r "+
   "JOIN cg20_report_schedule sch ON sch.root_realm_id=r.root_realm_id "+
   "AND sch.id=r.schedule_ref AND sch.owner_account_ref=r.requester_ref "+
   "AND sch.recipient_account_ref=r.requester_ref AND sch.state='ACTIVE' "+
   "AND sch.channel='IN_APP' AND sch.saved_revision=r.definition_revision "+
   "JOIN cg20_saved_report saved ON saved.root_realm_id=r.root_realm_id "+
   "AND saved.id=r.saved_ref AND saved.owner_account_ref=r.requester_ref "+
   "AND saved.state='ACTIVE' AND saved.current_revision=r.definition_revision "+
   "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.requester_ref=$3 "+
   "AND r.state='RUNNING' AND r.run_origin='SCHEDULED' "+
   "AND r.expires_at>now() LIMIT 1",
   [row.root_realm_id,row.id,row.requester_ref]);
  return !!a.rows[0];
 }
 private async finish(row:ReadyRun,state:string,details:{
  artifactRef?:string;asOf?:string;rows?:number;errorClass?:string
 }={}){
  const q=await this.db.query(
   "UPDATE cg20_report_run SET state=$3,artifact_ref=$4,"+
   "source_as_of=$5,result_row_count=$6,error_class=$7,updated_at=now() "+
   "WHERE root_realm_id=$1 AND id=$2 AND state='RUNNING' RETURNING id",
   [row.root_realm_id,row.id,state,details.artifactRef??null,
    details.asOf??null,details.rows??null,details.errorClass??null]);
  return !!q.rowCount;
 }
 private async executeRun(row:ReadyRun){
  try{
   if(!await this.runStillAuthorized(row)){
    await this.finish(row,"REVOKED",{errorClass:"CURRENT_SCOPE_CHANGED"});
    return;
   }
   // The exact original CG09 posted SQL is shared with the interactive
   // report. No future-owner or protected audit feed is run unattended.
   const originalScope=await this.sources.originalScheduledScope(
    row.root_realm_id,row.requester_ref,parseSafeReport(row.safe_request));
   const report=await this.sources.previewScheduledReport(
    row.root_realm_id,row.requester_ref,row.safe_request,true);
   if(report.state==="EMPTY"){
    await this.finish(row,"EMPTY",{asOf:report.sourceAsOf,rows:0});
    return;
   }
   if(report.state!=="READY"||report.nextOffset!==null)
    throw new Error("Scheduled original source is incomplete");
   const data={
    label:report.label,scopeLabel:report.scopeLabel,
    sourceReadAt:report.sourceReadAt,
    sourceAsOf:report.sourceAsOf,
    sourceDigest:createHash("sha256").update(JSON.stringify({
     kind:report.kind,view:report.view,columns:report.columns,
     rows:report.rows,sourceAsOf:report.sourceAsOf
    })).digest("hex"),
    columns:report.columns,rows:report.rows
   };
   // Original CG19 owns actual server-side bytes, object key, scanner,
   // verified checksum and version; UNKNOWN cannot be a completed export.
   const artifact=report.kind==="PROJECT_STATUS_REPORT"?
    await this.files.issueScheduledProject(row.root_realm_id,row.requester_ref,row.id,"PDF",data):
    await this.files.issueScheduledFinance(row.root_realm_id,row.requester_ref,row.id,"PDF",data);
   if(!artifact.confirmed){
    await this.finish(row,"UNKNOWN",{errorClass:"FILE_CONFIRMATION_UNKNOWN"});
    return;
   }
   // Re-check root/account/source and saved report after the object write.
   if(!await this.runStillAuthorized(row)){
    await this.finish(row,"REVOKED",{errorClass:"CURRENT_SCOPE_CHANGED"});
    return;
   }
   const latestScope=await this.sources.originalScheduledScope(
    row.root_realm_id,row.requester_ref,parseSafeReport(row.safe_request));
   if(originalScope.all&&!latestScope.all||
      !latestScope.all&&originalScope.branchRefs.some(ref=>!latestScope.branchRefs.includes(ref))){
    await this.finish(row,"REVOKED",{errorClass:"SOURCE_SCOPE_REVOKED_DURING_EXPORT"});
    return;
   }
   const post=await this.sources.previewScheduledReport(
    row.root_realm_id,row.requester_ref,row.safe_request);
   const digestRows=(value:typeof report)=>createHash("sha256")
    .update(JSON.stringify({kind:value.kind,view:value.view,
     columns:value.columns,rows:value.rows,scopeLabel:value.scopeLabel}))
    .digest("hex");
   if(post.state!=="READY"||post.nextOffset!==null||digestRows(post)!==digestRows(report)){
    await this.finish(row,"REVOKED",{errorClass:"SOURCE_CHANGED_DURING_EXPORT"});
    return;
   }
   const tx=await this.db.connect();let open=false;
   try{
    await tx.query("BEGIN");open=true;
    await tx.query("SET LOCAL statement_timeout='7s'");
    const confirmed=await tx.query(
     "UPDATE cg20_report_run r SET state='READY',artifact_ref=$3,"+
     "source_as_of=$4,result_row_count=$5,original_scope_all=$6,"+
     "original_scope_branch_refs=$7::uuid[],original_project_digest=$8,updated_at=now() "+
     "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.state='RUNNING' "+
     "AND EXISTS(SELECT 1 FROM cg20_report_schedule sch "+
     "JOIN cg20_saved_report saved ON saved.root_realm_id=sch.root_realm_id "+
     "AND saved.id=sch.saved_ref AND saved.owner_account_ref=sch.owner_account_ref "+
     "WHERE sch.root_realm_id=r.root_realm_id AND sch.id=r.schedule_ref "+
     "AND sch.state='ACTIVE' AND sch.recipient_account_ref=r.requester_ref "+
     "AND sch.saved_revision=r.definition_revision "+
     "AND saved.state='ACTIVE' AND saved.current_revision=r.definition_revision) "+
     "RETURNING r.id",
     [row.root_realm_id,row.id,artifact.artifactRef,
      report.sourceAsOf??null,report.rows.length,
      originalScope.all,originalScope.branchRefs,report.kind==="PROJECT_STATUS_REPORT"?digestRows(report):null]);
    if(confirmed.rowCount){
     await tx.query(
      "INSERT INTO cg20_report_delivery_attempt(root_realm_id,run_ref,"+
      "recipient_account_ref,channel,state,next_retry_utc) "+
      "VALUES($1,$2,$3,'IN_APP','QUEUED',now()) "+
      "ON CONFLICT DO NOTHING",
      [row.root_realm_id,row.id,row.requester_ref]);
    }
    await tx.query("COMMIT");open=false;
    if(!confirmed.rowCount)
     await this.finish(row,"REVOKED",{errorClass:"CURRENT_SCOPE_CHANGED"});
   }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);
    throw e;}finally{tx.release();}
  }catch(e){
   const banned=e instanceof ForbiddenException||
    e instanceof NotFoundException||e instanceof UnauthorizedException;
   // A source outage or ambiguous original CG19 file outcome is neither
   // a confirmed empty report nor proof of successful delivery. Reclaim the
   // SAME run at most three times; exhaustion remains honest UNKNOWN.
   await this.finish(row,banned?"REVOKED":"UNKNOWN",{
    errorClass:banned?"CURRENT_SCOPE_CHANGED":
     "SOURCE_OR_STORAGE_NOT_YET_CONFIRMED"
   }).catch(()=>undefined);
  }
 }
 private async claimDelivery():Promise<Delivery|null>{
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query("SET LOCAL statement_timeout='7s'");
   const result=await tx.query<Delivery>(
    "SELECT * FROM cg20_report_delivery_attempt "+
    "WHERE channel='IN_APP' AND state IN('QUEUED','SENT_PENDING','FAILED') "+
    "AND next_retry_utc<=now() AND attempts<5 "+
    "ORDER BY next_retry_utc,id LIMIT 1 FOR UPDATE SKIP LOCKED");
   const row=result.rows[0];
   if(!row){await tx.query("COMMIT");open=false;return null;}
   await tx.query(
    "UPDATE cg20_report_delivery_attempt SET state='SENT_PENDING',"+
    "attempts=attempts+1,next_retry_utc=now()+interval '2 minutes',"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [row.root_realm_id,row.id]);
   // The fifth attempt is final: subsequent failures must move to
   // UNAVAILABLE, not remain SENT_PENDING or imply a delivered notice.
   await tx.query("COMMIT");open=false;
   return {...row,attempts:row.attempts+1};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);
   throw e;}finally{tx.release();}
 }
 private async sendDelivery(row:Delivery){
  try{
   const q=await this.db.query<ReadyRun>(
    "SELECT * FROM cg20_report_run WHERE root_realm_id=$1 AND id=$2 "+
    "AND requester_ref=$3 AND state='READY' AND run_origin='SCHEDULED' "+
    "AND expires_at>now() LIMIT 1",
    [row.root_realm_id,row.run_ref,row.recipient_account_ref]);
   const run=q.rows[0];
   if(!run)throw new Error("Scheduled private file no longer valid");
   await this.sessions.requireScheduledMisAction(
    row.root_realm_id,row.recipient_account_ref,"communications.notifications.view");
   if(run.original_scope_all===null||run.original_scope_branch_refs===null)
    throw new ForbiddenException("Original report branch scope cannot be verified");
   const latest=await this.sources.originalScheduledScope(
    row.root_realm_id,row.recipient_account_ref,parseSafeReport(run.safe_request));
   if(run.original_scope_all&&!latest.all||
     !latest.all&&run.original_scope_branch_refs.some(ref=>!latest.branchRefs.includes(ref)))
    throw new ForbiddenException("An old report contains branches no longer assigned");
   const fresh=await this.sources.previewScheduledReport(
    row.root_realm_id,row.recipient_account_ref,run.safe_request);
   if(run.source_key==="PROJECT_STATUS_REPORT"){
    const digest=createHash("sha256").update(JSON.stringify({kind:fresh.kind,view:fresh.view,columns:fresh.columns,rows:fresh.rows,scopeLabel:fresh.scopeLabel})).digest("hex");
    if(fresh.state!=="READY"||digest!==run.original_project_digest)throw new ForbiddenException("Project report changed before delivery");
   }
   await this.notices.publishReady(row.root_realm_id,
    row.recipient_account_ref,row.run_ref);
   // CG19 records confirmed in-app notice and original delivery row in one
   // SQL transaction. No external provider is marked delivered here.
  }catch(e){
   const forbidden=e instanceof ForbiddenException||
    e instanceof NotFoundException||e instanceof UnauthorizedException;
   const exhausted=row.attempts>=5;
   await this.db.query(
    "UPDATE cg20_report_delivery_attempt SET state=$3,"+
    "next_retry_utc=$4,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='SENT_PENDING'",
    [row.root_realm_id,row.id,forbidden?"SUPPRESSED":
      exhausted?"UNAVAILABLE":"FAILED",
     forbidden||exhausted?null:new Date(Date.now()+300000)]
   ).catch(()=>undefined);
  }
 }
 /** Strictly bounded work per minute, no per-account/tenant scans. */
 async tick(){
  if(this.stopped||this.executing)return;
  this.executing=true;
  try{
   for(let i=0;i<4&&!this.stopped;i++){
    if(!await this.claimDue())break;
   }
   for(let i=0;i<4&&!this.stopped;i++){
    const row=await this.claimQueued();
    if(!row)break;
    await this.executeRun(row);
   }
   // Interrupted RUNNING storage writes may be UNKNOWN, never falsely READY.
   await this.db.query(
    "UPDATE cg20_report_run run SET state='UNKNOWN',"+
    "error_class='WORKER_INTERRUPTED',updated_at=now() "+
    "FROM (SELECT root_realm_id,id FROM cg20_report_run "+
    "WHERE run_origin='SCHEDULED' AND state='RUNNING' "+
    "AND updated_at<now()-interval '10 minutes' "+
    "ORDER BY updated_at,root_realm_id,id LIMIT 4) stale "+
    "WHERE run.root_realm_id=stale.root_realm_id AND run.id=stale.id "+
    "AND run.run_origin='SCHEDULED' AND run.state='RUNNING' "+
    "AND run.updated_at<now()-interval '10 minutes'"
   );
   // A worker may crash after claiming its FINAL allowed in-app attempt.
   // Reconcile only a bounded stale batch into truthful UNAVAILABLE; never
   // leave an exhausted SENT_PENDING row or invent a provider confirmation.
   await this.db.query(
    "UPDATE cg20_report_delivery_attempt attempt SET "+
    "state='UNAVAILABLE',next_retry_utc=NULL,updated_at=now() "+
    "FROM (SELECT root_realm_id,id FROM cg20_report_delivery_attempt "+
    "WHERE channel='IN_APP' AND state='SENT_PENDING' AND attempts>=5 "+
    "AND next_retry_utc<=now() "+
    "ORDER BY next_retry_utc,root_realm_id,id LIMIT 4) stale "+
    "WHERE attempt.root_realm_id=stale.root_realm_id "+
    "AND attempt.id=stale.id AND attempt.state='SENT_PENDING' "+
    "AND attempt.attempts>=5"
   );
   for(let i=0;i<4&&!this.stopped;i++){
    const row=await this.claimDelivery();if(!row)break;
    await this.sendDelivery(row);
   }
  }catch(error){
   // Never log account, Foundation, patient, report IDs, raw SQL, file URLs,
   // source amounts or provider payloads. Preserve the error category only.
   this.logger.warn("CG20 scheduled reporting iteration unavailable ("+
    (error instanceof Error?error.name:"UnknownError")+
    "); no successful delivery has been recorded.");
  }finally{this.executing=false;}
 }
}
