import {
 ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";

/** Original CG-19 in-app notification producer for one actual CG-20 READY
 * scheduled run. No report rows/amounts/recipient bank data or raw file URLs
 * are placed in a notification. A current CG-01 source grant is mandatory
 * before recording this harmless sign-in notice.
 */
@Injectable()
export class MisReportNoticeService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly branches:BranchSourceFacade){}

 async publishReady(root:string,account:string,runRef:string){
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.view");
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.export");
  await this.sessions.requireScheduledMisAction(root,account,"communications.notifications.view");
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL statement_timeout='8s'");
   await tx.query("SET LOCAL lock_timeout='3s'");
   const actual=await tx.query<{id:string;expires_at:Date;safe_request:unknown;
    source_key:string;original_project_digest:string|null;original_scope_all:boolean|null;original_scope_branch_refs:string[]|null}>(
    "SELECT r.id,r.expires_at,r.safe_request,r.source_key,r.original_project_digest,r.original_scope_all,"+
    "r.original_scope_branch_refs FROM cg20_report_run r "+
    "JOIN cg20_report_schedule schedule ON schedule.root_realm_id=r.root_realm_id "+
    "AND schedule.id=r.schedule_ref AND schedule.owner_account_ref=r.requester_ref "+
    "AND schedule.recipient_account_ref=r.requester_ref "+
    "AND schedule.saved_revision=r.definition_revision "+
    "JOIN cg20_saved_report saved ON saved.root_realm_id=r.root_realm_id "+
    "AND saved.id=r.saved_ref AND saved.owner_account_ref=r.requester_ref "+
    "AND saved.state='ACTIVE' AND saved.current_revision=r.definition_revision "+
    "JOIN cg19_mis_report_artifact artifact ON artifact.root_realm_id=r.root_realm_id "+
    "AND artifact.report_run_ref=r.id AND artifact.id=r.artifact_ref "+
    "JOIN account recipient ON recipient.realm_id=r.root_realm_id "+
    "AND recipient.id=r.requester_ref AND recipient.status='ACTIVE' "+
    "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.requester_ref=$3 "+
    "AND r.run_origin='SCHEDULED' AND r.state='READY' "+
    "AND r.expires_at>now() AND schedule.state='ACTIVE' "+
    "AND artifact.state='READY' AND artifact.revoked_at IS NULL "+
    "AND artifact.object_version IS NOT NULL AND artifact.content_sha256 IS NOT NULL "+
    "AND artifact.content_length IS NOT NULL "+
    "LIMIT 1 FOR SHARE OF r,schedule,saved,artifact,recipient",
    [root,runRef,account]);
   if(!actual.rows[0])
    throw new NotFoundException({
     code:"MIS_SCHEDULE_REPORT_UNAVAILABLE",
     message:"The protected scheduled report is unavailable for delivery."});
   const request=actual.rows[0].safe_request as {branchRef?:unknown};
   const original=actual.rows[0];
   if(original.original_scope_all===null||original.original_scope_branch_refs===null)
    throw new ForbiddenException("The original report scope cannot be verified");
   const chosen=typeof request?.branchRef==="string"?request.branchRef:null;
   const project=original.source_key==="PROJECT_STATUS_REPORT";
   if(!project&&original.source_key!=="FINANCE_POSTED_SUMMARY")throw new ForbiddenException("Scheduled source unavailable");
   if(project&&!original.original_project_digest)throw new ForbiddenException("Project report proof unavailable");
   if(!project&&chosen)await this.branches.requireScheduledFinanceReportBranch(root,account,chosen);
   // A null selection means the originally authorized branch union for a
   // limited manager, never implicit Foundation-null financial access.
   const current=project?await this.branches.scheduledProjectScope(root,account,tx):await this.branches.scheduledFinanceScope(root,account);
   if(original.original_scope_all&&!current.all||
     !current.all&&original.original_scope_branch_refs.some(ref=>
       !current.branchRefs.includes(ref)))
    throw new ForbiddenException("Report branch access changed before delivery");
   if(chosen&&(project||!current.all)&&!current.branchRefs.includes(chosen))
    throw new ForbiddenException("This report branch is no longer assigned");
   const text={
    subject:"Your CareGanga Foundation report is ready",
    body:"A scheduled Foundation report is available. Sign in to your private account to check current permissions and download it."
   };
   await tx.query(
    "INSERT INTO cg19_message_template(realm_id,kind,channel,version,"+
    "subject,body,status,origin,approved_by) "+
    "VALUES($1,'CG20_MIS_REPORT','IN_APP',1,$2,$3,'APPROVED','SYSTEM',NULL) "+
    "ON CONFLICT(realm_id,kind,channel,version) DO NOTHING",
    [root,text.subject,text.body]);
   const templ=await tx.query<{id:string;version:number;subject:string;body:string}>(
    "SELECT id,version,subject,body FROM cg19_message_template "+
    "WHERE realm_id=$1 AND kind='CG20_MIS_REPORT' AND channel='IN_APP' "+
    "AND status='APPROVED' AND version=1 LIMIT 1",[root]);
   if(!templ.rows[0])throw new ConflictException({
    code:"MIS_SCHEDULE_NOTICE_UNAVAILABLE",message:"Private report notice is not configured."});
   const template=templ.rows[0];
   const created=await tx.query<{id:string}>(
    "INSERT INTO cg19_notification(realm_id,source_kind,source_key,"+
    "cg20_mis_run_ref,recipient_id,template_id,template_version,channel,"+
    "subject_snapshot,body_snapshot,purpose,state,due_at,expires_at) "+
    "VALUES($1,'CG20_MIS_REPORT',$2,$2,$3,$4,$5,'IN_APP',"+
    "$6,$7,'TRANSACTIONAL','IN_APP',NULL,$8) "+
    "ON CONFLICT DO NOTHING RETURNING id",
    [root,runRef,account,template.id,template.version,
     template.subject,template.body,actual.rows[0].expires_at]);
   const notification=created.rows[0]??(
    await tx.query<{id:string}>(
     "SELECT id FROM cg19_notification WHERE realm_id=$1 "+
     "AND source_kind='CG20_MIS_REPORT' AND source_key=$2 "+
     "AND recipient_id=$3 AND channel='IN_APP' AND template_id=$4 "+
     "AND template_version=$5 LIMIT 1",
     [root,runRef,account,template.id,template.version])
   ).rows[0];
   if(!notification)
    throw new ConflictException({
     code:"MIS_SCHEDULE_NOTICE_UNAVAILABLE",message:"Private report notification outcome is unconfirmed."});
   if(created.rows[0]){
    await tx.query(
     "INSERT INTO cg19_communication_event(realm_id,notification_id,kind) "+
     "VALUES($1,$2,'SOURCE_CAPTURED')",[root,notification.id]);
   }
   await tx.query(
    "INSERT INTO cg20_report_delivery_attempt(root_realm_id,run_ref,"+
    "recipient_account_ref,channel,state,original_cg19_notification_ref) "+
    "VALUES($1,$2,$3,'IN_APP','CONFIRMED',$4) "+
    "ON CONFLICT(root_realm_id,run_ref,recipient_account_ref,channel) "+
    "DO UPDATE SET state='CONFIRMED',"+
    "original_cg19_notification_ref=EXCLUDED.original_cg19_notification_ref,"+
    "updated_at=now()",
    [root,runRef,account,notification.id]);
   await tx.query("COMMIT");active=false;
   return {channel:"IN_APP" as const,state:"CONFIRMED" as const};
  }catch(e){if(active)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
 }
}
