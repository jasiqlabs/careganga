import {DonationBankCollectionFacade} from "./donation-bank-collection.facade";
import {MembershipFeesService} from "./membership-fees.service";
import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import {financeSqlFailure} from "./finance-sql-error";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FinanceBankStatementProofFacade} from "../../cg-19-documents-notifications/application/finance-bank-statement-proof.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=(v:unknown,field:string)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field});
 return v;
};
const position=(value?:string)=>{
 if(value!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(value))
  throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"offset"});
 return Number(value??"0");
};
const validDate=(v?:string)=>{
 if(!v)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(new Date(v+"T00:00:00Z").getTime())||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
  throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"date"});
 return v;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const amountMinor=(v:unknown)=>{
 if(typeof v!=="string"||!/^(-)?(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(v))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID",field:"amount"});
 const neg=v.startsWith("-"),str=neg?v.slice(1):v,[a,b=""]=str.split(".");
 const minor=(BigInt(a)*100n+BigInt((b+"00").slice(0,2)))*(neg?-1n:1n);
 if(minor===0n||minor>99999999999999n||minor<(-99999999999999n))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID",field:"amount"});
 return minor.toString();
};
type Options={yearRef?:string;branchRef?:string;accountRef?:string;from?:string;to?:string;offset?:string;areaRef?:string};
@Injectable()
export class FinanceReportsService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly statementProof:FinanceBankStatementProofFacade,
   private readonly branches:BranchSourceFacade,private readonly membershipFees:MembershipFeesService,
  private readonly bankDonations:DonationBankCollectionFacade){}
 private actor(bearer:string,write=false){
  return this.sessions.requireAction(bearer,
   write?"finance.reconciliation.manage":"finance.reports.view");
 }
 private filters(raw:Options,allowArea=false){
  if(Object.keys(raw).some(k=>!["yearRef","branchRef","accountRef","from","to","offset"].includes(k)&&
    !(allowArea&&k==="areaRef")))
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID"});
  const fy=raw.yearRef?uuid(raw.yearRef,"yearRef"):null,
   branch=raw.branchRef?uuid(raw.branchRef,"branchRef"):null,
   account=raw.accountRef?uuid(raw.accountRef,"accountRef"):null,
   from=validDate(raw.from),to=validDate(raw.to);
  if(from&&to&&from>to)
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"date"});
  return {fy,branch,account,from,to,offset:position(raw.offset),
   areaRef:allowArea&&raw.areaRef?uuid(raw.areaRef,"areaRef"):null};
 }
 private async verifyFilterScope(bearer:string,realm:string,v:{
  fy:string|null;branch:string|null;account:string|null},areaRef?:string|null){
  const tests:{ref:string|null;field:string;table:string}[]=[
   {ref:v.fy,field:"yearRef",table:"financial_year"},
   {ref:v.branch,field:"branchRef",table:"branch"},
   {ref:v.account,field:"accountRef",table:"finance_account"}
  ];
  const areaBranches=areaRef?
   await this.branches.financeAreaBranchRefs(bearer,areaRef,v.branch):null;
  if(!areaRef)await this.branches.requireFinanceReportBranch(bearer,v.branch);
  for(const t of tests){
   if(!t.ref)continue;
   // Whitelisted table names only: no request values interpolated into SQL.
   const result=await this.db.query(
    "SELECT id FROM "+t.table+" WHERE id=$1 AND root_realm_id=$2",
    [t.ref,realm]);
   if(!result.rowCount)
    throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:t.field});
  }
  return areaBranches;
 }
 async options(bearer:string){
  const actor=await this.actor(bearer);
  const scope=await this.branches.financeReportScope(bearer);
  const [years,accounts,branches,areas]=await Promise.all([
   this.db.query<{ref:string;name:string;startOn:string;endOn:string}>(
    "SELECT id AS ref,name,start_on::text AS \"startOn\",end_on::text AS \"endOn\" "+
    "FROM financial_year WHERE root_realm_id=$1 ORDER BY start_on DESC LIMIT 30",
    [actor.realmId]),
   this.db.query<{ref:string;name:string;code:string;kind:string}>(
    "SELECT id AS ref,name,code,account_kind AS kind FROM finance_account "+
    "WHERE root_realm_id=$1 AND ($2::boolean OR "+
    "(branch_id IS NULL OR branch_id=ANY($3::uuid[]))) "+
    "ORDER BY name,id LIMIT 200",[actor.realmId,scope.all,scope.branchRefs]),
    this.branches.financeBranches(bearer,"finance.reports.view"),
    this.branches.financeReportGeographies(bearer)
  ]);
  return {years:years.rows,accounts:accounts.rows,branches,areas,
   allBranches:scope.all};
 }
 async ledger(bearer:string,raw:Options){
  const actor=await this.actor(bearer),v=this.filters(raw,true);
  const allowedAreaBranches=await this.verifyFilterScope(
   bearer,actor.realmId,v,v.areaRef);
  const rows=await this.db.query<{accountName:string;accountCode:string;category:string;
   postingDate:string;description:string;postingKind:string;debitMinor:string;
   creditMinor:string;normalSide:string;journalRef:string;lineRef:string}>(
   "SELECT a.name AS \"accountName\",a.code AS \"accountCode\",g.category,"+
   "j.posting_date::text AS \"postingDate\",j.description,j.posting_kind AS \"postingKind\","+
   "l.debit_minor::text AS \"debitMinor\",l.credit_minor::text AS \"creditMinor\","+
   "a.normal_side AS \"normalSide\",j.id AS \"journalRef\",l.id AS \"lineRef\" "+
   "FROM journal_line l JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
   "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
   "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
   "AND ($4::uuid IS NULL OR l.account_id=$4) "+
   "AND ($5::date IS NULL OR j.posting_date>=$5) "+
   "AND ($6::date IS NULL OR j.posting_date<=$6) "+
   "AND ($8::uuid[] IS NULL OR l.branch_id=ANY($8::uuid[])) "+
   "ORDER BY j.posting_date DESC,j.id DESC,l.id DESC LIMIT 51 OFFSET $7",
   [actor.realmId,v.fy,v.branch,v.account,v.from,v.to,v.offset,allowedAreaBranches]);
  return {lines:rows.rows.slice(0,50),
   nextOffset:rows.rows.length>50?v.offset+50:null,
   explanation:"All amounts are from immutable, posted journal lines. No inferred future sources."};
 }
 async trialBalance(bearer:string,yearInput:string,branchInput?:string){
  const actor=await this.actor(bearer),yearRef=uuid(yearInput,"yearRef"),
   branch=branchInput?uuid(branchInput,"branchRef"):null;
  await this.verifyFilterScope(bearer,actor.realmId,{fy:yearRef,branch,account:null});
  const row=await this.db.query<{accountName:string;code:string;category:string;
   debitMinor:string;creditMinor:string;normalSide:string}>(
   "SELECT a.name AS \"accountName\",a.code,g.category,a.normal_side AS \"normalSide\","+
   "COALESCE(x.debit,0)::text AS \"debitMinor\","+
   "COALESCE(x.credit,0)::text AS \"creditMinor\" "+
   "FROM finance_account a JOIN account_group g "+
   "ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "LEFT JOIN (SELECT l.account_id,SUM(l.debit_minor) AS debit,"+
   "SUM(l.credit_minor) AS credit "+
   "FROM journal j JOIN journal_line l ON l.journal_id=j.id "+
   "AND l.root_realm_id=j.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.financial_year_id=$2 AND j.status='POSTED' "+
   "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
   "GROUP BY l.account_id) x ON x.account_id=a.id "+
   "WHERE a.root_realm_id=$1 "+
   "AND ($3::uuid IS NULL OR a.branch_id IS NULL OR a.branch_id=$3) "+
   "ORDER BY a.code,a.id LIMIT 1001",
   [actor.realmId,yearRef,branch]);
  // Use only posted, year-scoped ledger lines; no cross-year account row scans.
  if(row.rows.length>1000)
   throw new ConflictException({code:"FINANCE_REPORT_TOO_LARGE",
    message:"Select a branch or narrower financial-year account set."});
  const balances=row.rows.map(a=>{
   const debit=BigInt(a.debitMinor),credit=BigInt(a.creditMinor);
   const net=debit-credit;
   return {...a,netDebitMinor:(net>0n?net:0n).toString(),
    netCreditMinor:(net<0n?-net:0n).toString()};
  });
  const debit=balances.reduce((n,v)=>n+BigInt(v.netDebitMinor),0n);
  const credit=balances.reduce((n,v)=>n+BigInt(v.netCreditMinor),0n);
  return {accounts:balances,totalDebitMinor:debit.toString(),
   totalCreditMinor:credit.toString(),balanced:debit===credit,
   explanation:"Trial balance is derived only from posted CG-09 journals, not a stored balance."};
 }
 async books(bearer:string,kind:"DAY"|"CASH"|"BANK",raw:Options){
  const actor=await this.actor(bearer),v=this.filters(raw);
  await this.verifyFilterScope(bearer,actor.realmId,v);
  const rows=await this.db.query<{postingDate:string;account:string;kind:string;
   debitMinor:string;creditMinor:string;description:string;postingKind:string}>(
   "SELECT j.posting_date::text AS \"postingDate\",a.name AS account,"+
   "a.account_kind AS kind,l.debit_minor::text AS \"debitMinor\","+
   "l.credit_minor::text AS \"creditMinor\",j.description,j.posting_kind AS \"postingKind\" "+
   "FROM journal j JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
   "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
   "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
   "AND ($4::uuid IS NULL OR l.account_id=$4) "+
   "AND ($5::date IS NULL OR j.posting_date>=$5) "+
   "AND ($6::date IS NULL OR j.posting_date<=$6) "+
   "AND ($7='DAY' OR ($7='CASH' AND a.account_kind='CASH') "+
   "OR ($7='BANK' AND a.account_kind='BANK')) "+
   "ORDER BY j.posting_date DESC,j.id DESC,l.id DESC LIMIT 51 OFFSET $8",
   [actor.realmId,v.fy,v.branch,v.account,v.from,v.to,kind,v.offset]);
  return {kind,lines:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?v.offset+50:null};
 }
 async summary(bearer:string,yearInput?:string,branchInput?:string){
  const actor=await this.actor(bearer),
   year=yearInput?uuid(yearInput,"yearRef"):null,
   branch=branchInput?uuid(branchInput,"branchRef"):null;
  await this.verifyFilterScope(bearer,actor.realmId,{fy:year,branch,account:null});
  const result=await this.readPostedSummary(actor.realmId,year,branch);
  await this.actor(bearer);
  await this.verifyFilterScope(bearer,actor.realmId,{fy:year,branch,account:null});
  return result;
 }
 /** Same original posted-metric formula for both interactive and current-role
  * CG20 scheduled readers. Never a second CG20 finance SQL/projection.
  */
 private async readPostedSummary(realm:string,year:string|null,branch:string|null,
  permittedBranches:readonly string[]|null=null){
  // Keep both source totals in the same actual PostgreSQL read snapshot.
  // Snapshot time is per CG-09; it is NOT a cross-owner/global watermark.
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");open=true;
   await tx.query("SET LOCAL statement_timeout='8s'");
   const cutoff=await tx.query<{asOf:Date}>(
    'SELECT transaction_timestamp() AS "asOf"');
   const result=await tx.query<{category:string;amountDebit:string;amountCredit:string}>(
    "SELECT g.category,COALESCE(SUM(l.debit_minor),0)::text AS \"amountDebit\","+
    "COALESCE(SUM(l.credit_minor),0)::text AS \"amountCredit\" "+
    "FROM journal j JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id "+
    "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
    "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
    "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
    "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
    "AND ($4::uuid[] IS NULL OR l.branch_id=ANY($4::uuid[])) GROUP BY g.category",
    [realm,year,branch,permittedBranches]);
   const k=Object.fromEntries(result.rows.map(x=>[x.category,x]));
   const get=(cat:string,side:"amountDebit"|"amountCredit")=>BigInt(k[cat]?.[side]??"0");
   const income=get("INCOME","amountCredit")-get("INCOME","amountDebit");
   const expense=get("EXPENSE","amountDebit")-get("EXPENSE","amountCredit");
   const funds=get("FUND","amountCredit")-get("FUND","amountDebit");
   const cash=await tx.query<{balance:string}>(
    "SELECT COALESCE(SUM(CASE WHEN a.normal_side='DEBIT' "+
    "THEN l.debit_minor-l.credit_minor ELSE l.credit_minor-l.debit_minor END),0)::text AS balance "+
    "FROM journal_line l JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id "+
    "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
    "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
    "AND a.account_kind IN('CASH','BANK') "+
    "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
    "AND ($4::uuid[] IS NULL OR l.branch_id=ANY($4::uuid[]))",
    [realm,year,branch,permittedBranches]);
   await tx.query("COMMIT");open=false;
   return {incomeMinor:income.toString(),expenseMinor:expense.toString(),
    surplusMinor:(income-expense).toString(),fundsMinor:funds.toString(),
    cashBankMinor:cash.rows[0]?.balance??"0",
    sourceRecordState:result.rows.length===0?"NO_ROWS":"HAS_ROWS",
    sourceAsOf:cutoff.rows[0].asOf.toISOString(),sourceCutoffKind:"POSTGRES_READ_SNAPSHOT",
    explanation:"Recognized income/expense from posted GL only. Cash/bank is not approved claims or invoices."};
  }catch(e){if(open)await tx.query("ROLLBACK").catch(()=>undefined);throw e;}
  finally{tx.release();}
 }
 /** MIS-only regional and delegated manager aggregate: all currently allowed
  * branch lines, never Foundation-null money or unrelated branches.
  */
 async assignedMisSummary(bearer:string,yearInput?:string){
  const actor=await this.actor(bearer);
  const year=yearInput?uuid(yearInput,"yearRef"):null;
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  if(scope.all)return this.summary(bearer,yearInput);
  if(scope.branchRefs.length===0)
   throw new ForbiddenException("No active reporting branch is assigned to your account");
  if(year)await this.verifyAssignedMisYear(actor.realmId,year);
  const result=await this.readPostedSummary(actor.realmId,year,null,scope.branchRefs);
  // A revoked branch grant bumps CG01 access_version. Do not return a stale
  // regional report if the session or selected CG02 branch scope changed
  // while the read-only PostgreSQL snapshot was being assembled.
  await this.actor(bearer);
  const latest=await this.branches.financeReportScope(bearer,"finance.reports.view");
  if(scope.all&&!latest.all||
   !latest.all&&scope.branchRefs.some(ref=>!latest.branchRefs.includes(ref)))
   throw new ForbiddenException("Your assigned branch reporting scope changed. Refresh the report.");
  return result;
 }
 private async verifyAssignedMisYear(root:string,year:string){
  const row=await this.db.query(
   "SELECT 1 FROM financial_year WHERE root_realm_id=$1 AND id=$2",
   [root,year]);
  if(!row.rowCount)throw new BadRequestException({
   code:"FINANCE_REPORT_FILTER_INVALID",field:"yearRef"});
 }
 /** The due worker has no user bearer. Its stored CG01 account is checked
  * live and CG02 enforces the same assigned-branch/Finance-Admin boundary.
  * Only this narrow posted finance owner projection is supported unattended.
  */
 async scheduledSummary(root:string,account:string,yearInput?:string,branchInput?:string){
  await this.sessions.requireScheduledMisAction(root,account,"finance.reports.view");
  const year=yearInput?uuid(yearInput,"yearRef"):null;
  const branch=branchInput?uuid(branchInput,"branchRef"):null;
  // Single branch must be CURRENT; an omitted branch is an EXPLICIT
  // currently authorized all-assigned union, not guessed root authority.
  const assigned=branch?null:await this.branches.scheduledFinanceScope(root,account);
  if(branch)await this.branches.requireScheduledFinanceReportBranch(root,account,branch);
  if(year){
   const exists=await this.db.query(
    "SELECT 1 FROM financial_year WHERE id=$1 AND root_realm_id=$2",
    [year,root]);
   if(!exists.rowCount)
    throw new ForbiddenException("The scheduled financial year is unavailable");
  }
  const result=await this.readPostedSummary(root,year,branch,
   assigned&&!assigned.all?assigned.branchRefs:null);
  // A pending CG19 delivery must never release bytes after the owner loses
  // branch, protected root or original CG01 finance permission mid-read.
  await this.sessions.requireScheduledMisAction(root,account,"finance.reports.view");
  if(branch)await this.branches.requireScheduledFinanceReportBranch(root,account,branch);
  else{
   const current=await this.branches.scheduledFinanceScope(root,account);
   if(assigned?.all&&!current.all||
     assigned&&!assigned.all&&!current.all&&
      assigned.branchRefs.some(ref=>!current.branchRefs.includes(ref)))
    throw new ForbiddenException("Scheduled report scope changed. Refresh the original report.");
  }
  return result;
 }
 /** CG-20 US-001 source-owned narrow trend, never a separate MIS ledger.
  * Month uses original posting_date, only POSTED journal lines and the same
  * current CG-02 branch permission as all existing CG-09 finance reports.
  * Absent months are not invented. No private journal row leaves CG-09.
  */
 async monthlyMisTrend(bearer:string,yearInput?:string,branchInput?:string){
  const actor=await this.actor(bearer);
  const year=yearInput?uuid(yearInput,"yearRef"):null;
  const branch=branchInput?uuid(branchInput,"branchRef"):null;
  await this.verifyFilterScope(bearer,actor.realmId,{fy:year,branch,account:null});
  const trend=await this.readMonthlyMisTrend(actor.realmId,year,branch,null);
  await this.actor(bearer);
  await this.verifyFilterScope(bearer,actor.realmId,{fy:year,branch,account:null});
  return trend;
 }
 private async readMonthlyMisTrend(root:string,year:string|null,branch:string|null,
  permittedBranches:readonly string[]|null){
  const rows=await this.db.query<{month:string;incomeMinor:string;expenseMinor:string}>(
   "SELECT to_char(date_trunc('month',j.posting_date),'YYYY-MM') AS month,"+
   "COALESCE(SUM(CASE WHEN g.category='INCOME' "+
   "THEN l.credit_minor-l.debit_minor ELSE 0 END),0)::text AS \"incomeMinor\","+
   "COALESCE(SUM(CASE WHEN g.category='EXPENSE' "+
   "THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS \"expenseMinor\" "+
   "FROM journal j "+
   "JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
   "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
   "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
   "AND ($4::uuid[] IS NULL OR l.branch_id=ANY($4::uuid[])) "+
   "AND j.posting_date >= (date_trunc('month',CURRENT_DATE) - interval '5 months')::date "+
   "AND j.posting_date < (date_trunc('month',CURRENT_DATE) + interval '1 month')::date "+
   "AND g.category IN ('INCOME','EXPENSE') "+
   "GROUP BY date_trunc('month',j.posting_date) "+
   "ORDER BY date_trunc('month',j.posting_date) LIMIT 6",
   [root,year,branch,permittedBranches]);
  return {months:rows.rows,windowLabel:"Last six calendar months",
   explanation:"Net posted finance income and expenses by posting month. Missing months have no original qualifying journal lines."};
 }
 /** Restricted MIS aggregate trend. Source CG09 posted journals only. */
 async assignedMisMonthlyTrend(bearer:string,yearInput?:string){
  const actor=await this.actor(bearer);
  const year=yearInput?uuid(yearInput,"yearRef"):null;
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  if(scope.all)return this.monthlyMisTrend(bearer,yearInput);
  if(scope.branchRefs.length===0)
   throw new ForbiddenException("No active reporting branch is assigned to your account");
  if(year)await this.verifyAssignedMisYear(actor.realmId,year);
  const result=await this.readMonthlyMisTrend(actor.realmId,year,null,scope.branchRefs);
  await this.actor(bearer);
  const latest=await this.branches.financeReportScope(bearer,"finance.reports.view");
  if(scope.all&&!latest.all||
   !latest.all&&scope.branchRefs.some(ref=>!latest.branchRefs.includes(ref)))
   throw new ForbiddenException("Your assigned branch reporting scope changed. Refresh the report.");
  return result;
 }
 /** Typed CG20 C49 grouping is computed ONLY by the original CG09
  * posted-ledger owner. No CG20 SQL, arbitrary columns or client-side totals
  * from a truncated 50-row ledger preview.
  */
 async groupedMis(bearer:string,raw:{
  yearRef?:string;branchRef?:string;fromDay?:string;untilDay?:string;
  areaRef?:string;
  groupBy:"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME";
  sortBy?:"NAME"|"DEBIT"|"CREDIT";sortDirection?:"ASC"|"DESC"
 }){
  const actor=await this.actor(bearer),v=this.filters({
   yearRef:raw.yearRef,branchRef:raw.branchRef,
   from:raw.fromDay,to:raw.untilDay
  });
  const selectedArea=raw.areaRef?uuid(raw.areaRef,"areaRef"):null;
  const areaBranches=await this.verifyFilterScope(
   bearer,actor.realmId,v,selectedArea);
  const group=({
   CATEGORY:"g.category",POSTING_KIND:"j.posting_kind",
   ACCOUNT_NAME:"a.name"
  } as const)[raw.groupBy];
  const order=({
   NAME:'"groupLabel"',DEBIT:"SUM(l.debit_minor)",CREDIT:"SUM(l.credit_minor)"
  } as const)[raw.sortBy??"NAME"];
  const direction=raw.sortDirection==="DESC"?"DESC":"ASC";
  if(!group||!order||raw.sortDirection&&
     raw.sortDirection!=="ASC"&&raw.sortDirection!=="DESC")
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",
    message:"Choose a permitted grouping and sort."});
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");active=true;
   await c.query("SET LOCAL statement_timeout='8s'");
   const cutoff=await c.query<{asOf:Date}>(
    'SELECT transaction_timestamp() AS "asOf"');
   // group/order expressions come ONLY from static server-side maps.
   const rows=await c.query<{groupLabel:string;debitMinor:string;creditMinor:string}>(
    "SELECT "+group+" AS \"groupLabel\","+
    "COALESCE(SUM(l.debit_minor),0)::text AS \"debitMinor\","+
    "COALESCE(SUM(l.credit_minor),0)::text AS \"creditMinor\" "+
    "FROM journal j JOIN journal_line l ON l.journal_id=j.id "+
    "AND l.root_realm_id=j.root_realm_id "+
    "JOIN finance_account a ON a.id=l.account_id "+
    "AND a.root_realm_id=l.root_realm_id "+
    "JOIN account_group g ON g.id=a.group_id "+
    "AND g.root_realm_id=a.root_realm_id "+
    "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
    "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
    "AND ($3::uuid IS NULL OR l.branch_id=$3) "+
    "AND ($4::date IS NULL OR j.posting_date>=$4) "+
    "AND ($5::date IS NULL OR j.posting_date<=$5) "+
    "AND ($6::uuid[] IS NULL OR l.branch_id=ANY($6::uuid[])) "+
    "GROUP BY "+group+" "+
    "ORDER BY "+order+" "+direction+', "groupLabel" ASC LIMIT 51',
    [actor.realmId,v.fy,v.branch,v.from,v.to,areaBranches]);
   await c.query("COMMIT");active=false;
   return {groups:rows.rows.slice(0,50),partial:rows.rows.length>50,
    sourceAsOf:cutoff.rows[0].asOf.toISOString(),
    sourceCutoffKind:"POSTGRES_READ_SNAPSHOT" as const,
    explanation:"Net finance amounts are aggregated across only immutable posted journal lines by the original finance owner."};
  }catch(e){if(active)await c.query("ROLLBACK").catch(()=>undefined);
   throw e;}finally{c.release();}
 }
 /** Invoice receivables are a projection of original POSTED/ISSUED accruals
  * minus the source-linked verified CG-09 receipt. No sample supplier or
  * future donor/client master and no shadow balance table.
  */
 async receivables(bearer:string,raw:Options){
  const actor=await this.actor(bearer),v=this.filters(raw);
  await this.verifyFilterScope(bearer,actor.realmId,v);
  const rows=await this.db.query<{invoiceNumber:string;invoiceDate:string;
   dueDate:string;counterpartyName:string;status:string;
   totalMinor:string;verifiedMinor:string;outstandingMinor:string}>(
   "SELECT i.invoice_number AS \"invoiceNumber\","+
   "i.invoice_date::text AS \"invoiceDate\","+
   "i.due_date::text AS \"dueDate\",i.counterparty_name AS \"counterpartyName\","+
   "i.status,i.total_minor::text AS \"totalMinor\","+
   "COALESCE(r.verified,0)::text AS \"verifiedMinor\","+
   "(i.total_minor-COALESCE(r.verified,0))::text AS \"outstandingMinor\" "+
   "FROM finance_invoice i LEFT JOIN LATERAL "+
   "(SELECT COALESCE(SUM(amount_minor),0) AS verified FROM finance_invoice_receipt "+
   "WHERE root_realm_id=i.root_realm_id AND invoice_id=i.id) r ON TRUE "+
   "WHERE i.root_realm_id=$1 AND i.status IN('POSTED','ISSUED') "+
   "AND NOT EXISTS(SELECT 1 FROM finance_invoice_posted_cancellation c "+
   "WHERE c.root_realm_id=i.root_realm_id AND c.invoice_id=i.id) "+
   "AND NOT EXISTS(SELECT 1 FROM finance_invoice_credit_note c "+
   "WHERE c.root_realm_id=i.root_realm_id AND c.invoice_id=i.id) "+
   "AND ($2::uuid IS NULL OR i.financial_year_id=$2) "+
   "AND ($3::uuid IS NULL OR i.branch_id=$3) "+
   "AND ($4::uuid IS NULL OR i.receivable_account_id=$4) "+
   "AND ($5::date IS NULL OR i.invoice_date>=$5) "+
   "AND ($6::date IS NULL OR i.invoice_date<=$6) "+
   "AND i.total_minor>COALESCE(r.verified,0) "+
   "ORDER BY i.invoice_date DESC,i.id DESC LIMIT 51 OFFSET $7",
   [actor.realmId,v.fy,v.branch,v.account,v.from,v.to,v.offset]);
  return {items:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?v.offset+50:null,
   explanation:"An accrued/issued invoice is not cash. Only original source-linked verified receipt amounts reduce the receivable; protected issue and payment states remain separate."};
 }
 async reconciliationOptions(bearer:string){
  const actor=await this.actor(bearer);
  const scope=await this.branches.financeReportScope(bearer);
  const r=await this.db.query<{accountRef:string;name:string;code:string}>(
   "SELECT id AS \"accountRef\",name,code FROM finance_account "+
   "WHERE root_realm_id=$1 AND account_kind='BANK' AND status='ACTIVE' "+
   "AND ($2::boolean OR branch_id IS NULL OR branch_id=ANY($3::uuid[])) "+
   "ORDER BY name,id LIMIT 50",[actor.realmId,scope.all,scope.branchRefs]);
  return {banks:r.rows};
 }
 async bankLines(bearer:string,bankInput:string){
  const actor=await this.actor(bearer),bank=uuid(bankInput,"bankRef");
  const scope=await this.branches.financeReportScope(bearer);
  const rows=await this.db.query<{journalRef:string;financialYearRef:string;postingDate:string;
   description:string;amountMinor:string}>(
   "SELECT j.id AS \"journalRef\",j.financial_year_id AS \"financialYearRef\","+
   "j.posting_date::text AS \"postingDate\",j.description,"+
   "sum(l.debit_minor-l.credit_minor)::text AS \"amountMinor\" "+
   "FROM journal_line l JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND l.account_id=$2 AND a.account_kind='BANK' "+
   "AND j.status='POSTED' "+
   "AND ($3::boolean OR NOT cg11_root_payroll_journal(j.root_realm_id,j.id)) "+
   "AND ($3::boolean OR ((a.branch_id IS NULL OR a.branch_id=ANY($4::uuid[])) "+
   "AND l.branch_id=ANY($4::uuid[]))) "+
   "AND NOT EXISTS(SELECT 1 FROM finance_bank_reconciliation r "+
   "WHERE r.root_realm_id=l.root_realm_id AND r.bank_account_id=l.account_id "+
   "AND r.journal_id=j.id) GROUP BY j.id,j.root_realm_id,j.financial_year_id,j.posting_date,j.description "+
   "HAVING count(*)=1 OR cg11_root_payroll_journal(j.root_realm_id,j.id) ORDER BY j.posting_date DESC,j.id DESC LIMIT 51",
   [actor.realmId,bank,scope.all,scope.branchRefs]);
  return {lines:rows.rows.slice(0,50),hasMore:rows.rows.length>50};
 }
 async recordBankMatch(bearer:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.manage");
  await this.sessions.requireAction(bearer,"documents.files.manage");
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const data=raw as Record<string,unknown>;
  if(Object.keys(data).some(x=>!["bankRef","journalRef","financialYearRef","statementDate",
    "bankItemReference","statementAmount","requestKey"].includes(x)))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const bankRef=uuid(data.bankRef,"bankRef"),journalRef=uuid(data.journalRef,"journalRef"),
   financialYearRef=uuid(data.financialYearRef,"financialYearRef"),
   key=uuid(data.requestKey,"requestKey"),date=validDate(data.statementDate as string);
  if(!date||typeof data.bankItemReference!=="string"||
     !/^[A-Za-z0-9._/: -]{4,100}$/.test(data.bankItemReference))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID",field:"bankItemReference"});
  const amount=amountMinor(data.statementAmount);
  const digest=sha([bankRef,journalRef,financialYearRef,date,data.bankItemReference,amount]);
  const scope=await this.branches.financeReportScope(bearer,"finance.reconciliation.manage");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.reconciliation.manage");
   await this.identity.assertCurrent(tx,actor,"documents.files.manage");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const previous=await tx.query<{id:string;content_digest:string;status:string}>(
    "SELECT id,content_digest,status FROM finance_bank_reconciliation "+
    "WHERE root_realm_id=$1 AND recorded_by=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(previous.rows[0]){
    if(previous.rows[0].content_digest!==digest)
     throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:previous.rows[0].status,replayed:true};
   }
   const line=await tx.query<{amount_minor:string;root_payroll:boolean}>(
    "SELECT (l.debit_minor-l.credit_minor)::text AS amount_minor,cg11_root_payroll_journal(j.root_realm_id,j.id) AS root_payroll "+
    "FROM journal_line l JOIN journal j ON j.id=l.journal_id "+
    "AND j.root_realm_id=l.root_realm_id JOIN finance_account a "+
    "ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "WHERE j.id=$1 AND j.root_realm_id=$2 AND j.financial_year_id=$3 "+
    "AND l.account_id=$4 AND a.account_kind='BANK' AND j.status='POSTED' "+
    "AND ($5::boolean OR NOT cg11_root_payroll_journal(j.root_realm_id,j.id)) "+
    "AND ($5::boolean OR ((a.branch_id IS NULL OR a.branch_id=ANY($6::uuid[])) "+
    "AND l.branch_id=ANY($6::uuid[]))) FOR SHARE OF j,l,a",
    [journalRef,actor.realmId,financialYearRef,bankRef,scope.all,scope.branchRefs]);
   if(!line.rows.length||(line.rows.length!==1&&!line.rows.every(x=>x.root_payroll)))
    throw new ConflictException({code:"FINANCE_RECONCILIATION_INVALID"});
   if(line.rows.some(x=>x.root_payroll))await this.branches.requireFinanceRootScope(tx,actor,"finance.reconciliation.manage");
   const posted=line.rows.reduce((n,x)=>n+BigInt(x.amount_minor),0n),variance=BigInt(amount)-posted;
   await tx.query(
    "INSERT INTO finance_bank_reconciliation(root_realm_id,bank_account_id,journal_id,"+
    "financial_year_id,statement_date,bank_item_ref,statement_amount_minor,"+
    "posted_amount_minor,variance_minor,recorded_by,request_key,content_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [actor.realmId,bankRef,journalRef,financialYearRef,date,data.bankItemReference,
     amount,posted.toString(),variance.toString(),actor.accountId,key,digest]);
   await tx.query("COMMIT");
   return {confirmed:true,status:"PENDING",varianceMinor:variance.toString(),replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"bank");}finally{tx.release();}
 }
 async reconciliationList(bearer:string,offsetInput?:string){
  const actor=await this.actor(bearer),offset=position(offsetInput);
  const scope=await this.branches.financeReportScope(bearer);
  const rows=await this.db.query<{reconciliationRef:string;accountName:string;
   statementDate:string;bankItemReference:string;statementAmountMinor:string;
   postedAmountMinor:string;varianceMinor:string;status:string;canUpload:boolean}>(
   "SELECT r.id AS \"reconciliationRef\",a.name AS \"accountName\","+
   "r.statement_date::text AS \"statementDate\","+
   "('•••• '||right(r.bank_item_ref,4)) AS \"bankItemReference\","+
   "r.statement_amount_minor::text AS \"statementAmountMinor\","+
   "r.posted_amount_minor::text AS \"postedAmountMinor\","+
   "r.variance_minor::text AS \"varianceMinor\",r.status,"+
   "(r.recorded_by=$2::uuid) AS \"canUpload\" "+
   "FROM finance_bank_reconciliation r JOIN finance_account a "+
   "ON a.id=r.bank_account_id AND a.root_realm_id=r.root_realm_id "+
   "WHERE r.root_realm_id=$1 AND ($4::boolean OR NOT cg11_root_payroll_journal(r.root_realm_id,r.journal_id)) "+
   "AND EXISTS(SELECT 1 FROM journal_line bl WHERE bl.journal_id=r.journal_id AND bl.root_realm_id=r.root_realm_id AND bl.account_id=r.bank_account_id AND ($4::boolean OR bl.branch_id=ANY($5::uuid[]))) "+
   "ORDER BY r.recorded_at DESC,r.id DESC LIMIT 51 OFFSET $3",
   [actor.realmId,actor.accountId,offset,scope.all,scope.branchRefs]);
  return {items:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?offset+50:null};
 }
 async verifyBankMatch(bearer:string,refInput:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  const ref=uuid(refInput,"reconciliationRef");
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["action","requestKey","currentPassword",
      "statementFileRef","statementFileVersion"].includes(k))||
     !["VERIFY","REJECT"].includes(String(v.action))||
     typeof v.currentPassword!=="string"||v.currentPassword.length<8||
     Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const key=uuid(v.requestKey,"requestKey");
  const file=v.action==="VERIFY"?uuid(v.statementFileRef,"statementFileRef"):null;
  const fileVersion=v.action==="VERIFY"?v.statementFileVersion:null;
  if((v.action==="VERIFY"&&(!Number.isSafeInteger(fileVersion)||
       Number(fileVersion)<1))||
     (v.action==="REJECT"&&(v.statementFileRef!==undefined||
       v.statementFileVersion!==undefined)))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const scope=await this.branches.financeReportScope(bearer,"finance.reconciliation.review");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.identity.assertCurrent(tx,actor,"finance.reconciliation.review");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const old=await tx.query<{id:string;actor_ref:string;action:string;
    reconciliation_id:string;statement_file_id:string|null;statement_file_version:number|null}>(
    "SELECT id,actor_ref,action,reconciliation_id,statement_file_id,statement_file_version "+
    "FROM finance_reconciliation_decision "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(old.rows[0]){
    if(old.rows[0].reconciliation_id!==ref||old.rows[0].action!==v.action||
       old.rows[0].statement_file_id!==file||
       old.rows[0].statement_file_version!==(fileVersion??null))
     throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:"PREVIOUSLY_CONFIRMED",replayed:true};
   }
   const row=await tx.query<{status:string;recorded_by:string;content_digest:string;
    variance_minor:string}>(
    "SELECT r.status,r.recorded_by,r.content_digest,r.variance_minor::text "+
    "FROM finance_bank_reconciliation r JOIN finance_account a "+
    "ON a.id=r.bank_account_id AND a.root_realm_id=r.root_realm_id "+
    "WHERE r.id=$1 AND r.root_realm_id=$2 AND ($3::boolean OR NOT cg11_root_payroll_journal(r.root_realm_id,r.journal_id)) "+
    "AND EXISTS(SELECT 1 FROM journal_line bl WHERE bl.journal_id=r.journal_id AND bl.root_realm_id=r.root_realm_id AND bl.account_id=r.bank_account_id AND ($3::boolean OR bl.branch_id=ANY($4::uuid[]))) "+
    "FOR UPDATE OF r",
    [ref,actor.realmId,scope.all,scope.branchRefs]);
   const rec=row.rows[0];
   if(!rec||rec.status!=="PENDING"||rec.recorded_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
   if(v.action==="VERIFY"&&BigInt(rec.variance_minor)!==0n)
    throw new ConflictException({code:"FINANCE_RECONCILIATION_VARIANCE"});
   if(file)await this.statementProof.guardForReviewer(tx,actor,{
    reconciliationRef:ref,fileRef:file,fileVersion:Number(fileVersion)});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,v.currentPassword as string);
   await tx.query(
    "INSERT INTO finance_reconciliation_decision(root_realm_id,reconciliation_id,"+
    "actor_ref,request_key,action,original_digest,password_verified_at,"+
    "statement_file_id,statement_file_version) "+
    "VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8)",
    [actor.realmId,ref,actor.accountId,key,v.action,rec.content_digest,
     file,fileVersion]);
   await tx.query(
    "UPDATE finance_bank_reconciliation SET status=$3,verified_by=$4,verified_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING'",
    [ref,actor.realmId,v.action==="VERIFY"?"VERIFIED":"REJECTED",actor.accountId]);
   if(v.action==="VERIFY")await this.membershipFees.onReconciliationVerified(tx,actor,ref);
   // CG07 only consumes an independently approved original CG09 decision
   // and original CG19 frozen statement evidence in THIS SAME transaction.
   // A general bank reconciliation remains unchanged.
   await this.bankDonations.onReconciliation(tx,actor,ref,
    v.action==="VERIFY"?"VERIFIED":"REJECTED");
   await tx.query("COMMIT");
   return {confirmed:true,status:v.action==="VERIFY"?"VERIFIED":"REJECTED",replayed:false,
    explanation:"A separate reviewer checked the uploaded scanned statement and exact bank line. This does not confirm gateway or outgoing settlement."};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"bank");}finally{tx.release();}
 }
 /** Complete small V1 CSV export: same source read guards as on-screen
  * reports. 2000-line cap prevents unbounded financial/data exports.
  */
 async exportCsv(bearer:string,raw:Options&{view?:string}):Promise<string>{
  const allowed=["summary","general-ledger","trial-balance","day-book","cash-book",
   "bank-book","receivables"] as const;
  if(!raw.view||!allowed.some(x=>x===raw.view))
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"view"});
  const {view,...filters}=raw;
  this.filters(filters);
  const actor=await this.actor(bearer);
  await this.verifyFilterScope(bearer,actor.realmId,{
   fy:filters.yearRef??null,branch:filters.branchRef??null,
   account:filters.accountRef??null});
  type CsvRecord=Record<string,unknown>;
  let columns:string[]=[];
  let records:CsvRecord[]=[];
  if(view==="summary"){
   const result=await this.summary(bearer,filters.yearRef,filters.branchRef);
   columns=["metric","amountMinor"];
   records=["incomeMinor","expenseMinor","surplusMinor","fundsMinor","cashBankMinor"]
    .map(metric=>({metric,amountMinor:(result as unknown as CsvRecord)[metric]??"0"}));
  }else if(view==="trial-balance"){
   if(!filters.yearRef)
    throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"yearRef"});
   const result=await this.trialBalance(bearer,filters.yearRef,filters.branchRef);
   columns=["code","accountName","category","netDebitMinor","netCreditMinor"];
   records=result.accounts as unknown as CsvRecord[];
  }else{
   columns=view==="general-ledger"?
    ["postingDate","accountCode","accountName","category","description",
     "postingKind","debitMinor","creditMinor"]:
    view==="receivables"?
    ["invoiceNumber","invoiceDate","dueDate","counterpartyName",
     "status","totalMinor","verifiedMinor","outstandingMinor"]:
    ["postingDate","account","kind","description","postingKind",
     "debitMinor","creditMinor"];
   let offset=0;
   do{
    const paging={...filters,offset:String(offset)};
    const result=view==="general-ledger"?await this.ledger(bearer,paging):
     view==="receivables"?await this.receivables(bearer,paging):
     await this.books(bearer,view==="cash-book"?"CASH":
      view==="bank-book"?"BANK":"DAY",paging);
    const page=("items" in result?result.items:result.lines) as CsvRecord[];
    records.push(...page);
    const next=result.nextOffset;
    if(next!==null&&records.length>=2000)
     throw new ConflictException({code:"FINANCE_REPORT_TOO_LARGE",
      message:"Narrow the year, branch or date range to export up to 2,000 records."});
    if(next===null)break;
    if(next<=offset)throw new ConflictException({code:"FINANCE_REPORT_FILTER_INVALID"});
    offset=next;
   }while(records.length<2000);
  }
  const csv=(x:unknown)=>{
   const str=String(x??"").replace(/[\r\n]/g," ").replace(/"/g,'""');
   const guarded=/^\s*[=+\-@]/.test(str)?"'"+str:str;
   return '"'+guarded+'"';
  };
  const output=[columns.map(csv).join(","),...records.map(row=>columns.map(k=>
   csv(row[k])).join(","))].join("\r\n");
  if(Buffer.byteLength(output,"utf8")>1024*1024)
   throw new ConflictException({code:"FINANCE_REPORT_TOO_LARGE",
    message:"Reduce the report range before exporting."});
  return "\uFEFF"+output;
 }

}
