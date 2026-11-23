import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CsrParty="CSR"|"FOUNDATION";
export type ApprovedFundingSource=Readonly<{
 proposalRef:string;sourceVersion:number;branchRef:string|null;
 csrMinor:string;foundationMinor:string;status:"APPROVED";
}>;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const uid=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException("Choose the original bank reconciliation.");return v.toLowerCase();};
const stale=()=>new ConflictException({
 code:"CG08_VERIFIED_RECEIPT_CHANGED",
 message:"Original CG09 bank verification or funding pledge changed. Refresh."});

/** CG09 owns real receipts and original journals, CG08 only approved pledges.
 * These links add NO journal, bank or copied monetary amount. */
@Injectable()
export class FinanceCsrReceiptSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 private async scope(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource,
  action:"finance.reports.view"|"finance.reconciliation.manage"){
  await this.identity.assertCurrent(tx,a,action);
  if(p.branchRef===null)await this.branches.requireFinanceRootScope(tx,a,action);
  else await this.branches.requireFinanceActiveBranch(tx,a,p.branchRef,action);
 }
 async eligibleReceipts(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource){
  await this.scope(tx,a,p,"finance.reports.view");
  const rows=await tx.query<{
   reconciliation_ref:string;verified_date:string;amount_minor:string;
   bank_name:string;bank_item_masked:string}>(
   "SELECT rec.id AS reconciliation_ref,rec.statement_date::text AS verified_date,"+
   "rec.posted_amount_minor::text AS amount_minor,a.name AS bank_name,"+
   "('•••• '||right(rec.bank_item_ref,4)) AS bank_item_masked "+
   "FROM finance_bank_reconciliation rec "+
   "JOIN finance_account a ON a.root_realm_id=rec.root_realm_id "+
   "AND a.id=rec.bank_account_id AND a.account_kind='BANK' "+
   "JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id "+
   "AND d.reconciliation_id=rec.id AND d.actor_ref=rec.verified_by "+
   "AND d.action='VERIFY' AND d.password_verified_at IS NOT NULL "+
   "JOIN cg19_stored_file f ON f.realm_id=d.root_realm_id "+
   "AND f.id=d.statement_file_id AND f.reconciliation_id=d.reconciliation_id "+
   "AND f.revision=d.statement_file_version "+
   "AND f.owner_kind='CG09_BANK_STATEMENT' "+
   "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
   "JOIN cg19_upload_intent i ON i.realm_id=f.realm_id "+
   "AND i.id=f.upload_intent_id AND i.reconciliation_id=rec.id "+
   "AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' "+
   "JOIN journal j ON j.id=rec.journal_id AND j.root_realm_id=rec.root_realm_id "+
   "AND j.posting_kind='GENERAL' AND j.status='POSTED' "+
   "JOIN finance_command command ON command.root_realm_id=j.root_realm_id "+
   "AND command.command_kind='GENERAL_POST' "+
   "AND command.request_key=j.immutable_source_event_key "+
   "AND command.entity_ref=j.id AND j.source_ref=command.request_key "+
   "JOIN journal_line debit ON debit.root_realm_id=rec.root_realm_id "+
   "AND debit.journal_id=j.id AND debit.account_id=rec.bank_account_id "+
   "AND debit.branch_id IS NOT DISTINCT FROM $2::uuid "+
   "AND debit.debit_minor=rec.posted_amount_minor AND debit.credit_minor=0 "+
   "JOIN journal_line credit ON credit.root_realm_id=rec.root_realm_id "+
   "AND credit.journal_id=j.id AND credit.account_id<>rec.bank_account_id "+
   "AND credit.branch_id IS NOT DISTINCT FROM $2::uuid "+
   "AND credit.credit_minor=rec.posted_amount_minor AND credit.debit_minor=0 "+
   "JOIN finance_account income ON income.id=credit.account_id "+
   "AND income.root_realm_id=rec.root_realm_id "+
   "JOIN account_group g ON g.id=income.group_id AND g.root_realm_id=income.root_realm_id "+
   "AND g.category IN('INCOME','FUND') "+
   "WHERE rec.root_realm_id=$1 AND rec.status='VERIFIED' "+
   "AND rec.variance_minor=0 AND rec.posted_amount_minor>0 "+
   "AND rec.statement_amount_minor=rec.posted_amount_minor "+
   "AND (SELECT count(*) FROM journal_line l "+
   "WHERE l.root_realm_id=rec.root_realm_id AND l.journal_id=rec.journal_id)=2 "+
   "AND NOT EXISTS(SELECT 1 FROM finance_csr_verified_receipt_link e "+
   "WHERE e.root_realm_id=rec.root_realm_id AND e.reconciliation_id=rec.id) "+
   "AND NOT EXISTS(SELECT 1 FROM finance_invoice_receipt x "+
   "WHERE x.root_realm_id=rec.root_realm_id AND x.reconciliation_id=rec.id) "+
   "AND NOT EXISTS(SELECT 1 FROM donation_bank_collection x "+
   "WHERE x.root_realm_id=rec.root_realm_id AND x.reconciliation_id=rec.id) "+
   "AND NOT EXISTS(SELECT 1 FROM finance_membership_collection x "+
   "WHERE x.root_realm_id=rec.root_realm_id AND x.journal_id=rec.journal_id) "+
   "AND NOT EXISTS(SELECT 1 FROM journal reversal "+
   "WHERE reversal.root_realm_id=j.root_realm_id "+
   "AND reversal.reversal_of_id=j.id AND reversal.posting_kind='REVERSAL') "+
   "ORDER BY rec.statement_date DESC,rec.id DESC LIMIT 26",
   [a.realmId,p.branchRef]);
  return {items:rows.rows.slice(0,25).map(v=>({
   reconciliationRef:v.reconciliation_ref,verifiedDate:v.verified_date,
   amountMinor:v.amount_minor,bankName:v.bank_name,
   bankItemMasked:v.bank_item_masked})),hasMore:rows.rows.length>25};
 }
 async linkReceipt(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource,
  input:{partyKind:CsrParty;reconciliationRef:string;requestKey:string}){
  await this.scope(tx,a,p,"finance.reconciliation.manage");
  if(input.partyKind!=="CSR"&&input.partyKind!=="FOUNDATION")
   throw new BadRequestException("Choose an approved funding party.");
  const ref=uid(input.reconciliationRef),key=uid(input.requestKey);
  const hash=digest(["CG09_CSR_RECEIPT_LINK_V1",p.proposalRef,p.sourceVersion,input.partyKind,ref]);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["CG09:CSR:RECEIPT:"+a.realmId+":"+a.accountId+":"+key]);
  const prior=(await tx.query<{id:string;funding_proposal_id:string;
   approved_source_version:number;party_kind:string;reconciliation_id:string;
   request_digest:string}>(
   "SELECT * FROM finance_csr_verified_receipt_link "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [a.realmId,a.accountId,key])).rows[0];
  if(prior){
   if(prior.funding_proposal_id!==p.proposalRef||
    prior.approved_source_version!==p.sourceVersion||
    prior.party_kind!==input.partyKind||prior.reconciliation_id!==ref||
    prior.request_digest!==hash)throw stale();
   return {linked:true,replayed:true};
  }
  const saved=await tx.query(
   "INSERT INTO finance_csr_verified_receipt_link(root_realm_id,funding_proposal_id,"+
   "approved_source_version,party_kind,reconciliation_id,request_key,request_digest,actor_ref) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
   [a.realmId,p.proposalRef,p.sourceVersion,input.partyKind,ref,key,hash,a.accountId]);
  if(!saved.rowCount)throw stale();
  return {linked:true,replayed:false};
 }
 /** Invalidated statement proof or reversed general journal cannot fund a
  * NEW allocation; prior immutable financial history is retained. */
 async currentReceived(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource){
  await this.scope(tx,a,p,"finance.reports.view");
  const rows=await tx.query<{party_kind:CsrParty;valid_minor:string;invalid_minor:string}>(
   "SELECT link.party_kind,"+
   "coalesce(sum(CASE WHEN f.id IS NOT NULL AND i.id IS NOT NULL AND "+
   "reversal.id IS NULL THEN rec.posted_amount_minor ELSE 0 END),0)::text AS valid_minor,"+
   "coalesce(sum(CASE WHEN f.id IS NULL OR i.id IS NULL OR reversal.id IS NOT NULL "+
   "THEN rec.posted_amount_minor ELSE 0 END),0)::text AS invalid_minor "+
   "FROM finance_csr_verified_receipt_link link "+
   "JOIN finance_bank_reconciliation rec ON rec.root_realm_id=link.root_realm_id "+
   "AND rec.id=link.reconciliation_id AND rec.status='VERIFIED' AND rec.variance_minor=0 "+
   "JOIN journal j ON j.root_realm_id=rec.root_realm_id AND j.id=rec.journal_id "+
   "LEFT JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id "+
   "AND d.reconciliation_id=rec.id AND d.action='VERIFY' "+
   "LEFT JOIN cg19_stored_file f ON f.realm_id=d.root_realm_id "+
   "AND f.id=d.statement_file_id AND f.reconciliation_id=d.reconciliation_id "+
   "AND f.revision=d.statement_file_version "+
   "AND f.owner_kind='CG09_BANK_STATEMENT' "+
   "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL "+
   "LEFT JOIN cg19_upload_intent i ON i.realm_id=f.realm_id "+
   "AND i.id=f.upload_intent_id AND i.reconciliation_id=rec.id "+
   "AND i.owner_kind='CG09_BANK_STATEMENT' AND i.status='VALIDATED' "+
   "LEFT JOIN journal reversal ON reversal.root_realm_id=j.root_realm_id "+
   "AND reversal.reversal_of_id=j.id AND reversal.posting_kind='REVERSAL' "+
   "WHERE link.root_realm_id=$1 AND link.funding_proposal_id=$2 "+
   "GROUP BY link.party_kind",[a.realmId,p.proposalRef]);
  const by=(party:CsrParty)=>rows.rows.find(x=>x.party_kind===party);
  const csr=by("CSR"),foundation=by("FOUNDATION");
  return {csrReceivedMinor:csr?.valid_minor??"0",
   foundationReceivedMinor:foundation?.valid_minor??"0",
   csrNeedsRevalidationMinor:csr?.invalid_minor??"0",
   foundationNeedsRevalidationMinor:foundation?.invalid_minor??"0",
   source:"CG09_VERIFIED_BANK_RECONCILIATION" as const};
 }
}
