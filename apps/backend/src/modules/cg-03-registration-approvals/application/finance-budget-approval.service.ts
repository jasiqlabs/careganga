import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {FinanceBudgetSourceFacade} from "../../cg-09-finance-accounting/application/finance-budget-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"FINANCE_BUDGET_SOURCE_INVALID"});return v;};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type BudgetCase={id:string;realm_id:string;case_number:string;proposer_id:string;
 finance_budget_id:string;finance_budget_revision:number;finance_budget_digest:string;
 process_id:string;process_version:number;current_step:number;revision:number;status:string;
 request_key:string;request_digest:string};
@Injectable()
export class FinanceBudgetApprovalService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:FinanceBudgetSourceFacade){}
 async processStatus(bearer:string){
  const a=await this.sessions.requireAction(bearer,"finance.budgets.manage");
  const r=await this.db.query("SELECT process_id FROM cg03_budget_process_current WHERE realm_id=$1",
   [a.realmId]);
  return {configured:Boolean(r.rowCount),status:r.rowCount?"AVAILABLE":"NOT_CONFIGURED"};
 }
 async initialize(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
  await this.sessions.requireAction(bearer,"finance.budgets.review");
  if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).some(k=>k!=="currentPassword")||
   typeof (input as {currentPassword?:unknown}).currentPassword!=="string")
   throw new BadRequestException({code:"FINANCE_BUDGET_REVIEW_INVALID"});
  const password=(input as {currentPassword:string}).currentPassword;
  if(password.length<8||Buffer.byteLength(password,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_BUDGET_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"approvals.process.manage");
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation root only");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,actor,password);
   const prev=await tx.query("SELECT process_id FROM cg03_budget_process_current WHERE realm_id=$1",
    [actor.realmId]);
   if(prev.rowCount){await tx.query("COMMIT");return {configured:true,status:"AVAILABLE"};}
   const n=await tx.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version FROM cg03_process WHERE realm_id=$1",
    [actor.realmId]);
   const created=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'FINANCE_BUDGET') RETURNING id",
    [actor.realmId,n.rows[0].version,actor.accountId]);
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[created.rows[0].id]);
   await tx.query("INSERT INTO cg03_budget_process_current(realm_id,process_id) VALUES($1,$2)",
    [actor.realmId,created.rows[0].id]);
   await tx.query("COMMIT");
   return {configured:true,status:"AVAILABLE"};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** Original CG03 reviewer case, inserted atomically by CG09 while budget is still DRAFT. */
 async createCase(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  budgetRef:string;version:number;digest:string;number:string;key:string
 }){
  await this.source.guardDraft(tx,actor,input.budgetRef,input.version,input.digest);
  const fingerprint=sha(["CG03_ORIGINAL_BUDGET_V1",input.budgetRef,input.version,input.digest,input.key]);
  const earlier=await tx.query<BudgetCase>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='FINANCE_BUDGET' "+
   "AND finance_budget_id=$2 AND finance_budget_revision=$3 FOR SHARE",
   [actor.realmId,input.budgetRef,input.version]);
  if(earlier.rows[0]){
   if(earlier.rows[0].proposer_id!==actor.accountId||
      earlier.rows[0].request_key!==input.key||
      earlier.rows[0].request_digest!==fingerprint)
    throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
   return {caseRef:earlier.rows[0].id,caseNumber:earlier.rows[0].case_number};
  }
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const latest=await tx.query<BudgetCase>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='FINANCE_BUDGET' "+
   "AND finance_budget_id=$2 AND finance_budget_revision<$3 "+
   "ORDER BY finance_budget_revision DESC LIMIT 1 FOR SHARE",
   [actor.realmId,input.budgetRef,input.version]);
  if(latest.rows[0]&&latest.rows[0].status!=="RETURNED")
   throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
  const process=await tx.query<{id:string;version:number}>(
   "SELECT p.id,p.version FROM cg03_budget_process_current c JOIN cg03_process p "+
   "ON p.id=c.process_id AND p.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND p.process_kind='FINANCE_BUDGET'",[actor.realmId]);
  if(!process.rows[0])
   throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
  const created=await tx.query<BudgetCase>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,finance_budget_id,finance_budget_revision,"+
   "finance_budget_digest,previous_case_id) VALUES("+
   "$1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "$2,$3,$4,NULL,NULL,$5,'Budget',NULL,NULL,$6,$7,$8,$9,"+
   "'FINANCE_BUDGET',$10,$11,$12,$13) RETURNING *",
   [actor.realmId,process.rows[0].id,process.rows[0].version,actor.accountId,
    input.number,input.version,input.digest,fingerprint,input.key,
    input.budgetRef,input.version,input.digest,latest.rows[0]?.id??null]);
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,$4,1,$5)",[actor.realmId,created.rows[0].id,actor.accountId,
    latest.rows[0]?"CORRECTED":"SUBMITTED",randomUUID()]);
  return {caseRef:created.rows[0].id,caseNumber:created.rows[0].case_number};
 }
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"finance.budgets.review");
  return actor;
 }
 async list(bearer:string,offsetInput?:string){
  const actor=await this.reviewer(bearer);
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_BUDGET_FILTER_INVALID",field:"offset"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const r=await tx.query<{caseRef:string;caseNumber:string;budgetNumber:string;
    status:string;revision:number}>(
    "SELECT id AS \"caseRef\",case_number AS \"caseNumber\","+
    "account_name_snapshot AS \"budgetNumber\",status,revision "+
    "FROM cg03_case WHERE realm_id=$1 AND case_kind='FINANCE_BUDGET' "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 41 OFFSET $2",
    [actor.realmId,Number(offsetInput??"0")]);
   await tx.query("COMMIT");
   return {cases:r.rows.slice(0,40),
    nextOffset:r.rows.length>40?Number(offsetInput??"0")+40:null};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async detail(bearer:string,refInput:string){
  const actor=await this.reviewer(bearer);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<BudgetCase>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='FINANCE_BUDGET'",[valid(refInput),actor.realmId]);
   const c=rows.rows[0];
   if(!c)throw new NotFoundException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
   await tx.query("COMMIT");
   return {caseRef:c.id,caseNumber:c.case_number,status:c.status,revision:c.revision,
    source:await this.source.reviewerSnapshot(bearer,c.finance_budget_id,c.finance_budget_revision)};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async decide(bearer:string,refInput:string,value:unknown){
  const actor=await this.reviewer(bearer),caseRef=valid(refInput);
  if(!value||typeof value!=="object"||Array.isArray(value))
   throw new BadRequestException({code:"FINANCE_BUDGET_REVIEW_INVALID"});
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","expectedRevision","action","remarks","currentPassword"].includes(k))||
    !UUID.test(String(v.requestKey))||!Number.isSafeInteger(v.expectedRevision)||
    Number(v.expectedRevision)<1||!["APPROVE","RETURN","REJECT"].includes(String(v.action))||
    typeof v.currentPassword!=="string"||v.currentPassword.length<8||
    Buffer.byteLength(v.currentPassword,"utf8")>1024||
    (v.remarks!==undefined&&(typeof v.remarks!=="string"||v.remarks.length>500)))
   throw new BadRequestException({code:"FINANCE_BUDGET_REVIEW_INVALID"});
  const action=v.action as "APPROVE"|"RETURN"|"REJECT",key=String(v.requestKey),
   expected=Number(v.expectedRevision),remarks=typeof v.remarks==="string"?v.remarks.trim():"",
   digest=sha([action,remarks,expected]);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<BudgetCase>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='FINANCE_BUDGET' FOR UPDATE",[caseRef,actor.realmId]);
   const c=rows.rows[0];
   if(!c)throw new NotFoundException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("A different authorized reviewer must decide");
   const prior=await tx.query<{actor_id:string;request_digest:string;
    accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE case_id=$1 AND request_key=$2 FOR SHARE",[caseRef,key]);
   if(prior.rows[0]){
    if(prior.rows[0].actor_id!==actor.accountId||
       prior.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:"PREVIOUSLY_CONFIRMED",
     caseRef,revision:prior.rows[0].accepted_case_revision,replayed:true};
   }
   if(c.revision!==expected||!["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
   await this.source.submittedForReviewer(tx,actor,c.finance_budget_id,
    c.finance_budget_revision,c.finance_budget_digest);
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 "+
    "AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",
    [c.process_id,c.current_step]);
   if(!step.rowCount)
    throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,
    v.currentPassword as string);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND revision=$4",
    [caseRef,actor.realmId,next,c.revision]);
   const d=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,"+
    "expected_case_revision,accepted_case_revision,request_key,request_digest,"+
    "safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,caseRef,actor.accountId,action,c.revision,c.revision+1,key,digest,remarks]);
   await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,caseRef,actor.accountId,
     action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   if(action==="APPROVE")await tx.query(
    "INSERT INTO cg03_finance_owner_effect(case_id,realm_id,final_decision_id) "+
    "VALUES($1,$2,$3)",[caseRef,actor.realmId,d.rows[0].id]);
   await tx.query("COMMIT");
   return {confirmed:true,caseRef,status:next,revision:c.revision+1,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** CG09 consumes only the protected original CG03 decision, never writes its tables. */
 async outcome(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  caseRef:string;budgetRef:string;version:number;digest:string
 }){
  const found=await tx.query<{status:string;effect_key:string|null}>(
   "SELECT c.status,(SELECT e.effect_key FROM cg03_finance_owner_effect e "+
   "WHERE e.case_id=c.id AND e.realm_id=c.realm_id) AS effect_key "+
   "FROM cg03_case c JOIN cg03_case_decision d "+
   "ON d.case_id=c.id AND d.realm_id=c.realm_id "+
   "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='FINANCE_BUDGET' "+
   "AND c.finance_budget_id=$3 AND c.finance_budget_revision=$4 "+
   "AND c.finance_budget_digest=$5 AND d.fresh_password_verified_at IS NOT NULL "+
   "AND ((c.status IN('PENDING_OWNER','OWNER_COMPLETED') AND d.action='APPROVE') "+
   "OR (c.status='RETURNED' AND d.action='RETURN') "+
   "OR (c.status='REJECTED' AND d.action='REJECT')) "+
   "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
   [input.caseRef,actor.realmId,input.budgetRef,input.version,input.digest]);
  if(!found.rows[0]||
     (["PENDING_OWNER","OWNER_COMPLETED"].includes(found.rows[0].status)&&!found.rows[0].effect_key))
   throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
  return found.rows[0];
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  await tx.query("UPDATE cg03_finance_owner_effect "+
   "SET status='OWNER_COMPLETED',completed_at=now() "+
   "WHERE case_id=$1 AND realm_id=$2 AND status='PENDING_OWNER'",
   [caseRef,actor.realmId]);
 }
}
