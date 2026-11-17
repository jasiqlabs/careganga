import {
 BadRequestException,ConflictException,Inject,Injectable
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {FinanceVoucherSourceFacade} from "./finance-voucher-source.facade";
import {FinanceVoucherApprovalService} from "../../cg-03-registration-approvals/application/finance-voucher-approval.service";
import {FinanceVoucherEvidenceService} from "../../cg-19-documents-notifications/application/finance-voucher-evidence.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=(value:unknown,field:string):string=>{
 if(typeof value!=="string"||!UUID.test(value))
  throw new BadRequestException({code:"FINANCE_VOUCHER_SOURCE_INVALID",field});
 return value;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Voucher={id:string;version:number;status:string;voucher_number:string;
 approval_case_id:string|null;proof_file_id:string|null;proof_file_revision:number|null};
type Command={request_digest:string;case_id:string;result_status:string;voucher_version:number};
type CommandResult={confirmed:true;caseRef:string;status:string;voucherNumber:string;
 version:number;replayed:boolean};
const keys=(payload:unknown,allowed:string[])=>{
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||
  Object.keys(payload).some(k=>!allowed.includes(k)))
  throw new BadRequestException({code:"FINANCE_VOUCHER_FORM_INVALID"});
 return payload as Record<string,unknown>;
};
const revision=(v:unknown,field:string)=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"FINANCE_VOUCHER_STALE",field});
 return Number(v);
};

@Injectable()
export class FinanceVoucherWorkflowService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:FinanceVoucherSourceFacade,
  private readonly approvals:FinanceVoucherApprovalService,
  private readonly evidence:FinanceVoucherEvidenceService){}
 private async actor(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  return actor;
 }
 private async command(client:PoolClient,actor:VerifiedFoundationActor,key:string){
  const found=await client.query<Command>(`
   SELECT request_digest,case_id,result_status,voucher_version
   FROM finance_voucher_workflow_command
   WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3`,
   [actor.realmId,actor.accountId,key]);
  return found.rows[0]??null;
 }
 private async voucher(client:PoolClient,actor:VerifiedFoundationActor,voucherRef:string){
  const found=await client.query<Voucher>(`
   SELECT id,version,status,voucher_number,approval_case_id,proof_file_id,
    proof_file_revision FROM finance_voucher WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,
   [voucherRef,actor.realmId]);
  if(!found.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  return found.rows[0];
 }
 private async insertCommand(client:PoolClient,actor:VerifiedFoundationActor,input:{
  voucherRef:string;version:number;action:"SUBMIT"|"SETTLE";key:string;
  digest:string;caseRef:string;status:string
 }){
  await client.query(`
    INSERT INTO finance_voucher_workflow_command(root_realm_id,voucher_id,actor_ref,
      action,request_key,request_digest,voucher_version,case_id,result_status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
   [actor.realmId,input.voucherRef,actor.accountId,input.action,input.key,
    input.digest,input.version,input.caseRef,input.status]);
  await client.query(`
    INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
    VALUES($1,$2,'VOUCHER',$3,$4,$5)`,
   [actor.realmId,actor.accountId,input.voucherRef,
    input.action==="SUBMIT"?"VOUCHER_SUBMITTED":"VOUCHER_REVIEW_"+input.status,input.key]);
 }
 async submit(bearer:string,voucherInput:string,payload:unknown):Promise<CommandResult>{
  const actor=await this.actor(bearer);
  const voucherRef=valid(voucherInput,"voucherRef");
  const body=keys(payload,["requestKey","expectedVersion","proofFileRef","proofVersion"]);
  const requestKey=valid(body.requestKey,"requestKey"),
   expectedVersion=revision(body.expectedVersion,"expectedVersion"),
   proofFileRef=valid(body.proofFileRef,"proofFileRef"),
   proofVersion=revision(body.proofVersion,"proofVersion");
  const digest=sha(["CG09_VOUCHER_SUBMIT",voucherRef,expectedVersion,
    proofFileRef,proofVersion]);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
   const prior=await this.command(client,actor,requestKey);
   if(prior){
    if(prior.request_digest!==digest)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    const v=await this.voucher(client,actor,voucherRef);
    await client.query("COMMIT");
    return {confirmed:true,caseRef:prior.case_id,status:prior.result_status,
     voucherNumber:v.voucher_number,version:prior.voucher_version,replayed:true};
   }
   const v=await this.voucher(client,actor,voucherRef);
   if(v.status!=="DRAFT"||v.version!==expectedVersion)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   const snapshot=await this.source.guardDraft(client,actor,voucherRef,v.version);
   await this.evidence.guardVerifiedProof(client,actor,voucherRef,v.version,
    proofFileRef,proofVersion);
   const caseResult=await this.approvals.createCase(client,actor,{
    voucherRef,version:v.version,digest:snapshot.sourceDigest,
    proofRef:proofFileRef,proofRevision:proofVersion,
    voucherNumber:v.voucher_number,requestKey
   });
   const accepted=await client.query(`
    UPDATE finance_voucher SET status='SUBMITTED',
     approval_case_id=$3,proof_file_id=$4,proof_file_revision=$5,updated_at=now()
    WHERE id=$1 AND root_realm_id=$2 AND status='DRAFT' AND version=$6
    RETURNING id`,
    [voucherRef,actor.realmId,caseResult.caseRef,proofFileRef,proofVersion,v.version]);
   if(!accepted.rowCount)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   await this.insertCommand(client,actor,{voucherRef,version:v.version,action:"SUBMIT",
    key:requestKey,digest,caseRef:caseResult.caseRef,status:"SUBMITTED"});
   await client.query("COMMIT");
   return {confirmed:true,caseRef:caseResult.caseRef,status:"SUBMITTED",
    voucherNumber:v.voucher_number,version:v.version,replayed:false};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 /** Reconciling a real CG-03 decision is separate from approving a payment.
  * No ledger postings, external disbursements or cash/bank PAID state here.
  */
 async settle(bearer:string,voucherInput:string,payload:unknown):Promise<CommandResult>{
  const actor=await this.actor(bearer);
  const voucherRef=valid(voucherInput,"voucherRef");
  const body=keys(payload,["caseRef","requestKey"]);
  const caseRef=valid(body.caseRef,"caseRef"),
   requestKey=valid(body.requestKey,"requestKey");
  const digest=sha(["CG09_VOUCHER_SETTLE",voucherRef,caseRef]);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
   const prior=await this.command(client,actor,requestKey);
   if(prior){
    if(prior.request_digest!==digest||prior.case_id!==caseRef)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    const v=await this.voucher(client,actor,voucherRef);
    await client.query("COMMIT");
    return {confirmed:true,caseRef,status:prior.result_status,voucherNumber:v.voucher_number,
     version:prior.voucher_version,replayed:true};
   }
   const voucher=await this.voucher(client,actor,voucherRef);
   if(voucher.approval_case_id!==caseRef||!voucher.proof_file_id||
      !voucher.proof_file_revision)
    throw new ConflictException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
   if(!["SUBMITTED","APPROVED","RETURNED","REJECTED"].includes(voucher.status))
    throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
   const source=await this.source.guardFrozen(client,actor,voucherRef,voucher.version,
    (await client.query<{payload_digest:string}>(`
     SELECT payload_digest FROM finance_voucher_draft_revision
     WHERE voucher_id=$1 AND root_realm_id=$2 AND version=$3`,
     [voucherRef,actor.realmId,voucher.version])).rows[0]?.payload_digest??"");
   const proof={caseRef,voucherRef,sourceVersion:voucher.version,
    digest:source.sourceDigest,proofRef:voucher.proof_file_id,
    proofRevision:voucher.proof_file_revision};
   const outcome=await this.approvals.reviewOutcome(client,actor,proof);
   const finalStatus=outcome==="PENDING_OWNER"||outcome==="OWNER_COMPLETED"?
    "APPROVED":outcome;
   if(finalStatus==="APPROVED"){
    await this.approvals.guardFinalApproval(client,actor,proof);
    await this.evidence.guardFrozenProof(client,actor,voucherRef,voucher.version,
      source.sourceDigest,voucher.proof_file_id,voucher.proof_file_revision);
   }
   if(voucher.status==="SUBMITTED"){
    const changed=await client.query(`
     UPDATE finance_voucher SET status=$3,updated_at=now()
     WHERE id=$1 AND root_realm_id=$2 AND status='SUBMITTED'
     RETURNING id`,[voucherRef,actor.realmId,finalStatus]);
    if(!changed.rowCount)
     throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   }else if(voucher.status!==finalStatus)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   if(finalStatus==="APPROVED")
    await this.approvals.completeEffect(client,actor,caseRef);
   await this.insertCommand(client,actor,{voucherRef,version:voucher.version,
    action:"SETTLE",key:requestKey,digest,caseRef,status:finalStatus});
   await client.query("COMMIT");
   return {confirmed:true,caseRef,status:finalStatus,
    voucherNumber:voucher.voucher_number,version:voucher.version,replayed:false};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async commandStatus(bearer:string,keyInput:string){
  const actor=await this.actor(bearer);
  const requestKey=valid(keyInput,"requestKey");
  const record=await this.db.query<Command>(`
   SELECT case_id,result_status,request_digest,voucher_version
   FROM finance_voucher_workflow_command
   WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3`,
   [actor.realmId,actor.accountId,requestKey]);
  return {confirmed:!!record.rows[0],
   status:record.rows[0]?.result_status??null};
 }
}
