import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_INVOICE_CANCEL_INVALID"});
 return v;
};
const day=(v:unknown)=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||
  !Number.isFinite(Date.parse(v+"T00:00:00Z"))||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
  throw new BadRequestException({code:"FINANCE_INVOICE_CANCEL_INVALID"});
 return v;
};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
/** Original finance owner: narrow POSTED/unissued/unpaid invoice cancellation.
 * This is intentionally not a legal credit note/reissue or paid refund.
 */
@Injectable()
export class FinanceInvoiceCancellationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly owner:ProtectedAccessOwnerService,
  private readonly posting:FinanceJournalPostingService){}
 private async reviewer(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.review");
  await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"approvals.review");
  return actor;
 }
 async eligibility(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.view");
  try{
   await this.sessions.requireAction(bearer,"finance.invoices.review");
   await this.sessions.requireAction(bearer,"finance.journals.post");
   await this.sessions.requireAction(bearer,"approvals.review");
   const tx=await this.db.connect();
   try{
    await tx.query("BEGIN");
    await this.identity.assertCurrent(tx,actor,"finance.invoices.review");
    await this.identity.assertCurrent(tx,actor,"finance.journals.post");
    await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
    await tx.query("COMMIT");
    return {canCancel:true};
   }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  }catch{return {canCancel:false};}
 }
 async status(bearer:string,keyInput:string){
  const actor=await this.reviewer(bearer),key=id(keyInput);
  const row=await this.db.query<{reversal_journal_id:string}>(
   "SELECT reversal_journal_id FROM finance_invoice_posted_cancellation "+
   "WHERE root_realm_id=$1 AND reviewer_id=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key]);
  return {confirmed:!!row.rows[0],status:row.rows[0]?"REVERSED":"NOT_FOUND",
   reversalRef:row.rows[0]?.reversal_journal_id??null};
 }
 async cancelUnissued(bearer:string,invoiceInput:string,raw:unknown){
  const actor=await this.reviewer(bearer),invoiceRef=id(invoiceInput);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"FINANCE_INVOICE_CANCEL_INVALID"});
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","financialYearRef","postingDate","reason","currentPassword"].includes(k))||
   typeof v.reason!=="string"||v.reason.trim().length<12||v.reason.trim().length>300||
   typeof v.currentPassword!=="string"||v.currentPassword.length<8||
   Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_INVOICE_CANCEL_INVALID"});
  const key=id(v.requestKey),year=id(v.financialYearRef),postingDate=day(v.postingDate),
   reason=v.reason.trim().replace(/\s+/g," "),
   fingerprint=digest(["UNISSUED_POSTED_INVOICE_CANCEL_V1",invoiceRef,year,postingDate,reason]);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.review");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   await this.owner.verifyReviewer(tx,actor,"approvals.review",true);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const old=await tx.query<{request_digest:string;invoice_id:string;
    reversal_journal_id:string}>(
    "SELECT request_digest,invoice_id,reversal_journal_id "+
    "FROM finance_invoice_posted_cancellation "+
    "WHERE root_realm_id=$1 AND reviewer_id=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(old.rows[0]){
    if(old.rows[0].request_digest!==fingerprint||old.rows[0].invoice_id!==invoiceRef)
     throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:"REVERSED",reversalRef:old.rows[0].reversal_journal_id,
     replayed:true};
   }
   const invoice=await tx.query<{id:string;version:number;created_by:string;status:string}>(
    "SELECT id,version,created_by,status FROM finance_invoice "+
    "WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [invoiceRef,actor.realmId]);
   const inv=invoice.rows[0];
   if(!inv||inv.status!=="POSTED"||inv.created_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   // Fail closed even if a CG-19 provider write is UNKNOWN, or even an
   // unverified collection journal exists. No legal issued-invoice bypass.
   const blockers=await tx.query<{total:string}>(
    "SELECT ((SELECT COUNT(*) FROM cg19_finance_invoice_document "+
    "WHERE root_realm_id=$1 AND invoice_id=$2)+ "+
    "(SELECT COUNT(*) FROM finance_invoice_receipt "+
    "WHERE root_realm_id=$1 AND invoice_id=$2)+ "+
    "(SELECT COUNT(*) FROM journal WHERE root_realm_id=$1 "+
    "AND source_ref=$2 AND posting_kind='GENERAL'))::bigint AS total",
    [actor.realmId,invoiceRef]);
   if(BigInt(blockers.rows[0]?.total??"0")>0n)
    throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   const already=await tx.query(
    "SELECT id FROM finance_invoice_posted_cancellation "+
    "WHERE root_realm_id=$1 AND invoice_id=$2 FOR SHARE",[actor.realmId,invoiceRef]);
   if(already.rowCount)
    throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   const posting=await tx.query<{journal_id:string;immutable_payload_digest:string}>(
    "SELECT p.journal_id,j.immutable_payload_digest FROM finance_invoice_posting p "+
    "JOIN journal j ON j.id=p.journal_id AND j.root_realm_id=p.root_realm_id "+
    "WHERE p.invoice_id=$1 AND p.root_realm_id=$2 AND j.status='POSTED' "+
    "AND j.posting_kind='INVOICE' FOR SHARE OF p,j",
    [invoiceRef,actor.realmId]);
   const source=posting.rows[0];
   if(!source)throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   const lines=await tx.query<{account_id:string;branch_id:string|null;
    debit_minor:string;credit_minor:string}>(
    "SELECT account_id,branch_id,debit_minor::text,credit_minor::text "+
    "FROM journal_line WHERE journal_id=$1 AND root_realm_id=$2 ORDER BY id",
    [source.journal_id,actor.realmId]);
   if(lines.rows.length<2||lines.rows.length>40)
    throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   const reversed=await this.posting.postBalanced(tx,actor,{
    financialYearRef:year,postingDate,sourceRef:invoiceRef,eventKey:key,
    reversalOfRef:source.journal_id,kind:"REVERSAL",
    immutableDigest:digest(["CG09_UNISSUED_INVOICE_OFFSET",fingerprint,
     source.immutable_payload_digest]),
    description:"Unissued invoice cancellation: "+reason.slice(0,425),
    lines:lines.rows.map(l=>({accountRef:l.account_id,branchRef:l.branch_id,
     debitMinor:l.credit_minor,creditMinor:l.debit_minor}))
   });
   await this.sessions.requireFreshFoundationRootProof(tx,actor,v.currentPassword);
   await tx.query(
    "INSERT INTO finance_invoice_posted_cancellation(root_realm_id,invoice_id,"+
    "invoice_version,original_journal_id,reversal_journal_id,reviewer_id,"+
    "request_key,request_digest,reason,password_verified_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())",
    [actor.realmId,invoiceRef,inv.version,source.journal_id,reversed,
     actor.accountId,key,fingerprint,reason]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'INVOICE',$3,'UNISSUED_POSTED_CANCELLATION',$4)",
    [actor.realmId,actor.accountId,invoiceRef,key]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"REVERSED",reversalRef:reversed,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&
    ["23505","P0930","P0901","P0902","P0904"].includes(String(e.code)))
    throw new ConflictException({code:"FINANCE_INVOICE_CANCEL_CONFLICT"});
   throw e;
  }finally{tx.release();}
 }
}
