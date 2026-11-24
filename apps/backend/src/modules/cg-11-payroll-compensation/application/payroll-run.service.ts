import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {HrPayrollAttendanceSourceFacade} from "../../cg-10-human-resources/application/hr-payroll-attendance-source.facade";
import {calculatePayroll,periodDates,type SalaryDay,type PayComponent,type Rule} from "../domain/payroll-calculator";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {PayrollCompensationService} from "./payroll-compensation.service";
import {recordPayrollAudit} from "../../cg-21-platform-configuration-audit/application/payroll-audit-source";
import {date,fields,id,label,minor,payrollMonth} from "../domain/payroll-input";
type Run={id:string;branch_ref:string|null;run_number:string;period_key:string;period_from:string;period_until:string;fiscal_year_label:string;tentative_payment_date:string|null;status:string;revision:number;request_digest:string;creator:string;snapshot_digest:string|null;approval_case_ref:string|null;approved_decision_ref:string|null};
type Candidate=Awaited<ReturnType<HrPayrollAttendanceSourceFacade["payrollCandidates"]>>[number];
type Attendance=Awaited<ReturnType<HrPayrollAttendanceSourceFacade["payrollPeriod"]>>;
type FrozenSalary=SalaryDay&{policyRef:string;policyRevision:number;compensationRevision:number;assignmentRef:string;assignmentRevision:number};
type InputLine={employee:Candidate;attendance:Attendance;salary:FrozenSalary[];issues:string[]};
type Adjustment={employeeRef:string;kind:"BONUS"|"DEDUCTION"|"HOLD";minor:string;reason:string};
type Calculation=Extract<ReturnType<typeof calculatePayroll>,{status:"CALCULATED"}>;
type ResultLine={employeeRef:string;reference:string;name:string;branchRef:string;status:"CALCULATED"|"PENDING_VALIDATION"|"HELD";issues:string[];adjustments:Adjustment[];amounts?:Calculation&{bonusMinor:string;extraDeductionMinor:string}};
type Snapshot={inputs:InputLine[];inputDigest:string;adjustments:Adjustment[];lines:ResultLine[];totals:{employees:number;calculated:number;pending:number;held:number;grossMinor:string;deductionMinor:string;netMinor:string;employerMinor:string}};
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v!==null&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const digestOf=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const conflict=()=>new ConflictException("Payroll source or revision changed. Refresh and retry the original operation.");
const emptyTotals=()=>({employees:0,calculated:0,pending:0,held:0,grossMinor:"0",deductionMinor:"0",netMinor:"0",employerMinor:"0"});
const projection="id,branch_ref,run_number,period_key,period_from::text,period_until::text,fiscal_year_label,tentative_payment_date::text,status,revision,request_digest,creator,snapshot_digest,approval_case_ref,approved_decision_ref";
function draftInput(raw:unknown){
 const x=fields(raw,["requestKey","branchRef","fiscalYear","period","tentativePaymentDate"]);
 const period=payrollMonth(x.fiscalYear,x.period),branch=x.branchRef==="FOUNDATION"?null:id(x.branchRef),tentative=x.tentativePaymentDate==null||x.tentativePaymentDate===""?null:date(x.tentativePaymentDate);
 if(tentative&&tentative<period.periodFrom)throw new BadRequestException("Tentative payment date cannot precede the payroll month");
 return {key:id(x.requestKey),branch,tentative,...period};
}
@Injectable()
export class PayrollRunService{
 constructor(private readonly compensation:PayrollCompensationService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade,private readonly hr:HrPayrollAttendanceSourceFacade){}
 private view(r:Run){return {ref:r.id,branchRef:r.branch_ref,reference:r.run_number,period:r.period_key,periodFrom:r.period_from,periodUntil:r.period_until,fiscalYear:r.fiscal_year_label,tentativePaymentDate:r.tentative_payment_date,status:r.status,revision:r.revision,attendanceStatus:r.revision===1?"NOT_IMPORTED":"IMPORTED",calculationStatus:["CALCULATED","SUBMITTED","APPROVED_FROZEN"].includes(r.status)?"CALCULATED":r.status==="ATTENDANCE_IMPORTED"?"PENDING_VALIDATION":"NOT_CALCULATED",paymentStatus:r.status==="APPROVED_FROZEN"?"APPROVED_NOT_PAID":"NOT_AUTHORIZED"};}
 async options(token:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const scope=await this.branches.projectBranchScope(tx,a);
  const today=(await tx.query<{today:string}>("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today")).rows[0].today;
  return {branches:[...(scope.all?[{value:"FOUNDATION",label:"Foundation-wide"}]:[]),...scope.branches.map(({value,label})=>({value,label}))],today,cycle:"MONTHLY"};
 });}
 async list(token:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  const rows=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[])) ORDER BY period_from DESC,run_number DESC LIMIT 100",[a.realmId,scope.all,scope.branches.map(b=>b.value)])).rows;
  await recordPayrollAudit(tx,a,"RUN","READ");return {items:rows.map(r=>this.view(r))};
 });}
 async detail(token:string,ref:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  const row=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND id=$2 AND ((branch_ref IS NULL AND $3::boolean) OR branch_ref=ANY($4::uuid[]))",[a.realmId,id(ref),scope.all,scope.branches.map(b=>b.value)])).rows[0];
  if(!row)throw new NotFoundException("Payroll run unavailable");
  await recordPayrollAudit(tx,a,"RUN","READ");return {...this.view(row),...await this.safeSnapshot(tx,a,row)};
 });}
 async createDraft(token:string,raw:unknown){return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
  const v=draftInput(raw);
  await this.identity.assertCurrent(tx,a,"payroll.runs.view");await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  await this.branches.projectBranch(tx,a,v.branch);
  const digest=digestOf(v);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN:"+a.realmId+":"+a.accountId+":"+v.key]);
  const previous=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND creator=$2 AND request_key=$3",[a.realmId,a.accountId,v.key])).rows[0];
  if(previous){if(previous.request_digest!==digest||previous.branch_ref!==v.branch)throw new ConflictException("This payroll request changed");return {...this.view(previous),replayed:true};}
  const same=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND branch_ref IS NOT DISTINCT FROM $2::uuid AND period_key=$3 AND cycle='MONTHLY'",[a.realmId,v.branch,v.period])).rows[0];
  if(same)throw new ConflictException("A payroll draft already exists for this scope and month. Open the existing run.");
  const row=(await tx.query<Run>("INSERT INTO payroll_run(root_realm_id,branch_ref,period_key,period_from,period_until,fiscal_year_label,tentative_payment_date,creator,request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "+projection,[a.realmId,v.branch,v.period,v.periodFrom,v.periodUntil,v.label,v.tentative,a.accountId,v.key,digest])).rows[0];
  await recordPayrollAudit(tx,a,"RUN","DRAFT_CREATED");return {...this.view(row),replayed:false};
 });}
 async row(tx:PoolClient,a:Actor,ref:string,lock=false){
  await this.identity.assertCurrent(tx,a,"payroll.runs.view");await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const r=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND id=$2"+(lock?" FOR UPDATE":" FOR SHARE"),[a.realmId,id(ref)])).rows[0];
  if(!r)throw new NotFoundException("Payroll run unavailable");
  await this.branches.projectBranch(tx,a,r.branch_ref);return r;
 }
 private async snapshot(tx:PoolClient,a:Actor,r:Run):Promise<Snapshot|null>{
  if(!r.snapshot_digest)return null;
  const row=(await tx.query<{snapshot:Snapshot}>("SELECT snapshot FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 AND source_digest=$3 ORDER BY revision DESC LIMIT 1",[a.realmId,r.id,r.snapshot_digest])).rows[0];
  if(!row||digestOf(row.snapshot)!==r.snapshot_digest)throw conflict();
  return row.snapshot;
 }
 private async safeSnapshot(tx:PoolClient,a:Actor,r:Run){
  const s=await this.snapshot(tx,a,r);
  return {lines:s?.lines??[],totals:s?.totals??null,sourceDigest:r.snapshot_digest};
 }
 private async gather(tx:PoolClient,a:Actor,r:Run):Promise<InputLine[]>{
  const today=(await tx.query<{today:string}>("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today")).rows[0].today;
  if(r.period_until>today)throw new BadRequestException("Complete the payroll month before freezing attendance");
  const candidates=await this.hr.payrollCandidates(tx,a,r.branch_ref,r.period_from,r.period_until);
  const result:InputLine[]=[];
  for(const employee of candidates){
   // Lock the original employee while pinning attendance, salary and assignment.
   await tx.query("SELECT id FROM hr_employee WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,employee.id]);
   const attendance=await this.hr.payrollPeriod(tx,a,employee.id,r.period_from,r.period_until,r.branch_ref);
   const issues:string[]=[];if(attendance.reason)issues.push(attendance.reason);
   if(!["ACTIVE","PROBATION"].includes(employee.status))issues.push("EMPLOYMENT_STATUS_REQUIRES_REVIEW");
   const salary:FrozenSalary[]=[];
   if(!attendance.reason){
    const rows=(await tx.query<{id:string;branch_ref:string;assignment_ref:string;assignment_version:number;revision:number;policy_id:string;policy_revision:number;from:string;until:string|null;base:string;rules:Rule;components:PayComponent[]}>(
     `SELECT c.id,c.branch_ref,c.assignment_ref,c.assignment_version,c.revision,c.policy_id,c.policy_revision,c.effective_from::text AS "from",c.effective_until::text AS until,c.base_salary_minor::text AS base,p.attendance_rules AS rules,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('code',v.code,'label',v.label,'kind',v.kind,'mode',v.calc_mode,'minor',v.amount_minor::text,'bp',v.rate_bp,'taxClass',v.tax_class) ORDER BY v.code) FROM payroll_component v WHERE v.root_realm_id=c.root_realm_id AND v.policy_id=c.policy_id),'[]'::jsonb) AS components
      FROM employee_compensation_effective c JOIN payroll_policy p ON p.root_realm_id=c.root_realm_id AND p.id=c.policy_id AND p.revision=c.policy_revision AND p.status='APPROVED'
      WHERE c.root_realm_id=$1 AND c.employee_ref=$2 AND c.status='APPROVED' AND c.effective_from<$4::date AND (c.effective_until IS NULL OR c.effective_until>$3::date) ORDER BY c.effective_from,c.id`,[a.realmId,employee.id,r.period_from,r.period_until])).rows;
    for(const date of periodDates(r.period_from,r.period_until)){
     const assigned=attendance.assignments.filter(x=>x.from<=date&&(!x.until||x.until>date));
     if(!assigned.length)continue;
     if(assigned.length!==1){issues.push("OVERLAPPING_ASSIGNMENT:"+date);continue;}
     const ass=assigned[0],matching=rows.filter(c=>c.branch_ref===ass.branchRef&&c.assignment_ref===ass.id&&c.from<=date&&(!c.until||c.until>date));
     if(matching.length!==1){issues.push("APPROVED_COMPENSATION_MISSING_OR_OVERLAPPING:"+date);continue;}
     const c=matching[0];salary.push({date,branchRef:ass.branchRef,compensationRef:c.id,compensationRevision:c.revision,policyRef:c.policy_id,policyRevision:c.policy_revision,assignmentRef:ass.id,assignmentRevision:ass.version,baseMinor:c.base,components:c.components,rules:c.rules});
    }
   }
   result.push({employee,attendance,salary,issues});
  }
  return result;
 }
 private evaluate(r:Run,inputs:InputLine[],adjustments:Adjustment[],calculate:boolean):Snapshot{
  const lines:ResultLine[]=inputs.map(i=>{
   const e=i.employee,adj=adjustments.filter(x=>x.employeeRef===e.id);
   const line={employeeRef:e.id,reference:e.reference,name:e.name,branchRef:e.branchRef,adjustments:adj};
   if(adj.some(x=>x.kind==="HOLD"))return {...line,status:"HELD",issues:["EXPLICIT_HOLD"]};
   if(i.issues.length)return {...line,status:"PENDING_VALIDATION",issues:i.issues};
   const value=calculatePayroll(r.period_from,r.period_until,i.attendance.days,i.salary);
   if(value.status==="PENDING_VALIDATION")return {...line,status:"PENDING_VALIDATION",issues:value.issues.length?value.issues:["NO_APPROVED_COMPENSATION"]};
   if(!calculate)return {...line,status:"PENDING_VALIDATION",issues:["READY_TO_CALCULATE"]};
   const bonus=adj.filter(x=>x.kind==="BONUS").reduce((n,x)=>n+BigInt(x.minor),0n),extra=adj.filter(x=>x.kind==="DEDUCTION").reduce((n,x)=>n+BigInt(x.minor),0n);
   const gross=BigInt(value.grossMinor)+bonus,deductions=BigInt(value.deductionMinor)+extra;
   if(deductions>gross)return {...line,status:"PENDING_VALIDATION",issues:["DEDUCTIONS_EXCEED_GROSS"]};
   return {...line,status:"CALCULATED",issues:[],amounts:{...value,bonusMinor:bonus.toString(),extraDeductionMinor:extra.toString(),grossMinor:gross.toString(),deductionMinor:deductions.toString(),netMinor:(gross-deductions).toString()}};
  });
  const totals=emptyTotals();totals.employees=lines.length;for(const l of lines){
   if(l.status==="HELD")totals.held++;else if(l.status==="PENDING_VALIDATION")totals.pending++;else if(l.amounts){totals.calculated++;for(const k of ["grossMinor","deductionMinor","netMinor","employerMinor"] as const)totals[k]=(BigInt(totals[k])+BigInt(l.amounts[k])).toString();}
  }
  return {inputs,inputDigest:digestOf(inputs),adjustments,lines,totals};
 }
 async command(token:string,ref:string,action:"import-current-attendance"|"calculate"|"adjust",raw:unknown){
  return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
   const x=fields(raw,action==="adjust"?["requestKey","expectedRevision","employeeRef","kind","amountMinor","reason"]:["requestKey","expectedRevision"]);
   const key=id(x.requestKey),expected=Number(x.expectedRevision);if(!Number.isSafeInteger(expected)||expected<1)throw conflict();
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
   const r=await this.row(tx,a,ref,true),requestDigest=digestOf([r.id,action,x]);
   const prior=(await tx.query<{run_id:string;request_digest:string}>("SELECT run_id,request_digest FROM payroll_run_command WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.run_id!==r.id||prior.request_digest!==requestDigest)throw conflict();return {...this.view(r),...await this.safeSnapshot(tx,a,r),replayed:true};}
   if(r.revision!==expected||!["DRAFT","ATTENDANCE_IMPORTED","CALCULATED","RETURNED"].includes(r.status))throw conflict();
   const prev=await this.snapshot(tx,a,r);
   let next:Snapshot;
   if(action==="import-current-attendance"){
    const inputs=await this.gather(tx,a,r);next=this.evaluate(r,inputs,[],false);
   }else{
    if(!prev||!["ATTENDANCE_IMPORTED","CALCULATED"].includes(r.status))throw conflict();
    const inputs=await this.gather(tx,a,r);if(digestOf(inputs)!==prev.inputDigest)throw conflict();
    let adjustments=prev.adjustments;
    if(action==="adjust"){
     const employeeRef=id(x.employeeRef);
     if(!inputs.some(i=>i.employee.id===employeeRef)||!["BONUS","DEDUCTION","HOLD","CLEAR"].includes(String(x.kind)))throw new BadRequestException("Choose an eligible employee adjustment");
     const reason=label(x.reason);
     if(x.kind==="CLEAR"){adjustments=adjustments.filter(v=>v.employeeRef!==employeeRef);}else{
      const kind=x.kind as Adjustment["kind"],amount=kind==="HOLD"?"0":minor(x.amountMinor);
      adjustments=[...adjustments.filter(v=>v.employeeRef!==employeeRef||v.kind!==kind),{employeeRef,kind,minor:amount,reason}];
     }
    }
    next=this.evaluate(r,inputs,adjustments,true);
   }
   const revision=r.revision+1,digest=digestOf(next),status=action==="import-current-attendance"?"ATTENDANCE_IMPORTED":"CALCULATED";
   await tx.query("INSERT INTO payroll_run_revision(root_realm_id,run_id,revision,source_digest,snapshot,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6)",[a.realmId,r.id,revision,digest,JSON.stringify(next),a.accountId]);
   await tx.query("INSERT INTO payroll_run_command(root_realm_id,actor_ref,request_key,run_id,request_digest,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",[a.realmId,a.accountId,key,r.id,requestDigest,revision]);
   const updated=(await tx.query<Run>("UPDATE payroll_run SET status=$3,revision=$4,snapshot_digest=$5,approval_case_ref=NULL,approved_decision_ref=NULL WHERE root_realm_id=$1 AND id=$2 AND revision=$6 RETURNING "+projection,[a.realmId,r.id,status,revision,digest,expected])).rows[0];
   if(!updated)throw conflict();await recordPayrollAudit(tx,a,"RUN",action==="import-current-attendance"?"IMPORTED":"CALCULATED");
   return {...this.view(updated),lines:next.lines,totals:next.totals,sourceDigest:digest,replayed:false};
  });
 }
 async history(token:string,ref:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const r=await this.row(tx,a,ref);
  const rows=(await tx.query<{revision:number;created_at:string}>("SELECT revision,created_at::text FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 ORDER BY revision DESC LIMIT 100",[a.realmId,r.id])).rows;
  await recordPayrollAudit(tx,a,"RUN","READ");return {items:rows.map(x=>({revision:x.revision,at:x.created_at}))};
 });}
 async reviewSource(tx:PoolClient,a:Actor,ref:string,lock=false,verifyFresh=false){
  if(lock)await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
  const r=await this.row(tx,a,ref,lock),s=await this.snapshot(tx,a,r);
  if(!s||!r.snapshot_digest||s.totals.pending!==0||s.totals.calculated===0)throw conflict();
  if(verifyFresh&&digestOf(await this.gather(tx,a,r))!==s.inputDigest)throw conflict();
  return {row:r,snapshot:s,digest:r.snapshot_digest,preview:{label:r.run_number,period:r.period_key,fiscalYear:r.fiscal_year_label,totals:s.totals,lines:s.lines,status:r.status}};
 }
 async applyReview(tx:PoolClient,a:Actor,ref:string,status:"SUBMITTED"|"APPROVED_FROZEN"|"RETURNED"|"REJECTED",expected:number,caseRef:string,decisionRef:string|null){
  const src=await this.reviewSource(tx,a,ref,true,status==="SUBMITTED"||status==="APPROVED_FROZEN"),r=src.row;
  if(r.revision!==expected||(status==="SUBMITTED"?r.status!=="CALCULATED":r.status!=="SUBMITTED"||r.approval_case_ref!==caseRef))throw conflict();
  if(status==="APPROVED_FROZEN"){
   const sourceRevision=(await tx.query<{revision:number}>("SELECT revision FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 AND source_digest=$3 ORDER BY revision DESC LIMIT 1",[a.realmId,r.id,src.digest])).rows[0].revision;
   for(const l of src.snapshot.lines){if(l.status!=="CALCULATED"||!l.amounts)continue;const m=l.amounts;
    await tx.query("INSERT INTO payroll_line(root_realm_id,run_id,source_revision,employee_ref,period_key,branch_ref,base_minor,allowance_minor,deduction_minor,gross_minor,net_minor,employer_minor,statutory_minor,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)",[a.realmId,r.id,sourceRevision,l.employeeRef,r.period_key,l.branchRef,m.baseMinor,(BigInt(m.allowanceMinor)+BigInt(m.bonusMinor)).toString(),m.deductionMinor,m.grossMinor,m.netMinor,m.employerMinor,m.statutoryMinor,JSON.stringify(l)]);
   }
  }
  const result=await tx.query("UPDATE payroll_run SET status=$3,revision=revision+1,approval_case_ref=$4,approved_decision_ref=$5 WHERE root_realm_id=$1 AND id=$2 AND revision=$6",[a.realmId,r.id,status,caseRef,decisionRef,expected]);
  if(!result.rowCount)throw conflict();await recordPayrollAudit(tx,a,"RUN",status==="APPROVED_FROZEN"?"APPROVED":status);
 }

}
