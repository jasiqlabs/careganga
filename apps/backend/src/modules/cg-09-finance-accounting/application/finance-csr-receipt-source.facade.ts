import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CsrParty="CSR"|"FOUNDATION";
export type ApprovedFundingSource=Readonly<{
 proposalRef:string;sourceVersion:number;branchRef:string|null;projectRef:string|null;
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
  action:"finance.reports.view"|"finance.reconciliation.manage"|"finance.budgets.manage"){
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
   "JOIN financial_year fy ON fy.id=j.financial_year_id "+
   "AND fy.root_realm_id=j.root_realm_id AND fy.status='OPEN' "+
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
  input:{partyKind:CsrParty;reconciliationRef:string;requestKey:string;remitterConfirmed:boolean}){
  await this.scope(tx,a,p,"finance.reconciliation.manage");
  if(input.remitterConfirmed!==true)
   throw new BadRequestException("Confirm the bank statement shows the actual funding remitter.");
  if(input.partyKind!=="CSR"&&input.partyKind!=="FOUNDATION")
   throw new BadRequestException("Choose an approved funding party.");
  const ref=uid(input.reconciliationRef),key=uid(input.requestKey);
  const hash=digest(["CG09_CSR_RECEIPT_LINK_V2",p.proposalRef,p.sourceVersion,input.partyKind,ref,input.remitterConfirmed]);
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
   "approved_source_version,party_kind,reconciliation_id,request_key,request_digest,"+
   "actor_ref,remitter_attested) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
   [a.realmId,p.proposalRef,p.sourceVersion,input.partyKind,ref,key,hash,a.accountId,true]);
  if(!saved.rowCount)throw stale();
  return {linked:true,replayed:false};
 }

 /** Budget options are real CG09 approved category/project/branch budgets.
  * Current finance permission is checked inside the same original transaction. */
 async eligibleBudgets(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource){
  await this.scope(tx,a,p,"finance.budgets.manage");
  const rows=await tx.query<{budgetRef:string;name:string;category:string;
   ceilingMinor:string;periodStart:string;periodEnd:string}>(
   'SELECT b.id AS "budgetRef",b.budget_name AS name,b.category_label AS category,'+
   'b.approved_ceiling_minor::text AS "ceilingMinor",'+
   'b.period_start::text AS "periodStart",b.period_end::text AS "periodEnd" '+
   "FROM finance_budget b JOIN financial_year fy ON fy.id=b.financial_year_id "+
   "AND fy.root_realm_id=b.root_realm_id AND fy.status='OPEN' "+
   "WHERE b.root_realm_id=$1 AND b.status='APPROVED' "+
   "AND b.branch_id IS NOT DISTINCT FROM $2::uuid "+
   "AND b.project_ref IS NOT DISTINCT FROM $3::uuid "+
   "ORDER BY b.created_at DESC,b.id DESC LIMIT 26",
   [a.realmId,p.branchRef,p.projectRef]);
  return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25};
 }
 async eligibleBudgetExpenses(tx:PoolClient,a:VerifiedFoundationActor,
  p:ApprovedFundingSource,budgetInput:string){
  await this.scope(tx,a,p,"finance.budgets.manage");
  const budget=uid(budgetInput);
  const rows=await tx.query<{journalRef:string;voucherNumber:string;amountMinor:string;postedDate:string}>(
   'SELECT j.id AS "journalRef",v.voucher_number AS "voucherNumber",'+
   'v.total_minor::text AS "amountMinor",j.posting_date::text AS "postedDate" '+
   "FROM finance_budget b JOIN journal j ON j.root_realm_id=b.root_realm_id "+
   "AND j.financial_year_id=b.financial_year_id "+
   "AND j.posting_date BETWEEN b.period_start AND b.period_end "+
   "AND j.posting_kind='VOUCHER' AND j.status='POSTED' "+
   "JOIN finance_voucher v ON v.id=j.source_ref AND v.root_realm_id=j.root_realm_id "+
   "AND v.voucher_type='EXPENSE' AND v.status IN('POSTED','PAYMENT_REQUESTED','PAID_VERIFIED') "+
   "AND v.branch_id IS NOT DISTINCT FROM b.branch_id "+
   "AND ($4::uuid IS NULL OR v.project_ref=$4) "+
   "JOIN finance_account account ON account.id=v.debit_account_id "+
   "AND account.root_realm_id=v.root_realm_id "+
   "JOIN account_group g ON g.id=account.group_id AND g.root_realm_id=account.root_realm_id "+
   "AND g.category='EXPENSE' AND g.code=b.category_label "+
   "WHERE b.id=$1 AND b.root_realm_id=$2 AND b.status='APPROVED' "+
   "AND b.branch_id IS NOT DISTINCT FROM $3::uuid "+
   "AND b.project_ref IS NOT DISTINCT FROM $4::uuid "+
   "AND NOT EXISTS(SELECT 1 FROM finance_budget_event e "+
   "WHERE e.root_realm_id=j.root_realm_id AND e.source_journal_id=j.id) "+
   "AND NOT EXISTS(SELECT 1 FROM journal reversal "+
   "WHERE reversal.root_realm_id=j.root_realm_id AND reversal.reversal_of_id=j.id "+
   "AND reversal.posting_kind='REVERSAL') "+
   "ORDER BY j.posting_date DESC,j.id DESC LIMIT 26",
   [budget,a.realmId,p.branchRef,p.projectRef]);
  return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25};
 }
 /** One original CG09 ALLOCATE/UTILIZE event and one immutable attribution
  * are committed in the same transaction; failed review rolls both back.
  * Original finance_budget_event capacity and posted voucher guards remain
  * authoritative, independently of our CG08 receipt-capacity guard. */
 async recordBudgetEffect(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource,
  raw:{partyKind:CsrParty;kind:"ALLOCATE"|"UTILIZE";budgetRef:string;
   amountMinor:string;journalRef:string|null;requestKey:string}){
  await this.scope(tx,a,p,"finance.budgets.manage");
  if(!["CSR","FOUNDATION"].includes(raw.partyKind)||
   !["ALLOCATE","UTILIZE"].includes(raw.kind)||
   !/^[1-9][0-9]{0,13}$/.test(raw.amountMinor)||
   BigInt(raw.amountMinor)>99999999999999n||
   raw.kind==="UTILIZE"&&!raw.journalRef||
   raw.kind==="ALLOCATE"&&raw.journalRef!==null)
   throw new BadRequestException("Check the approved allocation or original posted expense.");
  const budget=uid(raw.budgetRef),key=uid(raw.requestKey),
   journal=raw.journalRef===null?null:uid(raw.journalRef);
  const hash=digest(["CG09_CSR_BUDGET_EFFECT_V1",p.proposalRef,p.sourceVersion,
   raw.partyKind,raw.kind,budget,raw.amountMinor,journal]);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["CG09:CSR:BUDGET:"+a.realmId+":"+a.accountId+":"+key]);
  const prior=(await tx.query<{funding_proposal_id:string;approved_source_version:number;
   party_kind:string;request_digest:string}>(
   "SELECT funding_proposal_id,approved_source_version,party_kind,request_digest "+
   "FROM finance_csr_budget_effect WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [a.realmId,a.accountId,key])).rows[0];
  if(prior){
   if(prior.funding_proposal_id!==p.proposalRef||
    prior.approved_source_version!==p.sourceVersion||
    prior.party_kind!==raw.partyKind||prior.request_digest!==hash)throw stale();
   return {confirmed:true,replayed:true};
  }
  const matches=await this.eligibleBudgets(tx,a,p);
  if(!matches.items.some(x=>x.budgetRef===budget))
   throw new ConflictException("This original approved budget is unavailable in your project/branch.");
  if(raw.kind==="UTILIZE"){
   const eligible=await this.eligibleBudgetExpenses(tx,a,p,budget);
   if(!eligible.items.some(x=>x.journalRef===journal&&x.amountMinor===raw.amountMinor))
    throw new ConflictException("Choose the exact current posted Finance expense.");
  }
  const ev=(await tx.query<{id:string}>(
   "INSERT INTO finance_budget_event(root_realm_id,budget_id,kind,amount_minor,"+
   "event_key,source_digest,source_journal_id,actor_ref) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
   [a.realmId,budget,raw.kind,raw.amountMinor,key,hash,journal,a.accountId])).rows[0];
  if(!ev)throw stale();
  await tx.query(
   "INSERT INTO finance_csr_budget_effect(root_realm_id,funding_proposal_id,"+
   "approved_source_version,party_kind,budget_event_id,request_key,request_digest,actor_ref) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
   [a.realmId,p.proposalRef,p.sourceVersion,raw.partyKind,ev.id,key,hash,a.accountId]);
  return {confirmed:true,replayed:false};
 }
 /** A receipt is not an allocation; allocations and actual utilization
  * derive only from original CG09 budget events, never proposal estimates. */
 async currentBudgetEffects(tx:PoolClient,a:VerifiedFoundationActor,p:ApprovedFundingSource){
  await this.scope(tx,a,p,"finance.reports.view");
  const q=await tx.query<{kind:string;amountMinor:string}>(
   'SELECT e.kind,COALESCE(sum(e.amount_minor),0)::text AS "amountMinor" '+
   "FROM finance_csr_budget_effect link JOIN finance_budget_event e "+
   "ON e.id=link.budget_event_id AND e.root_realm_id=link.root_realm_id "+
   "WHERE link.root_realm_id=$1 AND link.funding_proposal_id=$2 "+
   "AND (e.kind='ALLOCATE' OR NOT EXISTS(SELECT 1 FROM journal reversal "+
   "WHERE reversal.root_realm_id=e.root_realm_id "+
   "AND reversal.reversal_of_id=e.source_journal_id AND reversal.posting_kind='REVERSAL')) "+
   "GROUP BY e.kind",[a.realmId,p.proposalRef]);
  const amount=(kind:string)=>q.rows.find(x=>x.kind===kind)?.amountMinor??"0";
  return {allocatedMinor:amount("ALLOCATE"),utilizedMinor:amount("UTILIZE"),
   source:"CG09_APPROVED_BUDGET_EVENTS" as const};
 }
 /** Single bounded B07 finance projection from original posted sources.
  * Caller intersects CG08 and CG09 permitted current CG02 scopes; no
  * paginated-row sum, no copy of received amounts into CG08. */
 async dashboardSummary(tx:PoolClient,a:VerifiedFoundationActor,scope:{
  all:boolean;branchRefs:string[];branchFilter:string|null|undefined;query:string
 }){
  await this.identity.assertCurrent(tx,a,"finance.reports.view");
  // The list snapshot may have been resolved BEFORE this SQL transaction.
  // Reverify each CG02 branch assignment under the current account/role
  // lock (and root-wide permission when full) before the aggregate runs.
  if(scope.all)await this.branches.requireFinanceRootScope(tx,a,"finance.reports.view");
  else{
   if(scope.branchRefs.length>100)
    throw new ConflictException("Narrow the permitted finance branch scope.");
   for(const branch of scope.branchRefs)
    await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.reports.view");
  }
  const x=await tx.query<{committed_minor:string;received_minor:string;invalid_minor:string;
   allocated_minor:string;utilized_minor:string}>(
   "WITH selected AS MATERIALIZED (SELECT f.id,f.root_realm_id,f.requested_minor "+
   "FROM csr_funding_proposal f WHERE f.root_realm_id=$1 "+
   "AND f.status='APPROVED' "+
   "AND ($2::boolean OR f.branch_ref=ANY($3::uuid[])) "+
   "AND ($4::boolean OR f.branch_ref IS NOT DISTINCT FROM $5::uuid) "+
   "AND ($6='' OR strpos(lower(f.purpose),$6)>0)), "+
   "commitments AS (SELECT coalesce(sum(requested_minor),0)::text AS amount FROM selected), "+
   "money AS (SELECT "+
   "coalesce(sum(CASE WHEN file.id IS NOT NULL AND intent.id IS NOT NULL "+
   "AND reversal.id IS NULL THEN rec.posted_amount_minor ELSE 0 END),0)::text AS received,"+
   "coalesce(sum(CASE WHEN file.id IS NULL OR intent.id IS NULL "+
   "OR reversal.id IS NOT NULL THEN rec.posted_amount_minor ELSE 0 END),0)::text AS invalid "+
   "FROM selected s JOIN finance_csr_verified_receipt_link link "+
   "ON link.root_realm_id=s.root_realm_id AND link.funding_proposal_id=s.id "+
   "JOIN finance_bank_reconciliation rec ON rec.root_realm_id=link.root_realm_id "+
   "AND rec.id=link.reconciliation_id AND rec.status='VERIFIED' AND rec.variance_minor=0 "+
   "JOIN journal j ON j.root_realm_id=rec.root_realm_id AND j.id=rec.journal_id "+
   "LEFT JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id "+
   "AND d.reconciliation_id=rec.id AND d.action='VERIFY' "+
   "LEFT JOIN cg19_stored_file file ON file.realm_id=d.root_realm_id "+
   "AND file.id=d.statement_file_id AND file.reconciliation_id=d.reconciliation_id "+
   "AND file.revision=d.statement_file_version "+
   "AND file.owner_kind='CG09_BANK_STATEMENT' "+
   "AND file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL "+
   "LEFT JOIN cg19_upload_intent intent ON intent.realm_id=file.realm_id "+
   "AND intent.id=file.upload_intent_id AND intent.reconciliation_id=rec.id "+
   "AND intent.owner_kind='CG09_BANK_STATEMENT' AND intent.status='VALIDATED' "+
   "LEFT JOIN journal reversal ON reversal.root_realm_id=j.root_realm_id "+
   "AND reversal.reversal_of_id=j.id AND reversal.posting_kind='REVERSAL'), "+
   "budget AS (SELECT coalesce(sum(ev.amount_minor) "+
   "FILTER(WHERE ev.kind='ALLOCATE'),0)::text AS allocated,"+
   "coalesce(sum(CASE WHEN ev.kind='UTILIZE' AND NOT EXISTS "+
   "(SELECT 1 FROM journal reversal WHERE reversal.root_realm_id=ev.root_realm_id "+
   "AND reversal.reversal_of_id=ev.source_journal_id "+
   "AND reversal.posting_kind='REVERSAL') THEN ev.amount_minor ELSE 0 END),0)::text AS utilized "+
   "FROM selected s JOIN finance_csr_budget_effect link "+
   "ON link.root_realm_id=s.root_realm_id AND link.funding_proposal_id=s.id "+
   "JOIN finance_budget_event ev ON ev.root_realm_id=link.root_realm_id "+
   "AND ev.id=link.budget_event_id) "+
   "SELECT c.amount AS committed_minor,m.received AS received_minor,"+
   "m.invalid AS invalid_minor,b.allocated AS allocated_minor,"+
   "b.utilized AS utilized_minor FROM commitments c CROSS JOIN money m CROSS JOIN budget b",
   [a.realmId,scope.all,scope.branchRefs,scope.branchFilter===undefined,
    scope.branchFilter??null,scope.query]);
  const v=x.rows[0];
  const received=BigInt(v?.received_minor??"0"),
   allocated=BigInt(v?.allocated_minor??"0"),
   utilized=BigInt(v?.utilized_minor??"0");
  const needsRevalidation=allocated>received||utilized>allocated||
   BigInt(v?.invalid_minor??"0")>0n;
  return {committedMinor:v?.committed_minor??"0",
   verifiedReceivedMinor:v?.received_minor??"0",
   revalidationRequiredMinor:v?.invalid_minor??"0",
   allocatedMinor:allocated.toString(),utilizedMinor:utilized.toString(),
   availableMinor:needsRevalidation?null:(received-allocated).toString(),
   utilizationPercent:needsRevalidation?null:allocated===0n?"0.00":
    (utilized*10000n/allocated/100n).toString()+"."+
    (utilized*10000n/allocated%100n).toString().padStart(2,"0"),
   needsRevalidation,
   notice:needsRevalidation?
    "Original receipt or budget effect requires Finance revalidation.":
    "Money and budget totals derive only from independently verified CG09 sources."};
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
