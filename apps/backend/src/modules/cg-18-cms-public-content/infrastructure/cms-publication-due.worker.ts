import {Inject,Injectable,Logger,OnModuleDestroy,OnModuleInit} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {CmsPublicationApprovalService} from "../../cg-03-registration-approvals/application/cms-publication-approval.service";
import {CmsDraftMediaService} from "../../cg-19-documents-notifications/application/cms-draft-media.service";
import {CmsPublicNoticeSource} from "../../cg-19-documents-notifications/application/cms-public-notice-source.service";
import {projectTeaserRevisionEligible} from "../../cg-05-projects-field-operations/application/project-public-source";
import {eventArticleRevisionEligible} from "../../cg-05-projects-field-operations/application/event-public-source";
import {complianceEligible} from "../application/cms-compliance-eligibility";
import {CsrPartnerPublicSource,type CsrEditorialSelection} from "../../cg-08-csr-funding/application/csr-partner-public-source";
import {HrPublicBioEditorialSource,type HrEditorialPerson} from "../../cg-10-human-resources/application/hr-public-bio-editorial-source";
import {parseExtendedSection} from "../application/cms-extended-sections";

type Due={id:string;foundation_root_id:string;page_publication_ref:string};
type Original={id:string;page_id:string;page_revision_id:string;
 foundation_root_id:string;source_content_digest:string;created_by:string;state:string;
 effective_at:Date;page_kind:string;current_revision:number;revision_no:number;
 revision_digest:string;revision_status:string;case_ref:string|null};
/** No generic scheduler/Redis or tenant-wide poll. One due-index lookup per
 * minute, ten due rows max per wake; original CG03/CG19 owner guards stay live.
 * Page-first transactional locks and READY recheck keep worker/withdrawal
 * lock order consistent; a duplicate poll never publishes twice.
 */
@Injectable()
export class CmsPublicationDueWorker implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(CmsPublicationDueWorker.name);
 private timer:ReturnType<typeof setInterval>|null=null;
 private running=false;private stopped=false;
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly decisions:CmsPublicationApprovalService,
  private readonly media:CmsDraftMediaService,
  private readonly notices:CmsPublicNoticeSource,
  private readonly csrPartners:CsrPartnerPublicSource,
  private readonly hrPublicBio:HrPublicBioEditorialSource){}
 onModuleInit(){
  this.stopped=false;
  void this.tick().catch(err=>{
   const failureCode=err&&typeof err==="object"&&"code" in err&&typeof err.code==="string"?err.code:undefined;
   this.logger.warn(JSON.stringify({
    at:new Date().toISOString(),module:"cms",worker:"CmsPublicationDueWorker",
    event:"initial_tick_rejection_caught",failureType:err instanceof Error?err.name:"UnexpectedWorkerError",
    ...(failureCode?{code:failureCode}:{})
   }));
  });
  this.timer=setInterval(()=>{
   void this.tick().catch(err=>{
    const failureCode=err&&typeof err==="object"&&"code" in err&&typeof err.code==="string"?err.code:undefined;
    this.logger.warn(JSON.stringify({
     at:new Date().toISOString(),module:"cms",worker:"CmsPublicationDueWorker",
     event:"scheduled_tick_rejection_caught",failureType:err instanceof Error?err.name:"UnexpectedWorkerError",
     ...(failureCode?{code:failureCode}:{})
    }));
   });
  },60000);
  this.timer.unref?.();
 }
 async onModuleDestroy(){
  this.stopped=true;
  if(this.timer){clearInterval(this.timer);this.timer=null;}
 }
 private async cancel(tx:PoolClient,due:Due,source:Original|null){
  if(source&&source.state==="SCHEDULED"){
   await tx.query("UPDATE cms_publication SET state='EXPIRED' "+
    "WHERE id=$1 AND foundation_root_id=$2 AND state='SCHEDULED'",
    [source.id,due.foundation_root_id]);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
    "event_key,actor_ref,action,revision_ref) "+
    "VALUES($1,$2,$3,$4,'EXPIRE',$5)",
    [source.foundation_root_id,source.page_id,randomUUID(),
     source.created_by,source.page_revision_id]);
  }
  await tx.query("UPDATE cms_publication_due SET status='CANCELLED' "+
   "WHERE id=$1 AND foundation_root_id=$2 AND status='READY'",
   [due.id,due.foundation_root_id]);
 }
 /** Scheduled CG18 must recheck original CG08 consent at actual due time.
  * No second queue/reviewer; a withdrawn partner cannot be reactivated by
  * yesterday's approved editorial submission. */
 private async partnerRevisionEligible(tx:PoolClient,root:string,rev:string,kind:string){
  if(kind!=="PARTNERS")return true;
  const q=await tx.query<{structured_fields:Record<string,unknown>}>(
   "SELECT structured_fields FROM cms_section_revision "+
   "WHERE foundation_root_id=$1 AND page_revision_id=$2 "+
   "AND section_kind='PARTNER_CARDS'",[root,rev]);
  if(q.rows.length!==1)return false;
  try{
   const sections=parseExtendedSection("PARTNER_CARDS",q.rows[0].structured_fields);
   const selected=sections.partners as CsrEditorialSelection[];
   return (await this.csrPartners.currentCards(tx,root,selected)).length===selected.length;
  }catch{return false;}
 }
 private async teamRevisionEligible(tx:PoolClient,root:string,rev:string){
  const q=await tx.query<{structured_fields:Record<string,unknown>}>(
   "SELECT structured_fields FROM cms_section_revision WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='TEAM'",[root,rev]);
  for(const row of q.rows){
   const selected=row.structured_fields.members;
   if(!Array.isArray(selected)||selected.length>15||selected.some(p=>!p||typeof p!=="object"||
    typeof p.sourceRef!=="string"||!/^[0-9a-f-]{36}$/i.test(p.sourceRef)||
    typeof p.proof!=="string"||!/^[a-f0-9]{64}$/.test(p.proof)||typeof p.name!=="string"||typeof p.designation!=="string"))return false;
   if(new Set(selected.map(p=>p.sourceRef)).size!==selected.length)return false;
   if((await this.hrPublicBio.currentCards(tx,root,selected as HrEditorialPerson[],true)).length!==selected.length)return false;
  }
  return true;
 }
 private async apply(tx:PoolClient,due:Due){
  // Always lock the CMS page before its publication and due row. Other CMS
  // writes/withdrawals lock the page first; a joined FOR UPDATE OF p,pub
  // has no guaranteed row-lock acquisition order under a changing query plan.
  const owningPage=await tx.query(
   "SELECT p.id FROM cms_page p JOIN cms_publication pub "+
   "ON pub.page_id=p.id AND pub.foundation_root_id=p.foundation_root_id "+
   "WHERE pub.id=$1 AND pub.foundation_root_id=$2 FOR UPDATE OF p",
   [due.page_publication_ref,due.foundation_root_id]);
  if(!owningPage.rowCount){
   await this.cancel(tx,due,null);return;
  }
  const rows=await tx.query<Original>(
   "SELECT pub.id,pub.page_id,pub.page_revision_id,pub.foundation_root_id,"+
   "pub.source_content_digest,pub.created_by,pub.state,pub.effective_at,"+
   "p.kind AS page_kind,p.draft_revision_no AS current_revision,"+
   "v.revision_no,v.content_digest AS revision_digest,"+
   "v.status AS revision_status,v.approval_case_ref AS case_ref "+
   "FROM cms_publication pub JOIN cms_page p "+
   "ON p.id=pub.page_id AND p.foundation_root_id=pub.foundation_root_id "+
   "JOIN cms_page_revision v ON v.id=pub.page_revision_id "+
   "AND v.page_id=pub.page_id AND v.foundation_root_id=pub.foundation_root_id "+
   "WHERE pub.id=$1 AND pub.foundation_root_id=$2 "+
   "AND p.archived_at IS NULL FOR UPDATE OF pub",
   [due.page_publication_ref,due.foundation_root_id]);
  const item=rows.rows[0]??null;
  // Withdraw locks page -> publication -> due; use the same order here.
  // Multiple workers can select this candidate, but only one holds the page
  // lock and then the durable due lock while mutating its publication.
  const ready=await tx.query(
   "SELECT 1 FROM cms_publication_due WHERE id=$1 "+
   "AND foundation_root_id=$2 AND status='READY' "+
   "AND due_at<=now() AND (next_attempt_at IS NULL OR next_attempt_at<=now()) "+
   "FOR UPDATE",
   [due.id,due.foundation_root_id]);
  if(!ready.rowCount)return;
  if(!item||item.state!=="SCHEDULED"||
   item.current_revision!==item.revision_no||
   item.revision_status!=="SUBMITTED"||
   item.revision_digest!==item.source_content_digest||!item.case_ref){
   await this.cancel(tx,due,item);return;
  }
  const [approved,mediaValid]=await Promise.all([
   this.decisions.scheduledProof(tx,item.foundation_root_id,item.case_ref,
    item.page_id,item.page_revision_id,item.revision_no,
    item.source_content_digest,item.created_by),
   this.media.validateScheduledPlacements(tx,item.foundation_root_id,item.page_revision_id)
  ]);
  if(!approved||!mediaValid||
    !(await complianceEligible(tx,item.foundation_root_id,item.page_revision_id))||
    !(await projectTeaserRevisionEligible(tx,item.foundation_root_id,item.page_revision_id))||
     !(await eventArticleRevisionEligible(tx,item.foundation_root_id,item.page_revision_id))||
    !(await this.notices.revisionEligible(tx,item.foundation_root_id,item.page_revision_id))||
    !(await this.partnerRevisionEligible(tx,item.foundation_root_id,item.page_revision_id,item.page_kind))||
    !(await this.teamRevisionEligible(tx,item.foundation_root_id,item.page_revision_id))){
   await this.cancel(tx,due,item);return;
  }
  const active=await tx.query<{publication_id:string}>(
   "SELECT publication_id FROM cms_page_effective WHERE "+
   "foundation_root_id=$1 AND page_id=$2 FOR UPDATE",
   [item.foundation_root_id,item.page_id]);
  if(active.rows[0])await tx.query(
   "UPDATE cms_publication SET state='SUPERSEDED' WHERE "+
   "id=$1 AND foundation_root_id=$2 AND state='EFFECTIVE'",
   [active.rows[0].publication_id,item.foundation_root_id]);
  const effect=await tx.query(
   "UPDATE cms_publication SET state='EFFECTIVE' WHERE id=$1 "+
   "AND foundation_root_id=$2 AND state='SCHEDULED' AND effective_at<=now() RETURNING id",
   [item.id,item.foundation_root_id]);
  if(!effect.rowCount)throw Error("CMS due source changed");
  await tx.query("INSERT INTO cms_page_effective(foundation_root_id,page_id,"+
   "publication_id) VALUES($1,$2,$3) ON CONFLICT(foundation_root_id,page_id) "+
   "DO UPDATE SET publication_id=EXCLUDED.publication_id,"+
   "version=cms_page_effective.version+1,changed_at=now()",
   [item.foundation_root_id,item.page_id,item.id]);
  if(item.page_kind==="HOME"){
   const nav=await tx.query<{id:string}>(
    "UPDATE cms_navigation_revision SET status='APPROVED',"+
    "cg03_decision_ref=(SELECT c.cg03_final_decision_ref FROM cms_publication c "+
    "WHERE c.id=$3 AND c.foundation_root_id=$1),effective_at=now() "+
    "WHERE foundation_root_id=$1 AND home_revision_id=$2 "+
    "AND source_digest=$4 AND status='SUBMITTED' RETURNING id",
    [item.foundation_root_id,item.page_revision_id,item.id,item.source_content_digest]);
   if(!nav.rows[0])throw Error("CMS original navigation missing");
   await tx.query("INSERT INTO cms_navigation_effective(foundation_root_id,revision_id) "+
    "VALUES($1,$2) ON CONFLICT(foundation_root_id) "+
    "DO UPDATE SET revision_id=EXCLUDED.revision_id,"+
    "version=cms_navigation_effective.version+1,changed_at=now()",
    [item.foundation_root_id,nav.rows[0].id]);
  }
  await tx.query("UPDATE cms_page SET version=version+1 WHERE id=$1 "+
   "AND foundation_root_id=$2",[item.page_id,item.foundation_root_id]);
  await this.decisions.finishScheduled(tx,item.foundation_root_id,item.case_ref,item.created_by);
  await tx.query("UPDATE cms_publication_due SET status='DONE' "+
   "WHERE id=$1 AND foundation_root_id=$2 AND status='READY'",
   [due.id,item.foundation_root_id]);
  await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
   "event_key,actor_ref,action,revision_ref) VALUES($1,$2,$3,$4,'PUBLISH',$5)",
   [item.foundation_root_id,item.page_id,randomUUID(),item.created_by,item.page_revision_id]);
 }
 async tick(): Promise<void> {
  if (this.stopped || this.running) return;
  this.running = true;
  try {
   for (let i = 0; i < 10 && !this.stopped; i++) {
    let tx: PoolClient | null = null;
    try {
     tx = await this.db.connect();
    } catch (connErr: unknown) {
     const failureCode = connErr && typeof connErr === "object" && "code" in connErr && typeof connErr.code === "string"
      ? connErr.code
      : undefined;
     this.logger.warn(JSON.stringify({
      at: new Date().toISOString(),
      module: "cms",
      worker: "CmsPublicationDueWorker",
      event: "db_connect_failed",
      failureType: connErr instanceof Error ? connErr.name : "ConnectionError",
      ...(failureCode ? { code: failureCode } : {})
     }));
     break;
    }
    let due: Due | null = null, committed = false;
    try {
     await tx.query("BEGIN");
     const rows = await tx.query<Due>(
      "SELECT id,foundation_root_id,page_publication_ref "+
      "FROM cms_publication_due WHERE status='READY' AND "+
      "page_publication_ref IS NOT NULL AND due_at<=now() "+
      "AND (next_attempt_at IS NULL OR next_attempt_at<=now()) "+
      "ORDER BY due_at,id LIMIT 1");
     due = rows.rows[0] ?? null;
     if (due) await this.apply(tx, due);
     await tx.query("COMMIT"); committed = true;
     if (!due) break;
    } catch {
     if (!committed) { try { await tx.query("ROLLBACK"); } catch {} }
     if (due) try {
      await this.db.query(
       "UPDATE cms_publication_due SET attempt_count=attempt_count+1,"+
       "status=CASE WHEN attempt_count>=9 THEN 'FAILED' ELSE 'READY' END,"+
       "next_attempt_at=now()+interval '2 minutes',"+
       "last_safe_error='Scheduled publication retry after source or database failure' "+
       "WHERE id=$1 AND foundation_root_id=$2 AND status='READY'",
       [due.id, due.foundation_root_id]);
     } catch {}
     break;
    } finally {
     tx.release();
    }
   }
  } catch (unexpectedError: unknown) {
   this.logger.error(JSON.stringify({
    at: new Date().toISOString(),
    module: "cms",
    worker: "CmsPublicationDueWorker",
    event: "worker_unexpected_failure",
    failureType: unexpectedError instanceof Error ? unexpectedError.name : "UnexpectedWorkerError"
   }));
  } finally {
   this.running = false;
  }
 }
}
