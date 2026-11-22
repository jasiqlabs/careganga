import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {eligibleEventSources} from "../../cg-05-projects-field-operations/application/event-public-source";
import {ProjectActivitiesService} from "../../cg-05-projects-field-operations/application/project-activities.service";
import {ProjectsService} from "../../cg-05-projects-field-operations/application/projects.service";
import {clean,fields,ref,version,choice,invalid,stale} from "../../cg-05-projects-field-operations/domain/project-input";
type Snapshot={id:string;activity_id:string;activity_version:number;source_digest:string;title:string;category:string;safe_summary:string;general_area:string;planned_launch:string;scheduled_start:Date;scheduled_end:Date;event_status:string;submitted_by:string;request_key:string;revoked_at:Date|null;cover_file_ref:string|null;cover_file_version:number|null};
type Case={id:string;case_number:string;proposer_id:string;event_public_ref:string;event_public_id:string;event_public_version:number;event_public_digest:string;status:string;revision:number;process_id:string;current_step:number};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const safe=(v:unknown,min:number,max:number)=>{const s=clean(v,min,max);if(/[<>]|(?:javascript|data):|https?:\/\//i.test(s))throw invalid();return s;};
@Injectable()
export class EventPublicEligibilityService{
 constructor(private readonly projects:ProjectsService,private readonly activities:ProjectActivitiesService,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:VerifiedFoundationActor,id:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,id,a.accountId,action,randomUUID()]);
 }
 private async exact(tx:PoolClient,a:VerifiedFoundationActor,c:Case){
  const p=await this.activities.guardPublicEvent(tx,a,c.event_public_id,c.event_public_version,false);
  if(!["SCHEDULED","ONGOING","COMPLETED"].includes(p.status))throw stale();
  const s=(await tx.query<Snapshot>("SELECT *,planned_launch::text AS planned_launch FROM event_public_eligibility WHERE root_realm_id=$1 AND id=$2 AND activity_id=$3 AND activity_version=$4 AND source_digest=$5 AND revoked_at IS NULL FOR SHARE",[a.realmId,c.event_public_ref,p.id,p.version,c.event_public_digest])).rows[0];
  if(!s)throw stale();
  if(s.cover_file_ref){await this.identity.assertCurrent(tx,a,"documents.files.view");if(!(await tx.query("SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.activity_id=$3 AND f.proposal_revision=$4 AND f.revision=$5 AND f.owner_kind='CG05_ACTIVITY' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' FOR SHARE OF f,i",[s.cover_file_ref,a.realmId,p.id,p.version,s.cover_file_version])).rowCount)throw stale();}
  return s;
 }
 async submit(token:string,activityRef:string,raw:unknown){
  const target=ref(activityRef),x=fields(raw,["requestKey","expectedVersion","publicSummary","generalArea","publicReleaseConfirmed","coverFileRef","coverFileVersion","coverRightsConfirmed"]);
  const key=ref(x.requestKey),expected=version(x.expectedVersion),summary=safe(x.publicSummary,3,500),area=safe(x.generalArea,2,160);
  if(x.publicReleaseConfirmed!==true)throw invalid();
  const cover=x.coverFileRef==null?null:ref(x.coverFileRef),coverVersion=cover?version(x.coverFileVersion):null;
  if(cover?x.coverRightsConfirmed!==true:x.coverFileVersion!=null||x.coverRightsConfirmed===true)throw invalid();
  return this.projects.run(token,"projects.activities.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.activities.view");
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const p=await this.activities.guardPublicEvent(tx,a,target,expected,true);
   if(!["SCHEDULED","ONGOING","COMPLETED"].includes(p.status))throw stale();
   const original=(await tx.query<{title:string;category:string;planned_launch:string;scheduled_start:Date;scheduled_end:Date}>("SELECT title,category,(scheduled_start AT TIME ZONE 'Asia/Kolkata')::date::text AS planned_launch,scheduled_start,scheduled_end FROM project_activity WHERE root_realm_id=$1 AND id=$2 AND kind='EVENT'",[a.realmId,p.id])).rows[0];
   if(!original)throw stale();
   const title=safe(original.title,2,160),category=safe(original.category,1,80);
   const digest=hash([p.id,p.version,title,category,summary,area,original.planned_launch,original.scheduled_start.toISOString(),original.scheduled_end.toISOString(),p.status,true,...(cover?[cover,coverVersion,true]:[])]);
   const prior=(await tx.query<Snapshot>("SELECT * FROM event_public_eligibility WHERE root_realm_id=$1 AND request_key=$2 FOR SHARE",[a.realmId,key])).rows[0];
   if(prior){
    if(prior.activity_id!==p.id||prior.activity_version!==p.version||prior.submitted_by!==a.accountId||prior.source_digest!==digest)throw stale();
    const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND event_public_ref=$2 AND case_kind='FOUNDATION_EVENT_REVIEW'",[a.realmId,prior.id])).rows[0];
    if(!c)throw stale();return {caseNumber:c.case_number,status:c.status==="OWNER_COMPLETED"?"ELIGIBLE_NOT_PUBLISHED":c.status,replayed:true};
   }
   if(cover){await this.identity.assertCurrent(tx,a,"documents.files.view");if(!(await tx.query("SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.activity_id=$3 AND f.proposal_revision=$4 AND f.revision=$5 AND f.owner_kind='CG05_ACTIVITY' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' FOR SHARE OF f,i",[cover,a.realmId,p.id,p.version,coverVersion])).rowCount)throw stale();}
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const current=await tx.query<{process_id:string}>("SELECT process_id FROM cg03_event_public_process_current WHERE realm_id=$1 FOR SHARE",[a.realmId]);
   let process=current.rows[0]?.process_id;
   if(!process){
    process=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'FOUNDATION_EVENT_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0].id;
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[process]);
    await tx.query("INSERT INTO cg03_event_public_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,process]);
   }
   if((await tx.query("SELECT 1 FROM event_public_eligibility WHERE root_realm_id=$1 AND activity_id=$2 AND activity_version=$3",[a.realmId,p.id,p.version])).rowCount)throw stale();
   const s=(await tx.query<{id:string}>("INSERT INTO event_public_eligibility(root_realm_id,activity_id,activity_version,source_digest,title,category,safe_summary,general_area,planned_launch,event_status,consent_confirmed,submitted_by,request_key,cover_file_ref,cover_file_version,scheduled_start,scheduled_end) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$13,$14,$15,$16) RETURNING id",[a.realmId,p.id,p.version,digest,title,category,summary,area,original.planned_launch,p.status,a.accountId,key,cover,coverVersion,original.scheduled_start,original.scheduled_end])).rows[0];
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,event_public_ref,event_public_id,event_public_version,event_public_digest) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Foundation event review',NULL,NULL,$4,$5,$6,$7,'FOUNDATION_EVENT_REVIEW',$8,$9,$4,$5 FROM cg03_process p WHERE p.id=$10 AND p.realm_id=$1 AND p.process_kind='FOUNDATION_EVENT_REVIEW' RETURNING *",[a.realmId,a.accountId,title,expected,digest,hash([target,key,digest]),key,s.id,target,process])).rows[0];
   if(!c)throw stale();await this.event(tx,a,c.id,"SUBMITTED");
   return {caseNumber:c.case_number,status:c.status,replayed:false};
  });
 }
 async detail(token:string,activityRef:string){
  return this.projects.run(token,"projects.activities.view",async(tx,a)=>{
   const p=await this.activities.guardPublicEvent(tx,a,activityRef,null,false);
   const current=(await tx.query<Snapshot>("SELECT *,planned_launch::text AS planned_launch FROM event_public_eligibility WHERE root_realm_id=$1 AND activity_id=$2 AND activity_version=$3 FOR SHARE",[a.realmId,p.id,p.version])).rows[0];
   if(!current)return {status:"PRIVATE",caseRef:null,canReview:false,canWithdraw:false,source:null};
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='FOUNDATION_EVENT_REVIEW' AND event_public_ref=$2 FOR SHARE",[a.realmId,current.id])).rows[0];
   if(!c)throw stale();
   let canReview=false,canWithdraw=false;
   if(!current.revoked_at&&["SCHEDULED","ONGOING","COMPLETED"].includes(p.status)){
    try{await this.activities.guardPublicEvent(tx,a,p.id,p.version,true);canWithdraw=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
    if(c.proposer_id!==a.accountId&&["SUBMITTED","IN_REVIEW"].includes(c.status)){
     try{await this.owner.verifyReviewer(tx,a,"approvals.review",true);if(current.cover_file_ref)await this.identity.assertCurrent(tx,a,"documents.files.view");canReview=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
    }
   }
   const approvedCurrent=c.status==="OWNER_COMPLETED"&&!current.revoked_at&&["SCHEDULED","ONGOING","COMPLETED"].includes(p.status)?(await eligibleEventSources(tx,a.realmId,[current.id])).length===1:false;
   const effective=current.revoked_at||!["SCHEDULED","ONGOING","COMPLETED"].includes(p.status)?"WITHDRAWN":c.status==="OWNER_COMPLETED"?(approvedCurrent?"ELIGIBLE_NOT_PUBLISHED":"SOURCE_INVALIDATED"):c.status;
   let canReadImage=false;
   if(current.cover_file_ref)try{await this.identity.assertCurrent(tx,a,"documents.files.view");canReadImage=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
   return {status:effective,caseRef:canReview?c.id:null,caseNumber:c.case_number,revision:c.revision,canReview,canWithdraw,source:{title:current.title,category:current.category,summary:current.safe_summary,area:current.general_area,launch:current.planned_launch,scheduledStart:current.scheduled_start,scheduledEnd:current.scheduled_end,status:current.event_status,coverFileRef:canReadImage?current.cover_file_ref:null,coverFileVersion:canReadImage?current.cover_file_version:null}};
  },true);
 }
 async decide(token:string,caseRef:string,raw:unknown){
  const target=ref(caseRef),x=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]);
  const key=ref(x.requestKey),expected=version(x.expectedRevision),action=choice(x.action,["APPROVE","RETURN","REJECT"] as const),remarks=clean(x.remarks??"",action==="APPROVE"?0:3,500),password=x.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)throw invalid();
  const h=hash([target,expected,action,remarks]);
  const a=await this.sessions.requireAction(token,"approvals.review");await this.sessions.limitFoundationRootProof(a);
  return this.projects.run(token,"approvals.review",async(tx,actor)=>{
   await this.identity.assertCurrent(tx,actor,"projects.activities.view");await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
   const found=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FOUNDATION_EVENT_REVIEW'",[actor.realmId,target])).rows[0];
   if(!found)throw new NotFoundException("Event review unavailable");
   await this.exact(tx,actor,found);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FOUNDATION_EVENT_REVIEW' FOR UPDATE",[actor.realmId,target])).rows[0];
   if(!c||c.proposer_id===actor.accountId)throw new ForbiddenException("A different authorized reviewer must decide");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[actor.realmId,target,key])).rows[0];
   if(prior){if(prior.actor_id!==actor.accountId||prior.request_digest!==h)throw stale();return {status:c.status,replayed:true};}
   if(c.revision!==expected||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw stale();
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step])).rowCount)throw stale();
   await this.sessions.requireFreshFoundationRootProof(tx,actor,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[actor.realmId,target,next]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[actor.realmId,target,actor.accountId,action,expected,expected+1,key,h,remarks]);
   await this.event(tx,actor,target,action==="APPROVE"?"FINAL_APPROVED":next);
   if(action==="APPROVE"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[actor.realmId,target]);await this.event(tx,actor,target,"OWNER_COMPLETED");}
   return {status:action==="APPROVE"?"ELIGIBLE_NOT_PUBLISHED":next,replayed:false};
  });
 }
 async withdraw(token:string,activityRef:string,raw:unknown){
  const x=fields(raw,["expectedVersion","reason"]),expected=version(x.expectedVersion),reason=clean(x.reason,3,500);
  return this.projects.run(token,"projects.activities.manage",async(tx,a)=>{
   const p=await this.activities.guardPublicEvent(tx,a,activityRef,expected,true);
   const q=await tx.query("UPDATE event_public_eligibility SET revoked_at=now(),revoked_by=$3,revocation_reason=$4 WHERE root_realm_id=$1 AND activity_id=$2 AND activity_version=$5 AND revoked_at IS NULL RETURNING id",[a.realmId,p.id,a.accountId,reason,p.version]);
   if(!q.rowCount){const prior=await tx.query("SELECT 1 FROM event_public_eligibility WHERE root_realm_id=$1 AND activity_id=$2 AND activity_version=$3 AND revoked_at IS NOT NULL",[a.realmId,p.id,p.version]);if(!prior.rowCount)throw stale();}
   return {status:"WITHDRAWN"};
  });
 }
}
