import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {CampaignLinkSourceFacade} from "../../cg-05-projects-field-operations/application/campaign-link-source.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {campaignRef,parseCampaignDraft,type CampaignDraft} from "../domain/campaign-draft-input";

type CampaignRow={id:string;root_realm_id:string;branch_ref:string|null;created_by:string;source_status:string;version:number;current_revision:number};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const invalid=(message:string)=>new ConflictException({code:"CG07_CAMPAIGN_STALE",message});
const projection=`c.id AS ref,c.code_norm AS code,c.title,c.category,c.source_status AS status,
 c.branch_ref AS "branchRef",b.name AS branch,c.project_source_ref AS "projectRef",c.event_source_ref AS "eventRef",
 c.version,c.current_revision AS revision,c.created_at AS "createdAt",c.updated_at AS "updatedAt",
 c.goal_minor::text AS "goalMinor",c.start_at::text AS "startAt",c.end_at::text AS "endAt",
 jsonb_build_object('basic',r.step1_basic,'project',r.step2_project_and_geo,'team',r.step3_team,
  'budget',r.step4_budget_targets,'media',r.step5_media_refs,'review',r.step6_summary) AS steps`;
const joins=` FROM campaign c JOIN campaign_revision r ON r.root_realm_id=c.root_realm_id AND r.campaign_id=c.id
 AND r.revision_no=c.current_revision
 LEFT JOIN branch b ON b.root_realm_id=c.root_realm_id AND b.id=c.branch_ref`;
@Injectable()
export class CampaignDraftsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,
  private readonly projectEvents:CampaignLinkSourceFacade){}
 private async run<T>(token:string,capability:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,read=false){
  const actor=await this.sessions.requireAction(token,capability),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,actor,capability);
   const result=await fn(tx,actor);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{/* Retain original outcome. */}
   if(e&&typeof e==="object"&&"code" in e&&["23503","23505","23514","40001","40P01"].includes(String(e.code)))
    throw invalid("The current campaign or related Foundation record changed. Refresh and try again.");
   throw e;
  }finally{tx.release();}
 }
 private async scope(tx:PoolClient,a:Actor,branch:string|null){
  await this.branches.projectBranch(tx,a,branch);
 }
 private async eligibleDraft(tx:PoolClient,a:Actor,v:CampaignDraft){
  const p=v.project;
  if(v.team.volunteerRef||v.media.fileRef)
   throw new ForbiddenException("Volunteer and media links require a current verified source. A text-only campaign is supported.");
  await this.projectEvents.requireCurrent(tx,a,p.branchRef,p.projectRef,p.eventRef);
  const branch=await this.branches.projectBranch(tx,a,p.branchRef);
  await this.branches.projectGeography(tx,a,p.stateRef,p.districtRef);
  if(v.team.coordinatorRef&&v.team.coordinatorRef!==a.accountId){
   if(p.branchRef&&v.team.coordinatorRef!==branch.managerRef)
    throw new ForbiddenException("Choose your permitted Foundation branch coordinator.");
   await this.identity.eligibleOfficeholder(tx,a,v.team.coordinatorRef);
  }
 }
 private async record(tx:PoolClient,a:Actor,c:CampaignRow,v:CampaignDraft,digest:string,kind:"CREATE_DRAFT"|"SAVE_DRAFT",prior:"DRAFT"|"RETURNED"="DRAFT"){
  await tx.query(`INSERT INTO campaign_revision(root_realm_id,campaign_id,revision_no,immutable_digest,
   step1_basic,step2_project_and_geo,step3_team,step4_budget_targets,step5_media_refs,step6_summary,created_by)
   VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11)`,
   [a.realmId,c.id,c.current_revision,digest,JSON.stringify(v.basic),JSON.stringify(v.project),JSON.stringify(v.team),
    JSON.stringify(v.budget),JSON.stringify(v.media),JSON.stringify(v.review),a.accountId]);
  await tx.query(`INSERT INTO campaign_status_event(root_realm_id,campaign_id,source_revision,digest,request_key,
   operation,prior_status,resulting_status,resulting_version,actor_ref)
   VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9)`,
   [a.realmId,c.id,c.current_revision,digest,v.key,kind,kind==="CREATE_DRAFT"?null:prior,c.version,a.accountId]);
  return {ref:c.id,version:c.version,code:(await tx.query<{code_norm:string}>(
   "SELECT code_norm FROM campaign WHERE root_realm_id=$1 AND id=$2",[a.realmId,c.id])).rows[0].code_norm,
   status:"DRAFT" as const,replayed:false};
 }
 private async current(tx:PoolClient,a:Actor,id:string,write=false){
  const c=(await tx.query<CampaignRow>(`SELECT id,root_realm_id,branch_ref,created_by,source_status,
   version,current_revision FROM campaign WHERE root_realm_id=$1 AND id=$2 `+(write?"FOR UPDATE":"FOR SHARE"),
   [a.realmId,campaignRef(id)])).rows[0];
  if(!c)throw new NotFoundException("Campaign unavailable.");
  const permitted=await this.branches.projectBranchScope(tx,a);
  if(!permitted.all&&!(c.branch_ref&&permitted.branches.some(b=>b.value===c.branch_ref)))
   throw new NotFoundException("Campaign unavailable in your current Foundation scope.");
  return c;
 }
 private async replay(tx:PoolClient,a:Actor,key:string,digest:string,kind:string,target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG07:CAMPAIGN:"+a.realmId+":"+a.accountId+":"+key]);
  const prior=(await tx.query<{campaign_id:string;digest:string;operation:string;resulting_version:number}>(
   "SELECT campaign_id,digest,operation,resulting_version FROM campaign_status_event WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [a.realmId,a.accountId,key])).rows[0];
  if(!prior)return null;
  if(prior.digest!==digest||prior.operation!==kind||target&&target!==prior.campaign_id)
   throw invalid("This request was already used for different campaign details.");
  const c=await this.current(tx,a,prior.campaign_id);
  const code=(await tx.query<{code_norm:string}>("SELECT code_norm FROM campaign WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,c.id])).rows[0].code_norm;
  return {ref:c.id,version:prior.resulting_version,code,status:c.source_status,replayed:true};
 }
 async options(token:string,query:Record<string,unknown>){
  if(Object.keys(query).some(k=>!["stateRef","branchRef","q"].includes(k)))throw invalid("Check the campaign choices.");
  const state=query.stateRef===undefined||query.stateRef===""?null:campaignRef(query.stateRef);
  const branch=query.branchRef===undefined||query.branchRef===""?null:campaignRef(query.branchRef);
  const search=query.q??"";
  if(typeof search!=="string"||search.length>80)throw invalid("Use a shorter campaign staff search.");
  return this.run(token,"campaigns.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   const managers=branch?await this.branches.projectBranch(tx,a,branch):null;
   let coordinators:{value:string;label:string}[];
   if(branch){
    const keys=[a.accountId,...(managers?.managerRef&&managers.managerRef!==a.accountId?[managers.managerRef]:[])];
    const labels=await Promise.all(keys.map(key=>this.identity.eligibleOfficeholder(tx,a,key)));
    coordinators=labels.map(x=>({value:x.accountRef,label:x.displayName})).filter(x=>!search||
     x.label.toLowerCase().includes(search.toLowerCase()));
   }else if(scope.all){
    coordinators=await this.identity.eligibleOfficeholderOptions(tx,a,search);
   }else{
    coordinators=[];
   }
   return {canFoundation:scope.all,branches:scope.branches.map(({value,label})=>({value,label})),
    states:await this.branches.projectGeographyOptions(tx,a,null),
    districts:state?await this.branches.projectGeographyOptions(tx,a,state):[],
    coordinators,
    ...(scope.all||branch?await this.projectEvents.options(tx,a,branch,search):
      {projects:[],events:[]})};
  },true);
 }
 async create(token:string,raw:unknown){
  const value=parseCampaignDraft(raw),digest=hash(["CG07_CREATE_V1",value]);
  return this.run(token,"campaigns.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"campaigns.view");
   const prior=await this.replay(tx,a,value.key,digest,"CREATE_DRAFT");if(prior)return prior;
   await this.eligibleDraft(tx,a,value);
   const c=(await tx.query<CampaignRow>(`INSERT INTO campaign(root_realm_id,title,category,branch_ref,
    goal_minor,start_at,end_at,created_by,project_source_ref,event_source_ref)
    VALUES($1,$2,$3,$4,$5::bigint,$6::date,$7::date,$8,$9,$10)
    RETURNING id,root_realm_id,branch_ref,created_by,source_status,version,current_revision`,
    [a.realmId,value.basic.title,value.project.category,value.project.branchRef,value.budget.goalMinor,
     value.budget.startAt,value.budget.endAt,a.accountId,value.project.projectRef,value.project.eventRef])).rows[0];
   return this.record(tx,a,c,value,digest,"CREATE_DRAFT");
  });
 }
 async save(token:string,ref:string,raw:unknown){
  const key=campaignRef(ref),value=parseCampaignDraft(raw,true),digest=hash(["CG07_SAVE_V1",key,value]);
  return this.run(token,"campaigns.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"campaigns.view");
   const prior=await this.replay(tx,a,value.key,digest,"SAVE_DRAFT",key);if(prior)return prior;
   const existing=await this.current(tx,a,key,true);
   if(!["DRAFT","RETURNED"].includes(existing.source_status)||existing.version!==value.expected)
    throw invalid("This campaign has changed. Refresh its draft before saving again.");
   await this.eligibleDraft(tx,a,value);
   const next=(await tx.query<CampaignRow>(`UPDATE campaign SET title=$3,category=$4,branch_ref=$5,
    goal_minor=$6::bigint,start_at=$7::date,end_at=$8::date,
    project_source_ref=$10,event_source_ref=$11,source_status='DRAFT',
    current_revision=current_revision+1,version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND version=$9 AND source_status IN('DRAFT','RETURNED')
    RETURNING id,root_realm_id,branch_ref,created_by,source_status,version,current_revision`,
    [a.realmId,key,value.basic.title,value.project.category,value.project.branchRef,value.budget.goalMinor,
     value.budget.startAt,value.budget.endAt,value.expected,value.project.projectRef,value.project.eventRef])).rows[0];
   if(!next)throw invalid("This campaign was updated elsewhere. Refresh its current draft.");
   return this.record(tx,a,next,value,digest,"SAVE_DRAFT",existing.source_status==="RETURNED"?"RETURNED":"DRAFT");
  });
 }
 /** Original CG07 mutable source authority consumed by the protected CG03 review owner,
  * using the SAME caller transaction. CG03 owns the approval case and decision. */
 async freezeForReview(tx:PoolClient,a:Actor,campaignId:string,expectedVersion:number,requestKey:string){
  await this.identity.assertCurrent(tx,a,"campaigns.manage");
  await this.identity.assertCurrent(tx,a,"campaigns.view");
  const c=await this.current(tx,a,campaignId,true);
  if(c.source_status!=="DRAFT"||c.version!==expectedVersion)
   throw invalid("Campaign draft changed. Refresh and submit its current revision.");
  const r=(await tx.query<{immutable_digest:string;title:string;category:string;branch_ref:string|null;
   project_source_ref:string|null;event_source_ref:string|null;goal_minor:string|null;start_at:string|null;end_at:string|null;
   basic:Record<string,unknown>;project:Record<string,unknown>;team:Record<string,unknown>;
   budget:Record<string,unknown>;media:Record<string,unknown>;review:Record<string,unknown>}>(
   `SELECT r.immutable_digest,c.title,c.category,c.branch_ref,c.project_source_ref,c.event_source_ref,
      c.goal_minor::text,c.start_at::text,c.end_at::text,r.step1_basic AS basic,
      r.step2_project_and_geo AS project,r.step3_team AS team,r.step4_budget_targets AS budget,
      r.step5_media_refs AS media,r.step6_summary AS review
    FROM campaign c JOIN campaign_revision r ON r.root_realm_id=c.root_realm_id
     AND r.campaign_id=c.id AND r.revision_no=c.current_revision
    WHERE c.root_realm_id=$1 AND c.id=$2 FOR SHARE OF r`,
   [a.realmId,c.id])).rows[0];
  if(!r||r.goal_minor===null||BigInt(r.goal_minor)<1n||!r.start_at||!r.end_at||
    r.end_at<(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))||!r.basic?.summary)
   throw invalid("Complete the campaign title, description, fundraising target and valid campaign period before review.");
  if(r.media?.fileRef||r.team?.volunteerRef)
   throw invalid("Unverified campaign media or volunteer association must be removed before verification.");
  await this.projectEvents.requireCurrent(tx,a,c.branch_ref,r.project_source_ref,r.event_source_ref);
  if(r.team?.coordinatorRef&&typeof r.team.coordinatorRef==="string"&&r.team.coordinatorRef!==a.accountId){
   const manager=await this.branches.projectBranch(tx,a,c.branch_ref);
   if(c.branch_ref&&r.team.coordinatorRef!==manager.managerRef)
    throw invalid("Campaign coordinator no longer belongs to the current selected branch.");
   await this.identity.eligibleOfficeholder(tx,a,r.team.coordinatorRef);
  }
  const nextVersion=c.version+1;
  const event=(await tx.query(
   `UPDATE campaign SET source_status='SUBMITTED',version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND version=$3 AND source_status='DRAFT' RETURNING version`,
   [a.realmId,c.id,c.version]));
  if(event.rowCount!==1)throw invalid("Campaign draft changed before submission.");
  await tx.query(`INSERT INTO campaign_status_event(root_realm_id,campaign_id,source_revision,digest,
   request_key,operation,prior_status,resulting_status,resulting_version,actor_ref)
   VALUES($1,$2,$3,$4,$5,'SUBMIT','DRAFT','SUBMITTED',$6,$7)`,
   [a.realmId,c.id,c.current_revision,r.immutable_digest,requestKey,nextVersion,a.accountId]);
  return {campaignId:c.id,version:nextVersion,revision:c.current_revision,digest:r.immutable_digest,title:r.title,
   sourceSnapshot:{title:r.title,category:r.category,branchRef:r.branch_ref,projectRef:r.project_source_ref,
    eventRef:r.event_source_ref,goalMinor:r.goal_minor,startAt:r.start_at,endAt:r.end_at,
    steps:{basic:r.basic,project:r.project,team:r.team,budget:r.budget,media:r.media,review:r.review}}};
 }
 /** Only CG03's independently authenticated final decision may invoke this
  * transaction-scoped owner effect; it never creates an original CG18 publication. */
 async acceptReviewEffect(tx:PoolClient,root:string,campaignId:string,revision:number,digest:string,
  decision:"APPROVE"|"RETURN"|"REJECT",actorId:string,requestKey:string){
  const row=(await tx.query<{version:number;current_revision:number;status:string;project_source_ref:string|null;
    event_source_ref:string|null;branch_ref:string|null;digest:string}>(
   `SELECT c.version,c.current_revision,c.source_status AS status,c.project_source_ref,
      c.event_source_ref,c.branch_ref,r.immutable_digest AS digest FROM campaign c
    JOIN campaign_revision r ON r.root_realm_id=c.root_realm_id
     AND r.campaign_id=c.id AND r.revision_no=c.current_revision
    WHERE c.root_realm_id=$1 AND c.id=$2 FOR UPDATE OF c`,
   [root,campaignId])).rows[0];
  if(!row||row.status!=="SUBMITTED"||row.current_revision!==revision||row.digest!==digest)
   throw invalid("The submitted campaign revision changed. Do not approve old details.");
  if(decision==="APPROVE"){
   if(row.project_source_ref){
    const valid=await tx.query(`SELECT 1 FROM project
     WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE'
       AND branch_ref IS NOT DISTINCT FROM $3::uuid FOR SHARE`,
     [root,row.project_source_ref,row.branch_ref]);
    if(!valid.rowCount)throw invalid("Linked project is no longer active. Return the campaign for correction.");
   }
   if(row.event_source_ref){
    const valid=await tx.query(`SELECT 1 FROM project_activity
     WHERE root_realm_id=$1 AND id=$2 AND kind='EVENT' AND status IN('SCHEDULED','ONGOING')
       AND branch_ref IS NOT DISTINCT FROM $3::uuid
       AND project_id IS NOT DISTINCT FROM $4::uuid FOR SHARE`,
     [root,row.event_source_ref,row.branch_ref,row.project_source_ref]);
    if(!valid.rowCount)throw invalid("Linked event has changed. Return the campaign for correction.");
   }
  }
  const status=decision==="APPROVE"?"APPROVED":decision==="RETURN"?"RETURNED":"REJECTED";
  await tx.query(`UPDATE campaign SET source_status=$3,version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND source_status='SUBMITTED'`,
    [root,campaignId,status]);
  await tx.query(`INSERT INTO campaign_status_event(root_realm_id,campaign_id,source_revision,digest,
    request_key,operation,prior_status,resulting_status,resulting_version,actor_ref)
    VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED',$7,$8,$9)`,
    [root,campaignId,revision,digest,requestKey,"REVIEW_"+decision,status,row.version+1,actorId]);
  return {status,version:row.version+1};
 }
 async detail(token:string,ref:string){
  return this.run(token,"campaigns.view",async(tx,a)=>{
   const c=await this.current(tx,a,ref);
   return (await tx.query(`SELECT ${projection}${joins} WHERE c.root_realm_id=$1 AND c.id=$2`,
    [a.realmId,c.id])).rows[0];
  },true);
 }
 async list(token:string,query:Record<string,unknown>){
  const offset=query.offset===undefined?0:Number(query.offset);
  const q=typeof query.q==="string"?query.q.trim().toLowerCase():"";
  if(!Number.isSafeInteger(offset)||offset<0||offset>5000||q.length>80||
   Object.keys(query).some(k=>!["offset","q"].includes(k)))
   throw invalid("Check the campaign search and page filters.");
  return this.run(token,"campaigns.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   const args=[a.realmId,scope.all,scope.branches.map(b=>b.value),q,offset] as const;
   const rows=(await tx.query(`SELECT ${projection}${joins}
    WHERE c.root_realm_id=$1 AND ($2::boolean OR c.branch_ref=ANY($3::uuid[]))
     AND ($4='' OR strpos(lower(c.title),$4)>0 OR strpos(lower(c.code_norm),$4)>0)
    ORDER BY c.updated_at DESC,c.id DESC LIMIT 26 OFFSET $5`,[...args])).rows;
   return {items:rows.slice(0,25),offset,hasMore:rows.length>25,
    message:"Only original Foundation campaign drafts are included. No donation or publication is inferred."};
  },true);
 }
}
