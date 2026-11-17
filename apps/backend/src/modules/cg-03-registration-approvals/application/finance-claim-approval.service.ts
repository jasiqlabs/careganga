import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceExpenseClaimSourceFacade} from "../../cg-09-finance-accounting/application/finance-expense-claim-source.facade";
import {FinanceClaimBillSourceFacade} from "../../cg-19-documents-notifications/application/finance-claim-bill-source.facade";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
 return v;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const number=(v:unknown):number=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"FINANCE_CLAIM_STALE",field:"expectedRevision"});
 return Number(v);
};
type Case={id:string;realm_id:string;proposer_id:string;case_number:string;
 finance_claim_id:string;finance_claim_revision:number;finance_claim_digest:string;
 finance_claim_bill_id:string;finance_claim_bill_version:number;
 process_id:string;process_version:number;current_step:number;
 status:string;revision:number;request_key:string;request_digest:string};
type Decision={action:"APPROVE"|"RETURN"|"REJECT";requestKey:string;expectedRevision:number;
 currentPassword:string;remarks:string};
function decision(value:unknown):Decision{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"FINANCE_CLAIM_REVIEW_INVALID"});
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["action","requestKey","expectedRevision","currentPassword","remarks"].includes(k))||
    !["APPROVE","RETURN","REJECT"].includes(String(x.action))||
    !UUID.test(String(x.requestKey))||!Number.isSafeInteger(x.expectedRevision)||
    Number(x.expectedRevision)<1||typeof x.currentPassword!=="string"||
    x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024||
    (x.remarks!==undefined&&(typeof x.remarks!=="string"||x.remarks.length>500)))
  throw new BadRequestException({code:"FINANCE_CLAIM_REVIEW_INVALID"});
 return {action:x.action as Decision["action"],requestKey:String(x.requestKey),
  expectedRevision:number(x.expectedRevision),currentPassword:x.currentPassword,
  remarks:typeof x.remarks==="string"?x.remarks.trim():""};
}
@Injectable()
export class FinanceClaimApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:FinanceExpenseClaimSourceFacade,
  private readonly evidence:FinanceClaimBillSourceFacade){}
 async processStatus(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const found=await this.db.query<{id:string}>(
   "SELECT process_id AS id FROM cg03_claim_process_current WHERE realm_id=$1",
   [actor.realmId]);
  return {configured:!!found.rows[0],status:found.rows[0]?"AVAILABLE":"NOT_CONFIGURED"};
 }
 async initialize(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
  await this.sessions.requireAction(bearer,"finance.claims.review");
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).some(k=>k!=="currentPassword")||
     typeof (input as Record<string,unknown>).currentPassword!=="string")
   throw new BadRequestException({code:"FINANCE_CLAIM_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"approvals.process.manage");
   const root=await tx.query(
    "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation account required");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,actor,
    (input as {currentPassword:string}).currentPassword);
   const found=await tx.query<{process_id:string}>(
    "SELECT process_id FROM cg03_claim_process_current WHERE realm_id=$1",
    [actor.realmId]);
   if(found.rows[0]){await tx.query("COMMIT");return {configured:true,status:"AVAILABLE"};}
   const v=await tx.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version FROM cg03_process WHERE realm_id=$1",
    [actor.realmId]);
   const row=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'FINANCE_REIMBURSEMENT') RETURNING id",
    [actor.realmId,v.rows[0].version,actor.accountId]);
   await tx.query(
    "INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[row.rows[0].id]);
   await tx.query(
    "INSERT INTO cg03_claim_process_current(realm_id,process_id) VALUES($1,$2)",
    [actor.realmId,row.rows[0].id]);
   await tx.query("COMMIT");
   return {configured:true,status:"AVAILABLE"};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** Original CG03 case, created inside CG09 claim-submit transaction. */
 async createCase(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  claimRef:string;version:number;digest:string;fileRef:string;fileVersion:number;
  requestKey:string;categoryLabel:string
 }){
  uid(input.claimRef);uid(input.fileRef);uid(input.requestKey);
  await this.source.guardDraft(tx,actor,input.claimRef,input.version);
  await this.evidence.guardForReviewer(tx,actor,{
   claimRef:input.claimRef,claimVersion:input.version,fileRef:input.fileRef,
   fileVersion:input.fileVersion});
  const check=await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='FINANCE_REIMBURSEMENT' "+
   "AND finance_claim_id=$2 AND finance_claim_revision=$3 FOR SHARE",
   [actor.realmId,input.claimRef,input.version]);
  const digest=sha(["CG03_REIMBURSEMENT",input.claimRef,input.version,
   input.digest,input.fileRef,input.fileVersion,input.requestKey]);
  if(check.rows[0]){
   if(check.rows[0].proposer_id!==actor.accountId||
      check.rows[0].request_key!==input.requestKey||
      check.rows[0].request_digest!==digest)
    throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
   return {caseRef:check.rows[0].id,status:check.rows[0].status,
    reference:check.rows[0].case_number,revision:check.rows[0].revision};
  }
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const process=await tx.query<{id:string;version:number}>(
   "SELECT p.id,p.version FROM cg03_claim_process_current c "+
   "JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND p.process_kind='FINANCE_REIMBURSEMENT'",
   [actor.realmId]);
  if(!process.rows[0])
   throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
  const inserted=await tx.query<Case>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,"+
   "role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,"+
   "proposal_digest,request_digest,request_key,case_kind,finance_claim_id,"+
   "finance_claim_revision,finance_claim_digest,finance_claim_bill_id,"+
   "finance_claim_bill_version) VALUES($1,'CG-AP-'||"+
   "lpad(nextval('cg03_public_case_sequence')::text,6,'0'),$2,$3,$4,"+
   "NULL,NULL,$5,'Reimbursement',NULL,NULL,$6,$7,$8,$9,"+
   "'FINANCE_REIMBURSEMENT',$10,$11,$12,$13,$14) RETURNING *",
   [actor.realmId,process.rows[0].id,process.rows[0].version,
    actor.accountId,input.categoryLabel,input.version,input.digest,digest,
    input.requestKey,input.claimRef,input.version,input.digest,
    input.fileRef,input.fileVersion]);
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
   "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,inserted.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:inserted.rows[0].id,status:"SUBMITTED",
   reference:inserted.rows[0].case_number,revision:1};
 }
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"finance.claims.review");
  await this.sessions.requireAction(bearer,"documents.files.view");
  return actor;
 }
 async list(bearer:string,offsetInput?:string){
  const actor=await this.reviewer(bearer);
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_CLAIM_FILTER_INVALID",field:"offset"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<{caseRef:string;reference:string;claimCategory:string;
    status:string;revision:number;submittedAt:Date}>(
    "SELECT c.id AS \"caseRef\",c.case_number AS reference,"+
    "c.account_name_snapshot AS \"claimCategory\",c.status,c.revision,"+
    "c.submitted_at AS \"submittedAt\" FROM cg03_case c "+
    "WHERE c.realm_id=$1 AND c.case_kind='FINANCE_REIMBURSEMENT' "+
    "ORDER BY c.submitted_at DESC,c.id DESC LIMIT 31 OFFSET $2",
    [actor.realmId,Number(offsetInput??"0")]);
   await tx.query("COMMIT");
   return {cases:rows.rows.slice(0,30),
    nextOffset:rows.rows.length>30?Number(offsetInput??"0")+30:null};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async detail(bearer:string,caseInput:string){
  const actor=await this.reviewer(bearer);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='FINANCE_REIMBURSEMENT'",[uid(caseInput),actor.realmId]);
   const c=rows.rows[0];
   if(!c)throw new NotFoundException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   await tx.query("COMMIT");
   return {caseRef:c.id,reference:c.case_number,claimRef:c.finance_claim_id,
    version:c.finance_claim_revision,billFileRef:c.finance_claim_bill_id,
    billVersion:c.finance_claim_bill_version,status:c.status,revision:c.revision};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async decide(bearer:string,caseInput:string,value:unknown){
  const actor=await this.reviewer(bearer),caseRef=uid(caseInput),
   input=decision(value);
  const digest=sha([input.action,input.remarks,input.expectedRevision]);
  // Do not store passwords as audit data or digest material.
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const row=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='FINANCE_REIMBURSEMENT' FOR UPDATE",
    [caseRef,actor.realmId]);
   const c=row.rows[0];
   if(!c)throw new NotFoundException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("Another authorized reviewer must decide this claim");
   const prev=await tx.query<{actor_id:string;request_digest:string;
    accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE case_id=$1 AND request_key=$2 FOR SHARE",
    [c.id,input.requestKey]);
   if(prev.rows[0]){
    if(prev.rows[0].actor_id!==actor.accountId||
       prev.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,caseRef,status:"PREVIOUSLY_CONFIRMED",
     revision:prev.rows[0].accepted_case_revision,replayed:true};
   }
   if(c.revision!==input.expectedRevision||!["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   await this.source.guardForReviewer(tx,actor,c.finance_claim_id,
    c.finance_claim_revision,c.finance_claim_digest);
   await this.evidence.guardForReviewer(tx,actor,{
    claimRef:c.finance_claim_id,claimVersion:c.finance_claim_revision,
    fileRef:c.finance_claim_bill_id,fileVersion:c.finance_claim_bill_version});
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 "+
    "AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",
    [c.process_id,c.current_step]);
   if(!step.rowCount)
    throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
   const next=input.action==="APPROVE"?"PENDING_OWNER":input.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query(
    "UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND revision=$4",
    [caseRef,actor.realmId,next,c.revision]);
   const d=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,"+
    "expected_case_revision,accepted_case_revision,request_key,request_digest,"+
    "safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,caseRef,actor.accountId,input.action,c.revision,c.revision+1,
     input.requestKey,digest,input.remarks]);
   await tx.query(
    "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,caseRef,actor.accountId,
     input.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   if(input.action==="APPROVE")await tx.query(
    "INSERT INTO cg03_finance_owner_effect(case_id,realm_id,final_decision_id) "+
    "VALUES($1,$2,$3)",[caseRef,actor.realmId,d.rows[0].id]);
   await tx.query("COMMIT");
   return {confirmed:true,caseRef,status:next,revision:c.revision+1,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** CG09 alone reconciles approval to its original claim; no money posting here. */
 async outcome(tx:PoolClient,actor:VerifiedFoundationActor,claimRef:string,
  sourceVersion:number,sourceDigest:string,fileRef:string,fileVersion:number,
  caseRef:string){
  const found=await tx.query<{status:string;effect_key:string|null}>(
   "SELECT c.status,(SELECT effect_key FROM cg03_finance_owner_effect e "+
   "WHERE e.case_id=c.id AND e.realm_id=c.realm_id) AS effect_key "+
   "FROM cg03_case c "+
   "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
   "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='FINANCE_REIMBURSEMENT' "+
   "AND c.finance_claim_id=$3 AND c.finance_claim_revision=$4 "+
   "AND c.finance_claim_digest=$5 AND c.finance_claim_bill_id=$6 "+
   "AND c.finance_claim_bill_version=$7 AND d.fresh_password_verified_at IS NOT NULL "+
   "AND ((c.status IN('PENDING_OWNER','OWNER_COMPLETED') AND d.action='APPROVE') "+
   "OR (c.status='RETURNED' AND d.action='RETURN') "+
   "OR (c.status='REJECTED' AND d.action='REJECT')) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
   [caseRef,actor.realmId,claimRef,sourceVersion,sourceDigest,fileRef,fileVersion]);
  const result=found.rows[0];
  if(!result||(["PENDING_OWNER","OWNER_COMPLETED"].includes(result.status)&&!result.effect_key))
   throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
  return result;
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  await tx.query(
   "UPDATE cg03_finance_owner_effect SET status='OWNER_COMPLETED',completed_at=now() "+
   "WHERE case_id=$1 AND realm_id=$2 AND status='PENDING_OWNER'",
   [caseRef,actor.realmId]);
 }
}
