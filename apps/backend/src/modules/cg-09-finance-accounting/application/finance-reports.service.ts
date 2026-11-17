import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import {financeSqlFailure} from "./finance-sql-error";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
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
type Options={yearRef?:string;branchRef?:string;accountRef?:string;from?:string;to?:string;offset?:string};
@Injectable()
export class FinanceReportsService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService){}
 private actor(bearer:string,write=false){
  return this.sessions.requireAction(bearer,
   write?"finance.reconciliation.manage":"finance.reports.view");
 }
 private filters(raw:Options){
  if(Object.keys(raw).some(k=>!["yearRef","branchRef","accountRef","from","to","offset"].includes(k)))
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID"});
  const fy=raw.yearRef?uuid(raw.yearRef,"yearRef"):null,
   branch=raw.branchRef?uuid(raw.branchRef,"branchRef"):null,
   account=raw.accountRef?uuid(raw.accountRef,"accountRef"):null,
   from=validDate(raw.from),to=validDate(raw.to);
  if(from&&to&&from>to)
   throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:"date"});
  return {fy,branch,account,from,to,offset:position(raw.offset)};
 }
 private async verifyFilterScope(realm:string,v:{
  fy:string|null;branch:string|null;account:string|null}){
  const tests:{ref:string|null;field:string;table:string}[]=[
   {ref:v.fy,field:"yearRef",table:"financial_year"},
   {ref:v.branch,field:"branchRef",table:"branch"},
   {ref:v.account,field:"accountRef",table:"finance_account"}
  ];
  for(const t of tests){
   if(!t.ref)continue;
   // Whitelisted table names only: no request values interpolated into SQL.
   const result=await this.db.query(
    "SELECT id FROM "+t.table+" WHERE id=$1 AND root_realm_id=$2",
    [t.ref,realm]);
   if(!result.rowCount)
    throw new BadRequestException({code:"FINANCE_REPORT_FILTER_INVALID",field:t.field});
  }
 }
 async options(bearer:string){
  const actor=await this.actor(bearer);
  const [years,accounts]=await Promise.all([
   this.db.query<{ref:string;name:string;startOn:string;endOn:string}>(
    "SELECT id AS ref,name,start_on::text AS \"startOn\",end_on::text AS \"endOn\" "+
    "FROM financial_year WHERE root_realm_id=$1 ORDER BY start_on DESC LIMIT 30",
    [actor.realmId]),
   this.db.query<{ref:string;name:string;code:string;kind:string}>(
    "SELECT id AS ref,name,code,account_kind AS kind FROM finance_account "+
    "WHERE root_realm_id=$1 ORDER BY name,id LIMIT 200",[actor.realmId])
  ]);
  return {years:years.rows,accounts:accounts.rows};
 }
 async ledger(bearer:string,raw:Options){
  const actor=await this.actor(bearer),v=this.filters(raw);
  await this.verifyFilterScope(actor.realmId,v);
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
   "ORDER BY j.posting_date DESC,j.id DESC,l.id DESC LIMIT 51 OFFSET $7",
   [actor.realmId,v.fy,v.branch,v.account,v.from,v.to,v.offset]);
  return {lines:rows.rows.slice(0,50),
   nextOffset:rows.rows.length>50?v.offset+50:null,
   explanation:"All amounts are from immutable, posted journal lines. No inferred future sources."};
 }
 async trialBalance(bearer:string,yearInput:string,branchInput?:string){
  const actor=await this.actor(bearer),yearRef=uuid(yearInput,"yearRef"),
   branch=branchInput?uuid(branchInput,"branchRef"):null;
  await this.verifyFilterScope(actor.realmId,{fy:yearRef,branch,account:null});
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
   "AND ($4::date IS NULL OR j.posting_date>=$4) "+
   "AND ($5::date IS NULL OR j.posting_date<=$5) "+
   "AND ($6='DAY' OR ($6='CASH' AND a.account_kind='CASH') "+
   "OR ($6='BANK' AND a.account_kind='BANK')) "+
   "ORDER BY j.posting_date DESC,j.id DESC,l.id DESC LIMIT 51 OFFSET $7",
   [actor.realmId,v.fy,v.branch,v.from,v.to,kind,v.offset]);
  return {kind,lines:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?v.offset+50:null};
 }
 async summary(bearer:string,yearInput?:string){
  const actor=await this.actor(bearer),
   year=yearInput?uuid(yearInput,"yearRef"):null;
  await this.verifyFilterScope(actor.realmId,{fy:year,branch:null,account:null});
  const result=await this.db.query<{category:string;amountDebit:string;amountCredit:string}>(
   "SELECT g.category,COALESCE(SUM(l.debit_minor),0)::text AS \"amountDebit\","+
   "COALESCE(SUM(l.credit_minor),0)::text AS \"amountCredit\" "+
   "FROM journal j JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
   "AND ($2::uuid IS NULL OR j.financial_year_id=$2) GROUP BY g.category",
   [actor.realmId,year]);
  const k=Object.fromEntries(result.rows.map(x=>[x.category,x]));
  const get=(cat:string,side:"amountDebit"|"amountCredit")=>BigInt(k[cat]?.[side]??"0");
  const income=get("INCOME","amountCredit")-get("INCOME","amountDebit");
  const expense=get("EXPENSE","amountDebit")-get("EXPENSE","amountCredit");
  const funds=get("FUND","amountCredit")-get("FUND","amountDebit");
  const cash=await this.db.query<{balance:string}>(
   "SELECT COALESCE(SUM(CASE WHEN a.normal_side='DEBIT' "+
   "THEN l.debit_minor-l.credit_minor ELSE l.credit_minor-l.debit_minor END),0)::text AS balance "+
   "FROM journal_line l JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.status='POSTED' "+
   "AND ($2::uuid IS NULL OR j.financial_year_id=$2) "+
   "AND a.account_kind IN('CASH','BANK')",[actor.realmId,year]);
  return {incomeMinor:income.toString(),expenseMinor:expense.toString(),
   surplusMinor:(income-expense).toString(),
   fundsMinor:funds.toString(),cashBankMinor:cash.rows[0]?.balance??"0",
   explanation:"Recognized income/expense from posted GL only. Cash/bank is not the same as approved claims or invoices."};
 }
 async reconciliationOptions(bearer:string){
  const actor=await this.actor(bearer);
  const r=await this.db.query<{accountRef:string;name:string;code:string}>(
   "SELECT id AS \"accountRef\",name,code FROM finance_account "+
   "WHERE root_realm_id=$1 AND account_kind='BANK' AND status='ACTIVE' "+
   "ORDER BY name,id LIMIT 50",[actor.realmId]);
  return {banks:r.rows};
 }
 async bankLines(bearer:string,bankInput:string){
  const actor=await this.actor(bearer),bank=uuid(bankInput,"bankRef");
  const rows=await this.db.query<{journalRef:string;financialYearRef:string;postingDate:string;
   description:string;amountMinor:string}>(
   "SELECT j.id AS \"journalRef\",j.financial_year_id AS \"financialYearRef\","+
   "j.posting_date::text AS \"postingDate\",j.description,"+
   "(l.debit_minor-l.credit_minor)::text AS \"amountMinor\" "+
   "FROM journal_line l JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id "+
   "JOIN finance_account a ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND l.account_id=$2 AND a.account_kind='BANK' "+
   "AND j.status='POSTED' "+
   "AND NOT EXISTS(SELECT 1 FROM finance_bank_reconciliation r "+
   "WHERE r.root_realm_id=l.root_realm_id AND r.bank_account_id=l.account_id "+
   "AND r.journal_id=j.id) ORDER BY j.posting_date DESC,j.id DESC LIMIT 51",
   [actor.realmId,bank]);
  return {lines:rows.rows.slice(0,50),hasMore:rows.rows.length>50};
 }
 async recordBankMatch(bearer:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.manage");
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
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.reconciliation.manage");
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
   const line=await tx.query<{amount_minor:string}>(
    "SELECT (l.debit_minor-l.credit_minor)::text AS amount_minor "+
    "FROM journal_line l JOIN journal j ON j.id=l.journal_id "+
    "AND j.root_realm_id=l.root_realm_id JOIN finance_account a "+
    "ON a.id=l.account_id AND a.root_realm_id=l.root_realm_id "+
    "WHERE j.id=$1 AND j.root_realm_id=$2 AND j.financial_year_id=$3 "+
    "AND l.account_id=$4 AND a.account_kind='BANK' AND j.status='POSTED' FOR SHARE OF j,l,a",
    [journalRef,actor.realmId,financialYearRef,bankRef]);
   if(line.rows.length!==1)
    throw new ConflictException({code:"FINANCE_RECONCILIATION_INVALID"});
   const posted=BigInt(line.rows[0].amount_minor),variance=BigInt(amount)-posted;
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
  const rows=await this.db.query<{reconciliationRef:string;accountName:string;
   statementDate:string;bankItemReference:string;statementAmountMinor:string;
   postedAmountMinor:string;varianceMinor:string;status:string}>(
   "SELECT r.id AS \"reconciliationRef\",a.name AS \"accountName\","+
   "r.statement_date::text AS \"statementDate\","+
   "('•••• '||right(r.bank_item_ref,4)) AS \"bankItemReference\","+
   "r.statement_amount_minor::text AS \"statementAmountMinor\","+
   "r.posted_amount_minor::text AS \"postedAmountMinor\","+
   "r.variance_minor::text AS \"varianceMinor\",r.status "+
   "FROM finance_bank_reconciliation r JOIN finance_account a "+
   "ON a.id=r.bank_account_id AND a.root_realm_id=r.root_realm_id "+
   "WHERE r.root_realm_id=$1 ORDER BY r.recorded_at DESC,r.id DESC LIMIT 51 OFFSET $2",
   [actor.realmId,offset]);
  return {items:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?offset+50:null};
 }
 async verifyBankMatch(bearer:string,refInput:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  const ref=uuid(refInput,"reconciliationRef");
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["action","requestKey","currentPassword"].includes(k))||
     !["VERIFY","REJECT"].includes(String(v.action))||
     typeof v.currentPassword!=="string"||v.currentPassword.length<8||
     Buffer.byteLength(v.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID"});
  const key=uuid(v.requestKey,"requestKey");
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.identity.assertCurrent(tx,actor,"finance.reconciliation.review");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   const old=await tx.query<{id:string;actor_ref:string;action:string}>(
    "SELECT id,actor_ref,action FROM finance_reconciliation_decision "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(old.rows[0]){
    if(old.rows[0].action!==v.action)
     throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:"PREVIOUSLY_CONFIRMED",replayed:true};
   }
   const row=await tx.query<{status:string;recorded_by:string;content_digest:string;
    variance_minor:string}>(
    "SELECT status,recorded_by,content_digest,variance_minor::text "+
    "FROM finance_bank_reconciliation WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [ref,actor.realmId]);
   const rec=row.rows[0];
   if(!rec||rec.status!=="PENDING"||rec.recorded_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
   if(v.action==="VERIFY"&&BigInt(rec.variance_minor)!==0n)
    throw new ConflictException({code:"FINANCE_RECONCILIATION_VARIANCE"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,v.currentPassword as string);
   await tx.query(
    "INSERT INTO finance_reconciliation_decision(root_realm_id,reconciliation_id,"+
    "actor_ref,request_key,action,original_digest,password_verified_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,now())",
    [actor.realmId,ref,actor.accountId,key,v.action,rec.content_digest]);
   await tx.query(
    "UPDATE finance_bank_reconciliation SET status=$3,verified_by=$4,verified_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='PENDING'",
    [ref,actor.realmId,v.action==="VERIFY"?"VERIFIED":"REJECTED",actor.accountId]);
   await tx.query("COMMIT");
   return {confirmed:true,status:v.action==="VERIFY"?"VERIFIED":"REJECTED",replayed:false,
    explanation:"Manual independent reconciliation does not verify an outgoing vendor payment."};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"bank");}finally{tx.release();}
 }
}
