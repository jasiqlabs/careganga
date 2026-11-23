import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {assertFinanceProject} from "../../cg-05-projects-field-operations/application/project-finance-source";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type BudgetSource=Readonly<{budgetRef:string;budgetNumber:string;version:number;
 status:string;sourceDigest:string;createdBy:string;name:string;category:string;
 amountMinor:string;financialYearRef:string;branchRef:string|null;
 periodStart:string;periodEnd:string}>;
const validate=(x:string)=>{
 if(!UUID.test(x))throw new BadRequestException({code:"FINANCE_BUDGET_SOURCE_INVALID"});
 return x;
};
@Injectable()
export class FinanceBudgetSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async read(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,
  version:number,permission:string):Promise<BudgetSource>{
  validate(ref);
  if(!Number.isSafeInteger(version)||version<1)
   throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
  await this.identity.assertCurrent(tx,actor,permission);
  const found=await tx.query<{id:string;budget_number:string;version:number;status:string;
   current_digest:string;created_by:string;budget_name:string;category_label:string;
   approved_ceiling_minor:string;financial_year_id:string;branch_id:string|null;
   period_start:string;period_end:string;project_ref:string|null}>(
   "SELECT id,budget_number,version,status,current_digest,created_by,budget_name,"+
   "category_label,approved_ceiling_minor::text,financial_year_id,branch_id,"+
   "period_start::text,period_end::text,project_ref FROM finance_budget "+
   "WHERE root_realm_id=$1 AND id=$2 AND version=$3 FOR SHARE",
   [actor.realmId,ref,version]);
  const b=found.rows[0];
  if(!b)throw new ConflictException({code:"FINANCE_BUDGET_SOURCE_INVALID"});
  if(b.project_ref)await assertFinanceProject(tx,actor,b.project_ref,b.branch_id);
  return {budgetRef:b.id,budgetNumber:b.budget_number,version:b.version,
   status:b.status,sourceDigest:b.current_digest,createdBy:b.created_by,
   name:b.budget_name,category:b.category_label,
   amountMinor:b.approved_ceiling_minor,financialYearRef:b.financial_year_id,
   branchRef:b.branch_id,periodStart:b.period_start,periodEnd:b.period_end};
 }
 async guardDraft(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,
  version:number,digest:string){
  const row=await this.read(tx,actor,ref,version,"finance.budgets.manage");
  if(row.status!=="DRAFT"||row.sourceDigest!==digest)
   throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
  return row;
 }
 async submittedForReviewer(tx:PoolClient,actor:VerifiedFoundationActor,
  ref:string,version:number,digest:string){
  const row=await this.read(tx,actor,ref,version,"finance.budgets.review");
  await this.identity.assertCurrent(tx,actor,"approvals.review");
  if(row.status!=="SUBMITTED"||row.sourceDigest!==digest||
     row.createdBy===actor.accountId)
   throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
  return row;
 }
 async reviewerSnapshot(bearer:string,ref:string,version:number){
  const actor=await this.sessions.requireAction(bearer,"finance.budgets.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.budgets.review");
   const rows=await tx.query<{created_by:string;budget_number:string;status:string;
    budget_name:string;category_label:string;approved_ceiling_minor:string;
    period_start:string;period_end:string;project_label:string|null}>(
    "SELECT b.created_by,b.budget_number,c.status,r.name AS budget_name,"+
    "r.category_label,r.approved_ceiling_minor::text,r.period_start::text,r.project_label,"+
    "r.period_end::text FROM finance_budget_revision r JOIN finance_budget b "+
    "ON b.id=r.budget_id AND b.root_realm_id=r.root_realm_id "+
    "JOIN cg03_case c ON c.finance_budget_id=b.id AND c.realm_id=b.root_realm_id "+
    "AND c.finance_budget_revision=r.version AND c.case_kind='FINANCE_BUDGET' "+
    "WHERE r.budget_id=$1 AND r.root_realm_id=$2 AND r.version=$3 FOR SHARE OF r,b,c",
    [validate(ref),actor.realmId,version]);
   const x=rows.rows[0];
   if(!x||x.created_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_BUDGET_REVIEW_UNAVAILABLE"});
   const lines=await tx.query<{description:string;quantityMilli:string;
    unitRateMinor:string;totalMinor:string}>(
    'SELECT description,quantity_milli::text AS "quantityMilli",'+
    'unit_rate_minor::text AS "unitRateMinor",line_total_minor::text AS "totalMinor" '+
    "FROM finance_budget_item_revision "+
    "WHERE root_realm_id=$1 AND budget_id=$2 AND version=$3 "+
    "ORDER BY line_no LIMIT 30",[actor.realmId,ref,version]);
   await tx.query("COMMIT");
   return {budgetNumber:x.budget_number,name:x.budget_name,category:x.category_label,
    amountMinor:x.approved_ceiling_minor,periodStart:x.period_start,
    periodEnd:x.period_end,status:x.status,projectLabel:x.project_label,
    items:lines.rows};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
