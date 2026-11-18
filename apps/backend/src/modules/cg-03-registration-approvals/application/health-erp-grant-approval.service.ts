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
import {HealthErpGrantReviewSourceFacade,type GrantSubmission}
 from "../../cg-14-healthcare-network/application/health-erp-grant-review-source.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Original={
 id:string;case_number:string;status:string;revision:number;request_key:string;
 request_digest:string;proposer_id:string;health_provider_id:string;
 health_center_id:string;health_erp_revision_id:string;health_revision_no:number;
 health_source_digest:string;process_id:string;current_step:number;
 account_name_snapshot:string
};
function parseDecision(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action",
   "remarks","currentPassword"].includes(k))||
  !ID.test(String(x.requestKey))||!Number.isSafeInteger(x.expectedRevision)||
  Number(x.expectedRevision)<1||
  !["APPROVE","RETURN","REJECT"].includes(String(x.action))||
  typeof x.currentPassword!=="string"||x.currentPassword.length<8||
  Buffer.byteLength(x.currentPassword,"utf8")>1024||
  (x.remarks!==undefined&&(typeof x.remarks!=="string"||
    x.remarks.length>500||/[\u0000-\u001f\u007f]/.test(x.remarks))))
  throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
 return {requestKey:String(x.requestKey),expectedRevision:Number(x.expectedRevision),
  action:String(x.action) as "APPROVE"|"RETURN"|"REJECT",
  remarks:typeof x.remarks==="string"?x.remarks.trim():"",
  currentPassword:x.currentPassword};
}
/** The ORIGINAL protected CG-03 reviewer, case and decision for one frozen
 * center ERP permission request. No extra CG-14 approval table is created. */
@Injectable()
export class HealthErpGrantApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:HealthErpGrantReviewSourceFacade){}
 async create(tx:PoolClient,actor:VerifiedFoundationActor,input:GrantSubmission){
  if(input.kind!=="HEALTH_CENTER_ERP_GRANT"||
    ![input.providerRef,input.centerRef,input.revisionRef,input.requestKey].every(ID.test.bind(ID))||
    !Number.isSafeInteger(input.revisionNo)||input.revisionNo<1||
    !/^[a-f0-9]{64}$/.test(input.digest))
   throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  const proof=await this.source.original(tx,actor,input);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const root=await tx.query("SELECT id FROM access_realm "+
   "WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!root.rowCount)throw new ForbiddenException("Foundation grant review unavailable");
  const current=await tx.query<{process_id:string}>(
   "SELECT process_id FROM cg03_health_process_current WHERE realm_id=$1 "+
   "AND case_kind='HEALTH_CENTER_ERP_GRANT' FOR SHARE",[actor.realmId]);
  let process=current.rows[0]?.process_id;
  if(!process){
   const next=await tx.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version FROM cg03_process "+
    "WHERE realm_id=$1",[actor.realmId]);
   const row=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'HEALTH_CENTER_ERP_GRANT') "+
    "RETURNING id",[actor.realmId,Number(next.rows[0].version),actor.accountId]);
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
    "protected_root_required) VALUES($1,1,'approvals.review',true)",
    [row.rows[0].id]);
   await tx.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
    "VALUES($1,'HEALTH_CENTER_ERP_GRANT',$2)",[actor.realmId,row.rows[0].id]);
   process=row.rows[0].id;
  }
  const digest=sha(["CG03_ERP_GRANT_V1",input]);
  const previous=await tx.query<Original>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 "+
   "AND case_kind='HEALTH_CENTER_ERP_GRANT' "+
   "AND health_erp_revision_id=$2 FOR SHARE",
   [actor.realmId,input.revisionRef]);
  if(previous.rows[0]){
   const c=previous.rows[0];
   if(c.proposer_id!==actor.accountId||c.request_key!==input.requestKey||
      c.request_digest!==digest)
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   return {caseRef:c.id,reference:c.case_number,replayed:true};
  }
  const result=await tx.query<Original>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,health_provider_id,health_center_id,"+
   "health_erp_revision_id,health_revision_no,health_source_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Center optional capability',NULL,NULL,"+
   "$4,$5,$6,$7,'HEALTH_CENTER_ERP_GRANT',$8,$9,$10,$11,$12 "+
   "FROM cg03_process p WHERE p.id=$13 RETURNING *",
   [actor.realmId,actor.accountId,proof.centerName+" · "+proof.capability,
    input.revisionNo,input.digest,digest,input.requestKey,input.providerRef,
    input.centerRef,input.revisionRef,input.revisionNo,input.digest,process]);
  if(!result.rows[0])
   throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,result.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:result.rows[0].id,reference:result.rows[0].case_number,replayed:false};
 }
 private submission(c:Original):GrantSubmission{
  return {kind:"HEALTH_CENTER_ERP_GRANT",providerRef:c.health_provider_id,
   centerRef:c.health_center_id,revisionRef:c.health_erp_revision_id,
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
   const rows=await tx.query<Original>(
    "SELECT id,case_number,status,revision,account_name_snapshot "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='HEALTH_CENTER_ERP_GRANT' "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 50",[actor.realmId]);
   await tx.query("COMMIT");active=false;
   return {cases:rows.rows.map(c=>({caseRef:c.id,reference:c.case_number,
    title:c.account_name_snapshot,status:c.status,revision:c.revision}))};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async detail(bearer:string,caseRef:string){
  const actor=await this.reviewer(bearer);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<Original>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='HEALTH_CENTER_ERP_GRANT' FOR SHARE",
    [actor.realmId,caseRef]);
   const c=rows.rows[0];
   if(!c)throw new NotFoundException("Original center capability review unavailable");
   const proof=["SUBMITTED","IN_REVIEW","PENDING_OWNER"].includes(c.status)?
    await this.source.original(tx,actor,this.submission(c)):null;
   await tx.query("COMMIT");active=false;
   return {caseRef:c.id,reference:c.case_number,status:c.status,
    revision:c.revision,title:c.account_name_snapshot,
    ...(proof?{capability:proof.capability,centerName:proof.centerName,
     validFrom:proof.validFrom,validUntil:proof.validUntil}:{}),
    independentReviewerRequired:true};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async decide(bearer:string,caseRef:string,raw:unknown){
  const actor=await this.reviewer(bearer),input=parseDecision(raw);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_ERP_GRANT_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const digest=sha([input.action,input.remarks,input.expectedRevision]);
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<Original>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='HEALTH_CENTER_ERP_GRANT' FOR UPDATE",
    [actor.realmId,caseRef]);
   const c=rows.rows[0];
   if(!c)throw new NotFoundException("Original center capability review unavailable");
   await this.identity.assertCurrent(tx,actor,"health.providers.verify");
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("A different Foundation reviewer is required");
   const old=await tx.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE case_id=$1 AND request_key=$2 FOR SHARE",[caseRef,input.requestKey]);
   if(old.rows[0]){
    if(old.rows[0].actor_id!==actor.accountId||old.rows[0].request_digest!==digest)
     throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
    await tx.query("COMMIT");active=false;
    return {caseRef,status:"PREVIOUSLY_CONFIRMED",
     revision:old.rows[0].accepted_case_revision,replayed:true};
   }
   if(c.revision!==input.expectedRevision||
     !["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   await this.source.original(tx,actor,this.submission(c));
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 AND "+
    "ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",
    [c.process_id,c.current_step]);
   if(!step.rowCount)throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
   const next=input.action==="APPROVE"?"PENDING_OWNER":
    input.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,"+
    "updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",
    [actor.realmId,caseRef,next,c.revision]);
   const result=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
    "step_ordinal,expected_case_revision,accepted_case_revision,request_key,"+
    "request_digest,safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,caseRef,actor.accountId,input.action,c.revision,c.revision+1,
     input.requestKey,digest,input.remarks]);
   await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,caseRef,actor.accountId,
     input.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   await tx.query("COMMIT");active=false;
   return {caseRef,status:next,revision:c.revision+1,
    decisionRef:input.action==="APPROVE"?result.rows[0].id:undefined,replayed:false};
  }catch(e){if(active)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async approved(tx:PoolClient,actor:VerifiedFoundationActor,
  input:GrantSubmission&{caseRef:string}){
  const match=await tx.query<{decision_ref:string}>(
   "SELECT d.id AS decision_ref FROM cg03_case c "+
   "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='HEALTH_CENTER_ERP_GRANT' "+
   "AND c.health_provider_id=$3 AND c.health_center_id=$4 "+
   "AND c.health_erp_revision_id=$5 AND c.health_revision_no=$6 "+
   "AND c.health_source_digest=$7 AND c.status='PENDING_OWNER' "+
   "AND d.action='APPROVE' AND d.actor_id<>c.proposer_id "+
   "AND d.fresh_password_verified_at IS NOT NULL "+
   "AND EXISTS(SELECT 1 FROM account reviewer "+
   "JOIN account_role ar ON ar.account_id=reviewer.id "+
   "AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL "+
   "JOIN role r ON r.id=ar.role_id AND r.realm_id=reviewer.realm_id "+
   "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=c.realm_id "+
   "AND reviewer.status='ACTIVE' AND r.active AND r.is_protected) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
   [actor.realmId,input.caseRef,input.providerRef,input.centerRef,
    input.revisionRef,input.revisionNo,input.digest]);
  if(!match.rows[0])
   throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
  return match.rows[0].decision_ref;
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const done=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='HEALTH_CENTER_ERP_GRANT' AND status='PENDING_OWNER' RETURNING id",
   [actor.realmId,caseRef]);
  if(!done.rowCount)throw new ConflictException({code:"HEALTH_ERP_GRANT_CHANGED"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
