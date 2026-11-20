import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService}
 from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthcareAssistanceReviewSourceFacade,
 type AssistancePolicySubmission}
 from "../../cg-17-healthcare-assistance-settlements/application/healthcare-assistance-review-source.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Original={id:string;realm_id:string;case_number:string;status:string;
 revision:number;proposer_id:string;request_key:string;request_digest:string;
 process_id:string;current_step:number;cg17_policy_revision_id:string;
 cg17_policy_version:number;cg17_policy_digest:string;
 account_name_snapshot:string};
type Review={
 requestKey:string;expectedRevision:number;action:"APPROVE"|"REJECT";
 remarks:string;currentPassword:string
};
function input(raw:unknown):Review{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"ASSISTANCE_REVIEW_INVALID"});
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["requestKey","expectedRevision","action",
   "remarks","currentPassword"].includes(k))||
   typeof v.requestKey!=="string"||!ID.test(v.requestKey)||
   typeof v.expectedRevision!=="number"||
   !Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<1||
   !["APPROVE","REJECT"].includes(String(v.action))||
   typeof v.currentPassword!=="string"||v.currentPassword.length<8||
   Buffer.byteLength(v.currentPassword,"utf8")>1024||
   (v.remarks!==undefined&&(typeof v.remarks!=="string"||
    v.remarks.length>500||/[\u0000-\u001f\u007f]/.test(v.remarks))))
  throw new BadRequestException({code:"ASSISTANCE_REVIEW_INVALID"});
 return {requestKey:v.requestKey,expectedRevision:v.expectedRevision,
  action:v.action as Review["action"],remarks:typeof v.remarks==="string"?
   v.remarks.trim():"",currentPassword:v.currentPassword};
}
/** Genuine original CG03 independent review and immutable decision. No
 * synthetic approvals, client-created decision proof or unrelated case types.
 */
@Injectable()
export class HealthcarePolicyApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:HealthcareAssistanceReviewSourceFacade){}
 private submission(c:Original):AssistancePolicySubmission{
  return {kind:"CG17_POLICY_EXCEPTION",policyRevisionRef:c.cg17_policy_revision_id,
   revisionNo:c.cg17_policy_version,digest:c.cg17_policy_digest,
   requestKey:c.request_key,centerRef:""};
 }
 async create(c:PoolClient,actor:VerifiedFoundationActor,
  submission:AssistancePolicySubmission){
  if(submission.kind!=="CG17_POLICY_EXCEPTION"||
   ![submission.policyRevisionRef,submission.centerRef,
     submission.requestKey].every(x=>ID.test(x))||
   !SHA.test(submission.digest)||!Number.isSafeInteger(submission.revisionNo)||
   submission.revisionNo<1)
   throw new BadRequestException({code:"ASSISTANCE_REVIEW_INVALID"});
  const proof=await this.source.original(c,actor,submission);
  if(proof.revision.actor_ref!==actor.accountId||
     proof.revision.request_key!==submission.requestKey)
   throw new ConflictException({code:"ASSISTANCE_REVIEW_SOURCE_CHANGED"});
  await this.protectedOwner.requireDistinctFinalReviewer(
   c,actor.realmId,actor.accountId);
  const root=await c.query("SELECT id FROM access_realm "+
   "WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!root.rowCount)
   throw new ForbiddenException({code:"ASSISTANCE_REVIEW_ROOT_REQUIRED"});
  const current=await c.query<{process_id:string}>(
   "SELECT process_id FROM cg03_health_process_current WHERE realm_id=$1 "+
   "AND case_kind='CG17_POLICY_EXCEPTION' FOR SHARE",[actor.realmId]);
  let process=current.rows[0]?.process_id;
  if(!process){
   const next=await c.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version "+
    "FROM cg03_process WHERE realm_id=$1",[actor.realmId]);
   const row=await c.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'CG17_POLICY_EXCEPTION') "+
    "RETURNING id",[actor.realmId,Number(next.rows[0].version),actor.accountId]);
   process=row.rows[0].id;
   await c.query("INSERT INTO cg03_process_step(process_id,ordinal,"+
    "capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[process]);
   await c.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,"+
    "process_id) VALUES($1,'CG17_POLICY_EXCEPTION',$2)",
    [actor.realmId,process]);
  }
  const requestDigest=hash(["CG03_POLICY_EXCEPTION_V1",submission]);
  const previous=await c.query<Original>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 "+
   "AND case_kind='CG17_POLICY_EXCEPTION' AND cg17_policy_revision_id=$2",
   [actor.realmId,submission.policyRevisionRef]);
  if(previous.rows[0]){
   const old=previous.rows[0];
   if(old.request_key!==submission.requestKey||
    old.request_digest!==requestDigest||old.proposer_id!==actor.accountId)
    throw new ConflictException({code:"ASSISTANCE_REVIEW_REQUEST_CONFLICT"});
   return {caseRef:old.id,reference:old.case_number,replayed:true};
  }
  const row=await c.query<Original>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,"+
   "role_name_snapshot,expected_access_version,expected_role_revision,"+
   "proposal_revision,proposal_digest,request_digest,request_key,case_kind,"+
   "cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Exceptional healthcare assistance',"+
   "NULL,NULL,$4,$5,$6,$7,'CG17_POLICY_EXCEPTION',$8,$9,$10 "+
   "FROM cg03_process p WHERE p.id=$11 RETURNING *",
   [actor.realmId,actor.accountId,
    (proof.centerName+" · 100% eligible consultation support").slice(0,160),
    submission.revisionNo,submission.digest,requestDigest,
    submission.requestKey,submission.policyRevisionRef,
    submission.revisionNo,submission.digest,process]);
  if(!row.rows[0])throw new ConflictException({code:"ASSISTANCE_REVIEW_UNAVAILABLE"});
  await c.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,row.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:row.rows[0].id,reference:row.rows[0].case_number,replayed:false};
 }
 private async reviewer(token:string){
  await this.sessions.requireAction(token,"healthcare.assistance.policies.review");
  return this.sessions.requireAction(token,"approvals.review");
 }
 async inbox(token:string){
  const actor=await this.reviewer(token);
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true);
   await this.identity.assertCurrent(c,actor,"healthcare.assistance.policies.review");
   const res=await c.query<Original>(
    "SELECT id,case_number,status,revision,account_name_snapshot,"+
    "cg17_policy_revision_id,cg17_policy_version,cg17_policy_digest "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='CG17_POLICY_EXCEPTION' "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 50",[actor.realmId]);
   await c.query("COMMIT");open=false;
   return {cases:res.rows.map(v=>({caseRef:v.id,reference:v.case_number,
    title:v.account_name_snapshot,status:v.status,revision:v.revision}))};
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{};throw e;}
  finally{c.release();}
 }
 async detail(token:string,ref:string){
  const actor=await this.reviewer(token);
  if(!ID.test(ref))throw new BadRequestException({code:"ASSISTANCE_REVIEW_INVALID"});
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true);
   await this.identity.assertCurrent(c,actor,"healthcare.assistance.policies.review");
   const q=await c.query<Original>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG17_POLICY_EXCEPTION'",[actor.realmId,ref]);
   const v=q.rows[0];
   if(!v)throw new NotFoundException({code:"ASSISTANCE_REVIEW_UNAVAILABLE"});
   const policy=await c.query<{center_ref:string;valid_from:Date;
    valid_until:Date;cap_minor:string;percent_basis_points:number;
    mode:string;approval_state:string}>(
    "SELECT center_ref,valid_from,valid_until,cap_minor::text,"+
    "percent_basis_points,mode,approval_state FROM healthcare_policy_revision "+
    "WHERE root_realm_id=$1 AND id=$2 AND revision_no=$3 "+
    "AND source_digest=$4",[actor.realmId,v.cg17_policy_revision_id,
     v.cg17_policy_version,v.cg17_policy_digest]);
   const original=policy.rows[0];
   if(!original)throw new ConflictException({code:"ASSISTANCE_REVIEW_CHANGED"});
   if(["SUBMITTED","IN_REVIEW","PENDING_OWNER"].includes(v.status))
    await this.source.original(c,actor,{kind:"CG17_POLICY_EXCEPTION",
     policyRevisionRef:v.cg17_policy_revision_id,
     revisionNo:v.cg17_policy_version,digest:v.cg17_policy_digest,
     requestKey:v.request_key,centerRef:original.center_ref});
   await c.query("COMMIT");open=false;
   return {caseRef:v.id,reference:v.case_number,status:v.status,
    revision:v.revision,title:v.account_name_snapshot,source:{
     policyRevisionRef:v.cg17_policy_revision_id,
     validFrom:original.valid_from,validUntil:original.valid_until,
     capMinor:original.cap_minor,percentBasisPoints:original.percent_basis_points,
     service:"CONSULTATION",mode:original.mode,
     state:original.approval_state},independentReviewerRequired:true};
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{};throw e;}
  finally{c.release();}
 }
 async decide(token:string,ref:string,raw:unknown){
  const actor=await this.reviewer(token),v=input(raw);
  if(!ID.test(ref))throw new BadRequestException({code:"ASSISTANCE_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const decisionDigest=hash([v.action,v.remarks,v.expectedRevision]);
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL lock_timeout='3s'");
   await this.protectedOwner.verifyReviewer(c,actor,"approvals.review",true);
   await this.identity.assertCurrent(c,actor,"healthcare.assistance.policies.review");
   const q=await c.query<Original>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG17_POLICY_EXCEPTION'",[actor.realmId,ref]);
   const orig=q.rows[0];
   if(!orig)throw new NotFoundException({code:"ASSISTANCE_REVIEW_UNAVAILABLE"});
   const prior=await c.query<{actor_id:string;request_digest:string;
    accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision "+
    "FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 "+
    "AND request_key=$3",[actor.realmId,ref,v.requestKey]);
   if(prior.rows[0]){
    if(prior.rows[0].actor_id!==actor.accountId||
       prior.rows[0].request_digest!==decisionDigest)
     throw new ConflictException({code:"ASSISTANCE_REVIEW_REQUEST_CONFLICT"});
    await c.query("COMMIT");open=false;
    return {caseRef:ref,status:"PREVIOUSLY_CONFIRMED",
     revision:prior.rows[0].accepted_case_revision,replayed:true};
   }
   const pol=await c.query<{center_ref:string}>(
    "SELECT center_ref FROM healthcare_policy_revision WHERE "+
    "root_realm_id=$1 AND id=$2",[actor.realmId,orig.cg17_policy_revision_id]);
   if(!pol.rows[0])throw new ConflictException({code:"ASSISTANCE_REVIEW_CHANGED"});
   await this.source.original(c,actor,{kind:"CG17_POLICY_EXCEPTION",
    policyRevisionRef:orig.cg17_policy_revision_id,
    revisionNo:orig.cg17_policy_version,digest:orig.cg17_policy_digest,
    requestKey:orig.request_key,centerRef:pol.rows[0].center_ref});
   const lock=await c.query<Original>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG17_POLICY_EXCEPTION' FOR UPDATE",[actor.realmId,ref]);
   const now=lock.rows[0];
   if(!now||now.cg17_policy_revision_id!==orig.cg17_policy_revision_id||
    now.cg17_policy_digest!==orig.cg17_policy_digest||
    !["SUBMITTED","IN_REVIEW"].includes(now.status)||
    now.revision!==v.expectedRevision)
    throw new ConflictException({code:"ASSISTANCE_REVIEW_CHANGED"});
   if(now.proposer_id===actor.accountId)
    throw new ForbiddenException({code:"ASSISTANCE_INDEPENDENT_REVIEW_REQUIRED"});
   const step=await c.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
    "AND ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",
    [now.process_id,now.current_step]);
   if(!step.rowCount)throw new ConflictException({code:"ASSISTANCE_REVIEW_CHANGED"});
   await this.sessions.requireFreshFoundationRootProof(c,actor,v.currentPassword);
   const next=v.action==="APPROVE"?"PENDING_OWNER":"REJECTED";
   await c.query("UPDATE cg03_case SET status=$3,revision=revision+1,"+
    "updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",
    [actor.realmId,ref,next,now.revision]);
   const decision=await c.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
    "step_ordinal,expected_case_revision,accepted_case_revision,"+
    "request_key,request_digest,safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,ref,actor.accountId,v.action,now.revision,
     now.revision+1,v.requestKey,decisionDigest,v.remarks]);
   await c.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
    "action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,ref,actor.accountId,
     v.action==="APPROVE"?"FINAL_APPROVED":"REJECTED",randomUUID()]);
   if(v.action==="REJECT"){
    await c.query("UPDATE healthcare_policy_revision "+
     "SET approval_state='REJECTED',changed_by=$3,changed_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND approval_state='PENDING_APPROVAL'",
     [actor.realmId,now.cg17_policy_revision_id,actor.accountId]);
   }
   await c.query("COMMIT");open=false;
   return {caseRef:ref,status:next,revision:now.revision+1,
    decisionRef:v.action==="APPROVE"?decision.rows[0].id:null,replayed:false};
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{};throw e;}
  finally{c.release();}
 }
 async approved(c:PoolClient,actor:VerifiedFoundationActor,
  submission:AssistancePolicySubmission&{caseRef:string}){
  const q=await c.query<{id:string}>(
   "SELECT d.id FROM cg03_case review JOIN cg03_case_decision d "+
   "ON d.realm_id=review.realm_id AND d.case_id=review.id "+
   "WHERE review.realm_id=$1 AND review.id=$2 AND "+
   "review.case_kind='CG17_POLICY_EXCEPTION' AND "+
   "review.cg17_policy_revision_id=$3 AND review.cg17_policy_version=$4 "+
   "AND review.cg17_policy_digest=$5 AND review.status='PENDING_OWNER' "+
   "AND d.action='APPROVE' AND d.actor_id<>review.proposer_id "+
   "AND d.fresh_password_verified_at IS NOT NULL "+
   "AND d.accepted_case_revision=review.revision "+
   "AND EXISTS(SELECT 1 FROM account reviewer "+
   "JOIN account_role ar ON ar.account_id=reviewer.id "+
   "AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL "+
   "JOIN role current_role ON current_role.id=ar.role_id "+
   "AND current_role.realm_id=ar.realm_id "+
   "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id "+
   "AND reviewer.status='ACTIVE' AND current_role.active "+
   "AND current_role.is_protected) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF review,d",
   [actor.realmId,submission.caseRef,submission.policyRevisionRef,
    submission.revisionNo,submission.digest]);
  if(!q.rows[0])throw new ConflictException({code:"ASSISTANCE_APPROVAL_NOT_VERIFIED"});
  return q.rows[0].id;
 }
 async finish(c:PoolClient,actor:VerifiedFoundationActor,ref:string){
  const q=await c.query("UPDATE cg03_case "+
   "SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() "+
   "WHERE realm_id=$1 AND id=$2 AND case_kind='CG17_POLICY_EXCEPTION' "+
   "AND status='PENDING_OWNER' RETURNING id",[actor.realmId,ref]);
  if(!q.rowCount)throw new ConflictException({code:"ASSISTANCE_APPROVAL_CHANGED"});
  await c.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,ref,actor.accountId,randomUUID()]);
 }
}
