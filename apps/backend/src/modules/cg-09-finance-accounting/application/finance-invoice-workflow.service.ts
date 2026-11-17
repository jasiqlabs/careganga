import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import {financeSqlFailure} from "./finance-sql-error";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceInvoiceApprovalService} from "../../cg-03-registration-approvals/application/finance-invoice-approval.service";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import {FinanceInvoiceDocumentService} from "../../cg-19-documents-notifications/application/finance-invoice-document.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Invoice={id:string;version:number;current_digest:string;status:string;invoice_number:string;created_by:string;
 draft_payload:Record<string,unknown>;financial_year_id:string|null;branch_id:string|null;
 invoice_date:string|null;approval_case_id:string|null;receivable_account_id:string|null;
 income_account_id:string|null;tax_account_id:string|null;gross_minor:string|null;
 tax_minor:string|null;charges_minor:string|null;total_minor:string|null};
type JournalReply={confirmed:true;status:string;invoiceNumber:string;replayed:boolean};
const ident=(v:unknown,field="invoiceRef"):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:field==="invoiceRef"?
    "FINANCE_INVOICE_SOURCE_INVALID":"FINANCE_INVOICE_FORM_INVALID",field});
 return v;
};
const revision=(v:unknown):number=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"FINANCE_INVOICE_STALE",field:"expectedVersion"});
 return Number(v);
};
const input=(v:unknown,allowed:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.keys(v).some(k=>!allowed.includes(k)))
  throw new BadRequestException({code:"FINANCE_INVOICE_FORM_INVALID"});
 return v as Record<string,unknown>;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Command={request_digest:string;invoice_id:string;source_version:number;result_status:string};
@Injectable()
export class FinanceInvoiceWorkflowService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly approvals:FinanceInvoiceApprovalService,
  private readonly posting:FinanceJournalPostingService,
  private readonly documents:FinanceInvoiceDocumentService){}
 private async actor(bearer:string,capability:
  "finance.invoices.manage"|"finance.invoices.issue"){
  const actor=await this.sessions.requireAction(bearer,capability);
  return actor;
 }
 private async requireBranch(bearer:string,capability:
  "finance.invoices.view"|"finance.invoices.manage"|"finance.invoices.issue",
  branchRef:string|null,createdBy:string){
  const actor=await this.sessions.requireAction(bearer,capability);
  const scope=await this.branches.financeReportScope(bearer,capability);
  if(!scope.all&&(!branchRef||!scope.branchRefs.includes(branchRef))&&
    !(branchRef===null&&createdBy===actor.accountId))
   throw new ForbiddenException("This invoice is not available to your assigned branch");
 }
 private async load(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  const rows=await tx.query<Invoice>(
   "SELECT id,version,status,current_digest,invoice_number,created_by,draft_payload,"+
   "financial_year_id,branch_id,invoice_date::text,approval_case_id,"+
   "receivable_account_id,income_account_id,tax_account_id,"+
   "gross_minor::text,tax_minor::text,charges_minor::text,total_minor::text "+
   "FROM finance_invoice WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
   [ref,actor.realmId]);
  const x=rows.rows[0];
  if(!x)throw new ConflictException({code:"FINANCE_INVOICE_SOURCE_INVALID"});
  return x;
 }
 private async command(tx:PoolClient,actor:VerifiedFoundationActor,key:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [actor.realmId+":"+actor.accountId+":"+key]);
  const found=await tx.query<Command>(
   "SELECT request_digest,invoice_id,source_version,result_status "+
   "FROM finance_invoice_command WHERE root_realm_id=$1 "+
   "AND actor_ref=$2 AND request_key=$3 FOR SHARE",
   [actor.realmId,actor.accountId,key]);
  return found.rows[0]??null;
 }
 private async record(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,
  version:number,key:string,digest:string,action:"SUBMIT"|"RECONCILE"|"ACCRUAL_POST"|"ISSUE"|"COLLECTION_POST"|"RECEIPT_LINK",
  status:string){
  await tx.query(
   "INSERT INTO finance_invoice_command(root_realm_id,actor_ref,request_key,invoice_id,"+
   "action,request_digest,result_status,source_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
   [actor.realmId,actor.accountId,key,ref,action,digest,status,version]);
  await tx.query(
   "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
   "VALUES($1,$2,'INVOICE',$3,$4,$5)",
   [actor.realmId,actor.accountId,ref,"INVOICE_"+action+"_"+status,key]);
 }
 private async checkOriginal(tx:PoolClient,actor:VerifiedFoundationActor,x:Invoice){
  const d=x.draft_payload as {info?:Record<string,unknown>;items?:Record<string,unknown>;
    payment?:Record<string,unknown>};
  const i=d.info,j=d.items,p=d.payment;
  if(!i||!j||!p||!Array.isArray(j.rows)||
     typeof i.financialYearRef!=="string"||!UUID.test(i.financialYearRef)||
     typeof i.invoiceDate!=="string"||typeof i.dueDate!=="string"||
     typeof p.receivableAccountRef!=="string"||!UUID.test(p.receivableAccountRef)||
     typeof p.incomeAccountRef!=="string"||!UUID.test(p.incomeAccountRef)||
     (p.taxAccountRef!==null&&p.taxAccountRef!==undefined&&
      (typeof p.taxAccountRef!=="string"||!UUID.test(p.taxAccountRef))))
   throw new ConflictException({code:"FINANCE_INVOICE_INCOMPLETE"});
  const fy=await tx.query<{start_on:string;end_on:string;status:string}>(
   "SELECT start_on::text,end_on::text,status FROM financial_year "+
   "WHERE id=$1 AND root_realm_id=$2 FOR SHARE",
   [i.financialYearRef,actor.realmId]);
  const y=fy.rows[0];
  if(!y||y.status!=="OPEN"||i.invoiceDate<y.start_on||i.invoiceDate>y.end_on||
     i.dueDate<i.invoiceDate)throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
  const branch=typeof i.branchRef==="string"&&i.branchRef?i.branchRef:null;
  if(branch)await this.branches.requireFinanceBranchVersion(tx,actor,branch,
   Number(i.branchVersion),"finance.invoices.manage");
  const refs=[p.receivableAccountRef,p.incomeAccountRef,
   ...(p.taxAccountRef?[p.taxAccountRef]:[])];
  if(new Set(refs).size!==refs.length)
   throw new ConflictException({code:"FINANCE_INVOICE_ACCOUNT_INVALID"});
  const acc=await tx.query<{id:string;category:string;account_kind:string;branch_id:string|null}>(
   "SELECT a.id,g.category,a.account_kind,a.branch_id FROM finance_account a JOIN account_group g "+
   "ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND "+
   "a.id=ANY($2::uuid[]) FOR SHARE OF a,g",
   [actor.realmId,refs]);
  const map=new Map(acc.rows.map(a=>[a.id,a]));
  const good=(ref:string,c:string)=>map.get(ref)?.category===c&&
   (c!=="ASSET"||map.get(ref)?.account_kind==="GENERAL")&&
   (map.get(ref)?.branch_id===null||map.get(ref)?.branch_id===branch);
  if(!good(String(p.receivableAccountRef),"ASSET")||
     !good(String(p.incomeAccountRef),"INCOME")||
     (p.taxAccountRef&&!good(String(p.taxAccountRef),"LIABILITY"))||
     (BigInt(String(j.taxMinor??"0"))>0n&&!p.taxAccountRef))
   throw new ConflictException({code:"FINANCE_INVOICE_ACCOUNT_INVALID"});
  return {info:i,items:j,payment:p,branch};
 }
 async submit(bearer:string,invoiceInput:string,payload:unknown){
  const actor=await this.actor(bearer,"finance.invoices.manage"),ref=ident(invoiceInput),
   v=input(payload,["requestKey","expectedVersion"]),
   key=ident(v.requestKey,"requestKey"),version=revision(v.expectedVersion),
   digest=hash(["INVOICE_SUBMIT_V1",ref,version]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
   const old=await this.command(tx,actor,key);
   if(old){if(old.request_digest!==digest)
    throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};}
   const x=await this.load(tx,actor,ref);
   if(x.status!=="DRAFT"||x.version!==version)
    throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   const facts=await this.checkOriginal(tx,actor,x);
   await this.requireBranch(bearer,"finance.invoices.manage",facts.branch,x.created_by);
   const caseRow=await this.approvals.createCase(tx,actor,{
    invoiceRef:ref,version,digest:x.current_digest,number:x.invoice_number,key});
   const i=facts.info,j=facts.items,p=facts.payment;
   const change=await tx.query(
    "UPDATE finance_invoice SET status='SUBMITTED',approval_case_id=$3,"+
    "financial_year_id=$4,branch_id=$5,invoice_date=$6,due_date=$7,"+
    "category_label=$8,purpose=$9,counterparty_name=$10,counterparty_address=$11,"+
    "gross_minor=$12,tax_minor=$13,charges_minor=$14,total_minor=$15,"+
    "receivable_account_id=$16,income_account_id=$17,tax_account_id=$18,"+
    "updated_at=now() WHERE id=$1 AND root_realm_id=$2 "+
    "AND status='DRAFT' AND version=$19 RETURNING id",
    [ref,actor.realmId,caseRow.caseRef,i.financialYearRef,facts.branch,
     i.invoiceDate,i.dueDate,i.category,i.purpose,i.counterpartyName,
     i.counterpartyAddress,j.grossMinor,j.taxMinor,j.chargesMinor,j.totalMinor,
     p.receivableAccountRef,p.incomeAccountRef,p.taxAccountRef??null,version]);
   if(change.rowCount!==1)
    throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   // Reissue follows the normal invoice review, accrual and original CG19 PDF.
   // This one immutable link is the only added correction-specific source.
   if(typeof i.replacesInvoiceRef==="string"&&i.replacesInvoiceRef){
    const prior=await tx.query<{id:string}>(
     "SELECT id FROM finance_invoice_credit_note "+
     "WHERE root_realm_id=$1 AND invoice_id=$2 FOR SHARE",
     [actor.realmId,i.replacesInvoiceRef]);
    if(!prior.rows[0])
     throw new ConflictException({code:"FINANCE_INVOICE_REISSUE_CONFLICT"});
    const existing=await tx.query<{original_invoice_id:string}>(
     "SELECT original_invoice_id FROM finance_invoice_reissue_link "+
     "WHERE root_realm_id=$1 AND replacement_invoice_id=$2 FOR SHARE",
     [actor.realmId,ref]);
    if(existing.rows[0]){
     if(existing.rows[0].original_invoice_id!==i.replacesInvoiceRef)
      throw new ConflictException({code:"FINANCE_INVOICE_REISSUE_CONFLICT"});
    }else await tx.query(
     "INSERT INTO finance_invoice_reissue_link(root_realm_id,original_invoice_id,"+
     "replacement_invoice_id,original_credit_note_id,recorded_by) "+
     "VALUES($1,$2,$3,$4,$5)",
     [actor.realmId,i.replacesInvoiceRef,ref,prior.rows[0].id,actor.accountId]);
   }
   await this.record(tx,actor,ref,version,key,digest,"SUBMIT","SUBMITTED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"SUBMITTED",invoiceNumber:x.invoice_number,
    caseNumber:caseRow.caseNumber,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async reconcile(bearer:string,invoiceInput:string,payload:unknown){
  const actor=await this.actor(bearer,"finance.invoices.manage"),ref=ident(invoiceInput),
   v=input(payload,["requestKey"]),key=ident(v.requestKey,"requestKey"),
   digest=hash(["INVOICE_RECONCILE_V1",ref]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
   const old=await this.command(tx,actor,key);
   if(old){if(old.request_digest!==digest)
    throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};}
   const x=await this.load(tx,actor,ref);
   await this.requireBranch(bearer,"finance.invoices.manage",x.branch_id,x.created_by);
   if(!x.approval_case_id||x.status!=="SUBMITTED")
    throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   const caseRef=x.approval_case_id;
   const outcome=await this.approvals.outcome(tx,actor,{
    caseRef,invoiceRef:ref,version:x.version,digest:x.current_digest});
   const status=["PENDING_OWNER","OWNER_COMPLETED"].includes(outcome.status)?
    "APPROVED":outcome.status;
   if(!["APPROVED","RETURNED","REJECTED"].includes(status))
    throw new ConflictException({code:"FINANCE_INVOICE_REVIEW_UNAVAILABLE"});
   const updated=await tx.query(
    "UPDATE finance_invoice SET status=$3,updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='SUBMITTED' RETURNING id",
    [ref,actor.realmId,status]);
   if(updated.rowCount!==1)throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   if(status==="APPROVED")await this.approvals.finish(tx,actor,caseRef);
   await this.record(tx,actor,ref,x.version,key,digest,"RECONCILE",status);
   await tx.query("COMMIT");
   return {confirmed:true,status,invoiceNumber:x.invoice_number,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async post(bearer:string,invoiceInput:string,payload:unknown):Promise<JournalReply>{
  const actor=await this.actor(bearer,"finance.invoices.manage");
  await this.sessions.requireAction(bearer,"finance.journals.post");
  const ref=ident(invoiceInput),v=input(payload,["requestKey"]),key=ident(v.requestKey,"requestKey"),
   digest=hash(["INVOICE_ACCRUAL_POST_V1",ref]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   const old=await this.command(tx,actor,key);
   if(old){if(old.request_digest!==digest)
    throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    const oldInvoice=await this.load(tx,actor,ref);
    await tx.query("COMMIT");
    return {confirmed:true,status:old.result_status,invoiceNumber:oldInvoice.invoice_number,replayed:true};}
   const x=await this.load(tx,actor,ref);
   await this.requireBranch(bearer,"finance.invoices.manage",x.branch_id,x.created_by);
   if(x.status!=="APPROVED"||!x.approval_case_id||
      !x.financial_year_id||!x.invoice_date||!x.receivable_account_id||
      !x.income_account_id||!x.total_minor||!x.gross_minor||
      x.tax_minor===null||x.charges_minor===null)
    throw new ConflictException({code:"FINANCE_INVOICE_POSTING_NOT_READY"});
   const outcome=await this.approvals.outcome(tx,actor,{
    caseRef:x.approval_case_id,invoiceRef:ref,
    version:x.version,digest:x.current_digest});
   if(!outcome.effect_key||!["PENDING_OWNER","OWNER_COMPLETED"].includes(outcome.status))
    throw new ConflictException({code:"FINANCE_INVOICE_REVIEW_UNAVAILABLE"});
   const tax=BigInt(x.tax_minor),total=BigInt(x.total_minor),
    base=BigInt(x.gross_minor)+BigInt(x.charges_minor);
   if(base<=0n||tax<0n||tax+base!==total||
      tax>0n&&!x.tax_account_id)
    throw new ConflictException({code:"FINANCE_INVOICE_POSTING_NOT_READY"});
   const digestPosted=hash(["CG09_APPROVED_INVOICE_ACCRUAL_V1",ref,x.version,
    x.current_digest,x.approval_case_id,x.receivable_account_id,
    x.income_account_id,x.tax_account_id,total.toString()]);
   const lines=[
    {accountRef:x.receivable_account_id,branchRef:x.branch_id,
     debitMinor:total.toString(),creditMinor:"0"},
    {accountRef:x.income_account_id,branchRef:x.branch_id,
     debitMinor:"0",creditMinor:base.toString()},
    ...(tax>0n&&x.tax_account_id?[{accountRef:x.tax_account_id,
     branchRef:x.branch_id,debitMinor:"0",creditMinor:tax.toString()}]:[])
   ];
   const journalRef=await this.posting.postBalanced(tx,actor,{
    financialYearRef:x.financial_year_id,postingDate:x.invoice_date,
    sourceRef:ref,eventKey:outcome.effect_key,immutableDigest:digestPosted,
    kind:"INVOICE",description:"Approved Foundation invoice "+x.invoice_number,lines
   });
   await tx.query(
    "INSERT INTO finance_invoice_posting(root_realm_id,invoice_id,invoice_version,"+
    "approval_case_id,journal_id,original_digest,posted_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor.realmId,ref,x.version,x.approval_case_id,journalRef,digestPosted,actor.accountId]);
   const changed=await tx.query(
    "UPDATE finance_invoice SET status='POSTED',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='APPROVED' RETURNING id",
    [ref,actor.realmId]);
   if(changed.rowCount!==1)
    throw new ConflictException({code:"FINANCE_INVOICE_POSTING_NOT_READY"});
   await this.record(tx,actor,ref,x.version,key,digest,"ACCRUAL_POST","POSTED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"POSTED",invoiceNumber:x.invoice_number,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 /** CG19 stores and verifies real PDF bytes first. This is a separate
  * idempotent command; a failed provider never marks an invoice ISSUED.
  */
 async issue(bearer:string,invoiceInput:string,payload:unknown){
  const actor=await this.actor(bearer,"finance.invoices.issue"),
   ref=ident(invoiceInput),v=input(payload,["requestKey"]),key=ident(v.requestKey,"requestKey");
  const digest=hash(["INVOICE_ISSUE_V1",ref]);
  // External PDF issuance cannot be inside the transaction. CG19 uses the same
  // original source key and document-status lookup for any uncertain result.
  const original=await this.db.query<{branch_id:string|null;created_by:string}>(
   "SELECT branch_id,created_by FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
   [ref,actor.realmId]);
  if(!original.rows[0])throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
  await this.requireBranch(bearer,"finance.invoices.issue",
   original.rows[0].branch_id,original.rows[0].created_by);
  const result=await this.documents.issue(bearer,ref,key);
  if(result.status!=="ISSUED")
   return {confirmed:false,status:result.status,issueDocumentRef:result.documentRef??null};
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.issue");
   const old=await this.command(tx,actor,key);
   if(old){if(old.request_digest!==digest)
    throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};}
   const x=await this.load(tx,actor,ref);
   await this.requireBranch(bearer,"finance.invoices.issue",x.branch_id,x.created_by);
   if(x.status!=="POSTED")
    throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
   const changed=await tx.query(
    "UPDATE finance_invoice SET status='ISSUED',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='POSTED' RETURNING id",
    [ref,actor.realmId]);
   if(changed.rowCount!==1)
    throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   await this.record(tx,actor,ref,x.version,key,digest,"ISSUE","ISSUED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"ISSUED",invoiceNumber:x.invoice_number,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 /** Bank-statement verification is a real separate source. A receipt link
  * references exactly one existing journal, never posts income a second time.
  */
 /** Source-linked collection journal is real bank debit/receivable credit, never
  * a verified payment until an independent statement reviewer confirms the
  * bank line. Each request key is one immutable balanced journal source.
  */
 async collectionOptions(bearer:string,invoiceInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  await this.sessions.requireAction(bearer,"finance.journals.post");
  const ref=ident(invoiceInput);
  const source=await this.db.query<{status:string;branch_id:string|null;created_by:string;
   receivable_account_id:string;total_minor:string}>(
   "SELECT status,branch_id,created_by,receivable_account_id,total_minor::text "+
   "FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
   [ref,actor.realmId]);
  const invoice=source.rows[0];
  if(!invoice||invoice.status!=="ISSUED")
   throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
  const credited=await this.db.query("SELECT id FROM finance_invoice_credit_note "+
   "WHERE root_realm_id=$1 AND invoice_id=$2",[actor.realmId,ref]);
  if(credited.rowCount)
   throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
  await this.requireBranch(bearer,"finance.invoices.issue",invoice.branch_id,invoice.created_by);
  const [banks,years]=await Promise.all([
   this.db.query<{accountRef:string;code:string;name:string}>(
    "SELECT id AS \"accountRef\",code,name FROM finance_account "+
    "WHERE root_realm_id=$1 AND status='ACTIVE' AND account_kind='BANK' "+
    "AND (branch_id IS NULL OR branch_id=$2::uuid) ORDER BY name,id LIMIT 50",
    [actor.realmId,invoice.branch_id]),
   this.db.query<{yearRef:string;name:string;startOn:string;endOn:string}>(
    "SELECT id AS \"yearRef\",name,start_on::text AS \"startOn\",end_on::text AS \"endOn\" "+
    "FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' ORDER BY start_on DESC LIMIT 20",
    [actor.realmId])
  ]);
  return {banks:banks.rows,years:years.rows};
 }
 async recordCollection(bearer:string,invoiceInput:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  await this.sessions.requireAction(bearer,"finance.journals.post");
  const ref=ident(invoiceInput);
  const v=input(raw,["requestKey","bankAccountRef","financialYearRef","postingDate","amount"]);
  const key=ident(v.requestKey,"requestKey"),bank=ident(v.bankAccountRef,"bankAccountRef"),fy=ident(v.financialYearRef,"financialYearRef");
  const date=String(v.postingDate??"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))||
     new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)
   throw new BadRequestException({code:"FINANCE_INVOICE_DATE_INVALID",field:"postingDate"});
  if(typeof v.amount!=="string"||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(v.amount))
   throw new BadRequestException({code:"FINANCE_INVOICE_AMOUNT_INVALID",field:"amount"});
  const [rupee,paise=""]=v.amount.split(".");
  const amount=BigInt(rupee)*100n+BigInt((paise+"00").slice(0,2));
  if(amount<=0n||amount>99999999999999n)
   throw new BadRequestException({code:"FINANCE_INVOICE_AMOUNT_INVALID",field:"amount"});
  const requestDigest=hash(["INVOICE_BANK_COLLECTION_POST_V1",ref,bank,fy,date,amount.toString()]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.issue");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   const old=await this.command(tx,actor,key);
   if(old){
    if(old.request_digest!==requestDigest)
     throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:old.result_status,replayed:true};
   }
   const x=await this.load(tx,actor,ref);
   await this.requireBranch(bearer,"finance.invoices.issue",x.branch_id,x.created_by);
   if(x.status!=="ISSUED"||!x.total_minor||!x.receivable_account_id)
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const credited=await tx.query("SELECT id FROM finance_invoice_credit_note "+
    "WHERE root_realm_id=$1 AND invoice_id=$2 FOR SHARE",[actor.realmId,ref]);
   if(credited.rowCount)
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   if(x.branch_id)
    await this.branches.requireFinanceActiveBranch(tx,actor,x.branch_id,"finance.journals.post");
   const years=await tx.query<{id:string}>(
    "SELECT id FROM financial_year WHERE id=$1 AND root_realm_id=$2 "+
    "AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",
    [fy,actor.realmId,date]);
   if(!years.rows[0])throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
   const banks=await tx.query<{id:string}>(
    "SELECT id FROM finance_account WHERE id=$1 AND root_realm_id=$2 "+
    "AND account_kind='BANK' AND status='ACTIVE' "+
    "AND (branch_id IS NULL OR branch_id=$3::uuid) FOR SHARE",
    [bank,actor.realmId,x.branch_id]);
   if(!banks.rows[0]||bank===x.receivable_account_id)
    throw new ConflictException({code:"FINANCE_INVOICE_ACCOUNT_INVALID"});
   const posted=await tx.query<{total:string}>(
    "SELECT COALESCE(SUM(l.debit_minor),0)::text AS total "+
    "FROM journal j JOIN journal_line l ON l.journal_id=j.id "+
    "AND l.root_realm_id=j.root_realm_id "+
    "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "WHERE j.root_realm_id=$1 AND j.source_ref=$2 AND j.posting_kind='GENERAL' "+
    "AND j.status='POSTED' AND a.account_kind='BANK'",
    [actor.realmId,ref]);
   if(BigInt(posted.rows[0].total)+amount>BigInt(x.total_minor))
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const journalRef=await this.posting.postBalanced(tx,actor,{
    financialYearRef:fy,postingDate:date,sourceRef:ref,eventKey:key,
    immutableDigest:hash(["INVOICE_ORIGINAL_BANK_COLLECTION",ref,
     x.version,x.current_digest,bank,fy,date,amount.toString()]),
    kind:"GENERAL",description:"Invoice "+x.invoice_number+" bank receipt pending reconciliation",
    lines:[
     {accountRef:bank,branchRef:x.branch_id,debitMinor:amount.toString(),creditMinor:"0"},
     {accountRef:x.receivable_account_id,branchRef:x.branch_id,
      debitMinor:"0",creditMinor:amount.toString()}
    ]
   });
   await this.record(tx,actor,ref,x.version,key,requestDigest,"COLLECTION_POST","POSTED_UNVERIFIED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"POSTED_UNVERIFIED",journalRecorded:true,
    journalRef,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async receiptOptions(bearer:string,invoiceInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  const ref=ident(invoiceInput);
  const invoice=await this.db.query<{total_minor:string;receivable_account_id:string;
   branch_id:string|null;created_by:string;status:string}>(
   "SELECT total_minor::text,receivable_account_id,branch_id,created_by,status "+
   "FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
   [ref,actor.realmId]);
  const x=invoice.rows[0];
  if(!x||x.status!=="ISSUED")
   throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
  await this.requireBranch(bearer,"finance.invoices.issue",x.branch_id,x.created_by);
  const credited=await this.db.query("SELECT id FROM finance_invoice_credit_note "+
   "WHERE root_realm_id=$1 AND invoice_id=$2",[actor.realmId,ref]);
  if(credited.rowCount)return {matches:[],hasMore:false,outstandingMinor:"0"};
  const paid=await this.db.query<{paid:string}>(
   "SELECT COALESCE(SUM(amount_minor),0)::text AS paid FROM finance_invoice_receipt "+
   "WHERE root_realm_id=$1 AND invoice_id=$2",[actor.realmId,ref]);
  const remaining=BigInt(x.total_minor)-BigInt(paid.rows[0].paid);
  if(remaining<=0n)return {matches:[],hasMore:false,outstandingMinor:"0"};
  const rows=await this.db.query<{reconciliationRef:string;bankName:string;
   statementDate:string;amountMinor:string;statementHint:string}>(
   "SELECT r.id AS \"reconciliationRef\",a.name AS \"bankName\","+
   "r.statement_date::text AS \"statementDate\","+
   "r.statement_amount_minor::text AS \"amountMinor\","+
   "right(r.bank_item_ref,4) AS \"statementHint\" "+
   "FROM finance_bank_reconciliation r "+
   "JOIN finance_account a ON a.id=r.bank_account_id AND a.root_realm_id=r.root_realm_id "+
   "JOIN journal j ON j.id=r.journal_id AND j.root_realm_id=r.root_realm_id "+
   "JOIN journal_line bl ON bl.journal_id=r.journal_id AND bl.root_realm_id=r.root_realm_id "+
   "AND bl.account_id=r.bank_account_id "+
   "JOIN journal_line ar ON ar.journal_id=r.journal_id AND ar.root_realm_id=r.root_realm_id "+
   "AND ar.account_id=$3 AND ar.credit_minor=r.statement_amount_minor "+
   "WHERE r.root_realm_id=$1 AND r.status='VERIFIED' AND r.variance_minor=0 "+
   "AND r.statement_amount_minor>0 AND r.statement_amount_minor<=$4 "+
   "AND r.posted_amount_minor=r.statement_amount_minor "+
   "AND EXISTS (SELECT 1 FROM finance_reconciliation_decision d "+
   "JOIN cg19_stored_file f ON f.id=d.statement_file_id "+
   "AND f.realm_id=d.root_realm_id AND f.reconciliation_id=d.reconciliation_id "+
   "AND f.revision=d.statement_file_version "+
   "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id "+
   "AND i.realm_id=f.realm_id AND i.reconciliation_id=d.reconciliation_id "+
   "WHERE d.root_realm_id=r.root_realm_id AND d.reconciliation_id=r.id "+
   "AND d.action='VERIFY' AND f.owner_kind='CG09_BANK_STATEMENT' "+
   "AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' "+
   "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL) "+
   "AND j.posting_kind='GENERAL' AND j.status='POSTED' AND j.source_ref=$2 "+
   "AND bl.debit_minor=r.statement_amount_minor AND bl.credit_minor=0 "+
   "AND ar.debit_minor=0 "+
   "AND bl.branch_id IS NOT DISTINCT FROM $5::uuid "+
   "AND ar.branch_id IS NOT DISTINCT FROM $5::uuid "+
   "AND NOT EXISTS(SELECT 1 FROM finance_invoice_receipt f "+
   "WHERE f.root_realm_id=r.root_realm_id AND f.reconciliation_id=r.id) "+
   "ORDER BY r.statement_date DESC,r.id DESC LIMIT 51",
   [actor.realmId,ref,x.receivable_account_id,remaining.toString(),x.branch_id]);
  return {matches:rows.rows.slice(0,50),hasMore:rows.rows.length>50,
   outstandingMinor:remaining.toString()};
 }
 async linkReceipt(bearer:string,invoiceInput:string,payload:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  const ref=ident(invoiceInput),v=input(payload,["requestKey","reconciliationRef"]),
   key=ident(v.requestKey,"requestKey"),matchRef=ident(v.reconciliationRef,"reconciliationRef");
  const fingerprint=hash(["CG09_REAL_INVOICE_RECEIPT_LINK",ref,matchRef]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.issue");
   const old=await this.command(tx,actor,key);
   if(old){
    if(old.request_digest!==fingerprint)
     throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:old.result_status,replayed:true};
   }
   const x=await this.load(tx,actor,ref);
   await this.requireBranch(bearer,"finance.invoices.issue",x.branch_id,x.created_by);
   if(x.status!=="ISSUED"||!x.total_minor)
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const credited=await tx.query("SELECT id FROM finance_invoice_credit_note "+
    "WHERE root_realm_id=$1 AND invoice_id=$2 FOR SHARE",[actor.realmId,ref]);
   if(credited.rowCount)
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const match=await tx.query<{journal_id:string;statement_date:string;
    statement_amount_minor:string;status:string}>(
    "SELECT journal_id,statement_date::text,statement_amount_minor::text,status "+
    "FROM finance_bank_reconciliation WHERE id=$1 AND root_realm_id=$2 FOR SHARE",
    [matchRef,actor.realmId]);
   const m=match.rows[0];
   if(!m||m.status!=="VERIFIED"||BigInt(m.statement_amount_minor)<=0n)
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const previous=await tx.query<{total:string}>(
    "SELECT COALESCE(SUM(amount_minor),0)::text AS total FROM finance_invoice_receipt "+
    "WHERE root_realm_id=$1 AND invoice_id=$2",[actor.realmId,ref]);
   const newPaid=BigInt(previous.rows[0].total)+BigInt(m.statement_amount_minor);
   if(newPaid>BigInt(x.total_minor))
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   const digest=hash(["ORIGINAL_PAID_RECEIPT",ref,x.version,x.current_digest,
    m.journal_id,matchRef,m.statement_amount_minor]);
   const inserted=await tx.query<{receipt_number:string}>(
    "INSERT INTO finance_invoice_receipt(root_realm_id,invoice_id,"+
    "source_invoice_version,journal_id,reconciliation_id,amount_minor,"+
    "receipt_date,recorded_by,request_key,immutable_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING receipt_number",
    [actor.realmId,ref,x.version,m.journal_id,matchRef,
     m.statement_amount_minor,m.statement_date,actor.accountId,key,digest]);
   const paymentStatus=newPaid===BigInt(x.total_minor)?"PAID_VERIFIED":"PARTIALLY_PAID";
   await this.record(tx,actor,ref,x.version,key,fingerprint,"RECEIPT_LINK",paymentStatus);
   await tx.query("COMMIT");
   return {confirmed:true,status:paymentStatus,
    receiptNumber:inserted.rows[0].receipt_number,paidMinor:newPaid.toString(),
    outstandingMinor:(BigInt(x.total_minor)-newPaid).toString(),replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&
      ["23505","23514","P0927","P0928"].includes(String(e.code)))
    throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   financeSqlFailure(e,"invoice");
  }finally{tx.release();}
 }
 async receiptStatus(bearer:string,invoiceInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=ident(invoiceInput);
  const invoice=await this.db.query<{total:string;status:string;credited:boolean;branch_id:string|null;created_by:string}>(
   "SELECT i.total_minor::text AS total,i.status,i.branch_id,i.created_by,"+
   "EXISTS(SELECT 1 FROM finance_invoice_credit_note c "+
   "WHERE c.root_realm_id=i.root_realm_id AND c.invoice_id=i.id) AS credited "+
   "FROM finance_invoice i WHERE i.id=$1 AND i.root_realm_id=$2",[ref,actor.realmId]);
  const original=invoice.rows[0];
  if(!original||original.status!=="ISSUED")
   throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
  await this.requireBranch(bearer,"finance.invoices.view",original.branch_id,original.created_by);
  const receipts=await this.db.query<{receiptRef:string;receiptNumber:string;
   amountMinor:string;paidDate:string}>(
   "SELECT id AS \"receiptRef\",receipt_number AS \"receiptNumber\","+
   "amount_minor::text AS \"amountMinor\",receipt_date::text AS \"paidDate\" "+
   "FROM finance_invoice_receipt WHERE root_realm_id=$1 AND invoice_id=$2 "+
   "ORDER BY created_at DESC,id DESC LIMIT 100",
   [actor.realmId,ref]);
  const totals=await this.db.query<{paid:string}>(
   "SELECT COALESCE(SUM(amount_minor),0)::text AS paid FROM finance_invoice_receipt "+
   "WHERE root_realm_id=$1 AND invoice_id=$2",[actor.realmId,ref]);
  const paid=BigInt(totals.rows[0].paid);
  const outstanding=original.credited?0n:BigInt(original.total)-paid;
  const state=original.credited?"CREDITED":paid===0n?"NOT_VERIFIED":
   outstanding===0n?"PAID_VERIFIED":"PARTIALLY_PAID";
  return {paymentVerified:paid>0n,status:state,totalMinor:original.total,
   paidMinor:paid.toString(),outstandingMinor:outstanding.toString(),
   receipts:receipts.rows,hasMore:receipts.rows.length===100};
 }
 async commandStatus(bearer:string,requestKey:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const row=await this.db.query<Command>(
   "SELECT request_digest,invoice_id,source_version,result_status "+
   "FROM finance_invoice_command WHERE root_realm_id=$1 AND actor_ref=$2 "+
   "AND request_key=$3",[actor.realmId,actor.accountId,ident(requestKey)]);
  return {confirmed:!!row.rows[0],status:row.rows[0]?.result_status??"NOT_FOUND"};
 }
}
