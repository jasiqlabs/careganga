import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {CampaignLinkSourceFacade} from "../../cg-05-projects-field-operations/application/campaign-link-source.facade";
import {requireCurrentVolunteer} from "../../cg-04-membership-volunteers/application/current-volunteer-source";
import {countPublishedCampaignSources} from "./campaign-public-source";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {campaignRef,parseCampaignDraft,type CampaignDraft} from "../domain/campaign-draft-input";

type CampaignRow={id:string;root_realm_id:string;branch_ref:string|null;created_by:string;source_status:string;version:number;current_revision:number};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const invalid=(message:string)=>new ConflictException({code:"CG07_CAMPAIGN_STALE",message});
const projection=`c.id AS ref,c.code_norm AS code,c.title,c.category,c.source_status AS status,
 c.branch_ref AS "branchRef",b.name AS branch,c.project_source_ref AS "projectRef",c.event_source_ref AS "eventRef",c.volunteer_source_ref AS "volunteerRef",
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
 private async eligibleDraft(tx:PoolClient,a:Actor,v:CampaignDraft,existing?:CampaignRow){
  const p=v.project;
  if(v.media.coverRef||v.media.fileRef||v.media.supportingFileRefs.length){
   if(!existing)throw invalid("Save the campaign draft before uploading private files.");
   if(v.media.coverRef)await this.requireMediaProof(tx,a,existing.id,existing.current_revision,v.media.coverRef,"COVER");
   if(v.media.fileRef)await this.requireMediaProof(tx,a,existing.id,existing.current_revision,v.media.fileRef,"BANNER");
   for(const fileRef of v.media.supportingFileRefs)
    await this.requireMediaProof(tx,a,existing.id,existing.current_revision,fileRef,"DOCUMENT");
  }
  if(v.team.volunteerRef){
   await this.identity.assertCurrent(tx,a,"volunteers.view");
   await requireCurrentVolunteer(tx,a.realmId,v.team.volunteerRef,p.branchRef);
  }
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
 /** Trusted CG19 original media owner adapter. This never issues an upload
  * token; CG19 alone owns the actual private object/storage/scanner. */
 async guardMedia(tx:PoolClient,a:Actor,id:string,expectedVersion:number|null,write:boolean){
  await this.identity.assertCurrent(tx,a,"campaigns.view");
  if(write)await this.identity.assertCurrent(tx,a,"campaigns.manage");
  const c=await this.current(tx,a,id,write);
  if(write&&(!["DRAFT","RETURNED"].includes(c.source_status)||
      expectedVersion!==null&&c.version!==expectedVersion))
   throw invalid("Campaign changed. Refresh its current editable draft before uploading files.");
  return {id:c.id,version:c.current_revision,sourceVersion:c.version};
 }
 /** Only a genuinely CLEAN_VERIFIED original CG19 file owned by this same
  * campaign can be frozen into the next immutable campaign revision. */
 private async requireMediaProof(tx:PoolClient,a:Actor,campaignId:string,revision:number,fileRef:string,kind:"COVER"|"BANNER"|"DOCUMENT"){
  const valid=await tx.query(`SELECT 1 FROM cg19_stored_file f
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE f.realm_id=$1 AND f.campaign_id=$2 AND f.id=$3
    AND f.proposal_revision<=$4 AND f.owner_kind='CG07_CAMPAIGN'
    AND ($5='DOCUMENT' OR f.original_mime IN('image/jpeg','image/png','image/webp'))
    AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
    AND i.owner_kind='CG07_CAMPAIGN' AND i.campaign_id=$2
    AND i.status='VALIDATED' AND i.campaign_media_rights_confirmed
    AND i.classification=CASE $5 WHEN 'COVER' THEN 'CAMPAIGN_COVER' WHEN 'BANNER' THEN 'CAMPAIGN_BANNER' ELSE 'CAMPAIGN_DOCUMENT' END
   FOR SHARE OF f,i`,[a.realmId,campaignId,fileRef,revision,kind]);
  if(!valid.rowCount)throw invalid("Campaign image is not currently verified and consented. Upload a valid private banner or remove it.");
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
 private async eligibleVolunteerOptions(tx:PoolClient,a:Actor,branch:string|null,q:string){
  try{await this.identity.assertCurrent(tx,a,"volunteers.view");}
  catch(e){if(e instanceof ForbiddenException)return [] as {value:string;label:string}[];throw e;}
  const result=await tx.query<{value:string;label:string}>(`SELECT v.id AS value,
   v.display_name||' · '||v.volunteer_no AS label
   FROM volunteer v JOIN account aa ON aa.realm_id=v.root_realm_id AND aa.id=v.account_ref
   WHERE v.root_realm_id=$1
    AND cg04_current_volunteer(v.root_realm_id,v.id,aa.id,$2::uuid)
    AND ($3='' OR strpos(lower(v.display_name),lower($3))>0
      OR strpos(lower(v.volunteer_no),lower($3))>0)
   ORDER BY v.display_name,v.id LIMIT 80`,[a.realmId,branch,q]);
  return result.rows;
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
    volunteers:(scope.all||branch?await this.eligibleVolunteerOptions(tx,a,branch,search):[]),
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
    goal_minor,start_at,end_at,created_by,project_source_ref,event_source_ref,volunteer_source_ref)
    VALUES($1,$2,$3,$4,$5::bigint,$6::date,$7::date,$8,$9,$10,$11)
    RETURNING id,root_realm_id,branch_ref,created_by,source_status,version,current_revision`,
    [a.realmId,value.basic.title,value.project.category,value.project.branchRef,value.budget.goalMinor,
     value.budget.startAt,value.budget.endAt,a.accountId,value.project.projectRef,value.project.eventRef,value.team.volunteerRef])).rows[0];
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
   await this.eligibleDraft(tx,a,value,existing);
   const next=(await tx.query<CampaignRow>(`UPDATE campaign SET title=$3,category=$4,branch_ref=$5,
    goal_minor=$6::bigint,start_at=$7::date,end_at=$8::date,
    project_source_ref=$10,event_source_ref=$11,volunteer_source_ref=$12,source_status='DRAFT',
    current_revision=current_revision+1,version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND version=$9 AND source_status IN('DRAFT','RETURNED')
    RETURNING id,root_realm_id,branch_ref,created_by,source_status,version,current_revision`,
    [a.realmId,key,value.basic.title,value.project.category,value.project.branchRef,value.budget.goalMinor,
     value.budget.startAt,value.budget.endAt,value.expected,value.project.projectRef,value.project.eventRef,value.team.volunteerRef])).rows[0];
   if(!next)throw invalid("This campaign was updated elsewhere. Refresh its current draft.");
   return this.record(tx,a,next,value,digest,"SAVE_DRAFT",existing.source_status==="RETURNED"?"RETURNED":"DRAFT");
  });
 }
 /** Historic review list is returned only after a fresh CG01+CG02 current
  * campaign scope check. CG03 must not expose foreign campaign references. */
 async readForReviewHistory(tx:PoolClient,actor:Actor,campaignId:string):Promise<boolean>{
  await this.identity.assertCurrent(tx,actor,"campaigns.view");
  await this.current(tx,actor,campaignId);
  return true;
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
   project_source_ref:string|null;event_source_ref:string|null;volunteer_source_ref:string|null;goal_minor:string|null;start_at:string|null;end_at:string|null;
   basic:Record<string,unknown>;project:Record<string,unknown>;team:Record<string,unknown>;
   budget:Record<string,unknown>;media:Record<string,unknown>;review:Record<string,unknown>}>(
   `SELECT r.immutable_digest,c.title,c.category,c.branch_ref,c.project_source_ref,c.event_source_ref,c.volunteer_source_ref,
      c.goal_minor::text,c.start_at::text,c.end_at::text,r.step1_basic AS basic,
      r.step2_project_and_geo AS project,r.step3_team AS team,r.step4_budget_targets AS budget,
      r.step5_media_refs AS media,r.step6_summary AS review
    FROM campaign c JOIN campaign_revision r ON r.root_realm_id=c.root_realm_id
     AND r.campaign_id=c.id AND r.revision_no=c.current_revision
    WHERE c.root_realm_id=$1 AND c.id=$2 FOR SHARE OF r`,
   [a.realmId,c.id])).rows[0];
  const today=(await tx.query<{today:string}>(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today`)).rows[0].today;
  if(!r||r.goal_minor===null||BigInt(r.goal_minor)<1n||!r.start_at||!r.end_at||
    r.end_at<today||!r.basic?.summary)
   throw invalid("Complete the campaign title, description, fundraising target and valid campaign period before review.");
  if(r.media?.coverRef){
   if(typeof r.media.coverRef!=="string")throw invalid("Campaign cover proof is invalid.");
   await this.requireMediaProof(tx,a,c.id,c.current_revision,r.media.coverRef,"COVER");
  }
  if(r.media?.fileRef){
   if(typeof r.media.fileRef!=="string")throw invalid("Campaign banner proof is invalid.");
   await this.requireMediaProof(tx,a,c.id,c.current_revision,r.media.fileRef,"BANNER");
  }
  const supporting=r.media?.supportingFileRefs??[];
  if(!Array.isArray(supporting)||supporting.length>6)throw invalid("Campaign document proof is invalid.");
  for(const fileRef of supporting){
   if(typeof fileRef!=="string")throw invalid("Campaign document proof is invalid.");
   await this.requireMediaProof(tx,a,c.id,c.current_revision,fileRef,"DOCUMENT");
  }
  if(r.volunteer_source_ref){
   await this.identity.assertCurrent(tx,a,"volunteers.view");
   await requireCurrentVolunteer(tx,a.realmId,r.volunteer_source_ref,c.branch_ref);
  }
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
    eventRef:r.event_source_ref,volunteerRef:r.volunteer_source_ref,goalMinor:r.goal_minor,startAt:r.start_at,endAt:r.end_at,
    steps:{basic:r.basic,project:r.project,team:r.team,budget:r.budget,media:r.media,review:r.review}}};
 }
 /** Only CG03's independently authenticated final decision may invoke this
  * transaction-scoped owner effect; it never creates an original CG18 publication. */
 async acceptReviewEffect(tx:PoolClient,root:string,campaignId:string,revision:number,digest:string,
  decision:"APPROVE"|"RETURN"|"REJECT",actorId:string,requestKey:string){
  const row=(await tx.query<{version:number;current_revision:number;status:string;project_source_ref:string|null;
    event_source_ref:string|null;volunteer_source_ref:string|null;branch_ref:string|null;end_at:string|null;digest:string}>(
   `SELECT c.version,c.current_revision,c.source_status AS status,c.project_source_ref,
      c.event_source_ref,c.volunteer_source_ref,c.branch_ref,c.end_at::text,r.immutable_digest AS digest FROM campaign c
    JOIN campaign_revision r ON r.root_realm_id=c.root_realm_id
     AND r.campaign_id=c.id AND r.revision_no=c.current_revision
    WHERE c.root_realm_id=$1 AND c.id=$2 FOR UPDATE OF c`,
   [root,campaignId])).rows[0];
  if(!row||row.status!=="SUBMITTED"||row.current_revision!==revision||row.digest!==digest)
   throw invalid("The submitted campaign revision changed. Do not approve old details.");
  if(decision==="APPROVE"){
   const today=(await tx.query<{today:string}>(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today`)).rows[0].today;
   if(!row.end_at||row.end_at<today)
    throw invalid("Campaign period has expired. Return it for correction before approval.");
   if(row.branch_ref){
    const valid=await tx.query(`SELECT 1 FROM branch WHERE root_realm_id=$1 AND id=$2
     AND status='ACTIVE' FOR SHARE`,[root,row.branch_ref]);
    if(!valid.rowCount)throw invalid("Campaign branch is no longer active. Return it for correction.");
   }
   if(row.volunteer_source_ref){
    const active=await tx.query(`SELECT 1 FROM volunteer v
     WHERE v.root_realm_id=$1 AND v.id=$2
       AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,$3::uuid)
      FOR SHARE OF v`,[root,row.volunteer_source_ref,row.branch_ref]);
    if(!active.rowCount)throw invalid("Campaign volunteer is no longer currently eligible. Return the campaign for correction.");
   }
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
 /** Original A12 operational lifecycle. CG03 is the independent approval
  * authority and CG18 owns public placement; this only freezes/withdraws the
  * original CG07 campaign state and its immutable event, once per request. */
 async lifecycle(token:string,ref:string,raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw invalid("Choose a campaign action.");
  const value=raw as Record<string,unknown>;
  if(Object.keys(value).some(k=>!["requestKey","expectedVersion","action"].includes(k)))
   throw invalid("Refresh the campaign before changing its status.");
  const requestKey=campaignRef(value.requestKey);
  const campaignId=campaignRef(ref),expected=value.expectedVersion;
  if(!Number.isSafeInteger(expected)||Number(expected)<1||Number(expected)>2147483645)
   throw invalid("Refresh the original campaign before changing its status.");
  const action=value.action;
  if(!["PAUSE","RESUME","CLOSE","WITHDRAW"].includes(String(action)))
   throw invalid("Choose an allowed campaign action.");
  return this.run(token,"campaigns.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"campaigns.view");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG07:CAMPAIGN:LIFECYCLE:"+a.realmId+":"+a.accountId+":"+requestKey]);
   const previous=(await tx.query<{campaign_id:string;operation:string;
    prior_status:string;resulting_status:string;resulting_version:number}>(`SELECT campaign_id,operation,prior_status,resulting_status,resulting_version
     FROM campaign_status_event WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3
     FOR SHARE`,[a.realmId,a.accountId,requestKey])).rows[0];
   const target=action==="PAUSE"?"PAUSED":action==="RESUME"?"APPROVED":
    action==="CLOSE"?"CLOSED":"WITHDRAWN";
   if(previous){
    const equivalent=String(action)==="WITHDRAW"&&previous.operation==="CANCEL_DRAFT";
    if(previous.campaign_id!==campaignId||
      previous.operation!==(equivalent?"CANCEL_DRAFT":action)||
      previous.resulting_version!==Number(expected)+1||
      previous.resulting_status!==target)
     throw invalid("This campaign change request was already used. Refresh the campaign.");
    await this.current(tx,a,campaignId);
    return {ref:campaignId,version:previous.resulting_version,status:target,replayed:true};
   }
   const current=await this.current(tx,a,campaignId,true);
   if(current.version!==Number(expected))throw invalid("Campaign changed. Refresh before updating its status.");
   const allowed=current.source_status==="APPROVED"?["PAUSE","CLOSE","WITHDRAW"]:
    current.source_status==="PAUSED"?["RESUME","CLOSE","WITHDRAW"]:
    ["DRAFT","RETURNED"].includes(current.source_status)?["WITHDRAW"]:[];
   if(!allowed.includes(String(action)))throw invalid("This campaign status change is not permitted.");
   const original=(await tx.query<{immutable_digest:string;project_source_ref:string|null;event_source_ref:string|null;
      volunteer_source_ref:string|null;end_at:string|null}>(`SELECT r.immutable_digest,c.project_source_ref,c.event_source_ref,
      c.volunteer_source_ref,c.end_at::text FROM campaign c JOIN campaign_revision r
      ON r.root_realm_id=c.root_realm_id AND r.campaign_id=c.id
      AND r.revision_no=c.current_revision WHERE c.root_realm_id=$1 AND c.id=$2 FOR SHARE OF r`,
      [a.realmId,campaignId])).rows[0];
   if(!original)throw invalid("Current original campaign revision is missing.");
   if(action==="RESUME"){
    const today=(await tx.query<{today:string}>(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today`)).rows[0].today;
    if(!original.end_at||original.end_at<today)
     throw invalid("This campaign period has expired. It cannot resume without a new approval.");
    await this.projectEvents.requireCurrent(tx,a,current.branch_ref,original.project_source_ref,original.event_source_ref);
    if(original.volunteer_source_ref)
     await requireCurrentVolunteer(tx,a.realmId,original.volunteer_source_ref,current.branch_ref);
   }
   const done=(await tx.query(`UPDATE campaign SET source_status=$3,version=version+1,updated_at=now()
     WHERE root_realm_id=$1 AND id=$2 AND version=$4 AND source_status=$5
     RETURNING version`,[a.realmId,campaignId,target,current.version,current.source_status])).rows[0];
   if(!done)throw invalid("Campaign changed. Refresh its original status.");
   const operation=action==="WITHDRAW"&&["DRAFT","RETURNED"].includes(current.source_status)?
    "CANCEL_DRAFT":action;
   await tx.query(`INSERT INTO campaign_status_event(root_realm_id,campaign_id,source_revision,digest,
     request_key,operation,prior_status,resulting_status,resulting_version,actor_ref)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [a.realmId,campaignId,current.current_revision,original.immutable_digest,requestKey,
     operation,current.source_status,target,current.version+1,a.accountId]);
   return {ref:campaignId,version:current.version+1,status:target,replayed:false};
  });
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
  const status=query.status??"ALL";
  const stateRef=query.stateRef===undefined||query.stateRef===""?null:campaignRef(query.stateRef);
  const districtRef=query.districtRef===undefined||query.districtRef===""?null:campaignRef(query.districtRef);
  const leaderRef=query.leaderRef===undefined||query.leaderRef===""?null:campaignRef(query.leaderRef);
  const branchRef=query.branchRef===undefined||query.branchRef===""?null:campaignRef(query.branchRef);
  const featured=query.featured??"ALL";
  const start=query.createdFrom??"",end=query.createdTo??"";
  const validDay=(d:unknown):d is string=>typeof d==="string"&&
   (d===""||/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(d)&&
    !Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d);
  if(typeof status!=="string"||!["ALL","DRAFT","CLOSED","WITHDRAWN","SUBMITTED","RETURNED","REJECTED","APPROVED","PAUSED"].includes(status)||
   !Number.isSafeInteger(offset)||offset<0||offset>5000||q.length>80||
   !["ALL","YES","NO"].includes(String(featured))||!validDay(start)||!validDay(end)||
   (start!==""&&end!==""&&start>end)||
   Object.keys(query).some(k=>!["offset","q","status","stateRef","districtRef","leaderRef","branchRef","featured","createdFrom","createdTo"].includes(k)))
   throw invalid("Check the campaign search and date filters.");
  return this.run(token,"campaigns.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   const args=[a.realmId,scope.all,scope.branches.map(b=>b.value),q,status,
    stateRef,districtRef,leaderRef,featured,start||null,end||null,branchRef,offset] as const;
   const rows=(await tx.query(`SELECT ${projection}${joins}
    WHERE c.root_realm_id=$1 AND ($2::boolean OR c.branch_ref=ANY($3::uuid[]))
     AND ($4='' OR strpos(lower(c.title),$4)>0 OR strpos(lower(c.code_norm),$4)>0)
     AND ($5='ALL' OR c.source_status=$5)
     AND ($6::text IS NULL OR r.step2_project_and_geo->>'stateRef'=$6::text)
     AND ($7::text IS NULL OR r.step2_project_and_geo->>'districtRef'=$7::text)
     AND ($8::text IS NULL OR COALESCE(r.step3_team->>'coordinatorRef',c.created_by::text)=$8::text)
     AND ($10::date IS NULL OR (c.created_at AT TIME ZONE 'Asia/Kolkata')::date>=$10::date)
     AND ($11::date IS NULL OR (c.created_at AT TIME ZONE 'Asia/Kolkata')::date<=$11::date)
     AND ($12::uuid IS NULL OR c.branch_ref=$12::uuid)
     AND ($9='ALL' OR
       (EXISTS(SELECT 1 FROM cms_page p JOIN cms_page_effective pe
          ON pe.foundation_root_id=p.foundation_root_id AND pe.page_id=p.id
        JOIN cms_publication pub ON pub.id=pe.publication_id AND pub.foundation_root_id=pe.foundation_root_id
        JOIN cms_section_revision sec ON sec.foundation_root_id=pub.foundation_root_id
          AND sec.page_revision_id=pub.page_revision_id
        WHERE p.foundation_root_id=c.root_realm_id AND p.kind IN('HOME','ABOUT')
          AND p.archived_at IS NULL AND pub.state='EFFECTIVE'
          AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now())
          AND sec.section_kind='CAMPAIGN_TEASER'
          AND (sec.structured_fields->'sourceRefs') ? c.id::text))=($9='YES'))
    ORDER BY c.updated_at DESC,c.id DESC LIMIT 26 OFFSET $13`,[...args])).rows;
   const summary=(await tx.query<{total:number;active:number;draft:number;completed:number;cancelled:number;goalMinor:string}>(`
    SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE source_status='APPROVED')::integer AS active,
      count(*) FILTER (WHERE source_status='DRAFT')::integer AS draft,
      count(*) FILTER (WHERE source_status='CLOSED')::integer AS completed,
      count(*) FILTER (WHERE source_status='WITHDRAWN')::integer AS cancelled,
      COALESCE(sum(goal_minor) FILTER (WHERE source_status='APPROVED'),0)::text AS "goalMinor"
    FROM campaign WHERE root_realm_id=$1
     AND ($2::boolean OR branch_ref=ANY($3::uuid[]))`,
     [a.realmId,scope.all,scope.branches.map(b=>b.value)])).rows[0];
   const publicCount=await countPublishedCampaignSources(tx,a.realmId,scope.all,scope.branches.map(b=>b.value));
   return {items:rows.slice(0,25),offset,hasMore:rows.length>25,summary:{...summary,publicCount},
    message:"Operational approved and separately effective public counts are distinct; planned fundraising goal is not money received."};
  },true);
 }
}
