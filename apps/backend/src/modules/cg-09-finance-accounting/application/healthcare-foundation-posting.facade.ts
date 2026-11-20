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
}
