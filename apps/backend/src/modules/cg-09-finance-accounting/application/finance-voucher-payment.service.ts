import {payrollReadbackConfig,dispatchEnabled,type Dispatch} from "../infrastructure/payroll-razorpayx-readback";
import {PayrollProviderReadbackService} from "./payroll-provider-readback.service";
import {matchesPayoutEvidence} from "../../cg-11-payroll-compensation/domain/payout-instruction";
import {guardAssistanceOwner} from "../../cg-06-beneficiaries-assistance/application/assistance-owner-guard";
import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import {FinanceVoucherSourceFacade} from "./finance-voucher-source.facade";
import {FinanceVoucherApprovalService} from "../../cg-03-registration-approvals/application/finance-voucher-approval.service";
import {FinanceVoucherEvidenceService} from "../../cg-19-documents-notifications/application/finance-voucher-evidence.service";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reference=(v:unknown):string=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"FINANCE_VOUCHER_SOURCE_INVALID",field:"voucherRef"});
 return v;
};
const form=(v:unknown,allow:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||
  Object.keys(v).some(k=>!allow.includes(k)))
  throw new BadRequestException({code:"FINANCE_VOUCHER_FORM_INVALID"});
 return v as Record<string,unknown>;
};
const number=(v:unknown)=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"FINANCE_VOUCHER_STALE",field:"expectedVersion"});
 return Number(v);
};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const safePaymentFailure=(failure:unknown):never=>{
 const code=failure&&typeof failure==="object"&&"code" in failure?failure.code:null;
 if(code==="23505")
  throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_CONFLICT"});
 if(code==="P0917"||code==="23503"||code==="23514")
  throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID"});
 if(code==="P0940")throw new ConflictException({code:"FINANCE_PAYROLL_PROVIDER_PROOF_MISMATCH",message:"Bank provider status or reference does not match the independent payment proof."});
 if(code==="P0938")throw new ForbiddenException({code:"FINANCE_PAYROLL_SIGNER_UNAVAILABLE",message:"Current independent bank payment signing authority is required."});
 if(code==="P0939")throw new ConflictException({code:"FINANCE_PAYROLL_BANK_FUNDS_UNAVAILABLE",message:"Insufficient independently reconciled bank funds for this payment request."});
 if(code==="P0916")
  throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID"});
 if(code==="P0913")
  throw new ConflictException({code:"FINANCE_VOUCHER_POSTING_NOT_READY"});
 if(code==="P0901")throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
 if(code==="P0904")throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE"});
 if(code==="P0902")throw new ConflictException({code:"FINANCE_ACCOUNT_INACTIVE"});
 throw failure;
};
type Voucher={id:string;root_realm_id:string;version:number;status:string;
 voucher_number:string;voucher_type:string;financial_year_id:string;
 posting_date:string;branch_id:string|null;debit_account_id:string;credit_account_id:string;
 payment_account_id:string|null;total_minor:string;created_by:string;approval_case_id:string|null;
 proof_file_id:string|null;proof_file_revision:number|null};
type Proof={id:string;voucher_revision:number;method:"BANK_STATEMENT"|"CASH_RECEIPT";
 bank_reference:string|null;status:string;amount_minor:string;requested_by:string;
 proof_file_id:string;proof_file_version:number;request_key:string;request_digest:string;
 verified_by:string|null;review_request_key:string|null;review_digest:string|null;payroll_failure_verified:boolean};
type Cmd={action:string;request_digest:string;case_id:string;result_status:string;
 voucher_version:number};
@Injectable()
export class FinanceVoucherPaymentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly posting:FinanceJournalPostingService,
  private readonly source:FinanceVoucherSourceFacade,
  private readonly approvals:FinanceVoucherApprovalService,
  private readonly evidence:FinanceVoucherEvidenceService,private readonly payrollReadback:PayrollProviderReadbackService){}
 private async operator(bearer:string,posting=false){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  if(posting)await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"documents.files.view");
  return actor;
 }
 private async voucher(client:PoolClient,actor:VerifiedFoundationActor,ref:string,write=false){
  const found=await client.query<Voucher>(`
   SELECT id,root_realm_id,version,status,voucher_number,voucher_type,
    financial_year_id,posting_date::text,branch_id,debit_account_id,credit_account_id,
    payment_account_id,total_minor::text,created_by,approval_case_id,
    proof_file_id,proof_file_revision
   FROM finance_voucher WHERE root_realm_id=$1 AND id=$2 FOR UPDATE`,
   [actor.realmId,ref]);
  if(!found.rows[0])throw new NotFoundException({code:"FINANCE_VOUCHER_STALE"});
  await this.source.guardPaymentScope(client,actor,found.rows[0].branch_id,write);
  return found.rows[0];
 }
 private async command(client:PoolClient,actor:VerifiedFoundationActor,key:string){
  const found=await client.query<Cmd>(`
    SELECT action,request_digest,case_id,result_status,voucher_version
    FROM finance_voucher_workflow_command
    WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE`,
   [actor.realmId,actor.accountId,key]);
  return found.rows[0]??null;
 }
 private async register(client:PoolClient,actor:VerifiedFoundationActor,v:Voucher,input:{
  action:"PAYMENT_REQUEST"|"POST";key:string;digest:string;status:string}){
  if(!v.approval_case_id)throw new ConflictException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
  await client.query(`
   INSERT INTO finance_voucher_workflow_command(root_realm_id,voucher_id,actor_ref,
    action,request_key,request_digest,voucher_version,case_id,result_status)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
   [actor.realmId,v.id,actor.accountId,input.action,input.key,input.digest,
    v.version,v.approval_case_id,input.status]);
  await client.query(`
   INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
   VALUES($1,$2,'VOUCHER',$3,$4,$5)`,
   [actor.realmId,actor.accountId,v.id,
    input.action==="POST"?"VOUCHER_BALANCED_POSTED":"VOUCHER_PAYMENT_VERIFICATION_REQUESTED",
    input.key]);
 }
 async requestPayment(bearer:string,refInput:string,value:unknown){
  const actor=await this.operator(bearer),voucherRef=reference(refInput);
  const body=form(value,["requestKey","expectedVersion","dispatchPayroll","currentPassword"]);
  const key=reference(body.requestKey),expected=number(body.expectedVersion);
  const dispatch=body.dispatchPayroll===true;
  if((body.dispatchPayroll!==undefined&&typeof body.dispatchPayroll!=="boolean")||(dispatch?(typeof body.currentPassword!=="string"||body.currentPassword.length<8||Buffer.byteLength(body.currentPassword,"utf8")>1024):body.currentPassword!==undefined))throw new BadRequestException({code:"FINANCE_VOUCHER_FORM_INVALID"});
  const hash=digest(["REQUEST_PAYMENT",voucherRef,expected,...(dispatch?["PROTECTED_BANK_DISPATCH"]:[])]);
  if(dispatch){
   await this.sessions.limitFoundationRootProof(actor);
   const pre=await this.db.connect();let replay=false;
   try{await pre.query("BEGIN");await this.identity.assertCurrent(pre,actor,"finance.vouchers.manage");await this.protectedOwner.verifyReviewer(pre,actor,"approvals.review",true);await this.voucher(pre,actor,voucherRef,true);replay=!!await this.command(pre,actor,key);await pre.query("COMMIT");}
   catch(e){await pre.query("ROLLBACK");throw e;}finally{pre.release();}
   if(!replay)await this.payrollReadback.preflight(actor.realmId,voucherRef);
  }
  let payload:Dispatch|null=null;
  const client=await this.db.connect();let released=false,committed=false;
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
   const v=await this.voucher(client,actor,voucherRef,true);
   const earlier=await this.command(client,actor,key);
   if(earlier){
    if(earlier.action!=="PAYMENT_REQUEST"||earlier.request_digest!==hash||
     earlier.voucher_version!==expected)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    const original=(await client.query<{provider_state:string;id:string}>(`SELECT id,provider_state FROM payroll_payout_attempt WHERE root_realm_id=$1 AND voucher_ref=$2 AND provider_state<>'NOT_ENABLED'`,[actor.realmId,voucherRef])).rows[0];
    await client.query("COMMIT");
    return {confirmed:true,status:earlier.result_status,externalReference:original?.id??null,providerState:original?.provider_state??null,replayed:true};
   }
   await guardAssistanceOwner(client,actor.realmId,"PAYMENT",voucherRef);
   if(v.version!==expected||v.status!=="APPROVED"||
    !["PAYMENT","CONTRA"].includes(v.voucher_type))
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
   if(dispatch){await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);await this.sessions.requireFreshFoundationRootProof(client,actor,body.currentPassword as string);payload=await this.payrollReadback.prepareDispatch(client,actor.realmId,voucherRef);}
   // Original bank requests reserve only existing reconciled source capacity.
   // No provider transfer or paid confirmation is implied by this transition.
   const updated=await client.query(`
    UPDATE finance_voucher SET status='PAYMENT_REQUESTED',updated_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND status='APPROVED' RETURNING id`,
    [actor.realmId,voucherRef]);
   if(!updated.rowCount)throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   await this.register(client,actor,v,{action:"PAYMENT_REQUEST",key,digest:hash,
    status:"PAYMENT_REQUESTED"});
   const externalReference=await this.payrollReadback.enqueue(client,actor.realmId,voucherRef,dispatch?actor.accountId:null);
   await client.query("COMMIT");committed=true;
   if(payload){
    // The authorization is durably recorded before the external write. Do not
    // retain a borrowed database transaction across the provider network call.
    client.release();released=true;
    await this.payrollReadback.dispatchOnce(actor,payload);
   }else if(externalReference)void this.payrollReadback.tick();
   return {confirmed:true,status:"PAYMENT_REQUESTED",externalReference,providerState:dispatch?"UNKNOWN_WRITE_STATUS":externalReference?"AWAITING_BANK":null,replayed:false};
  }catch(e){if(!committed)await client.query("ROLLBACK");safePaymentFailure(e);}finally{if(!released)client.release();}
 }
 async submitProof(bearer:string,refInput:string,value:unknown){
  const actor=await this.operator(bearer),voucherRef=reference(refInput);
  const body=form(value,["requestKey","expectedVersion","fileRef","fileVersion","method",
   "transactionReference"]);
  const key=reference(body.requestKey),expected=number(body.expectedVersion);
  const fileRef=reference(body.fileRef),fileVersion=number(body.fileVersion);
  const method=body.method;
  if(method!=="BANK_STATEMENT"&&method!=="CASH_RECEIPT")
   throw new BadRequestException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID",
    field:"paymentMethod"});
  const transactionReference=typeof body.transactionReference==="string"?
   body.transactionReference.trim().toUpperCase():"";
  if((method==="BANK_STATEMENT"&&!/^[A-Z0-9 /._-]{6,64}$/.test(transactionReference))||
    (method==="CASH_RECEIPT"&&transactionReference!==""))
   throw new BadRequestException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID",
    field:"transactionReference"});
  const hash=digest(["PAYMENT_PROOF",voucherRef,expected,fileRef,fileVersion,
   method,transactionReference]);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
   const v=await this.voucher(client,actor,voucherRef,true);
   const prior=await client.query<Proof>(`
    SELECT * FROM finance_voucher_payment_verification
    WHERE root_realm_id=$1 AND voucher_id=$2 AND requested_by=$3 AND request_key=$4
    FOR SHARE`,[actor.realmId,voucherRef,actor.accountId,key]);
   if(prior.rows[0]){
    if(prior.rows[0].request_digest!==hash)
     throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_CONFLICT"});
    await client.query("COMMIT");
    return {confirmed:true,paymentProofRef:prior.rows[0].id,
     status:prior.rows[0].status,replayed:true};
   }
   if(v.version!==expected||v.status!=="PAYMENT_REQUESTED"||!v.approval_case_id)
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
   const active=await client.query<{id:string}>(`
    SELECT id FROM finance_voucher_payment_verification
    WHERE root_realm_id=$1 AND voucher_id=$2
     AND (status IN('PENDING_REVIEW','VERIFIED') OR payroll_failure_verified) FOR SHARE`,[actor.realmId,voucherRef]);
   if(active.rows[0])
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_CONFLICT"});
   await this.evidence.guardPaymentProof(client,actor,voucherRef,expected,fileRef,fileVersion);
   const result=await client.query<{id:string}>(`
    INSERT INTO finance_voucher_payment_verification(root_realm_id,voucher_id,
     voucher_revision,case_id,proof_file_id,proof_file_version,method,bank_reference,
     amount_minor,requested_by,request_key,request_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [actor.realmId,voucherRef,expected,v.approval_case_id,fileRef,fileVersion,
     method,method==="BANK_STATEMENT"?transactionReference:null,v.total_minor,
     actor.accountId,key,hash]);
   await client.query(`
    INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
    VALUES($1,$2,'VOUCHER',$3,'VOUCHER_PAYMENT_PROOF_SUBMITTED',$4)`,
    [actor.realmId,actor.accountId,voucherRef,key]);
   await client.query("COMMIT");
   return {confirmed:true,paymentProofRef:result.rows[0].id,
    status:"PENDING_REVIEW",replayed:false};
  }catch(e){await client.query("ROLLBACK");safePaymentFailure(e);}finally{client.release();}
 }
 async paymentStatus(bearer:string,refInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.view");
  const voucherRef=reference(refInput);
  const client=await this.db.connect();
  try{await client.query("BEGIN");const voucher=await this.voucher(client,actor,voucherRef);
  const rows=await client.query<{paymentProofRef:string;fileRef:string;fileVersion:number;
   method:string;bankReference:string|null;amountMinor:string;status:string;
   requestedAt:Date;verifiedAt:Date|null;requiresPayrollDestination:boolean;failedTransfer:boolean}>(`
   SELECT p.id AS "paymentProofRef",p.proof_file_id AS "fileRef",
    p.proof_file_version AS "fileVersion",p.method,
    p.bank_reference AS "bankReference",p.amount_minor::text AS "amountMinor",
    p.status,p.created_at AS "requestedAt",p.verified_at AS "verifiedAt",p.payroll_failure_verified AS "failedTransfer",
    EXISTS(SELECT 1 FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref WHERE t.root_realm_id=p.root_realm_id AND t.voucher_ref=p.voucher_id AND b.method='BANK') AS "requiresPayrollDestination"
   FROM finance_voucher_payment_verification p
   WHERE p.root_realm_id=$1 AND p.voucher_id=$2
   ORDER BY p.created_at DESC,p.id DESC LIMIT 1`,[actor.realmId,voucherRef]);
  const original=(await client.query<{externalReference:string;providerState:string;automated:boolean}>(`SELECT id AS "externalReference",provider_state AS "providerState",(dispatch_actor_ref IS NOT NULL) AS automated FROM payroll_payout_attempt WHERE root_realm_id=$1 AND voucher_ref=$2 AND provider_state<>'NOT_ENABLED'`,[actor.realmId,voucherRef])).rows[0];
  const config=payrollReadbackConfig();const dispatchAvailable=!!(dispatchEnabled()&&config&&config.root===actor.realmId&&voucher.payment_account_id===config.bank&&voucher.status==="APPROVED"&&(await client.query(`SELECT 1 FROM payroll_payout_attempt t JOIN integration_connection cfg ON cfg.foundation_realm_id=t.root_realm_id AND cfg.provider='razorpayx' AND cfg.purpose='payroll' AND cfg.secret_reference=$4 AND cfg.verification_status='VERIFIED' AND cfg.last_checked_credential_revision=cfg.credential_revision WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 AND t.provider_state='NOT_ENABLED' AND EXISTS(SELECT 1 FROM account_role ar JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected WHERE ar.realm_id=$1 AND ar.account_id=$3 AND ar.revoked_at IS NULL)`,[actor.realmId,voucherRef,actor.accountId,config.reference])).rowCount);
  await client.query("COMMIT");return {payment:rows.rows[0]??null,providerReadback:original??null,dispatchAvailable};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async verifyProof(bearer:string,refInput:string,proofInput:string,value:unknown){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const voucherRef=reference(refInput),proofRef=reference(proofInput);
  const body=form(value,["requestKey","action","currentPassword","payrollDestinationEvidence"]);
  const key=reference(body.requestKey),action=body.action;
  if(!["VERIFY","REJECT","CONFIRM_FAILED_TRANSFER"].includes(String(action))||
    typeof body.currentPassword!=="string"||body.currentPassword.length<8||
    Buffer.byteLength(body.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID"});
  const decisionHash=digest(["VERIFY_PAYMENT_PROOF",voucherRef,proofRef,action]);
  await this.sessions.limitFoundationRootProof(actor);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);
   const v=await this.voucher(client,actor,voucherRef);
   if(!["PAYMENT","CONTRA"].includes(v.voucher_type))
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
   const result=await client.query<Proof>(`
    SELECT * FROM finance_voucher_payment_verification
    WHERE id=$1 AND root_realm_id=$2 AND voucher_id=$3 FOR UPDATE`,
    [proofRef,actor.realmId,voucherRef]);
   const p=result.rows[0];
   if(!p)throw new NotFoundException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_INVALID"});
   if(p.status!=="PENDING_REVIEW"){
    if(p.review_request_key!==key||p.review_digest!==decisionHash||
      p.verified_by!==actor.accountId)
     throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_CONFLICT"});
    await client.query("COMMIT");return {confirmed:true,status:p.payroll_failure_verified?"FAILED_VERIFIED":p.status,replayed:true};
   }
   if(v.status!=="PAYMENT_REQUESTED")
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
   if(actor.accountId===p.requested_by||actor.accountId===v.created_by)
    throw new ForbiddenException("A different authorized Finance reviewer must verify this payment");
   // Independently inspect the original verified file, transaction reference and
   // amount in the UI; the signature is the protected password-confirmed decision.
   await this.evidence.guardPaymentProof(client,actor,voucherRef,v.version,
    p.proof_file_id,p.proof_file_version);
   await this.sessions.requireFreshFoundationRootProof(client,actor,
    body.currentPassword);
   const pinned=(await client.query<{employee_ref:string;destination_fingerprint:string}>(`SELECT l.employee_ref,i.destination_fingerprint FROM payroll_payout_attempt t
     JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref
     JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
     JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
     WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 FOR SHARE OF t,i,b,l`,[actor.realmId,voucherRef])).rows[0];
   let matched:string|null=null;
   if(action==="CONFIRM_FAILED_TRANSFER"&&(!pinned||p.method!=="BANK_STATEMENT"))throw new BadRequestException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID"});
   if((action==="VERIFY"||action==="CONFIRM_FAILED_TRANSFER")&&pinned){
    if(!matchesPayoutEvidence(actor.realmId,pinned.employee_ref,pinned.destination_fingerprint,body.payrollDestinationEvidence))
     throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID"});
    matched=pinned.destination_fingerprint;
   }else if(body.payrollDestinationEvidence!==undefined)throw new BadRequestException({code:"FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID"});
   const next=action==="VERIFY"?"VERIFIED":"REJECTED";
   await client.query(`
    UPDATE finance_voucher_payment_verification
     SET status=$4,verified_by=$5,verified_at=now(),verifier_proof_at=now(),
      review_request_key=$6,review_digest=$7,payroll_destination_fingerprint=$8,payroll_failure_verified=$9,updated_at=now()
    WHERE id=$1 AND root_realm_id=$2 AND voucher_id=$3 AND status='PENDING_REVIEW'`,
    [proofRef,actor.realmId,voucherRef,next,actor.accountId,key,decisionHash,matched,action==="CONFIRM_FAILED_TRANSFER"]);
   if(next==="VERIFIED"){
    const changed=await client.query(`
     UPDATE finance_voucher SET status='PAID_VERIFIED',updated_at=now()
     WHERE id=$1 AND root_realm_id=$2 AND status='PAYMENT_REQUESTED'`,
     [voucherRef,actor.realmId]);
    if(changed.rowCount!==1)throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   }
   await client.query(`
    INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
    VALUES($1,$2,'VOUCHER',$3,$4,$5)`,
    [actor.realmId,actor.accountId,voucherRef,
     next==="VERIFIED"?"VOUCHER_PAYMENT_INDEPENDENTLY_VERIFIED":action==="CONFIRM_FAILED_TRANSFER"?"PAYROLL_BANK_TRANSFER_FAILURE_VERIFIED":"VOUCHER_PAYMENT_PROOF_REJECTED",key]);
   await client.query("COMMIT");return {confirmed:true,status:action==="CONFIRM_FAILED_TRANSFER"?"FAILED_VERIFIED":next,replayed:false};
  }catch(e){await client.query("ROLLBACK");safePaymentFailure(e);}finally{client.release();}
 }
 /** One immutable double-entry journal, never a second voucher balance. */
 async post(bearer:string,refInput:string,value:unknown){
  const actor=await this.operator(bearer,true),voucherRef=reference(refInput);
  const body=form(value,["requestKey","expectedVersion"]);
  const key=reference(body.requestKey),expected=number(body.expectedVersion);
  const hash=digest(["POST_ORIGINAL_VOUCHER",voucherRef,expected]);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.journals.post");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
   const v=await this.voucher(client,actor,voucherRef,true);
   const prior=await this.command(client,actor,key);
   if(prior){
    if(prior.action!=="POST"||prior.request_digest!==hash||
      prior.voucher_version!==expected)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    await client.query("COMMIT");
    return {confirmed:true,status:"POSTED",replayed:true};
   }
   await guardAssistanceOwner(client,actor.realmId,"PAYMENT",voucherRef);
   if(v.version!==expected||!v.approval_case_id||!v.proof_file_id||!v.proof_file_revision||
    !(v.status==="APPROVED"&&!["PAYMENT","CONTRA"].includes(v.voucher_type)||
      v.status==="PAID_VERIFIED"&&["PAYMENT","CONTRA"].includes(v.voucher_type)))
    throw new ConflictException({code:"FINANCE_VOUCHER_POSTING_NOT_READY"});
   const revision=await client.query<{payload_digest:string}>(`
    SELECT payload_digest FROM finance_voucher_draft_revision
    WHERE root_realm_id=$1 AND voucher_id=$2 AND version=$3 FOR SHARE`,
    [actor.realmId,voucherRef,v.version]);
   if(!revision.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   const sourceDigest=revision.rows[0].payload_digest;
   const original={caseRef:v.approval_case_id,voucherRef,sourceVersion:v.version,
    digest:sourceDigest,proofRef:v.proof_file_id,proofRevision:v.proof_file_revision};
   const caseEffect=await this.approvals.guardFinalApproval(client,actor,original);
   await this.evidence.guardFrozenProof(client,actor,voucherRef,v.version,
     sourceDigest,v.proof_file_id,v.proof_file_revision);
   if(v.status==="PAID_VERIFIED"){
    const payment=await client.query<{id:string;proof_file_id:string;proof_file_version:number}>(`
     SELECT id,proof_file_id,proof_file_version
     FROM finance_voucher_payment_verification
     WHERE root_realm_id=$1 AND voucher_id=$2 AND voucher_revision=$3
      AND status='VERIFIED' FOR SHARE`,
     [actor.realmId,voucherRef,v.version]);
    if(!payment.rows[0])
     throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
    await this.evidence.guardPaymentProof(client,actor,voucherRef,v.version,
     payment.rows[0].proof_file_id,payment.rows[0].proof_file_version);
   }
   const payrollBound=!!(await client.query("SELECT 1 FROM payroll_payout_attempt WHERE root_realm_id=$1 AND voucher_ref=$2",[actor.realmId,voucherRef])).rowCount;
   const payrollLines=payrollBound?(await client.query<{accountRef:string;branchRef:string;debitMinor:string;creditMinor:string}>(`SELECT account_ref AS "accountRef",branch_ref AS "branchRef",dr::text AS "debitMinor",cr::text AS "creditMinor" FROM cg11_payroll_posting_lines($1,$2)`,[actor.realmId,voucherRef])).rows:null;
   if(payrollBound&&(!payrollLines?.length||v.status!=="PAID_VERIFIED"))throw new ConflictException({code:"FINANCE_VOUCHER_POSTING_NOT_READY"});
   const signature=digest(["CG09_APPROVED_VOUCHER_POST_V1",voucherRef,v.version,
    sourceDigest,v.approval_case_id,v.proof_file_id,v.proof_file_revision,
    v.debit_account_id,v.credit_account_id,v.total_minor,
    v.status==="PAID_VERIFIED"?"INDEPENDENT_PAYMENT_VERIFIED":"ACCRUED_NOT_PAID",...(payrollLines?[payrollLines]:[])]);
   // The CG-03 final owner-effect key is an immutable unique UUID source event.
   const journalRef=await this.posting.postBalanced(client,actor,{
    financialYearRef:v.financial_year_id,postingDate:v.posting_date,
    sourceRef:v.id,eventKey:caseEffect.effect_key,immutableDigest:signature,
    kind:"VOUCHER",description:"Verified Finance voucher "+v.voucher_number,payrollAllocation:payrollBound,
    lines:payrollLines??[
      {accountRef:v.debit_account_id,branchRef:v.branch_id,
       debitMinor:v.total_minor,creditMinor:"0"},
      {accountRef:v.credit_account_id,branchRef:v.branch_id,
       debitMinor:"0",creditMinor:v.total_minor}
    ]
   });
   await client.query(`
    INSERT INTO finance_voucher_posting(root_realm_id,voucher_id,voucher_revision,
     approval_case_id,journal_id,original_digest,posted_by)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [actor.realmId,v.id,v.version,v.approval_case_id,journalRef,signature,actor.accountId]);
   await client.query(`
    UPDATE finance_voucher SET status='POSTED',updated_at=now()
    WHERE id=$1 AND root_realm_id=$2 AND status=$3`,
    [voucherRef,actor.realmId,v.status]);
   await this.register(client,actor,v,{action:"POST",key,digest:hash,status:"POSTED"});
   await client.query("COMMIT");
   return {confirmed:true,status:"POSTED",voucherNumber:v.voucher_number,
    journalPosted:true,paidVerified:v.status==="PAID_VERIFIED",replayed:false};
  }catch(e){await client.query("ROLLBACK");
   safePaymentFailure(e);
  }finally{client.release();}
 }
}
