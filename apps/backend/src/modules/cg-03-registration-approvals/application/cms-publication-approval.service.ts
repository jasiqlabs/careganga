import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {CmsReviewSourceFacade} from "../../cg-18-cms-public-content/application/cms-review-source.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
type CaseRow={id:string;realm_id:string;case_number:string;proposer_id:string;
 cms_page_id:string;cms_page_revision_id:string;cms_revision_no:number;
 cms_content_digest:string;process_id:string;current_step:number;status:string;revision:number;
 request_key:string;request_digest:string};
type DecisionBody={requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";
 remarks:string;currentPassword:string};
function parse(value:unknown):DecisionBody{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["requestKey","expectedRevision","action","remarks","currentPassword"].includes(k))||
  typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
  !Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<1||
  !["APPROVE","RETURN","REJECT"].includes(String(v.action))||
  typeof v.currentPassword!=="string"||v.currentPassword.length<8||
  Buffer.byteLength(v.currentPassword,"utf8")>1024||
  (v.remarks!==undefined&&(typeof v.remarks!=="string"||v.remarks.length>500)))
  throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
 const remarks=typeof v.remarks==="string"?v.remarks.trim():"";
 if(/[\u0000-\u001f\u007f]/.test(remarks))
  throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
 return {requestKey:v.requestKey,expectedRevision:Number(v.expectedRevision),
  action:v.action as DecisionBody["action"],remarks,currentPassword:v.currentPassword};
}
@Injectable()
export class CmsPublicationApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:CmsReviewSourceFacade){}
 /** CG03-owned submission. Called inside the CMS revision freeze transaction.
  * One fixed process is provisioned when first genuinely needed, no extra
  * configuration wizard or new approval engine.
  */
 async createCase(tx:PoolClient,actor:VerifiedFoundationActor,source:{
  pageRef:string;revisionRef:string;revisionNo:number;digest:string;requestKey:string
 }){
  if(!UUID.test(source.requestKey)||!DIGEST.test(source.digest))
   throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
  await this.source.original(tx,actor,source.pageRef,source.revisionRef,
   source.revisionNo,source.digest);
// A currently authorized editor may submit a revision. The proposal binds the
  // actual submitting actor; the reviewer must be a distinct current account.
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const lockedRoot=await tx.query("SELECT id FROM access_realm WHERE id=$1 "+
   "AND realm_key=\'FOUNDATION_ROOT\' FOR UPDATE",[actor.realmId]);
  if(!lockedRoot.rowCount)throw new ForbiddenException("Foundation access unavailable");
  const current=await tx.query<{process_id:string}>(
   "SELECT process_id FROM cg03_cms_process_current WHERE realm_id=$1 FOR SHARE",
   [actor.realmId]);
  let processRef=current.rows[0]?.process_id;
  if(!processRef){
   const next=await tx.query<{v:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS v FROM cg03_process WHERE realm_id=$1",
    [actor.realmId]);
   const process=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'CMS_PUBLICATION') RETURNING id",
    [actor.realmId,next.rows[0].v,actor.accountId]);
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
    "protected_root_required) VALUES($1,1,'approvals.review',true)",[process.rows[0].id]);
   await tx.query("INSERT INTO cg03_cms_process_current(realm_id,process_id) VALUES($1,$2)",
    [actor.realmId,process.rows[0].id]);
   processRef=process.rows[0].id;
  }
  const prior=await tx.query<CaseRow>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='CMS_PUBLICATION' "+
   "AND cms_page_id=$2 AND cms_revision_no=$3 FOR SHARE",
   [actor.realmId,source.pageRef,source.revisionNo]);
  const requestDigest=hash(["CMS_PUBLICATION_V1",source.pageRef,source.revisionRef,
   source.revisionNo,source.digest,source.requestKey]);
  if(prior.rows[0]){
   if(prior.rows[0].proposer_id!==actor.accountId||
      prior.rows[0].request_key!==source.requestKey||
      prior.rows[0].request_digest!==requestDigest)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   return {caseRef:prior.rows[0].id,caseNumber:prior.rows[0].case_number,replayed:true};
  }
  const caseRow=await tx.query<CaseRow>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,cms_page_id,cms_page_revision_id,"+
   "cms_revision_no,cms_content_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Website page',NULL,NULL,$4,$5,$6,$7,"+
   "'CMS_PUBLICATION',$8,$9,$10,$11 FROM cg03_process p WHERE p.id=$12 RETURNING *",
   [actor.realmId,actor.accountId,frozen.title.slice(0,160),source.revisionNo,
    source.digest,requestDigest,source.requestKey,source.pageRef,source.revisionRef,
    source.revisionNo,source.digest,processRef]);
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,caseRow.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:caseRow.rows[0].id,caseNumber:caseRow.rows[0].case_number,
   replayed:false};
 }
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"cms.content.view");
  return actor;
 }
 async inbox(bearer:string,offsetInput?:string){
  const actor=await this.reviewer(bearer);
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<{caseRef:string;number:string;title:string;status:string;
    revision:number}>(
    'SELECT id AS "caseRef",case_number AS number,account_name_snapshot AS title,'+
    "status,revision FROM cg03_case WHERE realm_id=$1 AND case_kind='CMS_PUBLICATION' "+
    "AND status IN('SUBMITTED','IN_REVIEW','RETURNED','PENDING_OWNER','OWNER_COMPLETED') "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 41 OFFSET $2",
    [actor.realmId,Number(offsetInput??"0")]);
   await tx.query("COMMIT");
   return {cases:rows.rows.slice(0,40),
    nextOffset:rows.rows.length>40?Number(offsetInput??"0")+40:null};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async detail(bearer:string,ref:string){
  const actor=await this.reviewer(bearer);
  if(!UUID.test(ref))throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const row=await tx.query<CaseRow>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='CMS_PUBLICATION' FOR SHARE",[ref,actor.realmId]);
   const c=row.rows[0];if(!c)throw new NotFoundException({code:"CMS_REVIEW_UNAVAILABLE"});
   const source=await this.source.reviewSnapshot(actor.realmId,c.cms_page_id,
    c.cms_page_revision_id,c.id);
   await tx.query("COMMIT");
   return {caseNumber:c.case_number,caseRef:c.id,status:c.status,
    revision:c.revision,source};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async decide(bearer:string,ref:string,value:unknown){
  const actor=await this.reviewer(bearer),request=parse(value);
  if(!UUID.test(ref))throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
  const requestDigest=hash([request.action,request.remarks,request.expectedRevision]);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"approvals.review");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const row=await tx.query<CaseRow>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='CMS_PUBLICATION' FOR UPDATE",[ref,actor.realmId]);
   const c=row.rows[0];if(!c)throw new NotFoundException({code:"CMS_REVIEW_UNAVAILABLE"});
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("A different authorized reviewer must decide");
   const prior=await tx.query<{actor_id:string;request_digest:string;
    accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE case_id=$1 AND request_key=$2 FOR SHARE",[ref,request.requestKey]);
   if(prior.rows[0]){
    if(prior.rows[0].actor_id!==actor.accountId||prior.rows[0].request_digest!==requestDigest)
     throw new ConflictException({code:"CMS_REVIEW_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:"PREVIOUSLY_CONFIRMED",replayed:true,
     caseRef:ref,revision:prior.rows[0].accepted_case_revision};
   }
   if(c.revision!==request.expectedRevision||!["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"CMS_REVIEW_CONFLICT"});
   const rev=await tx.query(
    "SELECT id FROM cms_page_revision WHERE foundation_root_id=$1 AND "+
    "page_id=$2 AND id=$3 AND revision_no=$4 AND content_digest=$5 "+
    "AND approval_case_ref=$6 AND status='SUBMITTED' FOR SHARE",
    [actor.realmId,c.cms_page_id,c.cms_page_revision_id,c.cms_revision_no,
     c.cms_content_digest,c.id]);
   if(!rev.rowCount)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
    "AND ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",
    [c.process_id,c.current_step]);
   if(!step.rowCount)throw new ConflictException({code:"CMS_REVIEW_UNAVAILABLE"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,request.currentPassword);
   const next=request.action==="APPROVE"?"PENDING_OWNER":
    request.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND revision=$4",
    [ref,actor.realmId,next,c.revision]);
   const decision=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,"+
    "expected_case_revision,accepted_case_revision,request_key,request_digest,"+
    "safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,ref,actor.accountId,request.action,c.revision,c.revision+1,
     request.requestKey,requestDigest,request.remarks]);
   await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,ref,actor.accountId,
     request.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   await tx.query("COMMIT");
   return {confirmed:true,status:next,caseRef:ref,
    decisionRef:request.action==="APPROVE"?decision.rows[0].id:undefined,
    revision:c.revision+1,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** Only CG03 final decision can unlock a source revision for publication. */
 async approved(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  caseRef:string;pageRef:string;revisionRef:string;revisionNo:number;digest:string
 }){
  if(!UUID.test(input.caseRef))throw new BadRequestException({code:"CMS_REVIEW_INVALID"});
  const outcome=await tx.query<{id:string;reviewer_id:string}>(
   "SELECT d.id,d.actor_id AS reviewer_id FROM cg03_case c "+
   "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
   "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='CMS_PUBLICATION' "+
   "AND c.cms_page_id=$3 AND c.cms_page_revision_id=$4 AND c.cms_revision_no=$5 "+
   "AND c.cms_content_digest=$6 AND c.status IN('PENDING_OWNER','OWNER_COMPLETED') "+
   "AND c.proposer_id<>d.actor_id AND d.action='APPROVE' "+
   "AND d.fresh_password_verified_at IS NOT NULL "+
   "AND EXISTS(SELECT 1 FROM account reviewer "+
   "JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id "+
   "AND ar.revoked_at IS NULL "+
   "JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=reviewer.realm_id "+
   "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=c.realm_id "+
   "AND reviewer.status=\'ACTIVE\' AND rr.active=true AND rr.is_protected=true) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
   [input.caseRef,actor.realmId,input.pageRef,input.revisionRef,
    input.revisionNo,input.digest]);
  if(!outcome.rows[0])throw new ConflictException({code:"CMS_REVIEW_UNAVAILABLE"});
  return {decisionRef:outcome.rows[0].id,reviewedBy:outcome.rows[0].reviewer_id};
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const changed=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE id=$1 AND realm_id=$2 AND case_kind='CMS_PUBLICATION' "+
   "AND status='PENDING_OWNER' RETURNING id",[caseRef,actor.realmId]);
  if(changed.rowCount)await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
