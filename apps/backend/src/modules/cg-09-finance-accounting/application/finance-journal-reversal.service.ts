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
  throw new BadRequestException({code:"FINANCE_JOURNAL_REVERSAL_INVALID"});
 return v;
};
const date=(v:unknown)=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||
  (!Number.isFinite(Date.parse(v+"T00:00:00Z"))||
   new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v))
  throw new BadRequestException({code:"FINANCE_JOURNAL_REVERSAL_INVALID"});
 return v;
};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
/** Restricted correction of manually posted GENERAL journals only.
 * Original source never edited. Only settled payroll bank vouchers may use the explicit return correction path; other payouts and invoices are excluded.
 */
@Injectable()
export class FinanceJournalReversalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly posting:FinanceJournalPostingService){}
 async eligibility(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  try{
   await this.sessions.requireAction(bearer,"finance.journals.post");
   await this.sessions.requireAction(bearer,"approvals.review");
   const tx=await this.db.connect();
   try{
    await tx.query("BEGIN");
    await this.identity.assertCurrent(tx,actor,"finance.journals.post");
    await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
    await tx.query("COMMIT");
    return {canReverse:true};
   }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  }catch{return {canReverse:false};}
 }
 async status(bearer:string,keyInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"approvals.review");
  const ref=id(keyInput);
  const rows=await this.db.query<{reversal_journal_id:string}>(
   "SELECT reversal_journal_id FROM finance_manual_journal_reversal "+
   "WHERE root_realm_id=$1 AND reviewer_id=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,ref]);
  return {confirmed:!!rows.rows[0],status:rows.rows[0]?"REVERSED":"NOT_FOUND",
   reversalRef:rows.rows[0]?.reversal_journal_id??null};
 }
 async reverse(bearer:string,originalInput:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"approvals.review");
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"FINANCE_JOURNAL_REVERSAL_INVALID"});
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["requestKey","financialYearRef","postingDate","reason","currentPassword","returnBankReference"].includes(k))||
   typeof v.reason!=="string"||v.reason.trim().length<12||v.reason.trim().length>300||
   typeof v.currentPassword!=="string"||v.currentPassword.length<8||
   Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_JOURNAL_REVERSAL_INVALID"});
  const originalRef=id(originalInput),key=id(v.requestKey),
   year=id(v.financialYearRef),postingDate=date(v.postingDate);
  const reason=v.reason.trim().replace(/\s+/g," ");
  const returnBankReference=typeof v.returnBankReference==="string"?v.returnBankReference.trim().toUpperCase():null;
  if(v.returnBankReference!==undefined&&(!returnBankReference||!/^[A-Z0-9 /._-]{6,64}$/.test(returnBankReference)))throw new BadRequestException({code:"FINANCE_JOURNAL_REVERSAL_INVALID"});
  const payloadDigest=digest(["CG09_MANUAL_REVERSAL_V1",originalRef,year,postingDate,reason,...(returnBankReference?[returnBankReference]:[])]);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.journals.post");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const existing=await tx.query<{request_digest:string;original_journal_id:string;
    reversal_journal_id:string}>(
    "SELECT request_digest,original_journal_id,reversal_journal_id "+
    "FROM finance_manual_journal_reversal WHERE root_realm_id=$1 "+
    "AND reviewer_id=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==payloadDigest||
       existing.rows[0].original_journal_id!==originalRef)
     throw new ConflictException({code:"FINANCE_JOURNAL_REVERSAL_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,status:"REVERSED",reversalRef:existing.rows[0].reversal_journal_id,
     replayed:true};
   }
   const original=await tx.query<{financial_year_id:string;created_by:string;
    source_ref:string;immutable_source_event_key:string;immutable_payload_digest:string;posting_kind:string;payroll_return:boolean}>(
    "SELECT financial_year_id,created_by,source_ref,immutable_source_event_key,"+
    "immutable_payload_digest,posting_kind,cg11_original_settled_bank_journal(root_realm_id,id) AS payroll_return FROM journal "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='POSTED' "+
    "AND posting_kind IN('GENERAL','VOUCHER') FOR SHARE",[originalRef,actor.realmId]);
   const source=original.rows[0];
   if(!source||source.created_by===actor.accountId||
      !((source.posting_kind==="GENERAL"&&source.source_ref===source.immutable_source_event_key&&!returnBankReference)||(source.posting_kind==="VOUCHER"&&source.payroll_return&&returnBankReference)))
    throw new ConflictException({code:"FINANCE_JOURNAL_REVERSAL_CONFLICT"});
   if(returnBankReference){await tx.query(`SELECT i.id FROM payroll_batch_item i JOIN payroll_payout_attempt t ON t.root_realm_id=i.root_realm_id AND t.item_ref=i.id JOIN finance_voucher_posting p ON p.root_realm_id=t.root_realm_id AND p.voucher_id=t.voucher_ref WHERE p.root_realm_id=$1 AND p.journal_id=$2 FOR UPDATE OF i`,[actor.realmId,originalRef]);}
   const prior=await tx.query(
    "SELECT id FROM finance_manual_journal_reversal "+
    "WHERE root_realm_id=$1 AND original_journal_id=$2 FOR SHARE",
    [actor.realmId,originalRef]);
   if(prior.rowCount)throw new ConflictException({code:"FINANCE_JOURNAL_REVERSAL_CONFLICT"});
   const lines=await tx.query<{account_id:string;branch_id:string|null;
    debit_minor:string;credit_minor:string}>(
    "SELECT account_id,branch_id,debit_minor::text,credit_minor::text "+
    "FROM journal_line WHERE root_realm_id=$1 AND journal_id=$2 ORDER BY id",
    [actor.realmId,originalRef]);
   if(lines.rows.length<2||lines.rows.length>(returnBankReference?2500:40))
    throw new ConflictException({code:"FINANCE_JOURNAL_REVERSAL_CONFLICT"});
   // The single posting engine enforces a current open posting year,
   // active account/branch, and balanced double entry at COMMIT.
   const reversed=await this.posting.postBalanced(tx,actor,{
    financialYearRef:year,postingDate,sourceRef:originalRef,eventKey:key,
    immutableDigest:digest(["CG09_OFFSETTING_MANUAL_JOURNAL",payloadDigest,
     source.immutable_payload_digest]),
    kind:"REVERSAL",payrollAllocation:!!returnBankReference,description:(returnBankReference?"Payroll bank return correction: ":"Manual journal correction: ")+reason.slice(0,430),
    reversalOfRef:originalRef,
    lines:lines.rows.map(l=>({accountRef:l.account_id,branchRef:l.branch_id,
     debitMinor:l.credit_minor,creditMinor:l.debit_minor}))
   });
   await this.sessions.requireFreshFoundationRootProof(tx,actor,v.currentPassword);
   await tx.query(
    "INSERT INTO finance_manual_journal_reversal(root_realm_id,original_journal_id,"+
    "reversal_journal_id,reviewer_id,request_key,request_digest,reason,password_verified_at,payroll_return_bank_reference) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8)",
    [actor.realmId,originalRef,reversed,actor.accountId,key,payloadDigest,reason,returnBankReference]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'JOURNAL',$3,'MANUAL_JOURNAL_REVERSAL_POSTED',$4)",
    [actor.realmId,actor.accountId,originalRef,key]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"REVERSED",reversalRef:reversed,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&
      ["23505","P0929","P0901","P0902","P0904"].includes(String(e.code)))
    throw new ConflictException({code:"FINANCE_JOURNAL_REVERSAL_CONFLICT"});
   throw e;
  }finally{tx.release();}
 }
}
