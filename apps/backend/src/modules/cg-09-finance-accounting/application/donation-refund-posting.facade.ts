import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type CashOrigin={cash_account_ref:string;income_account_ref:string;
 branch_ref:string|null;amount_minor:string};
@Injectable()
export class DonationRefundPostingFacade{
 constructor(private readonly journal:FinanceJournalPostingService){}
 async originalCash(tx:PoolClient,a:VerifiedFoundationActor,donation:string):Promise<CashOrigin>{
  const r=(await tx.query<CashOrigin>(
   "SELECT e.cash_account_ref,e.income_account_ref,d.branch_ref,d.amount_minor::text "+
   "FROM donation_manual_evidence e JOIN donation d ON d.root_realm_id=e.root_realm_id "+
   "AND d.id=e.donation_id JOIN journal j ON j.root_realm_id=e.root_realm_id "+
   "AND j.id=e.journal_ref WHERE d.root_realm_id=$1 AND d.id=$2 "+
   "AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED' "+
   "AND j.status='POSTED' AND j.source_ref=d.id FOR SHARE OF e,d,j",
   [a.realmId,donation])).rows[0];
  if(!r)throw new ConflictException("Only previously confirmed physical cash can use a cash refund.");
  return r;
 }
 async post(tx:PoolClient,a:VerifiedFoundationActor,x:{
  refundRef:string;donationRef:string;yearRef:string;date:string;amountMinor:string;
  requestKey:string;digest:string;cashVoucher:string}){
  if(![x.refundRef,x.donationRef,x.yearRef,x.requestKey].every(v=>ID.test(v))||
   !/^[a-f0-9]{64}$/.test(x.digest)||!/^[1-9][0-9]{0,13}$/.test(x.amountMinor)||
   !/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!/^[A-Za-z0-9._/ -]{4,100}$/.test(x.cashVoucher))
   throw new BadRequestException("Choose a valid original refund and cash voucher.");
  const origin=await this.originalCash(tx,a,x.donationRef);
  const year=await tx.query("SELECT 1 FROM financial_year WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",
   [a.realmId,x.yearRef,x.date]);
  if(!year.rowCount)throw new ConflictException("Select an open Foundation finance year.");
  const accounts=await tx.query<{id:string;account_kind:string;category:string}>(
   "SELECT f.id,f.account_kind,g.category FROM finance_account f "+
   "JOIN account_group g ON g.id=f.group_id AND g.root_realm_id=f.root_realm_id "+
   "WHERE f.root_realm_id=$1 AND f.id=ANY($2::uuid[]) AND f.status='ACTIVE' "+
   "AND (f.branch_id IS NULL OR f.branch_id IS NOT DISTINCT FROM $3::uuid) FOR SHARE OF f,g",
   [a.realmId,[origin.cash_account_ref,origin.income_account_ref],origin.branch_ref]);
  if(accounts.rows.length!==2||
   !accounts.rows.some(v=>v.id===origin.cash_account_ref&&v.account_kind==="CASH"&&v.category==="ASSET")||
   !accounts.rows.some(v=>v.id===origin.income_account_ref&&v.account_kind==="GENERAL"&&v.category==="INCOME"))
   throw new ConflictException("Original cash refund accounts are no longer active.");
  // CG09 currently reserves posting_kind=REFUND for original invoice refunds.
  // Donation refunds therefore use one source-linked GENERAL correction,
  // not a copied ledger nor a fake invoice refund.
  return this.journal.postBalanced(tx,a,{
   financialYearRef:x.yearRef,postingDate:x.date,sourceRef:x.refundRef,
   eventKey:x.requestKey,immutableDigest:x.digest,kind:"GENERAL",
   description:"Verified physical cash donation refund "+x.cashVoucher,
   lines:[
    {accountRef:origin.income_account_ref,branchRef:origin.branch_ref,
     debitMinor:x.amountMinor,creditMinor:"0"},
    {accountRef:origin.cash_account_ref,branchRef:origin.branch_ref,
     debitMinor:"0",creditMinor:x.amountMinor}
   ]
  });
 }
 /** Confirm the identical original posted gateway-clearing/INCOME accounts.
  * A caller may not substitute an unrelated bank account for a refund. */
 async providerAccounts(tx:PoolClient,a:VerifiedFoundationActor,donationRef:string){
  if(!ID.test(donationRef))throw new BadRequestException("Original online donation unavailable.");
  const rows=await tx.query<{
   account_id:string;account_kind:string;category:string;name:string;
   debit_minor:string;credit_minor:string;branch_id:string|null
  }>(
   "SELECT l.account_id,f.account_kind,g.category,f.name,l.debit_minor::text,"+
   "l.credit_minor::text,l.branch_id FROM donation_finance_effect e "+
   "JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id "+
   "JOIN donation_payment_event captured ON captured.root_realm_id=e.root_realm_id "+
   "AND captured.donation_id=e.donation_id AND captured.outcome='SUCCESS' "+
   "AND captured.provider='razorpay' AND captured.provider_payment_id IS NOT NULL "+
   "JOIN journal_line l ON l.root_realm_id=j.root_realm_id AND l.journal_id=j.id "+
   "JOIN finance_account f ON f.root_realm_id=l.root_realm_id AND f.id=l.account_id "+
   "JOIN account_group g ON g.root_realm_id=f.root_realm_id AND g.id=f.group_id "+
   "WHERE e.root_realm_id=$1 AND e.donation_id=$2 AND e.status='POSTED' "+
   "AND j.status='POSTED' AND j.source_ref=e.donation_id AND f.status='ACTIVE' "+
   "ORDER BY l.id FOR SHARE OF j,e,l,f,g,captured",
   [a.realmId,donationRef]);
  if(rows.rows.length!==2)throw new ConflictException(
   "Original verified Razorpay gateway finance journal must contain two active accounts.");
  const asset=rows.rows.find(x=>x.account_kind==="GENERAL"&&x.category==="ASSET"&&
   BigInt(x.debit_minor)>0n&&BigInt(x.credit_minor)===0n);
  const income=rows.rows.find(x=>x.account_kind==="GENERAL"&&x.category==="INCOME"&&
   BigInt(x.credit_minor)>0n&&BigInt(x.debit_minor)===0n);
  if(!asset||!income||asset.branch_id!==income.branch_id||
   BigInt(asset.debit_minor)!==BigInt(income.credit_minor))
   throw new ConflictException("Original gateway asset/income source is not a balanced donation.");
  return {clearingAccountRef:asset.account_id,clearingLabel:asset.name,
   incomeAccountRef:income.account_id,incomeLabel:income.name,branchRef:asset.branch_id};
 }
 async postProvider(tx:PoolClient,a:VerifiedFoundationActor,x:{
  refundRef:string;donationRef:string;amountMinor:string;yearRef:string;date:string;
  eventKey:string;digest:string;providerRefundId:string
 }){
  if(![x.refundRef,x.donationRef,x.yearRef,x.eventKey].every(v=>ID.test(v))||
   !/^[a-f0-9]{64}$/.test(x.digest)||!/^[1-9][0-9]{0,13}$/.test(x.amountMinor)||
   !/^\d{4}-\d{2}-\d{2}$/.test(x.date)||
   !/^rfnd_[A-Za-z0-9]{8,}$/.test(x.providerRefundId))
   throw new BadRequestException("Verify the original processed gateway refund details.");
  const original=await this.providerAccounts(tx,a,x.donationRef);
  const y=await tx.query("SELECT 1 FROM financial_year WHERE root_realm_id=$1 "+
   "AND id=$2 AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",
   [a.realmId,x.yearRef,x.date]);
  if(y.rowCount!==1)throw new ConflictException("Choose an open original CG09 financial year.");
  return this.journal.postBalanced(tx,a,{
   financialYearRef:x.yearRef,postingDate:x.date,sourceRef:x.refundRef,
   eventKey:x.eventKey,immutableDigest:x.digest,kind:"GENERAL",
   description:"Signed provider-processed CareGanga refund "+x.providerRefundId,
   lines:[
    {accountRef:original.incomeAccountRef,branchRef:original.branchRef,
     debitMinor:x.amountMinor,creditMinor:"0"},
    {accountRef:original.clearingAccountRef,branchRef:original.branchRef,
     debitMinor:"0",creditMinor:x.amountMinor}
   ]
  });
 }

}
