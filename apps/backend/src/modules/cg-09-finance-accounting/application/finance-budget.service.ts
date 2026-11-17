import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceBudgetApprovalService} from "../../cg-03-registration-approvals/application/finance-budget-approval.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown,field="budgetRef"):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_BUDGET_SOURCE_INVALID",field});
 return v;
};
const version=(v:unknown):number=>{
 if(!Number.isSafeInteger(v)||Number(v)<1)
  throw new BadRequestException({code:"FINANCE_BUDGET_STALE",field:"expectedVersion"});
 return Number(v);
};
const sha=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const body=(raw:unknown,keys:string[]):Record<string,unknown>=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"FINANCE_BUDGET_FORM_INVALID"});
 return raw as Record<string,unknown>;
};
const label=(v:unknown,field:string,max:number):string=>{
 if(typeof v!=="string"||v.trim().length<3||v.trim().length>max||
  /[\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"FINANCE_BUDGET_FORM_INVALID",field});
 return v.trim().replace(/\s+/g," ");
};
const day=(v:unknown,field:string)=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||
  Number.isNaN(new Date(v+"T00:00:00Z").getTime())||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
  throw new BadRequestException({code:"FINANCE_BUDGET_PERIOD_INVALID",field});
 return v;
};
const minor=(v:unknown,positive=true):string=>{
 if(typeof v!=="string"||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(v))
  throw new BadRequestException({code:"FINANCE_BUDGET_AMOUNT_INVALID",field:"amount"});
 const [p,q=""]=v.split(".");
 const m=BigInt(p)*100n+BigInt((q+"00").slice(0,2));
 if(m>99999999999999n||(positive&&m===0n))
  throw new BadRequestException({code:"FINANCE_BUDGET_AMOUNT_INVALID",field:"amount"});
 return m.toString();
};
type Budget={id:string;budget_number:string;version:number;status:string;
 current_digest:string;approval_case_id:string|null;financial_year_id:string;
 branch_id:string|null;created_by:string;category_label:string;budget_name:string;
 period_start:string;period_end:string;funding_note:string;approved_ceiling_minor:string};
type Command={digest:string;budget_id:string;version:number;result_status:string};
type Input={budgetName:string;financialYearRef:string;branchRef:string|null;
 branchVersion:number|null;category:string;periodStart:string;periodEnd:string;
 fundingNote:string;ceilingMinor:string};
@Injectable()
export class FinanceBudgetService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly approvals:FinanceBudgetApprovalService){}
 private async actor(bearer:string,write=false){
  return this.sessions.requireAction(bearer,write?"finance.budgets.manage":"finance.budgets.view");
 }
 private parse(v:Record<string,unknown>):Input{
  const branch=v.branchRef?id(v.branchRef,"branchRef"):null;
  const bv=branch?version(v.branchVersion):null;
  const periodStart=day(v.periodStart,"periodStart"),periodEnd=day(v.periodEnd,"periodEnd");
  if(periodEnd<periodStart)
   throw new BadRequestException({code:"FINANCE_BUDGET_PERIOD_INVALID",field:"periodEnd"});
  return {budgetName:label(v.budgetName,"budgetName",160),
   financialYearRef:id(v.financialYearRef,"financialYearRef"),
   branchRef:branch,branchVersion:bv,
   category:label(v.category,"category",80),periodStart,periodEnd,
   fundingNote:label(v.fundingNote??"Foundation budget authorization","fundingNote",250),
   ceilingMinor:minor(v.ceiling)};
 }
 private async validScope(tx:PoolClient,actor:VerifiedFoundationActor,p:Input){
  await this.identity.assertCurrent(tx,actor,"finance.budgets.manage");
  const fy=await tx.query<{start_on:string;end_on:string;status:string}>(
   "SELECT start_on::text,end_on::text,status FROM financial_year "+
   "WHERE id=$1 AND root_realm_id=$2 FOR SHARE",[p.financialYearRef,actor.realmId]);
  const y=fy.rows[0];
  if(!y||y.status!=="OPEN"||p.periodStart<y.start_on||p.periodEnd>y.end_on)
   throw new ConflictException({code:"FINANCE_BUDGET_PERIOD_INVALID"});
  if(p.branchRef)
   await this.branches.requireFinanceBranchVersion(tx,actor,p.branchRef,
    p.branchVersion!,"finance.budgets.manage");
 }
 private async existing(tx:PoolClient,actor:VerifiedFoundationActor,key:string){
  const rows=await tx.query<Command>(
   "SELECT digest,budget_id,version,result_status FROM finance_budget_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
   [actor.realmId,actor.accountId,key]);
  return rows.rows[0]??null;
 }
 private async record(tx:PoolClient,actor:VerifiedFoundationActor,key:string,
  digest:string,budgetRef:string,v:number,action:string,status:string){
  await tx.query("INSERT INTO finance_budget_command(root_realm_id,actor_ref,request_key,"+
    "budget_id,action,digest,result_status,version) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [actor.realmId,actor.accountId,key,budgetRef,action,digest,status,v]);
  await tx.query("INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
   "VALUES($1,$2,'BUDGET',$3,$4,$5)",
   [actor.realmId,actor.accountId,budgetRef,"BUDGET_"+action+"_"+status,key]);
 }
 private async load(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  const rows=await tx.query<Budget>(
   "SELECT id,budget_number,version,status,current_digest,approval_case_id,"+
   "financial_year_id,branch_id,created_by,category_label,budget_name,"+
   "period_start::text,period_end::text,funding_note,approved_ceiling_minor::text "+
   "FROM finance_budget WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
   [ref,actor.realmId]);
  if(!rows.rows[0])
   throw new ConflictException({code:"FINANCE_BUDGET_SOURCE_INVALID"});
  return rows.rows[0];
 }
 async save(bearer:string,raw:unknown,budgetInput?:string){
  const actor=await this.actor(bearer,true);
  const value=body(raw,["budgetName","financialYearRef","branchRef","branchVersion",
   "category","periodStart","periodEnd","fundingNote","ceiling","expectedVersion","requestKey"]);
  const p=this.parse(value),key=id(value.requestKey,"requestKey"),
   budgetRef=budgetInput?id(budgetInput):randomUUID();
  const expected=budgetInput?version(value.expectedVersion):null;
  const fingerprint=sha(["CG09_BUDGET_SAVE",budgetInput??"NEW",expected,p]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   await this.validScope(tx,actor,p);
   const old=await this.existing(tx,actor,key);
   if(old){
    if(old.digest!==fingerprint)
     throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {confirmed:true,budgetRef:old.budget_id,version:old.version,
     status:old.result_status,replayed:true};
   }
   let next=1,action="CREATE",oldBudget:Budget|null=null;
   if(budgetInput){
    oldBudget=await this.load(tx,actor,budgetRef);
    if(!["DRAFT","RETURNED"].includes(oldBudget.status)||
      oldBudget.version!==expected||oldBudget.created_by!==actor.accountId)
     throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
    next=oldBudget.version+1;action="REVISE";
   }
   const sourceDigest=sha(["CG09_BUDGET_REVISION",budgetRef,next,p]);
   if(!oldBudget)await tx.query(
    "INSERT INTO finance_budget(id,root_realm_id,budget_name,financial_year_id,"+
    "branch_id,category_label,period_start,period_end,funding_note,approved_ceiling_minor,"+
    "version,current_digest,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    [budgetRef,actor.realmId,p.budgetName,p.financialYearRef,p.branchRef,
     p.category,p.periodStart,p.periodEnd,p.fundingNote,p.ceilingMinor,
     next,sourceDigest,actor.accountId]);
   await tx.query("INSERT INTO finance_budget_revision(root_realm_id,budget_id,"+
    "version,source_digest,name,category_label,financial_year_id,branch_id,"+
    "period_start,period_end,funding_note,approved_ceiling_minor,recorded_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    [actor.realmId,budgetRef,next,sourceDigest,p.budgetName,p.category,
     p.financialYearRef,p.branchRef,p.periodStart,p.periodEnd,p.fundingNote,
     p.ceilingMinor,actor.accountId]);
   if(oldBudget)await tx.query(
    "UPDATE finance_budget SET budget_name=$3,financial_year_id=$4,"+
    "branch_id=$5,category_label=$6,period_start=$7,period_end=$8,"+
    "funding_note=$9,approved_ceiling_minor=$10,version=$11,current_digest=$12,"+
    "approval_case_id=NULL,status='DRAFT',updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND version=$13",
    [budgetRef,actor.realmId,p.budgetName,p.financialYearRef,p.branchRef,p.category,
     p.periodStart,p.periodEnd,p.fundingNote,p.ceilingMinor,next,sourceDigest,expected]);
   await this.record(tx,actor,key,fingerprint,budgetRef,next,action,"DRAFT");
   await tx.query("COMMIT");
   return {confirmed:true,budgetRef,version:next,status:"DRAFT",replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async submit(bearer:string,budgetInput:string,raw:unknown){
  const actor=await this.actor(bearer,true),ref=id(budgetInput);
  const v=body(raw,["requestKey","expectedVersion"]),key=id(v.requestKey,"requestKey"),
   expected=version(v.expectedVersion),fingerprint=sha(["BUDGET_SUBMIT",ref,expected]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.budgets.manage");
   const old=await this.existing(tx,actor,key);
   if(old){
    if(old.digest!==fingerprint)throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};
   }
   const budget=await this.load(tx,actor,ref);
   if(budget.status!=="DRAFT"||budget.version!==expected)
    throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
   const prior=await tx.query(
    "SELECT id FROM financial_year WHERE id=$1 AND root_realm_id=$2 "+
    "AND status='OPEN' AND $3::date>=start_on AND $4::date<=end_on FOR SHARE",
    [budget.financial_year_id,actor.realmId,budget.period_start,budget.period_end]);
   if(!prior.rowCount)throw new ConflictException({code:"FINANCE_BUDGET_PERIOD_INVALID"});
   const reviewer=await this.approvals.createCase(tx,actor,{
    budgetRef:ref,version:expected,digest:budget.current_digest,
    number:budget.budget_number,key});
   const result=await tx.query(
    "UPDATE finance_budget SET status='SUBMITTED',approval_case_id=$3,updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='DRAFT' AND version=$4 RETURNING id",
    [ref,actor.realmId,reviewer.caseRef,expected]);
   if(result.rowCount!==1)throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
   await this.record(tx,actor,key,fingerprint,ref,expected,"SUBMIT","SUBMITTED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"SUBMITTED",budgetNumber:budget.budget_number,
    reviewCase:reviewer.caseNumber,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async reconcile(bearer:string,budgetInput:string,raw:unknown){
  const actor=await this.actor(bearer,true),ref=id(budgetInput);
  const v=body(raw,["requestKey"]),key=id(v.requestKey,"requestKey"),
   fingerprint=sha(["BUDGET_RECONCILE",ref]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.budgets.manage");
   const old=await this.existing(tx,actor,key);
   if(old){if(old.digest!==fingerprint)
    throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};}
   const budget=await this.load(tx,actor,ref);
   if(budget.status!=="SUBMITTED"||!budget.approval_case_id)
    throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
   const outcome=await this.approvals.outcome(tx,actor,{
    caseRef:budget.approval_case_id,budgetRef:ref,
    version:budget.version,digest:budget.current_digest});
   const next=["PENDING_OWNER","OWNER_COMPLETED"].includes(outcome.status)?
    "APPROVED":outcome.status;
   if(!["APPROVED","RETURNED","REJECTED"].includes(next))
    throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
   await tx.query("UPDATE finance_budget SET status=$3,updated_at=now() "+
    "WHERE id=$1 AND root_realm_id=$2 AND status='SUBMITTED'",
    [ref,actor.realmId,next]);
   if(next==="APPROVED")await this.approvals.finish(tx,actor,budget.approval_case_id);
   await this.record(tx,actor,key,fingerprint,ref,budget.version,"RECONCILE",next);
   await tx.query("COMMIT");
   return {confirmed:true,status:next,budgetNumber:budget.budget_number,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async recordEvent(bearer:string,budgetInput:string,raw:unknown){
  const actor=await this.actor(bearer,true),ref=id(budgetInput);
  const v=body(raw,["kind","amount","journalRef","requestKey"]),
   key=id(v.requestKey,"requestKey");
  const kind=v.kind;
  if(!["ALLOCATE","COMMIT","RELEASE","UTILIZE"].includes(String(kind)))
   throw new BadRequestException({code:"FINANCE_BUDGET_EVENT_INVALID",field:"kind"});
  const amount=minor(v.amount);
  const journal=kind==="UTILIZE"?id(v.journalRef,"journalRef"):null;
  if(kind!=="UTILIZE"&&v.journalRef)
   throw new BadRequestException({code:"FINANCE_BUDGET_EVENT_INVALID",field:"journalRef"});
  const fingerprint=sha(["BUDGET_EVENT",ref,kind,amount,journal]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.budgets.manage");
   const old=await this.existing(tx,actor,key);
   if(old){
    if(old.digest!==fingerprint)throw new ConflictException({code:"FINANCE_BUDGET_REPLAY_CONFLICT"});
    await tx.query("COMMIT");return {confirmed:true,status:old.result_status,replayed:true};
   }
   const budget=await this.load(tx,actor,ref);
   if(budget.status!=="APPROVED")
    throw new ConflictException({code:"FINANCE_BUDGET_NOT_APPROVED"});
   await tx.query("INSERT INTO finance_budget_event(root_realm_id,budget_id,kind,"+
    "amount_minor,event_key,source_digest,source_journal_id,actor_ref) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [actor.realmId,ref,kind,amount,key,fingerprint,journal,actor.accountId]);
   await this.record(tx,actor,key,fingerprint,ref,budget.version,"EVENT","CONFIRMED");
   await tx.query("COMMIT");
   return {confirmed:true,status:"CONFIRMED",budgetNumber:budget.budget_number,
    kind,replayed:false};
  }catch(e){
   await tx.query("ROLLBACK");
   if(e&&typeof e==="object"&&"code" in e&&
      ["23505","P0924"].includes(String(e.code)))
    throw new ConflictException({code:"FINANCE_BUDGET_EVENT_INVALID"});
   throw e;
  }finally{tx.release();}
 }
 async eligibleExpenses(bearer:string,budgetInput:string){
  const actor=await this.actor(bearer);
  const budgetRef=id(budgetInput);
  const budget=await this.db.query<{category_label:string;branch_id:string|null;
   financial_year_id:string;period_start:string;period_end:string;status:string}>(
   "SELECT category_label,branch_id,financial_year_id,period_start::text,"+
   "period_end::text,status FROM finance_budget WHERE id=$1 AND root_realm_id=$2",
   [budgetRef,actor.realmId]);
  const b=budget.rows[0];
  if(!b||b.status!=="APPROVED")
   throw new ConflictException({code:"FINANCE_BUDGET_NOT_APPROVED"});
  const rows=await this.db.query<{journalRef:string;voucherNumber:string;
   postedDate:string;amountMinor:string}>(
   "SELECT j.id AS \"journalRef\",v.voucher_number AS \"voucherNumber\","+
   "j.posting_date::text AS \"postedDate\",v.total_minor::text AS \"amountMinor\" "+
   "FROM journal j JOIN finance_voucher v "+
   "ON v.id=j.source_ref AND v.root_realm_id=j.root_realm_id "+
   "JOIN finance_account a ON a.id=v.debit_account_id AND a.root_realm_id=v.root_realm_id "+
   "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "JOIN finance_voucher_posting p ON p.journal_id=j.id "+
   "AND p.root_realm_id=j.root_realm_id "+
   "WHERE j.root_realm_id=$1 AND j.financial_year_id=$2 "+
   "AND j.posting_kind='VOUCHER' AND j.status='POSTED' "+
   "AND j.posting_date BETWEEN $3 AND $4 AND g.category='EXPENSE' AND g.name=$5 "+
   "AND v.voucher_type='EXPENSE' AND v.status IN('POSTED','PAYMENT_REQUESTED','PAID_VERIFIED') "+
   "AND v.branch_id IS NOT DISTINCT FROM $6::uuid "+
   "AND NOT EXISTS(SELECT 1 FROM finance_budget_event e WHERE "+
   "e.root_realm_id=j.root_realm_id AND e.source_journal_id=j.id) "+
   "ORDER BY j.posting_date DESC,j.id DESC LIMIT 51",
   [actor.realmId,b.financial_year_id,b.period_start,b.period_end,
    b.category_label,b.branch_id]);
  return {expenses:rows.rows.slice(0,50),hasMore:rows.rows.length>50};
 }
 async detail(bearer:string,budgetInput:string){
  const actor=await this.actor(bearer);
  const budgetRef=id(budgetInput);
  const found=await this.db.query<{budgetNumber:string;status:string;version:number;
   name:string;category:string;ceilingMinor:string;financialYearRef:string;
   branchRef:string|null;start:string;end:string;approvalCaseRef:string|null}>(
   "SELECT budget_number AS \"budgetNumber\",status,version,budget_name AS name,"+
   "category_label AS category,approved_ceiling_minor::text AS \"ceilingMinor\","+
   "financial_year_id AS \"financialYearRef\",branch_id AS \"branchRef\","+
   "period_start::text AS start,period_end::text AS end,approval_case_id AS \"approvalCaseRef\" "+
   "FROM finance_budget WHERE id=$1 AND root_realm_id=$2",
   [budgetRef,actor.realmId]);
  const b=found.rows[0];
  if(!b)throw new ConflictException({code:"FINANCE_BUDGET_SOURCE_INVALID"});
  const totals=await this.db.query<{allocated:string;committed:string;released:string;utilized:string;applied:string}>(
   "SELECT COALESCE(SUM(amount_minor) FILTER(WHERE kind='ALLOCATE'),0)::text AS allocated,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='COMMIT'),0)::text AS committed,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='RELEASE'),0)::text AS released,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='UTILIZE'),0)::text AS utilized,"+
   "COALESCE(SUM(commitment_applied_minor),0)::text AS applied "+
   "FROM finance_budget_event WHERE root_realm_id=$1 AND budget_id=$2",
   [actor.realmId,budgetRef]);
  const t=totals.rows[0],outstanding=BigInt(t.committed)-BigInt(t.released)-BigInt(t.applied);
  const available=BigInt(b.ceilingMinor)-outstanding-BigInt(t.utilized);
  const events=await this.db.query<{kind:string;amountMinor:string;recordedAt:Date}>(
   "SELECT kind,amount_minor::text AS \"amountMinor\",recorded_at AS \"recordedAt\" "+
   "FROM finance_budget_event WHERE root_realm_id=$1 AND budget_id=$2 "+
   "ORDER BY recorded_at DESC,id DESC LIMIT 30",[actor.realmId,budgetRef]);
  return {budgetRef,...b,allocatedMinor:t.allocated,
   committedOutstandingMinor:outstanding.toString(),utilizedMinor:t.utilized,
   releasedMinor:t.released,commitmentFulfilledMinor:t.applied,availableMinor:available.toString(),
   overBudgetMinor:available<0n?(-available).toString():"0",events:events.rows,
   explanation:"Allocation is earmarked, not spent. Utilized totals are exclusively matched original posted expenses."};
 }
 async list(bearer:string,offsetInput?:string){
  const actor=await this.actor(bearer);
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_BUDGET_FILTER_INVALID",field:"offset"});
  const offset=Number(offsetInput??"0");
  const rows=await this.db.query<{budgetRef:string;budgetNumber:string;
   name:string;status:string;version:number;category:string;ceilingMinor:string;
   branchRef:string|null;periodStart:string;periodEnd:string}>(
   "SELECT id AS \"budgetRef\",budget_number AS \"budgetNumber\","+
   "budget_name AS name,status,version,category_label AS category,"+
   "approved_ceiling_minor::text AS \"ceilingMinor\",branch_id AS \"branchRef\","+
   "period_start::text AS \"periodStart\",period_end::text AS \"periodEnd\" "+
   "FROM finance_budget WHERE root_realm_id=$1 "+
   "ORDER BY created_at DESC,id DESC LIMIT 41 OFFSET $2",
   [actor.realmId,offset]);
  return {budgets:rows.rows.slice(0,40),nextOffset:rows.rows.length>40?offset+40:null};
 }
 /** B01 overview is one root-scoped projection over the ONLY budget event store.
  * No fabricated project allocation, donor cash or competing balance table.
  */
 async dashboard(bearer:string){
  const actor=await this.actor(bearer);
  const rows=await this.db.query<{total:number;drafts:number;submitted:number;approved:number;
   returned:number;rejected:number;archived:number;totalCeilingMinor:string;
   allocatedMinor:string;committedOutstandingMinor:string;utilizedMinor:string;
   availableMinor:string;overBudgetMinor:string}>(
   "WITH movement AS(SELECT root_realm_id,budget_id,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='ALLOCATE'),0) AS allocated,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='COMMIT'),0) AS committed,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='RELEASE'),0) AS released,"+
   "COALESCE(SUM(amount_minor) FILTER(WHERE kind='UTILIZE'),0) AS utilized,"+
   "COALESCE(SUM(commitment_applied_minor),0) AS applied "+
   "FROM finance_budget_event WHERE root_realm_id=$1 GROUP BY root_realm_id,budget_id),"+
   "fact AS(SELECT b.status,b.approved_ceiling_minor,"+
   "COALESCE(m.allocated,0) AS allocated,"+
   "GREATEST(0,COALESCE(m.committed,0)-COALESCE(m.released,0)-COALESCE(m.applied,0)) AS outstanding,"+
   "COALESCE(m.utilized,0) AS utilized "+
   "FROM finance_budget b LEFT JOIN movement m "+
   "ON m.budget_id=b.id AND m.root_realm_id=b.root_realm_id "+
   "WHERE b.root_realm_id=$1) "+
   "SELECT COUNT(*)::int AS total,"+
   "COUNT(*) FILTER(WHERE status='DRAFT')::int AS drafts,"+
   "COUNT(*) FILTER(WHERE status='SUBMITTED')::int AS submitted,"+
   "COUNT(*) FILTER(WHERE status='APPROVED')::int AS approved,"+
   "COUNT(*) FILTER(WHERE status='RETURNED')::int AS returned,"+
   "COUNT(*) FILTER(WHERE status='REJECTED')::int AS rejected,"+
   "COUNT(*) FILTER(WHERE status='ARCHIVED')::int AS archived,"+
   "COALESCE(SUM(approved_ceiling_minor) FILTER(WHERE status='APPROVED'),0)::text AS \"totalCeilingMinor\","+
   "COALESCE(SUM(allocated) FILTER(WHERE status='APPROVED'),0)::text AS \"allocatedMinor\","+
   "COALESCE(SUM(outstanding) FILTER(WHERE status='APPROVED'),0)::text AS \"committedOutstandingMinor\","+
   "COALESCE(SUM(utilized) FILTER(WHERE status='APPROVED'),0)::text AS \"utilizedMinor\","+
   "COALESCE(SUM(approved_ceiling_minor-outstanding-utilized) "+
   "FILTER(WHERE status='APPROVED'),0)::text AS \"availableMinor\","+
   "COALESCE(SUM(GREATEST(outstanding+utilized-approved_ceiling_minor,0)) "+
   "FILTER(WHERE status='APPROVED'),0)::text AS \"overBudgetMinor\" "+
   "FROM fact",[actor.realmId]);
  return {cards:rows.rows[0],explanation:
   "Approved ceilings and allocations are authorizations, not received funds. Utilized is matched original posted expense only."};
 }
 async options(bearer:string){
  const actor=await this.actor(bearer);
  const years=await this.db.query<{yearRef:string;name:string;status:string;
   startOn:string;endOn:string}>(
   "SELECT id AS \"yearRef\",name,status,start_on::text AS \"startOn\","+
   "end_on::text AS \"endOn\" FROM financial_year WHERE root_realm_id=$1 "+
   "ORDER BY start_on DESC,id DESC LIMIT 30",[actor.realmId]);
  const branches=await this.branches.financeBranches(bearer,"finance.budgets.view");
  const categories=await this.db.query<{name:string}>(
   "SELECT DISTINCT name FROM account_group WHERE root_realm_id=$1 "+
   "AND category='EXPENSE' ORDER BY name LIMIT 100",[actor.realmId]);
  return {years:years.rows,branches,categories:categories.rows.map(r=>r.name)};
 }
 async commandStatus(bearer:string,keyInput:string){
  const actor=await this.actor(bearer);
  const key=id(keyInput,"requestKey");
  const rows=await this.db.query<Command>(
   "SELECT digest,budget_id,version,result_status FROM finance_budget_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key]);
  return {confirmed:Boolean(rows.rows[0]),status:rows.rows[0]?.result_status??"NOT_FOUND",
   version:rows.rows[0]?.version??null};
 }
}
