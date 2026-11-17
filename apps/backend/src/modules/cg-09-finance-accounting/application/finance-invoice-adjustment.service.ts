import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import {financeSqlFailure} from "./finance-sql-error";
import {renderOriginalFinanceCreditNote} from "../../cg-19-documents-notifications/application/finance-credit-note-pdf-renderer";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(x:unknown,field="invoiceRef"):string=>{
 if(typeof x!=="string"||!UUID.test(x))
  throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID",field});
 return x;
};
const day=(x:unknown):string=>{
 if(typeof x!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x)||
    Number.isNaN(Date.parse(x+"T00:00:00Z"))||
    new Date(x+"T00:00:00Z").toISOString().slice(0,10)!==x)
  throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID",field:"postingDate"});
 return x;
};
const input=(raw:unknown,keys:string[]):Record<string,unknown>=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID"});
 return raw as Record<string,unknown>;
};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const reasonText=(x:unknown)=>{
 if(typeof x!=="string"||x.trim().length<8||x.trim().length>300)
  throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID",field:"reason"});
 return x.trim().replace(/\s+/g," ");
};
const password=(x:unknown):string=>{
 if(typeof x!=="string"||x.length<8||Buffer.byteLength(x,"utf8")>1024)
  throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID",field:"currentPassword"});
 return x;
};
type Original={id:string;status:string;version:number;created_by:string;
 branch_id:string|null;total_minor:string;gross_minor:string;tax_minor:string;
 charges_minor:string;receivable_account_id:string;income_account_id:string;
 tax_account_id:string|null;invoice_number:string};
type Note={id:string;invoice_id:string;credit_note_number:string;total_minor:string;
 collected_minor:string;refund_liability_account_id:string|null;approved_by:string;
 adjustment_journal_id:string;};
type Refund={id:string;invoice_id:string;credit_note_id:string;amount_minor:string;
 bank_account_id:string;financial_year_id:string;posting_date:string;
 requested_by:string;status:string;request_digest:string;request_key:string;
 approved_by:string|null;approval_key:string|null;approval_journal_id:string|null;
 transfer_reference:string|null};
@Injectable()
export class FinanceInvoiceAdjustmentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly branches:BranchSourceFacade,
  private readonly posting:FinanceJournalPostingService){}
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.review");
  await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"approvals.review");
  return actor;
 }
 private async scope(bearer:string,capability:
  "finance.invoices.view"|"finance.invoices.manage"|"finance.invoices.review",
  branch:string|null){
  const rights=await this.branches.financeReportScope(bearer,capability);
  if(!rights.all&&(!branch||!rights.branchRefs.includes(branch)))
   throw new ForbiddenException("This invoice belongs to another Foundation branch");
 }
 async options(bearer:string,invoiceRef:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(invoiceRef);
  const inv=await this.db.query<{branch_id:string|null}>(
   "SELECT branch_id FROM finance_invoice WHERE root_realm_id=$1 AND id=$2",
   [actor.realmId,ref]);
  if(!inv.rows[0])throw new ConflictException({code:"FINANCE_ADJUSTMENT_NOT_FOUND"});
  await this.scope(bearer,"finance.invoices.view",inv.rows[0].branch_id);
  const [accounts,years,banks]=await Promise.all([
   this.db.query<{ref:string;code:string;name:string}>(
    "SELECT a.id AS ref,a.code,a.name FROM finance_account a JOIN account_group g "+
    "ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
    "WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND "+
    "g.category='LIABILITY' AND a.account_kind='GENERAL' "+
    "AND (a.branch_id IS NULL OR a.branch_id=$2::uuid) ORDER BY a.name LIMIT 100",
    [actor.realmId,inv.rows[0].branch_id]),
   this.db.query<{ref:string;name:string}>(
    "SELECT id AS ref,name FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' "+
    "ORDER BY start_on DESC LIMIT 20",[actor.realmId]),
   this.db.query<{ref:string;code:string;name:string}>(
    "SELECT id AS ref,code,name FROM finance_account "+
    "WHERE root_realm_id=$1 AND account_kind='BANK' AND status='ACTIVE' "+
    "AND (branch_id IS NULL OR branch_id=$2::uuid) ORDER BY name LIMIT 100",
    [actor.realmId,inv.rows[0].branch_id])
  ]);
  return {refundLiabilityAccounts:accounts.rows,years:years.rows,banks:banks.rows};
 }
 async detail(bearer:string,invoiceRef:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view"),ref=id(invoiceRef);
  const original=await this.db.query<{invoice_number:string;status:string;branch_id:string|null}>(
   "SELECT invoice_number,status,branch_id FROM finance_invoice "+
   "WHERE id=$1 AND root_realm_id=$2",[ref,actor.realmId]);
  if(!original.rows[0])throw new ConflictException({code:"FINANCE_ADJUSTMENT_NOT_FOUND"});
  await this.scope(bearer,"finance.invoices.view",original.rows[0].branch_id);
  const note=await this.db.query<Note>(
   "SELECT id,invoice_id,credit_note_number,total_minor::text,collected_minor::text,"+
   "refund_liability_account_id,approved_by,adjustment_journal_id "+
   "FROM finance_invoice_credit_note WHERE root_realm_id=$1 AND invoice_id=$2",
   [actor.realmId,ref]);
  const refunds=await this.db.query<Refund & {verified:boolean}>(
   "SELECT r.*,EXISTS(SELECT 1 FROM finance_bank_reconciliation m "+
   "WHERE m.root_realm_id=r.root_realm_id AND m.journal_id=r.approval_journal_id "+
   "AND m.bank_account_id=r.bank_account_id AND m.status='VERIFIED' "+
   "AND m.bank_item_ref=r.transfer_reference "+
   "AND m.statement_amount_minor=-r.amount_minor "+
   "AND m.posted_amount_minor=-r.amount_minor "+
   "AND m.variance_minor=0) AS verified "+
   "FROM finance_invoice_refund r WHERE r.root_realm_id=$1 AND r.invoice_id=$2",
   [actor.realmId,ref]);
  const replacement=await this.db.query<{invoiceNumber:string;status:string}>(
   "SELECT i.invoice_number AS \"invoiceNumber\",i.status "+
   "FROM finance_invoice_reissue_link l JOIN finance_invoice i "+
   "ON i.id=l.replacement_invoice_id AND i.root_realm_id=l.root_realm_id "+
   "WHERE l.root_realm_id=$1 AND l.original_invoice_id=$2 "+
   "ORDER BY (i.status<>'REJECTED') DESC,l.created_at DESC LIMIT 1",
   [actor.realmId,ref]);
  const refund=refunds.rows[0];
  return {invoiceNumber:original.rows[0].invoice_number,
   invoiceStatus:original.rows[0].status,replacementInvoice:replacement.rows[0]??null,
   creditNote:note.rows[0]??null,
   refund:refund?{refundRef:refund.id,amountMinor:refund.amount_minor,
    status:refund.status==="REQUESTED"?"PENDING_APPROVAL":
     refund.verified?"PAID_VERIFIED":"BANK_POSTED_AWAITING_STATEMENT",
    bankAccountRef:refund.bank_account_id,financialYearRef:refund.financial_year_id,
    postingDate:refund.posting_date,canReview:refund.status==="REQUESTED"}:null};
 }
 async credit(bearer:string,invoiceInput:string,raw:unknown){
  const actor=await this.reviewer(bearer),invoiceRef=id(invoiceInput);
  const v=input(raw,["requestKey","financialYearRef","postingDate","reason",
    "currentPassword","refundLiabilityAccountRef"]);
  const key=id(v.requestKey,"requestKey"),fy=id(v.financialYearRef,"financialYearRef"),
   date=day(v.postingDate),reason=reasonText(v.reason),
   proof=password(v.currentPassword),
   liability=v.refundLiabilityAccountRef?id(v.refundLiabilityAccountRef,"refundLiabilityAccountRef"):null;
  const fingerprint=hash(["ISSUED_CREDIT_NOTE_V1",invoiceRef,fy,date,reason,liability]);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.review");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const previous=await tx.query<{invoice_id:string;request_digest:string;
    credit_note_number:string}>(
    "SELECT invoice_id,request_digest,credit_note_number FROM finance_invoice_credit_note "+
    "WHERE root_realm_id=$1 AND approved_by=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(previous.rows[0]){
    if(previous.rows[0].request_digest!==fingerprint||
      previous.rows[0].invoice_id!==invoiceRef)
     throw new ConflictException({code:"FINANCE_CREDIT_NOTE_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:"CREDIT_NOTE_POSTED",
     creditNoteNumber:previous.rows[0].credit_note_number,replayed:true};
   }
   const invoice=await tx.query<Original>(
    "SELECT id,status,version,created_by,branch_id,total_minor::text,"+
    "gross_minor::text,tax_minor::text,charges_minor::text,receivable_account_id,"+
    "income_account_id,tax_account_id,invoice_number FROM finance_invoice "+
    "WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",[invoiceRef,actor.realmId]);
   const x=invoice.rows[0];
   if(!x||x.status!=="ISSUED"||x.created_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_CREDIT_NOTE_CONFLICT"});
   await this.scope(bearer,"finance.invoices.review",x.branch_id);
   const exists=await tx.query("SELECT id FROM finance_invoice_credit_note "+
    "WHERE root_realm_id=$1 AND invoice_id=$2 FOR SHARE",[actor.realmId,invoiceRef]);
   if(exists.rowCount)throw new ConflictException({code:"FINANCE_CREDIT_NOTE_ALREADY_EXISTS"});
   const original=await tx.query<{journal_id:string}>(
    "SELECT p.journal_id FROM finance_invoice_posting p "+
    "WHERE p.root_realm_id=$1 AND p.invoice_id=$2 FOR SHARE",[actor.realmId,invoiceRef]);
   if(!original.rows[0])throw new ConflictException({code:"FINANCE_CREDIT_NOTE_CONFLICT"});
   const amounts=await tx.query<{paid:string;posted:string}>(
    "SELECT (SELECT COALESCE(SUM(amount_minor),0)::text FROM finance_invoice_receipt "+
    "WHERE root_realm_id=$1 AND invoice_id=$2) AS paid,"+
    "(SELECT COALESCE(SUM(l.debit_minor),0)::text FROM journal j JOIN journal_line l "+
    "ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id "+
    "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "WHERE j.root_realm_id=$1 AND j.source_ref=$2 AND j.posting_kind='GENERAL' "+
    "AND a.account_kind='BANK') AS posted",[actor.realmId,invoiceRef]);
   const paid=BigInt(amounts.rows[0].paid),posted=BigInt(amounts.rows[0].posted),
    total=BigInt(x.total_minor),base=BigInt(x.gross_minor)+BigInt(x.charges_minor),
    tax=BigInt(x.tax_minor);
   if(paid!==posted||paid>total||total!==base+tax||base<=0n)
    throw new ConflictException({code:"FINANCE_CREDIT_NOTE_COLLECTION_PENDING"});
   if((paid>0n)!==Boolean(liability))
    throw new BadRequestException({code:"FINANCE_CREDIT_NOTE_REFUND_ACCOUNT_REQUIRED",
     field:"refundLiabilityAccountRef"});
   if(liability){
    const acc=await tx.query<{category:string;account_kind:string}>(
     "SELECT g.category,a.account_kind FROM finance_account a JOIN account_group g "+
     "ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
     "WHERE a.root_realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' "+
     "AND (a.branch_id IS NULL OR a.branch_id=$3::uuid) FOR SHARE OF a,g",
     [actor.realmId,liability,x.branch_id]);
    if(acc.rows[0]?.category!=="LIABILITY"||acc.rows[0]?.account_kind!=="GENERAL"||
      liability===x.tax_account_id)
     throw new ConflictException({code:"FINANCE_CREDIT_NOTE_REFUND_ACCOUNT_REQUIRED"});
   }
   const lines=[
    {accountRef:x.income_account_id,branchRef:x.branch_id,
     debitMinor:base.toString(),creditMinor:"0"},
    ...(tax>0n&&x.tax_account_id?[{accountRef:x.tax_account_id,branchRef:x.branch_id,
     debitMinor:tax.toString(),creditMinor:"0"}]:[]),
    ...(total>paid?[{accountRef:x.receivable_account_id,branchRef:x.branch_id,
     debitMinor:"0",creditMinor:(total-paid).toString()}]:[]),
    ...(paid>0n&&liability?[{accountRef:liability,branchRef:x.branch_id,
     debitMinor:"0",creditMinor:paid.toString()}]:[])
   ];
   const journal=await this.posting.postBalanced(tx,actor,{
    financialYearRef:fy,postingDate:date,sourceRef:invoiceRef,eventKey:key,
    kind:"CREDIT_NOTE",reversalOfRef:original.rows[0].journal_id,
    immutableDigest:hash(["ISSUED_CREDIT_LEDGER_V1",fingerprint,total.toString(),paid.toString()]),
    description:"Credit note for "+x.invoice_number+": "+reason,lines});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,proof);
   const saved=await tx.query<{id:string;credit_note_number:string}>(
    "INSERT INTO finance_invoice_credit_note(root_realm_id,invoice_id,invoice_version,"+
    "original_journal_id,adjustment_journal_id,total_minor,collected_minor,"+
    "refund_liability_account_id,approved_by,request_key,request_digest,reason,password_verified_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()) "+
    "RETURNING id,credit_note_number",
    [actor.realmId,invoiceRef,x.version,original.rows[0].journal_id,journal,
     total.toString(),paid.toString(),liability,actor.accountId,key,fingerprint,reason]);
   await tx.query("INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,"+
    "action,request_key) VALUES($1,$2,'INVOICE',$3,'ISSUED_CREDIT_NOTE_POSTED',$4)",
    [actor.realmId,actor.accountId,invoiceRef,key]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"CREDIT_NOTE_POSTED",
    creditNoteRef:saved.rows[0].id,creditNoteNumber:saved.rows[0].credit_note_number,
    refundRequired:paid>0n,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async requestRefund(bearer:string,invoiceInput:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.manage"),
   invoiceRef=id(invoiceInput);
  const v=input(raw,["requestKey","bankAccountRef","financialYearRef","postingDate"]);
  const key=id(v.requestKey,"requestKey"),bank=id(v.bankAccountRef,"bankAccountRef"),
   fy=id(v.financialYearRef,"financialYearRef"),date=day(v.postingDate);
  const fingerprint=hash(["CREDIT_NOTE_REFUND_REQUEST_V1",invoiceRef,bank,fy,date]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const existing=await tx.query<Refund>(
    "SELECT * FROM finance_invoice_refund WHERE root_realm_id=$1 "+
    "AND requested_by=$2 AND request_key=$3 FOR SHARE",[actor.realmId,actor.accountId,key]);
   if(existing.rows[0]){
    if(existing.rows[0].invoice_id!==invoiceRef||
       existing.rows[0].request_digest!==fingerprint)
     throw new ConflictException({code:"FINANCE_REFUND_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:existing.rows[0].status,refundRef:existing.rows[0].id,replayed:true};
   }
   const credit=await tx.query<Note & {branch_id:string|null}>(
    "SELECT c.id,c.invoice_id,c.collected_minor::text,c.refund_liability_account_id,"+
    "i.branch_id FROM finance_invoice_credit_note c JOIN finance_invoice i "+
    "ON i.id=c.invoice_id AND i.root_realm_id=c.root_realm_id "+
    "WHERE c.root_realm_id=$1 AND c.invoice_id=$2 FOR SHARE OF c,i",
    [actor.realmId,invoiceRef]);
   const c=credit.rows[0];
   if(!c||BigInt(c.collected_minor)<=0n)
    throw new ConflictException({code:"FINANCE_REFUND_NOT_REQUIRED"});
   await this.scope(bearer,"finance.invoices.manage",c.branch_id);
   const current=await tx.query("SELECT id FROM finance_invoice_refund "+
    "WHERE root_realm_id=$1 AND credit_note_id=$2 FOR SHARE",[actor.realmId,c.id]);
   if(current.rowCount)throw new ConflictException({code:"FINANCE_REFUND_ALREADY_REQUESTED"});
   const bankValid=await tx.query(
    "SELECT id FROM finance_account WHERE root_realm_id=$1 AND id=$2 "+
    "AND account_kind='BANK' AND status='ACTIVE' "+
    "AND (branch_id IS NULL OR branch_id=$3::uuid) FOR SHARE",
    [actor.realmId,bank,c.branch_id]);
   if(!bankValid.rowCount)throw new ConflictException({code:"FINANCE_REFUND_BANK_INVALID"});
   const open=await tx.query(
    "SELECT id FROM financial_year WHERE id=$1 AND root_realm_id=$2 "+
    "AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",
    [fy,actor.realmId,date]);
   if(!open.rowCount)
    throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
   const saved=await tx.query<{id:string}>(
    "INSERT INTO finance_invoice_refund(root_realm_id,credit_note_id,invoice_id,"+
    "amount_minor,bank_account_id,financial_year_id,posting_date,requested_by,"+
    "request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    [actor.realmId,c.id,invoiceRef,c.collected_minor,bank,fy,date,
     actor.accountId,key,fingerprint]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"PENDING_APPROVAL",refundRef:saved.rows[0].id,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async approveRefund(bearer:string,refundInput:string,raw:unknown){
  const actor=await this.reviewer(bearer),refundRef=id(refundInput,"refundRef");
  const v=input(raw,["requestKey","currentPassword","transferReference"]);
  const key=id(v.requestKey,"requestKey"),proof=password(v.currentPassword);
  if(typeof v.transferReference!=="string"||
     !/^[A-Za-z0-9._/: -]{4,100}$/.test(v.transferReference.trim()))
   throw new BadRequestException({code:"FINANCE_ADJUSTMENT_INVALID",field:"transferReference"});
  const transferReference=v.transferReference.trim();
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.review");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const found=await tx.query<Refund & {branch_id:string|null;
    refund_liability_account_id:string}>(
    "SELECT r.*,i.branch_id,c.refund_liability_account_id "+
    "FROM finance_invoice_refund r JOIN finance_invoice_credit_note c "+
    "ON c.id=r.credit_note_id AND c.root_realm_id=r.root_realm_id "+
    "JOIN finance_invoice i ON i.id=r.invoice_id AND i.root_realm_id=r.root_realm_id "+
    "WHERE r.id=$1 AND r.root_realm_id=$2 FOR UPDATE OF r",
    [refundRef,actor.realmId]);
   const x=found.rows[0];
   if(!x)throw new ConflictException({code:"FINANCE_REFUND_NOT_FOUND"});
   await this.scope(bearer,"finance.invoices.review",x.branch_id);
   if(x.status==="BANK_POSTED"){
    if(x.approved_by===actor.accountId&&x.approval_key===key&&
       x.transfer_reference===transferReference){
     await tx.query("COMMIT");return {confirmed:true,status:"BANK_POSTED_AWAITING_STATEMENT",
      journalRef:x.approval_journal_id,replayed:true};
    }
    throw new ConflictException({code:"FINANCE_REFUND_ALREADY_APPROVED"});
   }
   if(x.status!=="REQUESTED"||x.requested_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_REFUND_INDEPENDENT_REVIEWER"});
   const amount=BigInt(x.amount_minor);
   const lines=[
    {accountRef:x.refund_liability_account_id,branchRef:x.branch_id,
     debitMinor:amount.toString(),creditMinor:"0"},
    {accountRef:x.bank_account_id,branchRef:x.branch_id,
     debitMinor:"0",creditMinor:amount.toString()}
   ];
   const journal=await this.posting.postBalanced(tx,actor,{
    financialYearRef:x.financial_year_id,postingDate:x.posting_date,
    sourceRef:x.id,eventKey:key,kind:"REFUND",
    immutableDigest:hash(["APPROVED_CREDIT_REFUND_V1",x.id,x.amount_minor,
     x.bank_account_id,x.financial_year_id,x.posting_date]),
    description:"Approved refund of credited issued invoice",lines});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,proof);
   const changed=await tx.query(
    "UPDATE finance_invoice_refund SET status='BANK_POSTED',approved_by=$3,"+
    "approved_at=now(),password_verified_at=now(),approval_key=$4,"+
    "approval_journal_id=$5,transfer_reference=$6 "+
    "WHERE id=$1 AND root_realm_id=$2 "+
    "AND status='REQUESTED' RETURNING id",
    [refundRef,actor.realmId,actor.accountId,key,journal,transferReference]);
   if(changed.rowCount!==1)
    throw new ConflictException({code:"FINANCE_REFUND_ALREADY_APPROVED"});
   await tx.query("INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,"+
    "action,request_key) VALUES($1,$2,'INVOICE',$3,'REFUND_BANK_JOURNAL_POSTED',$4)",
    [actor.realmId,actor.accountId,x.invoice_id,key]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"BANK_POSTED_AWAITING_STATEMENT",journalRef:journal,
    refundRef,replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async creditPdf(bearer:string,invoiceInput:string):Promise<Buffer>{
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  const ref=id(invoiceInput);
  const source=await this.db.query<{
   branch_id:string|null;noteNumber:string;invoiceNumber:string;invoiceDate:string;
   creditDate:string;counterparty:string;reason:string;totalMinor:string;
   collectedMinor:string;incomeMinor:string;taxMinor:string
  }>(
   "SELECT i.branch_id,c.credit_note_number AS \"noteNumber\","+
   "i.invoice_number AS \"invoiceNumber\",i.invoice_date::text AS \"invoiceDate\","+
   "c.created_at::date::text AS \"creditDate\","+
   "i.counterparty_name AS counterparty,c.reason,"+
   "c.total_minor::text AS \"totalMinor\","+
   "c.collected_minor::text AS \"collectedMinor\","+
   "(i.gross_minor+i.charges_minor)::text AS \"incomeMinor\","+
   "i.tax_minor::text AS \"taxMinor\" "+
   "FROM finance_invoice_credit_note c JOIN finance_invoice i "+
   "ON i.id=c.invoice_id AND i.root_realm_id=c.root_realm_id "+
   "WHERE c.root_realm_id=$1 AND c.invoice_id=$2",[actor.realmId,ref]);
  const x=source.rows[0];
  if(!x)throw new ConflictException({code:"FINANCE_CREDIT_NOTE_NOT_FOUND"});
  await this.scope(bearer,"finance.invoices.view",x.branch_id);
  return renderOriginalFinanceCreditNote({...x,currency:"INR"});
 }

}
