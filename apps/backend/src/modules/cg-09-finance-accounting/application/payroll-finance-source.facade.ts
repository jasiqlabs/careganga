import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
type Run={id:string;branch_ref:string|null;period_until:string;approved_decision_ref:string; snapshot_digest:string};
type Accounts={expense:string;payable:string;deduction:string|null;employer:string|null;statutory:string|null};
@Injectable()
export class PayrollFinanceSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,private readonly posting:FinanceJournalPostingService){}
 private async scope(tx:PoolClient,a:Actor,branch:string|null){
  await this.identity.assertCurrent(tx,a,"finance.accounts.view");
  if(branch)await this.branches.requireFinanceActorBranch(tx,a,branch,"finance.journals.post");else await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
 }
 async options(tx:PoolClient,a:Actor,branch:string|null){
  await this.scope(tx,a,branch);
  const accounts=(await tx.query<{value:string;label:string;category:string}>(`SELECT a.id AS value,a.code||' · '||a.name AS label,g.category FROM finance_account a JOIN account_group g ON g.root_realm_id=a.root_realm_id AND g.id=a.group_id WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND a.account_kind='GENERAL' AND g.category IN('EXPENSE','LIABILITY') AND (a.branch_id IS NULL OR a.branch_id=$2::uuid) ORDER BY a.name,a.id LIMIT 200`,[a.realmId,branch])).rows;
  return {accounts};
 }
 async accrue(tx:PoolClient,a:Actor,r:Run,accounts:Accounts,digest:string){
  await this.scope(tx,a,r.branch_ref);
  const v=(await tx.query<{gross:string;net:string;deduction:string;employer:string;statutory:string}>(`SELECT coalesce(sum(gross_minor),0)::text gross,coalesce(sum(net_minor),0)::text net,coalesce(sum(deduction_minor),0)::text deduction,coalesce(sum(employer_minor),0)::text employer,coalesce(sum(statutory_minor),0)::text statutory FROM payroll_line WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  const gross=BigInt(v.gross),net=BigInt(v.net),deduction=BigInt(v.deduction),employer=BigInt(v.employer),statutory=BigInt(v.statutory);
  if(gross+employer<=0n||gross!==net+deduction||statutory>deduction)throw new ConflictException("No valid frozen payroll obligation");
  if((deduction>statutory)!==!!accounts.deduction||(employer>0n)!==!!accounts.employer||(statutory>0n)!==!!accounts.statutory)throw new BadRequestException("Select the separate applicable liability accounts");
  const entries=[{ref:accounts.expense,category:"EXPENSE",dr:gross+employer,cr:0n},{ref:accounts.payable,category:"LIABILITY",dr:0n,cr:net},{ref:accounts.deduction,category:"LIABILITY",dr:0n,cr:deduction-statutory},{ref:accounts.employer,category:"LIABILITY",dr:0n,cr:employer},{ref:accounts.statutory,category:"LIABILITY",dr:0n,cr:statutory}];
  const refs=entries.flatMap(x=>x.ref?[x.ref]:[]);
  if(new Set(refs).size!==refs.length)throw new BadRequestException("Use distinct payroll account classifications");
  const eligible=(await tx.query<{id:string;category:string}>(`SELECT a.id,g.category FROM finance_account a JOIN account_group g ON g.root_realm_id=a.root_realm_id AND g.id=a.group_id WHERE a.root_realm_id=$1 AND a.id=ANY($2::uuid[]) AND a.status='ACTIVE' AND a.account_kind='GENERAL' AND (a.branch_id IS NULL OR a.branch_id=$3::uuid) FOR SHARE OF a,g`,[a.realmId,refs,r.branch_ref])).rows;
  if(entries.some(x=>x.ref&&!eligible.some(y=>y.id===x.ref&&y.category===x.category)))throw new ConflictException("Selected payroll account is no longer eligible");
  const years=(await tx.query<{id:string;posting_date:string}>(`SELECT id,($2::date-1)::text posting_date FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' AND ($2::date-1) BETWEEN start_on AND end_on FOR SHARE`,[a.realmId,r.period_until])).rows;
  if(years.length!==1)throw new ConflictException("A unique open finance period is required for the payroll month end");
  return this.posting.postBalanced(tx,a,{financialYearRef:years[0].id,postingDate:years[0].posting_date,sourceRef:r.id,eventKey:r.approved_decision_ref,immutableDigest:digest,kind:"GENERAL",description:"Approved payroll accrual",lines:entries.filter(x=>x.ref&&(x.dr>0n||x.cr>0n)).map(x=>({accountRef:x.ref!,branchRef:r.branch_ref,debitMinor:String(x.dr),creditMinor:String(x.cr)}))});
 }
}
