import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterContentReviewSourceFacade,type CenterContentSubmission}
 from "../../cg-14-healthcare-network/application/health-center-content-review-source.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Case={id:string;case_number:string;status:string;revision:number;request_key:string;
 request_digest:string;proposer_id:string;health_provider_id:string;health_center_id:string;
 health_content_revision_id:string;health_revision_no:number;health_source_digest:string;
 process_id:string;current_step:number;account_name_snapshot:string};
function decision(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body))
  throw new BadRequestException({code:"HEALTH_CONTENT_REVIEW_INVALID"});
 const x=body as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action","remarks",
  "currentPassword"].includes(k))||!ID.test(String(x.requestKey))||
   !Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1||
   !["APPROVE","RETURN","REJECT"].includes(String(x.action))||
   typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword,"utf8")>1024||
   (x.remarks!==undefined&&(typeof x.remarks!=="string"||
    x.remarks.length>500||/[\u0000-\u001f\u007f]/.test(x.remarks))))
  throw new BadRequestException({code:"HEALTH_CONTENT_REVIEW_INVALID"});
 return {requestKey:String(x.requestKey),expectedRevision:Number(x.expectedRevision),
  action:String(x.action) as "APPROVE"|"RETURN"|"REJECT",
  remarks:typeof x.remarks==="string"?x.remarks.trim():"",
  currentPassword:x.currentPassword};
}
/** CG-03 is the one reviewer/decision/approval owner for CG-14 content. */
@Injectable()
export class HealthCenterContentApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:HealthCenterContentReviewSourceFacade){}
 async create(tx:PoolClient,actor:VerifiedFoundationActor,input:CenterContentSubmission){
  if(input.kind!=="HEALTH_CENTER_CONTENT_REVIEW"||!ID.test(input.providerRef)||
    !ID.test(input.centerRef)||!ID.test(input.revisionRef)||
    !ID.test(input.requestKey)||!Number.isSafeInteger(input.revisionNo)||
    input.revisionNo<1||!/^[a-f0-9]{64}$/.test(input.digest))
   throw new BadRequestException({code:"HEALTH_CONTENT_REVIEW_INVALID"});
  const original=await this.source.original(tx,actor,input);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const root=await tx.query("SELECT id FROM access_realm "+
    "WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!root.rowCount)throw new ForbiddenException("Foundation approval unavailable");
  const current=await tx.query<{process_id:string}>(
   "SELECT process_id FROM cg03_health_process_current WHERE realm_id=$1 "+
   "AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' FOR SHARE",[actor.realmId]);
  let process=current.rows[0]?.process_id;
  if(!process){
   const next=await tx.query<{v:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS v FROM cg03_process WHERE realm_id=$1",
    [actor.realmId]);
   const added=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'HEALTH_CENTER_CONTENT_REVIEW') "+
    "RETURNING id",[actor.realmId,next.rows[0].v,actor.accountId]);
   await tx.query(
    "INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
    "protected_root_required) VALUES($1,1,'approvals.review',true)",
    [added.rows[0].id]);
   await tx.query(
    "INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
    "VALUES($1,'HEALTH_CENTER_CONTENT_REVIEW',$2)",
    [actor.realmId,added.rows[0].id]);
   process=added.rows[0].id;
  }
  const digest=sha(["CG03_CENTER_CONTENT_V1",input]);
  const previous=await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 "+
   "AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' AND health_center_id=$2 "+
   "AND health_revision_no=$3 FOR SHARE",
   [actor.realmId,input.centerRef,input.revisionNo]);
  if(previous.rows[0]){
   const p=previous.rows[0];
   if(p.proposer_id!==actor.accountId||p.request_key!==input.requestKey||
    p.request_digest!==digest)
    throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
   return {caseRef:p.id,reference:p.case_number,replayed:true};
  }
  const caseRow=await tx.query<Case>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,health_provider_id,health_center_id,"+
   "health_content_revision_id,health_revision_no,health_source_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Center content review',NULL,NULL,$4,$5,"+
   "$6,$7,'HEALTH_CENTER_CONTENT_REVIEW',$8,$9,$10,$11,$12 "+
   "FROM cg03_process p WHERE p.id=$13 RETURNING *",
   [actor.realmId,actor.accountId,original.title,input.revisionNo,input.digest,
    digest,input.requestKey,input.providerRef,input.centerRef,input.revisionRef,
    input.revisionNo,input.digest,process]);
  if(!caseRow.rows[0])
   throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,caseRow.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:caseRow.rows[0].id,reference:caseRow.rows[0].case_number,replayed:false};
 }
 private submission(c:Case):CenterContentSubmission{
  return {kind:"HEALTH_CENTER_CONTENT_REVIEW",providerRef:c.health_provider_id,
   centerRef:c.health_center_id,revisionRef:c.health_content_revision_id,
   revisionNo:c.health_revision_no,digest:c.health_source_digest,
   requestKey:c.request_key};
 }
 private async reviewer(bearer:string){
  await this.sessions.requireAction(bearer,"health.providers.verify");
  return this.sessions.requireAction(bearer,"approvals.review");
 }
 async inbox(bearer:string){
  const actor=await this.reviewer(bearer);
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<Case>(
    "SELECT id,case_number,status,revision,account_name_snapshot "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 50",[actor.realmId]);
   await tx.query("COMMIT");active=false;
   return {cases:rows.rows.map(c=>({caseRef:c.id,reference:c.case_number,
    title:c.account_name_snapshot,status:c.status,revision:c.revision}))};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async detail(bearer:string,caseRef:string){
  const actor=await this.reviewer(bearer);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_CONTENT_REVIEW_INVALID"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const found=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' FOR SHARE",
    [actor.realmId,caseRef]);
   const c=found.rows[0];
   if(!c)throw new NotFoundException("This center content review is unavailable");
   let content:Record<string,unknown>|null=null;
   if(["SUBMITTED","IN_REVIEW"].includes(c.status))
    content=(await this.source.original(tx,actor,this.submission(c))).source;
   await tx.query("COMMIT");active=false;
   return {caseRef:c.id,reference:c.case_number,centerRef:c.health_center_id,
    title:c.account_name_snapshot,status:c.status,revision:c.revision,
    content,requiresIndependentReviewer:true};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async decide(bearer:string,caseRef:string,body:unknown){
  const actor=await this.reviewer(bearer),input=decision(body);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_CONTENT_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const digest=sha([input.action,input.remarks,input.expectedRevision]);
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const found=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' FOR UPDATE",
    [actor.realmId,caseRef]);
   const c=found.rows[0];
   if(!c)throw new NotFoundException("Content review unavailable");
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("A different Foundation reviewer must approve this content");
   const old=await tx.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE case_id=$1 AND request_key=$2 FOR SHARE",[caseRef,input.requestKey]);
   if(old.rows[0]){
    if(old.rows[0].actor_id!==actor.accountId||old.rows[0].request_digest!==digest)
     throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
    await tx.query("COMMIT");active=false;
    return {caseRef,status:"PREVIOUSLY_CONFIRMED",
     revision:old.rows[0].accepted_case_revision,replayed:true};
   }
   if(c.revision!==input.expectedRevision||
     !["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
   await this.source.original(tx,actor,this.submission(c));
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
    "AND ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step]);
   if(!step.rowCount)
    throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
   const next=input.action==="APPROVE"?"PENDING_OWNER":
    input.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query(
    "UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND revision=$4",
    [caseRef,actor.realmId,next,c.revision]);
   const decision=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
    "step_ordinal,expected_case_revision,accepted_case_revision,request_key,"+
    "request_digest,safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,caseRef,actor.accountId,input.action,c.revision,c.revision+1,
     input.requestKey,digest,input.remarks]);
   await tx.query(
    "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,caseRef,actor.accountId,
     input.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   await tx.query("COMMIT");active=false;
   return {caseRef,status:next,revision:c.revision+1,
    decisionRef:input.action==="APPROVE"?decision.rows[0].id:undefined,replayed:false};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async approved(tx:PoolClient,actor:VerifiedFoundationActor,input:CenterContentSubmission&{caseRef:string}){
  const found=await tx.query<{decision_ref:string}>(
   "SELECT d.id AS decision_ref FROM cg03_case c "+
   "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
   "AND c.health_provider_id=$3 AND c.health_center_id=$4 "+
   "AND c.health_content_revision_id=$5 AND c.health_revision_no=$6 "+
   "AND c.health_source_digest=$7 AND c.status IN('PENDING_OWNER','OWNER_COMPLETED') "+
   "AND d.action='APPROVE' AND d.actor_id<>c.proposer_id "+
   "AND d.fresh_password_verified_at IS NOT NULL "+
   "AND EXISTS(SELECT 1 FROM account reviewer "+
   "JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id "+
   "AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id "+
   "AND r.realm_id=reviewer.realm_id "+
   "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=c.realm_id "+
   "AND reviewer.status='ACTIVE' AND r.active=true AND r.is_protected=true) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
   [actor.realmId,input.caseRef,input.providerRef,input.centerRef,
    input.revisionRef,input.revisionNo,input.digest]);
  if(!found.rows[0])throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
  return found.rows[0].decision_ref;
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const result=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='HEALTH_CENTER_CONTENT_REVIEW' AND status='PENDING_OWNER' RETURNING id",
   [actor.realmId,caseRef]);
  if(!result.rowCount)throw new ConflictException({code:"HEALTH_CONTENT_REVIEW_CONFLICT"});
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
