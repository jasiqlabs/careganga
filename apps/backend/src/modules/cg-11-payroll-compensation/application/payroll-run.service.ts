import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {PayrollCompensationService} from "./payroll-compensation.service";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
import {date,fields,id,payrollMonth} from "../domain/payroll-input";
type Run={id:string;branch_ref:string|null;run_number:string;period_key:string;period_from:string;period_until:string;fiscal_year_label:string;tentative_payment_date:string|null;status:string;revision:number;request_digest:string};
const projection="id,branch_ref,run_number,period_key,period_from::text,period_until::text,fiscal_year_label,tentative_payment_date::text,status,revision,request_digest";
function draftInput(raw:unknown){
 const x=fields(raw,["requestKey","branchRef","fiscalYear","period","tentativePaymentDate"]);
 const period=payrollMonth(x.fiscalYear,x.period),branch=x.branchRef==="FOUNDATION"?null:id(x.branchRef),tentative=x.tentativePaymentDate==null||x.tentativePaymentDate===""?null:date(x.tentativePaymentDate);
 if(tentative&&tentative<period.periodFrom)throw new BadRequestException("Tentative payment date cannot precede the payroll month");
 return {key:id(x.requestKey),branch,tentative,...period};
}
@Injectable()
export class PayrollRunService{
 constructor(private readonly compensation:PayrollCompensationService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private view(r:Run){return {ref:r.id,branchRef:r.branch_ref,reference:r.run_number,period:r.period_key,periodFrom:r.period_from,periodUntil:r.period_until,fiscalYear:r.fiscal_year_label,tentativePaymentDate:r.tentative_payment_date,status:r.status,revision:r.revision,attendanceStatus:"NOT_IMPORTED",calculationStatus:"NOT_CALCULATED",paymentStatus:"NOT_AUTHORIZED"};}
 async options(token:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const scope=await this.branches.projectBranchScope(tx,a);
  const today=(await tx.query<{today:string}>("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today")).rows[0].today;
  return {branches:[...(scope.all?[{value:"FOUNDATION",label:"Foundation-wide"}]:[]),...scope.branches.map(({value,label})=>({value,label}))],today,cycle:"MONTHLY"};
 });}
 async list(token:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const scope=await this.branches.projectBranchScope(tx,a);
  const rows=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[])) ORDER BY period_from DESC,run_number DESC LIMIT 100",[a.realmId,scope.all,scope.branches.map(b=>b.value)])).rows;
  await recordPayrollAudit(tx,a,"RUN","READ");return {items:rows.map(r=>this.view(r))};
 });}
 async detail(token:string,ref:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const scope=await this.branches.projectBranchScope(tx,a);
  const row=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND id=$2 AND ((branch_ref IS NULL AND $3::boolean) OR branch_ref=ANY($4::uuid[]))",[a.realmId,id(ref),scope.all,scope.branches.map(b=>b.value)])).rows[0];
  if(!row)throw new NotFoundException("Payroll run unavailable");
  await recordPayrollAudit(tx,a,"RUN","READ");return this.view(row);
 });}
 async createDraft(token:string,raw:unknown){return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
  const v=draftInput(raw);
  await this.identity.assertCurrent(tx,a,"payroll.runs.view");await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  await this.branches.projectBranch(tx,a,v.branch);
  const digest=createHash("sha256").update(JSON.stringify(v)).digest("hex");
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN:"+a.realmId+":"+a.accountId+":"+v.key]);
  const previous=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND creator=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
  if(previous){if(previous.request_digest!==digest||previous.branch_ref!==v.branch)throw new ConflictException("This payroll request changed");return {...this.view(previous),replayed:true};}
  const same=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid AND period_key=$3 AND cycle='MONTHLY'",[a.realmId,v.branch,v.period])).rows[0];
  if(same)throw new ConflictException("A payroll draft already exists for this scope and month. Open the existing run.");
  const row=(await tx.query<Run>("INSERT INTO payroll_run(root_realm_id,branch_ref,period_key,period_from,period_until,fiscal_year_label,tentative_payment_date,creator,request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "+projection,[a.realmId,v.branch,v.period,v.periodFrom,v.periodUntil,v.label,v.tentative,a.accountId,v.key,digest])).rows[0];
  await recordPayrollAudit(tx,a,"RUN","DRAFT_CREATED");return {...this.view(row),replayed:false};
 });}
}
