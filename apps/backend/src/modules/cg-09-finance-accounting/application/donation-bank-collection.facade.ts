import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Source=Readonly<{
 donationRef:string;method:"BANK"|"CHEQUE"|"NEFT";amountMinor:string;
 bankAccountRef:string;suspenseAccountRef:string;incomeAccountRef:string;
 yearRef:string;postingDate:string;bankItemRef:string;requestKey:string;
 branchRef:string|null
}>;
type Choice={id:string;name:string;account_kind:string;category:string};
@Injectable()
export class DonationBankCollectionFacade{
 constructor(private readonly posting:FinanceJournalPostingService){}
 async options(tx:PoolClient,a:Actor,branch:string|null){
  const accounts=await tx.query<Choice>(
   "SELECT f.id,f.name,f.account_kind,g.category FROM finance_account f "+
   "JOIN account_group g ON g.root_realm_id=f.root_realm_id AND g.id=f.group_id "+
   "WHERE f.root_realm_id=$1 AND f.status='ACTIVE' "+
   "AND (f.branch_id IS NULL OR f.branch_id IS NOT DISTINCT FROM $2::uuid) "+
   "AND ((f.account_kind='BANK' AND g.category='ASSET') "+
   "OR (f.account_kind='GENERAL' AND g.category IN('LIABILITY','INCOME'))) "+
   "ORDER BY f.name,f.id LIMIT 101",[a.realmId,branch]);
  const years=await tx.query<{id:string;name:string}>(
   "SELECT id,name FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' "+
   "ORDER BY start_on DESC,id LIMIT 21",[a.realmId]);
  if(accounts.rows.length>100||years.rows.length>20)
   throw new ConflictException("Ask Finance Admin to narrow the bank/account choices.");
  const choices=(kind:string,category:string)=>accounts.rows.filter(r=>
   r.account_kind===kind&&r.category===category).map(r=>({value:r.id,label:r.name}));
  return {banks:choices("BANK","ASSET"),suspenseAccounts:choices("GENERAL","LIABILITY"),
   incomeAccounts:choices("GENERAL","INCOME"),
   years:years.rows.map(v=>({value:v.id,label:v.name}))};
 }
 async stage(tx:PoolClient,a:Actor,x:Source){
  if(![x.donationRef,x.bankAccountRef,x.suspenseAccountRef,x.incomeAccountRef,
   x.yearRef,x.requestKey].every(v=>ID.test(v))||
   new Set([x.bankAccountRef,x.suspenseAccountRef,x.incomeAccountRef]).size!==3||
   !/^[1-9][0-9]{0,13}$/.test(x.amountMinor)||BigInt(x.amountMinor)>99999999999999n||
   !/^\d{4}-\d{2}-\d{2}$/.test(x.postingDate)||
   !/^[A-Za-z0-9._/: -]{4,100}$/.test(x.bankItemRef))
   throw new BadRequestException("Check the actual bank/NEFT/cheque and finance account details.");
  const year=await tx.query(
   "SELECT id FROM financial_year WHERE root_realm_id=$1 AND id=$2 "+
   "AND status='OPEN' AND $3::date BETWEEN start_on AND end_on FOR SHARE",
   [a.realmId,x.yearRef,x.postingDate]);
  if(year.rowCount!==1)throw new ConflictException("Choose an open original finance year.");
  const accounts=await tx.query<Choice>(
   "SELECT f.id,f.name,f.account_kind,g.category FROM finance_account f "+
   "JOIN account_group g ON g.root_realm_id=f.root_realm_id AND g.id=f.group_id "+
   "WHERE f.root_realm_id=$1 AND f.id=ANY($2::uuid[]) AND f.status='ACTIVE' "+
   "AND (f.branch_id IS NULL OR f.branch_id IS NOT DISTINCT FROM $3::uuid) FOR SHARE OF f,g",
   [a.realmId,[x.bankAccountRef,x.suspenseAccountRef,x.incomeAccountRef],x.branchRef]);
  if(accounts.rows.length!==3||
   !accounts.rows.some(v=>v.id===x.bankAccountRef&&v.account_kind==="BANK"&&v.category==="ASSET")||
   !accounts.rows.some(v=>v.id===x.suspenseAccountRef&&v.account_kind==="GENERAL"&&v.category==="LIABILITY")||
   !accounts.rows.some(v=>v.id===x.incomeAccountRef&&v.account_kind==="GENERAL"&&v.category==="INCOME"))
   throw new ConflictException("Original bank asset, suspense liability or donation income account is inactive.");
  const digest=sha(["CG07_BANK_SUSPENSE",x.donationRef,x.amountMinor,x.bankAccountRef,
   x.suspenseAccountRef,x.incomeAccountRef,x.yearRef,x.postingDate,x.bankItemRef,x.method]);
  // Only a provisional bank/suspense balance, never donation INCOME.
  const initialJournalRef=await this.posting.postBalanced(tx,a,{
   financialYearRef:x.yearRef,postingDate:x.postingDate,sourceRef:x.donationRef,
   eventKey:x.requestKey,immutableDigest:digest,kind:"GENERAL",
   description:"Provisional "+x.method+" collection, CG19 bank statement review pending",
   lines:[
    {accountRef:x.bankAccountRef,branchRef:x.branchRef,debitMinor:x.amountMinor,creditMinor:"0"},
    {accountRef:x.suspenseAccountRef,branchRef:x.branchRef,debitMinor:"0",creditMinor:x.amountMinor}
   ]
  });
  const matched=(await tx.query<{id:string}>(
   "INSERT INTO finance_bank_reconciliation(root_realm_id,bank_account_id,journal_id,"+
   "financial_year_id,statement_date,bank_item_ref,statement_amount_minor,"+
   "posted_amount_minor,variance_minor,recorded_by,request_key,content_digest) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$7,0,$8,$9,$10) RETURNING id",
   [a.realmId,x.bankAccountRef,initialJournalRef,x.yearRef,x.postingDate,x.bankItemRef,
    x.amountMinor,a.accountId,x.requestKey,
    sha(["CG09_BANK_MATCH",initialJournalRef,x.bankAccountRef,x.amountMinor,x.bankItemRef,x.postingDate])])).rows[0];
  if(!matched)throw new ConflictException("Original pending bank match was not recorded.");
  return {initialJournalRef,reconciliationRef:matched.id,digest};
 }
 /** Runs INSIDE original CG09 FinanceReportsService.verifyBankMatch transaction,
  * after CG19 CLEAN_VERIFIED statement and distinct protected reviewer proof.
  * A typed UTR, donor note or simple deposit does not invoke this method. */
 async onReconciliation(tx:PoolClient,a:Actor,ref:string,status:"VERIFIED"|"REJECTED"){
  if(!ID.test(ref))throw new BadRequestException("Unknown original bank reconciliation.");
  const q=await tx.query<{
   id:string;donation_id:string;attempt_id:string;method:string;amount_minor:string;
   bank_account_ref:string;suspense_account_ref:string;income_account_ref:string;
   financial_year_ref:string;posting_date:string;initial_journal_id:string;
   recorded_by:string;source_status:string;branch_ref:string|null;
   decision_key:string;statement_file_id:string|null;statement_file_version:number|null;
   content_digest:string
  }>(
   "SELECT b.id,b.donation_id,b.attempt_id,b.method,b.amount_minor::text,"+
   "b.bank_account_ref,b.suspense_account_ref,b.income_account_ref,"+
   "b.financial_year_ref,b.posting_date::text,b.initial_journal_id,"+
   "b.recorded_by,b.source_status,d.branch_ref,decision.request_key AS decision_key,"+
   "decision.statement_file_id,decision.statement_file_version,r.content_digest "+
   "FROM donation_bank_collection b JOIN donation d ON d.root_realm_id=b.root_realm_id "+
   "AND d.id=b.donation_id JOIN finance_bank_reconciliation r "+
   "ON r.root_realm_id=b.root_realm_id AND r.id=b.reconciliation_id "+
   "JOIN finance_reconciliation_decision decision ON decision.root_realm_id=r.root_realm_id "+
   "AND decision.reconciliation_id=r.id AND decision.actor_ref=r.verified_by "+
   "WHERE b.root_realm_id=$1 AND b.reconciliation_id=$2 AND r.status=$3 "+
   "AND r.verified_by=$4 FOR UPDATE OF b,d",
   [a.realmId,ref,status,a.accountId]);
  if(q.rows.length===0)return; // unrelated original CG09 bank workflow
  if(q.rows.length!==1)throw new ConflictException("Original bank reconciliation was duplicated.");
  const row=q.rows[0];
  if(row.source_status!=="PENDING"||row.recorded_by===a.accountId)
   throw new ConflictException("A different reviewer or changed bank collection was detected.");
  const amount=row.amount_minor;
  const verifiedDigest=sha(["CG07_BANK_DECISION",row.id,row.content_digest,
   row.decision_key,row.statement_file_id,row.statement_file_version,status]);
  if(status==="VERIFIED"){
   if(!row.statement_file_id||!row.statement_file_version)
    throw new ConflictException("The original clean-verified CG19 bank statement is required.");
   const finalJournal=await this.posting.postBalanced(tx,a,{
    financialYearRef:row.financial_year_ref,postingDate:row.posting_date,
    sourceRef:row.donation_id,eventKey:row.decision_key,immutableDigest:verifiedDigest,
    kind:"GENERAL",description:"Original independent bank statement donation verification",
    lines:[
     {accountRef:row.suspense_account_ref,branchRef:row.branch_ref,
      debitMinor:amount,creditMinor:"0"},
     {accountRef:row.income_account_ref,branchRef:row.branch_ref,
      debitMinor:"0",creditMinor:amount}
    ]
   });
   await tx.query(
    "INSERT INTO donation_finance_effect(root_realm_id,donation_id,source_event_key,"+
    "immutable_digest,journal_id,status) VALUES($1,$2,$3,$4,$5,'POSTED')",
    [a.realmId,row.donation_id,row.decision_key,verifiedDigest,finalJournal]);
   await tx.query("UPDATE donation_bank_collection SET source_status='VERIFIED_POSTED',"+
    "final_journal_id=$3,verified_by=$4,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND source_status='PENDING'",
    [a.realmId,row.id,finalJournal,a.accountId]);
   await tx.query("UPDATE donation_payment_attempt SET status='RECEIVED_POSTED' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PAYMENT_PENDING'",
    [a.realmId,row.attempt_id]);
   const result=await tx.query(
    "UPDATE donation SET source_status='RECEIVED_POSTED',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='PAYMENT_PENDING'",
    [a.realmId,row.donation_id]);
   if(result.rowCount!==1)throw new ConflictException("The original donor payment changed.");
  }else{
   const reversal=await this.posting.postBalanced(tx,a,{
    financialYearRef:row.financial_year_ref,postingDate:row.posting_date,
    sourceRef:row.id,eventKey:row.decision_key,immutableDigest:verifiedDigest,
    kind:"GENERAL",description:"Original bank match rejected: reverse provisional collection",
    lines:[
     {accountRef:row.suspense_account_ref,branchRef:row.branch_ref,
      debitMinor:amount,creditMinor:"0"},
     {accountRef:row.bank_account_ref,branchRef:row.branch_ref,
      debitMinor:"0",creditMinor:amount}
    ]
   });
   await tx.query("UPDATE donation_bank_collection SET source_status='REJECTED_REVERSED',"+
    "reversal_journal_id=$3,verified_by=$4,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='PENDING'",
    [a.realmId,row.id,reversal,a.accountId]);
   await tx.query("UPDATE donation_payment_attempt SET status='FAILED' "+
    "WHERE root_realm_id=$1 AND id=$2 AND status='PAYMENT_PENDING'",
    [a.realmId,row.attempt_id]);
   const result=await tx.query(
    "UPDATE donation SET source_status='FAILED',version=version+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND source_status='PAYMENT_PENDING'",
    [a.realmId,row.donation_id]);
   if(result.rowCount!==1)throw new ConflictException("The original donor payment changed.");
  }
 }
}
