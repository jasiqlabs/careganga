import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {FinanceClaimApprovalService} from "../../cg-03-registration-approvals/application/finance-claim-approval.service";
import {FinanceClaimEvidenceService} from "../../cg-19-documents-notifications/application/finance-claim-evidence.service";
import {FinanceClaimBillSourceFacade} from "../../cg-19-documents-notifications/application/finance-claim-bill-source.facade";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(code:string,field?:string):never{
 throw new BadRequestException({code,...(field?{field}:{})});
}
function keyOf(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))
  return invalid("FINANCE_CLAIM_REQUEST_KEY_INVALID","requestKey");
 return value;
}
function label(value:unknown,field:"purpose"|"category",min:number,max:number):string{
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  return invalid(field==="purpose"?"FINANCE_CLAIM_PURPOSE_INVALID":"FINANCE_CLAIM_CATEGORY_INVALID",field);
 return value.trim().replace(/\s+/g," ");
}
function dateOnly(value:unknown):string{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  return invalid("FINANCE_CLAIM_DATE_INVALID","expenseDate");
 const date=new Date(value+"T00:00:00Z");
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
  return invalid("FINANCE_CLAIM_DATE_INVALID","expenseDate");
 return value;
}
function amount(value:unknown):string{
 if(typeof value!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(value))
  return invalid("FINANCE_CLAIM_AMOUNT_INVALID","amount");
 const [r,p=""]=value.split(".");
 const minor=BigInt(r)*100n+BigInt((p+"00").slice(0,2));
 if(minor<=0n||minor>99999999999999n)
  return invalid("FINANCE_CLAIM_AMOUNT_INVALID","amount");
 return minor.toString();
}
type Normal={key:string;purpose:string;category:string;expenseDate:string;amountMinor:string};
function parse(input:unknown):Normal{
 if(!input||typeof input!=="object"||Array.isArray(input))
  return invalid("FINANCE_CLAIM_FORM_INVALID");
 const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["requestKey","purpose","category","expenseDate","amount"].includes(k)))
  return invalid("FINANCE_CLAIM_FORM_INVALID");
 return {key:keyOf(v.requestKey),purpose:label(v.purpose,"purpose",3,500),
  category:label(v.category,"category",2,80),
  expenseDate:dateOnly(v.expenseDate),amountMinor:amount(v.amount)};
}
type Claim={id:string;status:string;version:number;create_digest:string};
@Injectable()
export class FinanceExpenseClaimService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly approvals:FinanceClaimApprovalService,
  private readonly evidence:FinanceClaimEvidenceService,
  private readonly billSource:FinanceClaimBillSourceFacade){}
 /** Real CG-01 Foundation requester; never invent an HR employee/volunteer. */
 async create(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const v=parse(input),digest=createHash("sha256").update(JSON.stringify(
   ["CG09_CLAIM_DRAFT_V1",v.purpose,v.category,v.expenseDate,v.amountMinor]
  )).digest("hex");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.create");
   const created=await client.query<Claim>(
    "INSERT INTO expense_claim(root_realm_id,requested_by,category_label,purpose,"+
    " expense_date,amount_minor,create_request_key,create_digest,current_digest) "+
    " VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) "+
    " ON CONFLICT(root_realm_id,requested_by,create_request_key) DO NOTHING "+
    " RETURNING id,status,version,create_digest",
    [actor.realmId,actor.accountId,v.category,v.purpose,v.expenseDate,
     v.amountMinor,v.key,digest,digest]);
   let row=created.rows[0],replayed=false;
   if(!row){
    const found=await client.query<Claim>(
     "SELECT id,status,version,create_digest FROM expense_claim "+
     "WHERE root_realm_id=$1 AND requested_by=$2 AND create_request_key=$3 FOR SHARE",
     [actor.realmId,actor.accountId,v.key]);
    row=found.rows[0];
    if(!row||row.create_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT",field:"requestKey"});
    replayed=true;
   }else{
    await client.query(
     "INSERT INTO expense_claim_revision(root_realm_id,claim_id,version,current_digest,"+
     "category_label,purpose,expense_date,amount_minor,recorded_by) "+
     "VALUES($1,$2,1,$3,$4,$5,$6,$7,$8)",
     [actor.realmId,row.id,digest,v.category,v.purpose,v.expenseDate,v.amountMinor,actor.accountId]);
    await client.query(
     "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
     "VALUES($1,$2,'CLAIM',$3,'CLAIM_DRAFT_CREATED',$4)",
     [actor.realmId,actor.accountId,row.id,v.key]);
   }
   await client.query("COMMIT");
   return {confirmed:true,claimRef:row.id,status:row.status,version:row.version,
    replayed,nextStep:"VERIFIED_BILL_REQUIRED_BEFORE_SUBMISSION"};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async mine(bearer:string,offsetInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.view");
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   return invalid("FINANCE_CLAIM_FILTER_INVALID","offset");
  const offset=Number(offsetInput??"0");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.view");
   const result=await client.query<{
    claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;
    amountMinor:string;status:string;version:number;createdAt:Date}>(
    "SELECT id AS \"claimRef\",claim_number AS \"claimNumber\",category_label AS category,purpose, "+
    "expense_date::text AS \"expenseDate\",amount_minor::text AS \"amountMinor\", "+
    "status,version,created_at AS \"createdAt\" FROM expense_claim "+
    "WHERE root_realm_id=$1 AND requested_by=$2 "+
    "ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET $3",
    [actor.realmId,actor.accountId,offset]);
   await client.query("COMMIT");
   return {claims:result.rows.slice(0,30),nextOffset:result.rows.length>30?offset+30:null};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 /** Lost-response check: same actor and request key, no second draft. */
 async command(bearer:string,keyInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const key=keyOf(keyInput);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.create");
   const result=await client.query<{id:string;status:string;version:number}>(
    "SELECT id,status,version FROM expense_claim "+
    "WHERE root_realm_id=$1 AND requested_by=$2 AND create_request_key=$3",
    [actor.realmId,actor.accountId,key]);
   await client.query("COMMIT");
   return result.rows[0]?{confirmed:true,claimRef:result.rows[0].id,
    status:result.rows[0].status,version:result.rows[0].version}:
    {confirmed:false,status:"NOT_FOUND"};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }

 /** Every original claim transition is keyed by the authenticated actor and
  * request digest. The result is persisted in the SAME transaction as the source.
  */
 /** Correct only a genuinely returned CG03 case, preserving the SAME claim
  * business reference and all immutable old bill/case revisions.
  */
 async correctReturned(bearer:string,claimInput:string,value:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const claimRef=keyOf(claimInput);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["requestKey","expectedVersion","purpose","category","expenseDate","amount"].includes(k)))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const key=keyOf(body.requestKey);
  if(!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
   return invalid("FINANCE_CLAIM_STALE","expectedVersion");
  const expected=Number(body.expectedVersion);
  const v={purpose:label(body.purpose,"purpose",3,500),
   category:label(body.category,"category",2,80),
   expenseDate:dateOnly(body.expenseDate),amountMinor:amount(body.amount)};
  const revision=expected+1;
  const hash=createHash("sha256").update(JSON.stringify([
   "CG09_CLAIM_CORRECTED_V1",claimRef,revision,v.purpose,v.category,
   v.expenseDate,v.amountMinor])).digest("hex");
  const digest=createHash("sha256").update(JSON.stringify([
   "CORRECT_CLAIM",claimRef,expected,hash])).digest("hex");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.create");
   const existing=await tx.query<{request_digest:string;result_status:string}>(
    "SELECT request_digest,result_status FROM expense_claim_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,claimRef,status:"DRAFT",
     version:revision,replayed:true};
   }
   const current=await tx.query<{id:string;version:number;status:string;requested_by:string;
    approval_case_id:string|null}>(
    "SELECT id,version,status,requested_by,approval_case_id FROM expense_claim "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,claimRef]);
   const row=current.rows[0];
   if(!row||row.requested_by!==actor.accountId||row.status!=="RETURNED"||
      row.version!==expected||!row.approval_case_id)
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   const decision=await tx.query(
    "SELECT c.id FROM cg03_case c JOIN cg03_case_decision d "+
    "ON d.case_id=c.id AND d.realm_id=c.realm_id "+
    "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='FINANCE_REIMBURSEMENT' "+
    "AND c.finance_claim_id=$3 AND c.finance_claim_revision=$4 "+
    "AND c.status='RETURNED' AND d.action='RETURN' "+
    "AND d.fresh_password_verified_at IS NOT NULL FOR SHARE OF c,d",
    [row.approval_case_id,actor.realmId,claimRef,expected]);
   if(!decision.rowCount)
    throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   await tx.query(
    "INSERT INTO expense_claim_revision(root_realm_id,claim_id,version,current_digest,"+
    "category_label,purpose,expense_date,amount_minor,recorded_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [actor.realmId,claimRef,revision,hash,v.category,v.purpose,v.expenseDate,
     v.amountMinor,actor.accountId]);
   const changed=await tx.query(
    "UPDATE expense_claim SET category_label=$3,purpose=$4,expense_date=$5,"+
    "amount_minor=$6,version=$7,current_digest=$8,status='DRAFT',"+
    "bill_file_id=NULL,bill_file_version=NULL,approval_case_id=NULL "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='RETURNED' AND version=$9 RETURNING id",
    [claimRef,actor.realmId,v.category,v.purpose,v.expenseDate,v.amountMinor,
     revision,hash,expected]);
   if(changed.rowCount!==1)throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   await tx.query(
    "INSERT INTO expense_claim_command(root_realm_id,claim_id,actor_ref,request_key,"+
    "action,request_digest,result_status,case_id) "+
    "VALUES($1,$2,$3,$4,'CORRECT',$5,'DRAFT',$6)",
    [actor.realmId,claimRef,actor.accountId,key,digest,row.approval_case_id]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'CLAIM',$3,'CLAIM_CORRECTED_AFTER_RETURN',$4)",
    [actor.realmId,actor.accountId,claimRef,key]);
   await tx.query("COMMIT");
   return {confirmed:true,claimRef,status:"DRAFT",version:revision,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="P0919")
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   throw e;
  }finally{tx.release();}
 }
 async submit(bearer:string,claimInput:string,payload:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const claimRef=keyOf(claimInput);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const body=payload as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["requestKey","expectedVersion","billFileRef","billVersion"].includes(k)))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const requestKey=keyOf(body.requestKey),fileRef=keyOf(body.billFileRef);
  if(!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1||
     !Number.isSafeInteger(body.billVersion)||Number(body.billVersion)<1)
   return invalid("FINANCE_CLAIM_STALE","expectedVersion");
  const version=Number(body.expectedVersion),fileVersion=Number(body.billVersion);
  const digest=createHash("sha256").update(JSON.stringify([
   "CG09_CLAIM_SUBMIT_V1",claimRef,version,fileRef,fileVersion
  ])).digest("hex");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.create");
   const existing=await tx.query<{request_digest:string;result_status:string;case_id:string}>(
    "SELECT request_digest,result_status,case_id FROM expense_claim_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,claimRef,caseRef:existing.rows[0].case_id,
     status:existing.rows[0].result_status,replayed:true};
   }
   const found=await tx.query<{
    id:string;requested_by:string;version:number;status:string;create_digest:string;
    category_label:string}>(
    "SELECT id,requested_by,version,status,current_digest,category_label "+
    "FROM expense_claim WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [claimRef,actor.realmId]);
   const claim=found.rows[0];
   if(!claim||claim.requested_by!==actor.accountId||claim.version!==version||
      claim.status!=="DRAFT")
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   await this.evidence.guardVerifiedBill(tx,actor,claimRef,version,fileRef,fileVersion);
   const created=await this.approvals.createCase(tx,actor,{
    claimRef,version,digest:claim.current_digest,fileRef,fileVersion,
    requestKey,categoryLabel:claim.category_label
   });
   const change=await tx.query(
    "UPDATE expense_claim SET status='SUBMITTED',bill_file_id=$3,bill_file_version=$4,"+
    "approval_case_id=$5 WHERE id=$1 AND root_realm_id=$2 AND status='DRAFT' "+
    "AND version=$6 RETURNING id",
    [claimRef,actor.realmId,fileRef,fileVersion,created.caseRef,version]);
   if(change.rowCount!==1)throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   await tx.query(
    "INSERT INTO expense_claim_command(root_realm_id,claim_id,actor_ref,request_key,"+
    "action,request_digest,result_status,case_id) "+
    "VALUES($1,$2,$3,$4,'SUBMIT',$5,'SUBMITTED',$6)",
    [actor.realmId,claimRef,actor.accountId,requestKey,digest,created.caseRef]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'CLAIM',$3,'CLAIM_SUBMITTED',$4)",
    [actor.realmId,actor.accountId,claimRef,requestKey]);
   await tx.query("COMMIT");
   return {confirmed:true,claimRef,caseRef:created.caseRef,
    status:"SUBMITTED",replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&e.code==="P0919")
    throw new ConflictException({code:"FINANCE_CLAIM_BILL_CONFLICT"});
   throw e;
  }finally{tx.release();}
 }
 /** Independently reconcile a protected CG03 decision. No posting or payment. */
 async reconcile(bearer:string,claimInput:string,payload:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.manage");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const claimRef=keyOf(claimInput);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const body=payload as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["caseRef","requestKey"].includes(k)))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const caseRef=keyOf(body.caseRef),requestKey=keyOf(body.requestKey);
  const digest=createHash("sha256").update(JSON.stringify([
   "CG09_RECONCILE_CLAIM",claimRef,caseRef
  ])).digest("hex");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.manage");
   const previous=await tx.query<{request_digest:string;result_status:string}>(
    "SELECT request_digest,result_status FROM expense_claim_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,requestKey]);
   if(previous.rows[0]){
    if(previous.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,claimRef,status:previous.rows[0].result_status,replayed:true};
   }
   const result=await tx.query<{status:string;version:number;current_digest:string;
    bill_file_id:string|null;bill_file_version:number|null;approval_case_id:string|null}>(
    "SELECT status,version,current_digest,bill_file_id,bill_file_version,"+
    "approval_case_id FROM expense_claim WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [claimRef,actor.realmId]);
   const claim=result.rows[0];
   if(!claim||claim.approval_case_id!==caseRef||!claim.bill_file_id||
      !claim.bill_file_version)
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   const outcome=await this.approvals.outcome(tx,actor,claimRef,claim.version,
    claim.current_digest,claim.bill_file_id,claim.bill_file_version,caseRef);
   const status=["PENDING_OWNER","OWNER_COMPLETED"].includes(outcome.status)?
    "APPROVED":outcome.status;
   if(status==="APPROVED"){
    await this.billSource.guardForReviewer(tx,actor,{
     claimRef,claimVersion:claim.version,fileRef:claim.bill_file_id,
     fileVersion:claim.bill_file_version});
   }
   if(claim.status==="SUBMITTED"){
    const changed=await tx.query(
     "UPDATE expense_claim SET status=$3 WHERE id=$1 AND root_realm_id=$2 "+
     "AND status='SUBMITTED' RETURNING id",[claimRef,actor.realmId,status]);
    if(changed.rowCount!==1)throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   }else if(claim.status!==status)
    throw new ConflictException({code:"FINANCE_CLAIM_STALE"});
   if(status==="APPROVED")await this.approvals.finish(tx,actor,caseRef);
   await tx.query(
    "INSERT INTO expense_claim_command(root_realm_id,claim_id,actor_ref,"+
    "request_key,action,request_digest,result_status,case_id) "+
    "VALUES($1,$2,$3,$4,'RECONCILE',$5,$6,$7)",
    [actor.realmId,claimRef,actor.accountId,requestKey,digest,status,caseRef]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'CLAIM',$3,$4,$5)",
    [actor.realmId,actor.accountId,claimRef,"CLAIM_REVIEW_"+status,requestKey]);
   await tx.query("COMMIT");
   return {confirmed:true,claimRef,status,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** An original expense voucher posts once. A separate paid-verified PAYMENT
  * voucher relieves that same liability. No second expense or shadow ledger.
  */
 async linkVoucher(bearer:string,claimInput:string,payload:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  const claimRef=keyOf(claimInput);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const body=payload as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["voucherRef","linkKind","requestKey"].includes(k)))
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const voucherRef=keyOf(body.voucherRef),requestKey=keyOf(body.requestKey),
   kind=body.linkKind;
  if(kind!=="PAYABLE"&&kind!=="PAYOUT")
   return invalid("FINANCE_CLAIM_FORM_INVALID");
  const digest=createHash("sha256").update(JSON.stringify([
   "CG09_CLAIM_VOUCHER_LINK",claimRef,voucherRef,kind
  ])).digest("hex");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.manage");
   const existing=await tx.query<{request_digest:string;result_status:string}>(
    "SELECT request_digest,result_status FROM expense_claim_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,claimRef,voucherRef,linkKind:kind,replayed:true};
   }
   const claim=await tx.query(
    "SELECT id FROM expense_claim WHERE root_realm_id=$1 AND id=$2 "+
    "AND status='APPROVED' FOR UPDATE",[actor.realmId,claimRef]);
   if(!claim.rowCount)
    throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   const voucher=await tx.query<{id:string;journal_id:string}>(
    "SELECT v.id,p.journal_id FROM finance_voucher v "+
    "JOIN finance_voucher_posting p ON p.root_realm_id=v.root_realm_id "+
    "AND p.voucher_id=v.id WHERE v.root_realm_id=$1 AND v.id=$2 "+
    "AND v.status='POSTED' FOR SHARE OF v,p",
    [actor.realmId,voucherRef]);
   if(!voucher.rows[0])
    throw new ConflictException({code:"FINANCE_CLAIM_VOUCHER_INVALID"});
   await tx.query(
    "INSERT INTO expense_claim_voucher_link(root_realm_id,claim_id,voucher_id,"+
    "link_kind,ledger_journal_id,actor_ref,request_key) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor.realmId,claimRef,voucherRef,kind,voucher.rows[0].journal_id,
     actor.accountId,requestKey]);
   await tx.query(
    "INSERT INTO expense_claim_command(root_realm_id,claim_id,actor_ref,request_key,"+
    "action,request_digest,result_status,voucher_id) "+
    "VALUES($1,$2,$3,$4,$5,$6,'CONFIRMED',$7)",
    [actor.realmId,claimRef,actor.accountId,requestKey,
     kind==="PAYABLE"?"LINK_PAYABLE":"LINK_PAYMENT",digest,voucherRef]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,"+
    "action,request_key) VALUES($1,$2,'CLAIM',$3,$4,$5)",
    [actor.realmId,actor.accountId,claimRef,
     kind==="PAYABLE"?"CLAIM_PAYABLE_POSTED":"CLAIM_PAYMENT_VERIFIED",requestKey]);
   await tx.query("COMMIT");
   return {confirmed:true,claimRef,voucherRef,linkKind:kind,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&
       ["23505","P0920","23503"].includes(String(e.code)))
    throw new ConflictException({code:"FINANCE_CLAIM_VOUCHER_INVALID"});
   throw e;
  }finally{tx.release();}
 }
 async detail(bearer:string,claimInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.view");
  const claimRef=keyOf(claimInput);
  const rows=await this.db.query<{
   claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;amountMinor:string;
   status:string;version:number;caseRef:string|null;billFileRef:string|null;
   billVersion:number|null;payableVoucherNumber:string|null;
   payoutVoucherNumber:string|null}>(
   "SELECT c.id AS \"claimRef\",c.claim_number AS \"claimNumber\",c.category_label AS category,c.purpose,"+
   "c.expense_date::text AS \"expenseDate\",c.amount_minor::text AS \"amountMinor\","+
   "c.status,c.version,c.approval_case_id AS \"caseRef\",c.bill_file_id AS \"billFileRef\","+
   "c.bill_file_version AS \"billVersion\",pv.voucher_number AS \"payableVoucherNumber\","+
   "mv.voucher_number AS \"payoutVoucherNumber\" FROM expense_claim c "+
   "LEFT JOIN expense_claim_voucher_link pl ON pl.root_realm_id=c.root_realm_id "+
   "AND pl.claim_id=c.id AND pl.link_kind='PAYABLE' "+
   "LEFT JOIN finance_voucher pv ON pv.id=pl.voucher_id AND pv.root_realm_id=c.root_realm_id "+
   "LEFT JOIN expense_claim_voucher_link ml ON ml.root_realm_id=c.root_realm_id "+
   "AND ml.claim_id=c.id AND ml.link_kind='PAYOUT' "+
   "LEFT JOIN finance_voucher mv ON mv.id=ml.voucher_id AND mv.root_realm_id=c.root_realm_id "+
   "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.requested_by=$3",
   [actor.realmId,claimRef,actor.accountId]);
  if(!rows.rows[0])throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return rows.rows[0];
 }
 async workflowCommand(bearer:string,requestInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const key=keyOf(requestInput);
  const rows=await this.db.query<{result_status:string}>(
   "SELECT result_status FROM expense_claim_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key]);
  return {confirmed:!!rows.rows[0],status:rows.rows[0]?.result_status??null};
 }


 /** Business-labelled claim options, for finance operator linking a new voucher
  * to the approved source. No unrestricted staff/volunteer directory. */
 async approvedOptions(bearer:string,queryInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  if(queryInput!==undefined&&(typeof queryInput!=="string"||queryInput.length>80))
   return invalid("FINANCE_CLAIM_FILTER_INVALID","search");
  const query=(queryInput??"").trim();
  const pattern="%"+query.replace(/[\\%_]/g,v=>"\\"+v)+"%";
  const rows=await this.db.query<{claimRef:string;claimNumber:string;version:number;
   category:string;purpose:string;amountMinor:string}>(
   "SELECT id AS \"claimRef\",claim_number AS \"claimNumber\",version,"+
   "category_label AS category,purpose,amount_minor::text AS \"amountMinor\" "+
   "FROM expense_claim WHERE root_realm_id=$1 AND status='APPROVED' "+
   "AND (claim_number ILIKE $2 ESCAPE '\\' OR category_label ILIKE $2 ESCAPE '\\' "+
   "OR purpose ILIKE $2 ESCAPE '\\') "+
   "ORDER BY created_at DESC,id DESC LIMIT 31",
   [actor.realmId,pattern]);
  return {claims:rows.rows.slice(0,30),hasMore:rows.rows.length>30};
 }


 /** Foundation finance register: real claims, current case and posted-voucher
  * links only; purpose is visible to explicitly authorized claim managers. */
 async managed(bearer:string,offsetInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.manage");
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   return invalid("FINANCE_CLAIM_FILTER_INVALID","offset");
  const offset=Number(offsetInput??"0");
  const rows=await this.db.query<{
   claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;
   amountMinor:string;status:string;version:number;approvalCaseRef:string|null;
   payableVoucherNumber:string|null;payoutVoucherNumber:string|null}>(
   "SELECT c.id AS \"claimRef\",c.claim_number AS \"claimNumber\","+
   "c.category_label AS category,c.purpose,c.expense_date::text AS \"expenseDate\","+
   "c.amount_minor::text AS \"amountMinor\",c.status,c.version,"+
   "c.approval_case_id AS \"approvalCaseRef\","+
   "pv.voucher_number AS \"payableVoucherNumber\","+
   "mv.voucher_number AS \"payoutVoucherNumber\" "+
   "FROM expense_claim c LEFT JOIN expense_claim_voucher_link pl "+
   "ON pl.root_realm_id=c.root_realm_id AND pl.claim_id=c.id AND pl.link_kind='PAYABLE' "+
   "LEFT JOIN finance_voucher pv ON pv.id=pl.voucher_id AND pv.root_realm_id=c.root_realm_id "+
   "LEFT JOIN expense_claim_voucher_link ml ON ml.root_realm_id=c.root_realm_id "+
   "AND ml.claim_id=c.id AND ml.link_kind='PAYOUT' "+
   "LEFT JOIN finance_voucher mv ON mv.id=ml.voucher_id AND mv.root_realm_id=c.root_realm_id "+
   "WHERE c.root_realm_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 31 OFFSET $2",
   [actor.realmId,offset]);
  return {claims:rows.rows.slice(0,30),nextOffset:rows.rows.length>30?offset+30:null};
 }

 async eligibleVouchers(bearer:string,claimInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  const claimRef=keyOf(claimInput);
  const claim=await this.db.query(
   "SELECT id FROM expense_claim WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='APPROVED'",[claimRef,actor.realmId]);
  if(!claim.rowCount)
   throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
  const rows=await this.db.query<{voucherRef:string;voucherNumber:string;type:string;
   totalMinor:string;kind:string|null;postedAt:Date}>(
   "SELECT v.id AS \"voucherRef\",v.voucher_number AS \"voucherNumber\","+
   "v.voucher_type AS type,v.total_minor::text AS \"totalMinor\","+
   "l.link_kind AS kind,p.posted_at AS \"postedAt\" "+
   "FROM finance_voucher v JOIN finance_voucher_posting p "+
   "ON p.voucher_id=v.id AND p.root_realm_id=v.root_realm_id "+
   "LEFT JOIN expense_claim_voucher_link l ON l.voucher_id=v.id "+
   "AND l.root_realm_id=v.root_realm_id "+
   "WHERE v.root_realm_id=$1 AND v.expense_claim_id=$2 AND v.status='POSTED' "+
   "ORDER BY p.posted_at DESC,v.id DESC LIMIT 60",
   [actor.realmId,claimRef]);
  return {vouchers:rows.rows};
 }

}
