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
