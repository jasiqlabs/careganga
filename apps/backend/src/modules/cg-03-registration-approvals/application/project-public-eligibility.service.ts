import {ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {ProjectsService} from "../../cg-05-projects-field-operations/application/projects.service";
import {clean,fields,ref,version,choice,invalid,stale} from "../../cg-05-projects-field-operations/domain/project-input";
type Snapshot={id:string;project_id:string;project_version:number;source_digest:string;title:string;category:string;safe_summary:string;general_area:string;planned_launch:string|null;project_status:string;submitted_by:string;request_key:string;revoked_at:Date|null;cover_file_ref:string|null;cover_file_version:number|null};
type Case={id:string;case_number:string;proposer_id:string;project_public_ref:string;project_public_id:string;project_public_version:number;project_public_digest:string;status:string;revision:number;process_id:string;current_step:number};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const safe=(v:unknown,min:number,max:number)=>{const s=clean(v,min,max);if(/[<>]|(?:javascript|data):|https?:\/\//i.test(s))throw invalid();return s;};
@Injectable()
export class ProjectPublicEligibilityService{
 constructor(private readonly projects:ProjectsService,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:VerifiedFoundationActor,id:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,id,a.accountId,action,randomUUID()]);
 }
 private async exact(tx:PoolClient,a:VerifiedFoundationActor,c:Case){
  const p=await this.projects.guardCover(tx,a,c.project_public_id,c.project_public_version,false);
  if(!["PLANNED","ACTIVE"].includes(p.status))throw stale();
  const s=(await tx.query<Snapshot>("SELECT *,planned_launch::text AS planned_launch FROM project_public_eligibility WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 AND project_version=$4 AND source_digest=$5 AND revoked_at IS NULL FOR SHARE",[a.realmId,c.project_public_ref,p.id,p.version,c.project_public_digest])).rows[0];
  if(!s)throw stale();
  if(s.cover_file_ref){await this.identity.assertCurrent(tx,a,"documents.files.view");if(!(await tx.query("SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.project_id=$3 AND f.proposal_revision=$4 AND f.revision=$5 AND f.owner_kind='CG05_PROJECT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' FOR SHARE OF f,i",[s.cover_file_ref,a.realmId,p.id,p.version,s.cover_file_version])).rowCount)throw stale();}
  return s;
 }
 async submit(token:string,projectRef:string,raw:unknown){
  const target=ref(projectRef),x=fields(raw,["requestKey","expectedVersion","publicSummary","generalArea","publicReleaseConfirmed","coverFileRef","coverFileVersion","coverRightsConfirmed"]);
  const key=ref(x.requestKey),expected=version(x.expectedVersion),summary=safe(x.publicSummary,3,500),area=safe(x.generalArea,2,160);
  if(x.publicReleaseConfirmed!==true)throw invalid();
  const cover=x.coverFileRef==null?null:ref(x.coverFileRef),coverVersion=cover?version(x.coverFileVersion):null;
  if(cover?x.coverRightsConfirmed!==true:x.coverFileVersion!=null||x.coverRightsConfirmed===true)throw invalid();
  return this.projects.run(token,"projects.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.view");
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const p=await this.projects.guardCover(tx,a,target,expected,true);
   if(!["PLANNED","ACTIVE"].includes(p.status))throw stale();
   const original=(await tx.query<{title:string;category:string;planned_launch:string|null}>("SELECT title,category,planned_start::text AS planned_launch FROM project WHERE root_realm_id=$1 AND id=$2",[a.realmId,p.id])).rows[0];
   const title=safe(original.title,2,160),category=safe(original.category,1,80);
   const digest=hash([p.id,p.version,title,category,summary,area,original.planned_launch,p.status,true,...(cover?[cover,coverVersion,true]:[])]);
   const prior=(await tx.query<Snapshot>("SELECT * FROM project_public_eligibility WHERE root_realm_id=$1 AND request_key=$2 FOR SHARE",[a.realmId,key])).rows[0];
   if(prior){
    if(prior.project_id!==p.id||prior.project_version!==p.version||prior.submitted_by!==a.accountId||prior.source_digest!==digest)throw stale();
    const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND project_public_ref=$2 AND case_kind='PROJECT_PUBLIC_ELIGIBILITY'",[a.realmId,prior.id])).rows[0];
    if(!c)throw stale();return {caseNumber:c.case_number,status:c.status,replayed:true};
   }
   if(cover){await this.identity.assertCurrent(tx,a,"documents.files.view");if(!(await tx.query("SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=$1 AND f.realm_id=$2 AND f.project_id=$3 AND f.proposal_revision=$4 AND f.revision=$5 AND f.owner_kind='CG05_PROJECT' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' FOR SHARE OF f,i",[cover,a.realmId,p.id,p.version,coverVersion])).rowCount)throw stale();}
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const current=await tx.query<{process_id:string}>("SELECT process_id FROM cg03_project_public_process_current WHERE realm_id=$1 FOR SHARE",[a.realmId]);
   let process=current.rows[0]?.process_id;
   if(!process){
    process=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'PROJECT_PUBLIC_ELIGIBILITY' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0].id;
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[process]);
    await tx.query("INSERT INTO cg03_project_public_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,process]);
   }
   const s=(await tx.query<{id:string}>("INSERT INTO project_public_eligibility(root_realm_id,project_id,project_version,source_digest,title,category,safe_summary,general_area,planned_launch,project_status,consent_confirmed,submitted_by,request_key,cover_file_ref,cover_file_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$13,$14) RETURNING id",[a.realmId,p.id,p.version,digest,title,category,summary,area,original.planned_launch,p.status,a.accountId,key,cover,coverVersion])).rows[0];
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,project_public_ref,project_public_id,project_public_version,project_public_digest) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Project public eligibility',NULL,NULL,$4,$5,$6,$7,'PROJECT_PUBLIC_ELIGIBILITY',$8,$9,$4,$5 FROM cg03_process p WHERE p.id=$10 AND p.realm_id=$1 AND p.process_kind='PROJECT_PUBLIC_ELIGIBILITY' RETURNING *",[a.realmId,a.accountId,title,expected,digest,hash([target,key,digest]),key,s.id,target,process])).rows[0];
   if(!c)throw stale();await this.event(tx,a,c.id,"SUBMITTED");
   return {caseNumber:c.case_number,status:c.status,replayed:false};
  });
 }
 async detail(token:string,projectRef:string){
  return this.projects.run(token,"projects.view",async(tx,a)=>{
   const p=await this.projects.guardCover(tx,a,projectRef,null,false);
   const current=(await tx.query<Snapshot>("SELECT *,planned_launch::text AS planned_launch FROM project_public_eligibility WHERE root_realm_id=$1 AND project_id=$2 AND project_version=$3 FOR SHARE",[a.realmId,p.id,p.version])).rows[0];
   if(!current)return {status:"PRIVATE",caseRef:null,canReview:false,canWithdraw:false,source:null};
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='PROJECT_PUBLIC_ELIGIBILITY' AND project_public_ref=$2 FOR SHARE",[a.realmId,current.id])).rows[0];
   if(!c)throw stale();
   let canReview=false,canWithdraw=false;
   if(!current.revoked_at&&["PLANNED","ACTIVE"].includes(p.status)){
    try{await this.projects.guardCover(tx,a,p.id,p.version,true);canWithdraw=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
    if(c.proposer_id!==a.accountId&&["SUBMITTED","IN_REVIEW"].includes(c.status)){
     try{await this.owner.verifyReviewer(tx,a,"approvals.review",true);if(current.cover_file_ref)await this.identity.assertCurrent(tx,a,"documents.files.view");canReview=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
    }
   }
   const effective=current.revoked_at||!["PLANNED","ACTIVE"].includes(p.status)?"WITHDRAWN":c.status==="OWNER_COMPLETED"?"ELIGIBLE_NOT_PUBLISHED":c.status;
   return {status:effective,caseRef:canReview?c.id:null,caseNumber:c.case_number,revision:c.revision,canReview,canWithdraw,source:{title:current.title,category:current.category,summary:current.safe_summary,area:current.general_area,launch:current.planned_launch,status:current.project_status,coverFileRef:current.cover_file_ref,coverFileVersion:current.cover_file_version}};
  },true);
 }
 async decide(token:string,caseRef:string,raw:unknown){
  const target=ref(caseRef),x=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]);
  const key=ref(x.requestKey),expected=version(x.expectedRevision),action=choice(x.action,["APPROVE","RETURN","REJECT"] as const),remarks=clean(x.remarks??"",action==="APPROVE"?0:3,500),password=x.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)throw invalid();
  const h=hash([target,expected,action,remarks]);
  const a=await this.sessions.requireAction(token,"approvals.review");await this.sessions.limitFoundationRootProof(a);
  return this.projects.run(token,"approvals.review",async(tx,actor)=>{
   await this.identity.assertCurrent(tx,actor,"projects.view");await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
   const found=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='PROJECT_PUBLIC_ELIGIBILITY'",[actor.realmId,target])).rows[0];
   if(!found)throw new NotFoundException("Project review unavailable");
   await this.exact(tx,actor,found);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='PROJECT_PUBLIC_ELIGIBILITY' FOR UPDATE",[actor.realmId,target])).rows[0];
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
 async withdraw(token:string,projectRef:string,raw:unknown){
  const x=fields(raw,["expectedVersion","reason"]),expected=version(x.expectedVersion),reason=clean(x.reason,3,500);
  return this.projects.run(token,"projects.manage",async(tx,a)=>{
   const p=await this.projects.guardCover(tx,a,projectRef,expected,true);
   const q=await tx.query("UPDATE project_public_eligibility SET revoked_at=now(),revoked_by=$3,revocation_reason=$4 WHERE root_realm_id=$1 AND project_id=$2 AND project_version=$5 AND revoked_at IS NULL RETURNING id",[a.realmId,p.id,a.accountId,reason,p.version]);
   if(!q.rowCount){const prior=await tx.query("SELECT 1 FROM project_public_eligibility WHERE root_realm_id=$1 AND project_id=$2 AND project_version=$3 AND revoked_at IS NOT NULL",[a.realmId,p.id,p.version]);if(!prior.rowCount)throw stale();}
   return {status:"WITHDRAWN"};
  });
 }
}
