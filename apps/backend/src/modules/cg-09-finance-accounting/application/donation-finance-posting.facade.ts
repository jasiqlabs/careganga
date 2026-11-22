import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Cash=Readonly<{donationRef:string;cashAccountRef:string;incomeAccountRef:string;
 yearRef:string;postingDate:string;amountMinor:string;eventKey:string;digest:string;
 branchRef:string|null;voucher:string}>;
@Injectable()
export class DonationFinancePostingFacade{
 constructor(private readonly journal:FinanceJournalPostingService){}
 /** CG09 validates all original account/year contracts. CG07 cannot create
  * an alternate balance or mutate another journal after posting. */
 async checkCash(tx:PoolClient,a:VerifiedFoundationActor,x:Omit<Cash,"donationRef"|"amountMinor"|"eventKey"|"digest"|"voucher">){
  if(![x.cashAccountRef,x.incomeAccountRef,x.yearRef].every(v=>ID.test(v))||
   x.cashAccountRef===x.incomeAccountRef||!/^\d{4}-\d{2}-\d{2}$/.test(x.postingDate))
   throw new BadRequestException("Choose a current cash account, donation income account and posting date.");
  const year=await tx.query(
   "SELECT 1 FROM financial_year WHERE id=$1 AND root_realm_id=$2 AND status='OPEN' "+
   "AND $3::date BETWEEN start_on AND end_on FOR SHARE",[x.yearRef,a.realmId,x.postingDate]);
  if(!year.rowCount)throw new ConflictException("Select an open financial year for the cash receipt.");
  const accounts=await tx.query<{id:string;category:string;account_kind:string;branch_id:string|null}>(
   "SELECT f.id,g.category,f.account_kind,f.branch_id FROM finance_account f "+
   "JOIN account_group g ON g.id=f.group_id AND g.root_realm_id=f.root_realm_id "+
   "WHERE f.root_realm_id=$1 AND f.id=ANY($2::uuid[]) AND f.status='ACTIVE' "+
   "AND (f.branch_id IS NULL OR f.branch_id IS NOT DISTINCT FROM $3::uuid) "+
   "FOR SHARE OF f,g",[a.realmId,[x.cashAccountRef,x.incomeAccountRef],x.branchRef]);
  if(accounts.rows.length!==2||
   !accounts.rows.some(v=>v.id===x.cashAccountRef&&v.category==="ASSET"&&v.account_kind==="CASH")||
   !accounts.rows.some(v=>v.id===x.incomeAccountRef&&v.category==="INCOME"&&v.account_kind==="GENERAL"))
   throw new ConflictException("Cash or donation income account is inactive or outside this Foundation branch.");
 }
 async options(tx:PoolClient,a:VerifiedFoundationActor,branchRef:string|null){
  const choices=await tx.query<{id:string;name:string;account_kind:string;category:string}>(`
   SELECT a.id,a.name,a.account_kind,g.category FROM finance_account a
   JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE a.root_realm_id=$1 AND a.status='ACTIVE'
     AND (a.branch_id IS NULL OR a.branch_id IS NOT DISTINCT FROM $2::uuid)
     AND ((a.account_kind='CASH' AND g.category='ASSET')
       OR (a.account_kind='GENERAL' AND g.category='INCOME'))
   ORDER BY a.name,a.id LIMIT 101`,[a.realmId,branchRef]);
  if(choices.rows.length>100)throw new ConflictException("Ask Finance Admin to narrow the cash account list.");
  const years=await tx.query<{id:string;name:string}>(`
    SELECT id,name FROM financial_year WHERE root_realm_id=$1 AND status='OPEN'
    ORDER BY start_on DESC,id LIMIT 21`,[a.realmId]);
  return {cashAccounts:choices.rows.filter(x=>x.account_kind==="CASH").map(x=>({value:x.id,label:x.name})),
   incomeAccounts:choices.rows.filter(x=>x.account_kind==="GENERAL").map(x=>({value:x.id,label:x.name})),
   years:years.rows.slice(0,20).map(x=>({value:x.id,label:x.name})),
   complete:choices.rows.length<=100&&years.rows.length<=20};
 }
 async postCash(tx:PoolClient,a:VerifiedFoundationActor,x:Cash){
  if(!ID.test(x.donationRef)||!ID.test(x.eventKey)||!/^[a-f0-9]{64}$/.test(x.digest)||
    !/^[1-9][0-9]{0,13}$/.test(x.amountMinor))
   throw new BadRequestException("Current verified cash donation details are incomplete.");
  await this.checkCash(tx,a,x);
  return this.journal.postBalanced(tx,a,{
   financialYearRef:x.yearRef,postingDate:x.postingDate,sourceRef:x.donationRef,
   eventKey:x.eventKey,immutableDigest:x.digest,kind:"GENERAL",
   description:"Verified cash donation voucher "+x.voucher,
   lines:[
    {accountRef:x.cashAccountRef,branchRef:x.branchRef,debitMinor:x.amountMinor,creditMinor:"0"},
    {accountRef:x.incomeAccountRef,branchRef:x.branchRef,debitMinor:"0",creditMinor:x.amountMinor}
   ]
  });
 }
}
