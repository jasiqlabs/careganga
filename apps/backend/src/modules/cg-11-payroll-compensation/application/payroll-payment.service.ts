import {ConflictException,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {PayrollFinanceSourceFacade} from "../../cg-09-finance-accounting/application/payroll-finance-source.facade";
import {PayrollCompensationService} from "./payroll-compensation.service";
import {PayrollRunService} from "./payroll-run.service";
import {fields,id} from "../domain/payroll-input";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
@Injectable()
export class PayrollPaymentService{
 constructor(private readonly comp:PayrollCompensationService,private readonly runs:PayrollRunService,private readonly finance:PayrollFinanceSourceFacade){}
 async approved(tx:PoolClient,a:Actor,ref:string,lock=false){
  const r=await this.runs.row(tx,a,ref,lock);
  if(r.status!=="APPROVED_FROZEN"||!r.approved_decision_ref||!r.snapshot_digest||!r.approval_case_ref)throw new ConflictException("An independently approved frozen payroll run is required");
  const valid=await tx.query(`SELECT 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='PAYROLL_RUN_RELEASE' AND c.status='OWNER_COMPLETED' AND d.id=$3 AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>$4 FOR SHARE OF c,d`,[a.realmId,r.approval_case_ref,r.approved_decision_ref,r.creator]);
  if(!valid.rowCount)throw new ConflictException("Original CG03 approval unavailable");
  return {...r,approved_decision_ref:r.approved_decision_ref,snapshot_digest:r.snapshot_digest};
 }
 async options(token:string,ref:string){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const r=await this.approved(tx,a,ref);
  const accounts=await this.finance.options(tx,a,r.branch_ref);
  const accrued=(await tx.query<{journal_ref:string}>(`SELECT journal_ref FROM payroll_accrual WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  const totals=(await tx.query(`SELECT coalesce(sum(gross_minor),0)::text AS "grossMinor",coalesce(sum(net_minor),0)::text AS "netMinor",coalesce(sum(deduction_minor-statutory_minor),0)::text AS "deductionMinor",coalesce(sum(employer_minor),0)::text AS "employerMinor",coalesce(sum(statutory_minor),0)::text AS "statutoryMinor" FROM payroll_line WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  return {...accounts,totals,journalRef:accrued?.journal_ref??null};
 });}
 async accrue(token:string,ref:string,raw:unknown){return this.comp.run(token,"payroll.runs.manage",async(tx,a)=>{
  const x=fields(raw,["requestKey","expenseRef","payableRef","deductionRef","employerRef","statutoryRef"]);
  const key=id(x.requestKey),optional=(v:unknown)=>v==null||v===""?null:id(v);
  const accounts={expense:id(x.expenseRef),payable:id(x.payableRef),deduction:optional(x.deductionRef),employer:optional(x.employerRef),statutory:optional(x.statutoryRef)};
  const r=await this.approved(tx,a,ref,true);
  await this.finance.options(tx,a,r.branch_ref);
  const digest=createHash("sha256").update(JSON.stringify([r.id,r.snapshot_digest,r.approved_decision_ref,accounts])).digest("hex");
  const prior=(await tx.query<{journal_ref:string;request_digest:string}>(`SELECT journal_ref,request_digest FROM payroll_accrual WHERE root_realm_id=$1 AND run_id=$2`,[a.realmId,r.id])).rows[0];
  if(prior){if(prior.request_digest!==digest)throw new ConflictException("Payroll has already accrued with different accounts");return {journalRef:prior.journal_ref,status:"ACCRUED_NOT_PAID",replayed:true};}
  const journal=await this.finance.accrue(tx,a,r,accounts,digest);
  await tx.query(`INSERT INTO payroll_accrual(root_realm_id,run_id,decision_ref,source_digest,request_digest,request_key,journal_ref,expense_ref,payable_ref,deduction_ref,employer_ref,statutory_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[a.realmId,r.id,r.approved_decision_ref,r.snapshot_digest,digest,key,journal,accounts.expense,accounts.payable,accounts.deduction,accounts.employer,accounts.statutory,a.accountId]);
  await recordPayrollAudit(tx,a,"RUN","APPROVED",key);
  return {journalRef:journal,status:"ACCRUED_NOT_PAID",replayed:false};
 });}
}
