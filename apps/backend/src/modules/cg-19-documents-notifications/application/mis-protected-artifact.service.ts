import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {reportMime,renderMisReport,type ReportFormat,type ReportData} from "./mis-report-renderer";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const valid=(v:string)=>{if(!UUID.test(v))
 throw new BadRequestException({code:"MIS_ARTIFACT_UNAVAILABLE"});
 return v;};
type Artifact={id:string;report_run_ref:string;issued_to_account_ref:string;
 state:string;format:ReportFormat;mime:string;object_key:string;
 object_version:string|null;content_sha256:string|null;
 content_length:number|null;created_at:Date;revoked_at:Date|null};
@Injectable()
export class MisProtectedArtifactService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly storage:PrivateObjectStorage){}
 private digest(bytes:Buffer){return createHash("sha256").update(bytes).digest("hex");}
 /** Only CG19 generates and persists protected bytes; CG20 supplies a
  * validated, source-scoped bounded report projection, never an object key.
  */
 async issueFromReport(token:string,runRef:string,format:ReportFormat,data:ReportData){
  const bytes=await renderMisReport(format,data);
  return this.issue(token,runRef,format,bytes);
 }

 /** CG-19 original file authority. Only CG-20 RUNNING original owner
  * metadata may request one create-only private object. CG20 must already
  * have revalidated the original owner source/filters before invoking.
  */
 async issue(token:string,runInput:string,format:ReportFormat,bytes:Buffer){
  const actor=await this.sessions.requireAction(token,"mis.reports.export");
  await this.sessions.requireAction(token,"mis.reports.view");
  return this.issueForAuthorizedActor(actor.realmId,actor.accountId,
   runInput,format,bytes);
 }
 /** CG20 internal worker entry: only the original current CG01 account and
  * CG09 grant may receive an owner-created protected scheduled file. No
  * synthesized login, bypass bearer, public route or alternate file store.
  */
 async issueScheduledFinance(root:string,account:string,runRef:string,
  format:ReportFormat,data:ReportData){
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.view");
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.export");
  await this.sessions.requireScheduledMisAction(root,account,"finance.reports.view");
  const bytes=await renderMisReport(format,data);
  return this.issueForAuthorizedActor(root,account,runRef,format,bytes);
 }
 async issueScheduledProject(root:string,account:string,runRef:string,format:ReportFormat,data:ReportData){
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.view");
  await this.sessions.requireScheduledMisAction(root,account,"mis.reports.export");
  await this.sessions.requireScheduledMisAction(root,account,"projects.view");
  await this.sessions.requireScheduledMisAction(root,account,"projects.export");
  return this.issueForAuthorizedActor(root,account,runRef,format,await renderMisReport(format,data));
 }
 private async issueForAuthorizedActor(root:string,account:string,
  runInput:string,format:ReportFormat,bytes:Buffer){
  const actor={realmId:root,accountId:account};
  const runRef=valid(runInput),mime=reportMime(format);
  if(!Buffer.isBuffer(bytes)||bytes.length>5242880||bytes.length<10)
   throw new BadRequestException({code:"MIS_ARTIFACT_LIMIT"});
  const sha=this.digest(bytes);
  const tx=await this.db.connect();let active=false,row:Artifact;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":cg19-mis:"+runRef]);
   const run=await tx.query<{id:string;state:string;format:string}>(
    "SELECT id,state,format FROM cg20_report_run WHERE root_realm_id=$1 "+
    "AND id=$2 AND requester_ref=$3 AND expires_at>now() FOR UPDATE",
    [actor.realmId,runRef,actor.accountId]);
   if(!run.rows[0]||!["RUNNING","READY"].includes(run.rows[0].state)||
     run.rows[0].format!==format)
    throw new NotFoundException({code:"MIS_ARTIFACT_UNAVAILABLE"});
   const existing=await tx.query<Artifact>(
    "SELECT * FROM cg19_mis_report_artifact WHERE root_realm_id=$1 "+
    "AND report_run_ref=$2 FOR UPDATE",[actor.realmId,runRef]);
   if(existing.rows[0]){
    row=existing.rows[0];
    if(row.format!==format)
     throw new ConflictException({code:"MIS_ARTIFACT_FORMAT_CONFLICT"});
   }else{
    const key="careganga/private/cg19/"+actor.realmId+"/mis/"+randomUUID();
    const inserted=await tx.query<Artifact>(
     "INSERT INTO cg19_mis_report_artifact(root_realm_id,report_run_ref,"+
     "issued_to_account_ref,format,mime,object_key) "+
     "VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
     [actor.realmId,runRef,actor.accountId,format,mime,key]);
    row=inserted.rows[0];
   }
   await tx.query("COMMIT");active=false;
  }catch(e){if(active)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
  if(row.state==="READY"&&row.content_sha256&&row.object_version&&
    row.content_length){
   // A replay is only a confirmed original version, not a second object.
   if(row.content_sha256!==sha)
    throw new ConflictException({code:"MIS_ARTIFACT_CHANGED",
     message:"The original report changed. Start a new protected report run."});
   return {artifactRef:row.id,status:"READY" as const,confirmed:true};
  }
  let persisted:{objectVersion:string;sha256:string;sizeBytes:number};
  try{
   if(row.state!=="PENDING"){
    persisted=await this.storage.reconcileGeneratedReport({
     objectKey:row.object_key,mime:format==="XLSX"?
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      format==="CSV"?"text/csv":"application/pdf",maxBytes:5242880});
    if(persisted.sha256!==sha)
     throw new ConflictException({code:"MIS_ARTIFACT_CHANGED"});
   }else{
    const result=await this.storage.writeVerifiedGeneratedReport({
     objectKey:row.object_key,mime:format==="XLSX"?
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      format==="CSV"?"text/csv":"application/pdf",bytes,sha256:sha});
    persisted={objectVersion:result.objectVersion,sha256:result.sha256,
     sizeBytes:bytes.length};
   }
   const changed=await this.db.query(
    "UPDATE cg19_mis_report_artifact SET state='READY',object_version=$3,"+
    "content_sha256=$4,content_length=$5,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state IN('PENDING','UNKNOWN') "+
    "AND revoked_at IS NULL AND object_version IS NULL RETURNING id",
    [actor.realmId,row.id,persisted.objectVersion,sha,persisted.sizeBytes]);
   if(!changed.rowCount){
    const latest=await this.db.query<Artifact>(
     "SELECT * FROM cg19_mis_report_artifact WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,row.id]);
    if(latest.rows[0]?.state!=="READY"||
      latest.rows[0].content_sha256!==sha)
     throw new ConflictException({code:"MIS_ARTIFACT_CHANGED"});
   }
   return {artifactRef:row.id,status:"READY" as const,confirmed:true};
  }catch(e){
   await this.db.query(
    "UPDATE cg19_mis_report_artifact SET state='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='PENDING'",
    [actor.realmId,row.id]).catch(()=>undefined);
   if(e instanceof ConflictException)throw e;
   return {artifactRef:row.id,status:"UNKNOWN" as const,confirmed:false};
  }
 }
 /** This is the CG-19 layer of download authorization. CG20 additionally
  * rechecks live source-row/branch/center scope BEFORE and AFTER this read.
  * A scheduled recipient needs an actual recorded CG20 delivery grant.
  */
 async read(token:string,runInput:string){
  const actor=await this.sessions.requireAction(token,"mis.reports.export");
  await this.sessions.requireAction(token,"mis.reports.view");
  const run=valid(runInput);
  const q=await this.db.query<Artifact>(
   "SELECT artifact.* FROM cg19_mis_report_artifact artifact "+
   "JOIN cg20_report_run r ON r.root_realm_id=artifact.root_realm_id "+
   "AND r.id=artifact.report_run_ref "+
   "WHERE artifact.root_realm_id=$1 AND artifact.report_run_ref=$2 "+
   "AND artifact.state='READY' AND artifact.revoked_at IS NULL "+
   "AND r.state='READY' AND r.expires_at>now() "+
   "AND (r.requester_ref=$3 OR EXISTS("+
   "SELECT 1 FROM cg20_report_delivery_attempt d "+
   "WHERE d.root_realm_id=r.root_realm_id AND d.run_ref=r.id "+
   "AND d.recipient_account_ref=$3 AND d.state IN('QUEUED','SENT_PENDING','CONFIRMED')"+
   ")) LIMIT 1",
   [actor.realmId,run,actor.accountId]);
  const artifact=q.rows[0];
  if(!artifact||!artifact.object_version||!artifact.content_sha256||
    !artifact.content_length)
   throw new NotFoundException({code:"MIS_ARTIFACT_UNAVAILABLE"});
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:artifact.object_key,objectVersion:artifact.object_version,
   maxBytes:artifact.content_length});
  if(bytes.length!==artifact.content_length||
    this.digest(bytes)!==artifact.content_sha256)
   throw new ServiceUnavailableException({code:"MIS_ARTIFACT_UNVERIFIED"});
  await this.sessions.requireAction(token,"mis.reports.export");
  const now=await this.db.query(
   "SELECT a.id FROM cg19_mis_report_artifact a "+
   "JOIN cg20_report_run r ON r.root_realm_id=a.root_realm_id "+
   "AND r.id=a.report_run_ref WHERE a.root_realm_id=$1 AND a.report_run_ref=$2 "+
   "AND a.state='READY' AND a.revoked_at IS NULL AND a.object_version=$3 "+
   "AND r.state='READY' AND r.expires_at>now() LIMIT 1",
   [actor.realmId,run,artifact.object_version]);
  if(!now.rowCount)throw new NotFoundException({code:"MIS_ARTIFACT_REVOKED"});
  return {bytes,mime:artifact.mime,format:artifact.format};
 }
}
