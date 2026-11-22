import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {CampaignDraftsService} from "../../cg-07-campaigns-donations/application/campaign-drafts.service";
import {campaignRef} from "../../cg-07-campaigns-donations/domain/campaign-draft-input";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";

/** CG03 original approval authority; CG07 owns campaign state, CG18 owns publication. */
type CaseRow={id:string;case_number:string;process_id:string;proposer_id:string;case_kind:string;
 status:string;revision:number;campaign_review_ref:string;campaign_id:string;campaign_source_revision:number;campaign_source_digest:string};
type FrozenSteps={basic:unknown;project:unknown;team:unknown;budget:unknown;media:unknown;review:unknown};
type CampaignFrozen={title:string;category:string;branchRef:string|null;projectRef:string|null;
 eventRef:string|null;goalMinor:string|null;startAt:string|null;endAt:string|null;steps:FrozenSteps};
type Source={root_realm_id:string;id:string;campaign_id:string;source_revision:number;source_digest:string;
 submitted_by:string;source_snapshot:CampaignFrozen};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const changed=()=>new ConflictException({code:"CG07_CAMPAIGN_REVIEW_CHANGED",message:"Campaign or independent approval has changed. Refresh the current review."});
const missing=()=>new NotFoundException("Campaign approval is not available.");
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function only(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BadRequestException("Check this campaign review request.");
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(key=>!keys.includes(key)))throw new BadRequestException("Unsupported campaign review field.");
 return x;
}
function key(v:unknown):string{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a current campaign review request.");
 return v.toLowerCase();
}
function rev(v:unknown):number{
 if(!Number.isSafeInteger(v)||Number(v)<1||Number(v)>2147483645)
  throw new BadRequestException("Refresh this campaign before continuing.");
 return Number(v);
}
function note(v:unknown,min=0):string{
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>500||/[<>\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException("Enter a short, safe review remark.");
 return v.trim();
}
@Injectable()
export class CampaignReviewService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService,
  private readonly campaigns:CampaignDraftsService){}
 private async transaction<T>(actor:Actor,work:(tx:PoolClient)=>Promise<T>,read=false):Promise<T>{
  const tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   const result=await work(tx);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{/* Preserve original failure. */}
   if(e&&typeof e==="object"&&"code" in e&&
      ["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))
    throw changed();
   throw e;
  }finally{tx.release();}
 }
 private async reviewer(token:string){
  const actor=await this.sessions.requireAction(token,"approvals.review");
  await this.sessions.requireAction(token,"campaigns.review");
  return actor;
 }
 private async authority(tx:PoolClient,actor:Actor){
  await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
  await this.identity.assertCurrent(tx,actor,"campaigns.review");
 }
 private async configured(tx:PoolClient,root:string){
  return (await tx.query<{id:string;version:number}>(`
   SELECT p.id,p.version FROM cg03_campaign_process_current current
   JOIN cg03_process p ON p.id=current.process_id AND p.realm_id=current.realm_id
   WHERE current.realm_id=$1 AND p.process_kind='CAMPAIGN_LAUNCH' FOR SHARE OF p`,[root])).rows[0];
 }
 private async event(tx:PoolClient,actor:Actor,c:CaseRow,action:string,remarks=""){
  await tx.query(`INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref,safe_remarks)
   VALUES($1,$2,$3,$4,1,$5,$6)`,[actor.realmId,c.id,actor.accountId,action,randomUUID(),remarks]);
 }
 private async originalCase(tx:PoolClient,actor:Actor,ref:string,lock=false){
  const c=(await tx.query<CaseRow>(`SELECT * FROM cg03_case
   WHERE realm_id=$1 AND id=$2 AND case_kind='CAMPAIGN_LAUNCH'`+(lock?" FOR UPDATE":" FOR SHARE"),
   [actor.realmId,key(ref)])).rows[0];
  if(!c)throw missing();
  return c;
 }
 private async source(tx:PoolClient,actor:Actor,c:CaseRow,current=false){
  const s=(await tx.query<Source>(`SELECT * FROM campaign_review_snapshot
   WHERE root_realm_id=$1 AND id=$2 AND campaign_id=$3
    AND source_revision=$4 AND source_digest=$5 FOR SHARE`,
   [actor.realmId,c.campaign_review_ref,c.campaign_id,c.campaign_source_revision,c.campaign_source_digest])).rows[0];
  if(!s||s.submitted_by!==c.proposer_id)throw changed();
  const original=(await tx.query<{digest:string;current_revision:number;status:string;title:string;
    category:string;branchRef:string|null;projectRef:string|null;eventRef:string|null;
    goalMinor:string|null;startAt:string|null;endAt:string|null;
    basic:unknown;project:unknown;team:unknown;budget:unknown;media:unknown;review:unknown}>(
   `SELECT r.immutable_digest AS digest,c.current_revision,c.source_status AS status,c.title,
     c.category,c.branch_ref AS "branchRef",c.project_source_ref AS "projectRef",
     c.event_source_ref AS "eventRef",c.goal_minor::text AS "goalMinor",
     c.start_at::text AS "startAt",c.end_at::text AS "endAt",
     r.step1_basic AS basic,r.step2_project_and_geo AS project,r.step3_team AS team,
     r.step4_budget_targets AS budget,r.step5_media_refs AS media,r.step6_summary AS review
    FROM campaign_revision r JOIN campaign c ON c.root_realm_id=r.root_realm_id AND c.id=r.campaign_id
    WHERE r.root_realm_id=$1 AND r.campaign_id=$2 AND r.revision_no=$3 FOR SHARE OF r`,
   [actor.realmId,c.campaign_id,c.campaign_source_revision])).rows[0];
  if(!original||original.digest!==s.source_digest||
   hash({title:original.title,category:original.category,branchRef:original.branchRef,
    projectRef:original.projectRef,eventRef:original.eventRef,goalMinor:original.goalMinor,
    startAt:original.startAt,endAt:original.endAt,
    steps:{basic:original.basic,project:original.project,team:original.team,budget:original.budget,
      media:original.media,review:original.review}})!==hash(s.source_snapshot))throw changed();
  if(current&&(original.current_revision!==s.source_revision||original.status!=="SUBMITTED"))
   throw changed();
  return s;
 }
 async policy(token:string){
  const actor=await this.reviewer(token);
  return this.transaction(actor,async tx=>{
   await this.authority(tx,actor);
   const current=await this.configured(tx,actor.realmId);
   return {configured:!!current,version:current?.version??0};
  },true);
 }
 async configure(token:string,raw:unknown){
  const x=only(raw,["currentPassword"]),password=x.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password,"utf8")>1024)
   throw new BadRequestException("Enter your current password to configure campaign review.");
  const actor=await this.sessions.requireAction(token,"approvals.process.manage");
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(actor,async tx=>{
   if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
     [actor.realmId])).rowCount)throw missing();
   await this.identity.assertCurrent(tx,actor,"approvals.process.manage");
   await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,actor,password);
   const previous=await this.configured(tx,actor.realmId);
   if(previous)return {configured:true,version:previous.version,replayed:true};
   const p=(await tx.query<{id:string;version:number}>(`INSERT INTO cg03_process(
     realm_id,version,first_reviewer_capability,configured_by,process_kind)
    SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'CAMPAIGN_LAUNCH'
     FROM cg03_process WHERE realm_id=$1 RETURNING id,version`,
     [actor.realmId,actor.accountId])).rows[0];
   await tx.query(`INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
    VALUES($1,1,'approvals.review',true)`,[p.id]);
   await tx.query(`INSERT INTO cg03_campaign_process_current(realm_id,process_id) VALUES($1,$2)`,
    [actor.realmId,p.id]);
   return {configured:true,version:p.version,replayed:false};
  });
 }
 async submit(token:string,ref:string,raw:unknown){
  const actor=await this.sessions.requireAction(token,"campaigns.manage");
  const campaignId=campaignRef(ref),x=only(raw,["requestKey","expectedVersion"]);
  const requestKey=key(x.requestKey),expected=rev(x.expectedVersion);
  const requestDigest=hash(["CG07_ORIGINAL_CAMPAIGN_SUBMIT",campaignId,expected]);
  return this.transaction(actor,async tx=>{
   await this.identity.assertCurrent(tx,actor,"campaigns.manage");
   await this.identity.assertCurrent(tx,actor,"campaigns.view");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     ["CG07:CAMPAIGN:SUBMIT:"+actor.realmId+":"+actor.accountId+":"+requestKey]);
   const old=(await tx.query<CaseRow & {request_digest:string;request_key:string}>(`SELECT * FROM cg03_case
    WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3`,
    [actor.realmId,actor.accountId,requestKey])).rows[0];
   if(old){
    if(old.case_kind!=="CAMPAIGN_LAUNCH"||old.campaign_id!==campaignId||old.request_digest!==requestDigest)
     throw changed();
    return {reference:old.case_number,status:old.status,replayed:true};
   }
   const process=await this.configured(tx,actor.realmId);
   if(!process)throw new ConflictException("Original campaign review is not configured. Your campaign draft is saved; contact Foundation Admin.");
   await this.owner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
   const previous=(await tx.query<CaseRow>(`SELECT * FROM cg03_case WHERE realm_id=$1
    AND campaign_id=$2 AND case_kind='CAMPAIGN_LAUNCH'
    ORDER BY campaign_source_revision DESC LIMIT 1 FOR SHARE`,
    [actor.realmId,campaignId])).rows[0];
   if(previous&&previous.status!=="RETURNED")throw changed();
   const frozen=await this.campaigns.freezeForReview(tx,actor,campaignId,expected,requestKey);
   const snap=(await tx.query<{id:string}>(`INSERT INTO campaign_review_snapshot(
    root_realm_id,campaign_id,source_revision,source_digest,submitted_by,request_key,source_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
    [actor.realmId,frozen.campaignId,frozen.revision,frozen.digest,actor.accountId,
     requestKey,JSON.stringify(frozen.sourceSnapshot)])).rows[0];
   const c=(await tx.query<CaseRow>(`INSERT INTO cg03_case(realm_id,case_number,process_id,
     process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,
     expected_access_version,expected_role_revision,proposal_revision,proposal_digest,
     request_digest,request_key,case_kind,campaign_review_ref,campaign_id,
     campaign_source_revision,campaign_source_digest,previous_case_id)
    VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),
     $2,$3,$4,NULL,NULL,$5,'Campaign launch',NULL,NULL,$6,$7,$8,$9,'CAMPAIGN_LAUNCH',
     $10,$11,$6,$7,$12) RETURNING *`,
    [actor.realmId,process.id,process.version,actor.accountId,
     frozen.title,frozen.revision,frozen.digest,requestDigest,requestKey,snap.id,
     frozen.campaignId,previous?.id??null])).rows[0];
   await this.event(tx,actor,c,"SUBMITTED");
   return {reference:c.case_number,caseRef:c.id,status:c.status,replayed:false};
  });
 }
 async inbox(token:string,raw:Record<string,unknown>){
  const actor=await this.reviewer(token);
  const x=only(raw,["status","q","offset"]);
  const statuses=["ALL","SUBMITTED","RETURNED","REJECTED","OWNER_COMPLETED"];
  const status=x.status??"ALL",q=x.q??"",offset=x.offset??"0";
  if(typeof status!=="string"||!statuses.includes(status)||
    typeof q!=="string"||q.length>80||/[<>\u0000-\u001f\u007f]/.test(q)||
    typeof offset!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(offset)||Number(offset)>5000)
   throw new BadRequestException("Check campaign review filters.");
  return this.transaction(actor,async tx=>{
   await this.authority(tx,actor);
   const rows=(await tx.query(`SELECT c.id AS "caseRef",c.case_number AS reference,c.status,c.revision,
     c.submitted_at AS "submittedAt",c.account_name_snapshot AS title,
     ca.code_norm AS campaign,c.proposer_id<>$2 AS "canDecide"
    FROM cg03_case c JOIN campaign ca ON ca.root_realm_id=c.realm_id AND ca.id=c.campaign_id
    WHERE c.realm_id=$1 AND c.case_kind='CAMPAIGN_LAUNCH'
      AND ($3='ALL' OR c.status=$3)
      AND ($4='' OR strpos(lower(c.account_name_snapshot),lower($4))>0
        OR strpos(lower(c.case_number),lower($4))>0)
    ORDER BY c.submitted_at DESC,c.id DESC LIMIT 26 OFFSET $5`,
    [actor.realmId,actor.accountId,status,q,Number(offset)])).rows;
   return {items:rows.slice(0,25),offset:Number(offset),hasMore:rows.length>25};
  },true);
 }
 async detail(token:string,ref:string){
  const actor=await this.reviewer(token);
  return this.transaction(actor,async tx=>{
   await this.authority(tx,actor);
   const c=await this.originalCase(tx,actor,ref);
   const s=await this.source(tx,actor,c,false);
   const history=(await tx.query(`SELECT e.action,e.safe_remarks AS remarks,e.occurred_at AS at,
      a.display_name AS actor FROM cg03_case_event e
     JOIN account a ON a.id=e.actor_id AND a.realm_id=e.realm_id
     WHERE e.realm_id=$1 AND e.case_id=$2 ORDER BY e.occurred_at DESC LIMIT 30`,
     [actor.realmId,c.id])).rows;
   return {caseRef:c.id,reference:c.case_number,status:c.status,revision:c.revision,
    source:s.source_snapshot,history,canDecide:c.status==="SUBMITTED"&&c.proposer_id!==actor.accountId};
  },true);
 }
 async campaignHistory(token:string,campaign:string){
  const actor=await this.sessions.requireAction(token,"campaigns.view");
  const id=campaignRef(campaign);
  return this.transaction(actor,async tx=>{
   await this.identity.assertCurrent(tx,actor,"campaigns.view");
   const allowed=await this.campaigns.readForReviewHistory(tx,actor,id);
   if(!allowed)throw missing();
   const cases=(await tx.query(`SELECT c.case_number AS reference,c.status,c.revision,
     c.submitted_at AS "submittedAt",c.campaign_source_revision AS "sourceRevision"
    FROM cg03_case c WHERE c.realm_id=$1 AND c.campaign_id=$2
      AND c.case_kind='CAMPAIGN_LAUNCH' ORDER BY c.submitted_at DESC LIMIT 30`,
     [actor.realmId,id])).rows;
   return {items:cases};
  },true);
 }
 async decide(token:string,ref:string,raw:unknown){
  const actor=await this.reviewer(token);
  const id=key(ref),x=only(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]);
  const requestKey=key(x.requestKey),expected=rev(x.expectedRevision);
  const action=x.action,remarks=note(x.remarks??"",action==="APPROVE"?0:3);
  if(!["APPROVE","RETURN","REJECT"].includes(String(action)))
   throw new BadRequestException("Choose Approve, Return or Reject.");
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword,"utf8")>1024)
   throw new BadRequestException("Enter your current password for independent campaign review.");
  const digest=hash(["CAMPAIGN_DECISION",id,action,expected,remarks]);
  await this.sessions.limitFoundationRootProof(actor);
  return this.transaction(actor,async tx=>{
   await this.authority(tx,actor);
   const c=await this.originalCase(tx,actor,id,true);
   if(c.proposer_id===actor.accountId)throw new ForbiddenException("Another Foundation reviewer must decide this campaign.");
   const old=(await tx.query<{actor_id:string;request_digest:string}>(`
    SELECT actor_id,request_digest FROM cg03_case_decision
    WHERE realm_id=$1 AND case_id=$2 AND request_key=$3`,
    [actor.realmId,id,requestKey])).rows[0];
   if(old){
    if(old.actor_id!==actor.accountId||old.request_digest!==digest)throw changed();
    return {reference:c.case_number,status:c.status,revision:c.revision,replayed:true};
   }
   if(c.status!=="SUBMITTED"||c.revision!==expected)throw changed();
   await this.source(tx,actor,c,true);
   const route=(await tx.query(`SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id
    WHERE p.realm_id=$1 AND p.id=$2 AND p.process_kind='CAMPAIGN_LAUNCH'
     AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required
    FOR SHARE OF p,s`,[actor.realmId,c.process_id])).rows[0];
   if(!route)throw changed();
   await this.sessions.requireFreshFoundationRootProof(tx,actor,x.currentPassword);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query(`UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
    WHERE realm_id=$1 AND id=$2 AND status='SUBMITTED' AND revision=$4`,
    [actor.realmId,c.id,next,expected]);
   await tx.query(`INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,
     expected_case_revision,accepted_case_revision,request_key,request_digest,
     safe_remarks,fresh_password_verified_at)
    VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())`,
    [actor.realmId,c.id,actor.accountId,action,expected,expected+1,requestKey,digest,remarks]);
   const outcome=await this.campaigns.acceptReviewEffect(tx,actor.realmId,c.campaign_id,
    c.campaign_source_revision,c.campaign_source_digest,action as "APPROVE"|"RETURN"|"REJECT",actor.accountId,requestKey);
   await this.event(tx,actor,c,action==="APPROVE"?"FINAL_APPROVED":next,remarks);
   if(action==="APPROVE"){
    await tx.query(`UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now()
     WHERE realm_id=$1 AND id=$2 AND status='PENDING_OWNER'`,[actor.realmId,c.id]);
    await this.event(tx,actor,c,"OWNER_COMPLETED");
   }
   return {reference:c.case_number,status:action==="APPROVE"?"OWNER_COMPLETED":next,
    campaignStatus:outcome.status,revision:expected+(action==="APPROVE"?2:1),replayed:false};
  });
 }
}
