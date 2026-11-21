import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe=(v:string)=>typeof v==="string"&&ID.test(v);
const amount=(v:string)=>typeof v==="string"&&/^[1-9][0-9]{0,10}$/.test(v);
export type HealthcareAccrualSource=Readonly<{
 financialYearRef:string;expenseAccountRef:string;liabilityAccountRef:string;
 effectRef:string;effectKey:string;immutableDigest:string;
 amountMinor:string;postingDate:string
}>;

export type HealthcareAccrualCorrection=Readonly<{
 originalJournalRef:string;originalEffectRef:string;
 originalDigest:string;amountMinor:string;
 requestKey:string;correctionDigest:string;
 financialYearRef:string;postingDate:string;reason:string;
}>;
/** Narrow original CG09 posting authority. No new ledger, account or
 * CG17 dependency. Foundation expense-to-payable accrual has NO bank
 * or cash line, and is independent of patient-paid center receipts.
 */
@Injectable()
export class HealthcareFoundationPostingFacade{
 constructor(private readonly posting:FinanceJournalPostingService){}
 async options(c:PoolClient,actor:VerifiedFoundationActor,postingDate:string){
  const years=await c.query<{id:string;name:string}>(
   "SELECT id,name FROM financial_year WHERE root_realm_id=$1 "+
   "AND status='OPEN' AND start_on<=$2::date AND end_on>=$2::date "+
   "ORDER BY start_on DESC,id LIMIT 21",[actor.realmId,postingDate]);
  const accounts=await c.query<{id:string;name:string;category:string}>(
   "SELECT account.id,account.name,grouping.category "+
   "FROM finance_account account JOIN account_group grouping "+
   "ON grouping.id=account.group_id AND "+
   "grouping.root_realm_id=account.root_realm_id "+
   "WHERE account.root_realm_id=$1 AND account.status='ACTIVE' "+
   "AND account.scope_kind='FOUNDATION' AND account.account_kind='GENERAL' "+
   "AND grouping.category IN('EXPENSE','LIABILITY') "+
   "ORDER BY grouping.category,account.name,account.id LIMIT 101",
   [actor.realmId]);
  return {financialYears:years.rows.map(x=>({
   yearRef:x.id,name:x.name})),
   accounts:accounts.rows.slice(0,100).map(x=>({
    accountRef:x.id,name:x.name,kind:x.category})),
   complete:accounts.rows.length<=100&&years.rows.length<=20};
 }
 async postAccrual(c:PoolClient,actor:VerifiedFoundationActor,
  source:HealthcareAccrualSource){
  if(![source.financialYearRef,source.expenseAccountRef,
   source.liabilityAccountRef,source.effectRef,source.effectKey].every(safe)||
   !amount(source.amountMinor)||!/^\d{4}-\d{2}-\d{2}$/.test(source.postingDate)||
   !/^[a-f0-9]{64}$/.test(source.immutableDigest)||
   source.expenseAccountRef===source.liabilityAccountRef)
   throw new BadRequestException({code:"CG17_FOUNDATION_POSTING_INVALID"});
  const year=await c.query(
   "SELECT 1 FROM financial_year WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='OPEN' AND start_on<=$3::date AND end_on>=$3::date FOR SHARE",
   [actor.realmId,source.financialYearRef,source.postingDate]);
  if(!year.rowCount)
   throw new ConflictException({code:"CG17_FINANCIAL_YEAR_UNAVAILABLE"});
  const accounts=await c.query<{id:string;category:string}>(
   "SELECT a.id,g.category FROM finance_account a "+
   "JOIN account_group g ON g.id=a.group_id AND "+
   "g.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND "+
   "a.id=ANY($2::uuid[]) AND a.status='ACTIVE' "+
   "AND a.scope_kind='FOUNDATION' AND a.account_kind='GENERAL' "+
   "AND g.category IN('EXPENSE','LIABILITY') FOR SHARE OF a,g",
   [actor.realmId,[source.expenseAccountRef,source.liabilityAccountRef]]);
  if(accounts.rows.length!==2||
    accounts.rows.find(x=>x.id===source.expenseAccountRef)?.category!=="EXPENSE"||
    accounts.rows.find(x=>x.id===source.liabilityAccountRef)?.category!=="LIABILITY")
   throw new ConflictException({code:"CG17_FINANCIAL_ACCOUNTS_UNAVAILABLE"});
  const memo="Completed consultation Foundation assistance liability";
  return this.posting.postBalanced(c,actor,{
   financialYearRef:source.financialYearRef,
   postingDate:source.postingDate,sourceRef:source.effectRef,
   eventKey:source.effectKey,immutableDigest:source.immutableDigest,
   kind:"GENERAL",description:memo,
   lines:[
    {accountRef:source.expenseAccountRef,branchRef:null,
     debitMinor:source.amountMinor,creditMinor:"0"},
    {accountRef:source.liabilityAccountRef,branchRef:null,
     debitMinor:"0",creditMinor:source.amountMinor}
   ]
  });
 }

 /** The sole existing CG09 journal engine creates the opposite entry.
  * Caller owns verified CG17 source, protected reviewer and idempotency.
  * Neither the original source nor the posted journal is edited.
  */

 /** The real credited payable account of one original CG09 expense/payable
  * healthcare accrual. CG17 may only match refunds to this original account.
  */
 async payableAccountForAccrual(c:PoolClient,actor:VerifiedFoundationActor,
  originalJournalRef:string,amountMinor:string){
  if(!safe(originalJournalRef)||!amount(amountMinor))
   throw new BadRequestException({code:"CG17_ORIGINAL_PAYABLE_INVALID"});
  const q=await c.query<{account_id:string}>(
   "SELECT credit.account_id FROM journal j "+
   "JOIN journal_line credit ON credit.journal_id=j.id "+
   "AND credit.root_realm_id=j.root_realm_id "+
   "JOIN finance_account account ON account.id=credit.account_id "+
   "AND account.root_realm_id=j.root_realm_id "+
   "JOIN account_group grp ON grp.id=account.group_id "+
   "AND grp.root_realm_id=account.root_realm_id "+
   "WHERE j.id=$1 AND j.root_realm_id=$2 AND j.source_owner='CG-09' "+
   "AND j.posting_kind='GENERAL' AND j.status='POSTED' "+
   "AND j.reversal_of_id IS NULL "+
   "AND credit.branch_id IS NULL AND credit.debit_minor=0 "+
   "AND credit.credit_minor=$3::bigint "+
   "AND account.scope_kind='FOUNDATION' "+
   "AND account.account_kind='GENERAL' AND grp.category='LIABILITY' "+
   "AND (SELECT count(*) FROM journal_line line "+
   "WHERE line.root_realm_id=j.root_realm_id AND line.journal_id=j.id)=2",
   [originalJournalRef,actor.realmId,amountMinor]);
  if(q.rows.length!==1)throw new ConflictException({
   code:"CG17_ORIGINAL_PAYABLE_UNVERIFIED"});
  return q.rows[0].account_id;
 }
 async reverseAccrual(c:PoolClient,actor:VerifiedFoundationActor,
  original:HealthcareAccrualCorrection){
  if(![original.originalJournalRef,original.originalEffectRef,
    original.requestKey,original.financialYearRef].every(safe)||
    !amount(original.amountMinor)||
    !/^[a-f0-9]{64}$/.test(original.originalDigest)||
    !/^[a-f0-9]{64}$/.test(original.correctionDigest)||
    !/^\d{4}-\d{2}-\d{2}$/.test(original.postingDate)||
    original.reason.length<12||original.reason.length>300)
   throw new BadRequestException({code:"CG17_ACCRUAL_REVERSAL_INVALID"});
  const openYear=await c.query(
   "SELECT 1 FROM financial_year WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='OPEN' AND start_on<=$3::date AND end_on>=$3::date FOR SHARE",
   [actor.realmId,original.financialYearRef,original.postingDate]);
  if(!openYear.rowCount)
   throw new ConflictException({code:"CG17_CORRECTION_YEAR_NOT_OPEN"});
  const originalJournal=await c.query<{source_ref:string;created_by:string;
    immutable_payload_digest:string}>(
   "SELECT source_ref,created_by,immutable_payload_digest FROM journal "+
   "WHERE id=$1 AND root_realm_id=$2 AND source_owner='CG-09' "+
   "AND posting_kind='GENERAL' AND status='POSTED' AND reversal_of_id IS NULL "+
   "FOR SHARE",[original.originalJournalRef,actor.realmId]);
  const j=originalJournal.rows[0];
  if(!j||j.source_ref!==original.originalEffectRef||
    j.immutable_payload_digest!==original.originalDigest||
    j.created_by===actor.accountId)
   throw new ConflictException({code:"CG17_ACCRUAL_REVERSAL_SOURCE_CHANGED"});
  const prior=await c.query<{account_id:string;branch_id:string|null;
    debit_minor:string;credit_minor:string}>(
   "SELECT account_id,branch_id,debit_minor::text,credit_minor::text "+
   "FROM journal_line WHERE root_realm_id=$1 AND journal_id=$2 "+
   "ORDER BY id FOR SHARE",
   [actor.realmId,original.originalJournalRef]);
  if(prior.rows.length!==2||
    prior.rows.some(x=>x.branch_id!==null)||
    prior.rows.reduce((x,row)=>x+BigInt(row.debit_minor),0n)!==BigInt(original.amountMinor)||
    prior.rows.reduce((x,row)=>x+BigInt(row.credit_minor),0n)!==BigInt(original.amountMinor))
   throw new ConflictException({code:"CG17_ACCRUAL_REVERSAL_LINES_CHANGED"});
  const offset=await c.query(
   "SELECT 1 FROM journal WHERE root_realm_id=$1 AND reversal_of_id=$2 "+
   "LIMIT 1",[actor.realmId,original.originalJournalRef]);
  if(offset.rowCount)throw new ConflictException({
   code:"CG17_ACCRUAL_ALREADY_REVERSED"});
  return this.posting.postBalanced(c,actor,{
   financialYearRef:original.financialYearRef,
   postingDate:original.postingDate,
   sourceRef:original.originalJournalRef,
   eventKey:original.requestKey,
   immutableDigest:original.correctionDigest,
   kind:"REVERSAL",
   reversalOfRef:original.originalJournalRef,
   description:"Healthcare liability correction: "+original.reason,
   lines:prior.rows.map(x=>({
    accountRef:x.account_id,branchRef:x.branch_id,
    debitMinor:x.credit_minor,creditMinor:x.debit_minor
   }))
  });
 }

}
