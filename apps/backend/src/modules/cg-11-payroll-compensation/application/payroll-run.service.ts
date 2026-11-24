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
type Adjustment={employeeRef:string;kind:"BONUS"|"DEDUCTION"|"HOLD"|"LATE_ARREARS"|"LATE_RECOVERY";minor:string;reason:string;sourceRef?:string;sourceDigest?:string};
type Calculation=Extract<ReturnType<typeof calculatePayroll>,{status:"CALCULATED"}>;
type ResultLine={employeeRef:string;reference:string;name:string;branchRef:string;designation:string;department:string|null;employmentType:string;attendance:{presentDays:number;leaveDays:number;absentDays:number;recordedDays:number};status:"CALCULATED"|"PENDING_VALIDATION"|"HELD";issues:string[];adjustments:Adjustment[];amounts?:Calculation&{bonusMinor:string;arrearsMinor:string;extraDeductionMinor:string}};
type Snapshot={inputs:InputLine[];inputDigest:string;adjustments:Adjustment[];lines:ResultLine[];totals:{employees:number;calculated:number;pending:number;held:number;heldNetMinor:string;grossMinor:string;deductionMinor:string;netMinor:string;employerMinor:string}};
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v!==null&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const digestOf=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const conflict=()=>new ConflictException("Payroll source or revision changed. Refresh and retry the original operation.");
const emptyTotals=()=>({employees:0,calculated:0,pending:0,held:0,heldNetMinor:"0",grossMinor:"0",deductionMinor:"0",netMinor:"0",employerMinor:"0"});
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
 /** Six-month, scope-filtered original frozen obligations and current CG09 settlement. */
 async dashboard(token:string,periodInput="",branchInput=""){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  if(typeof periodInput!=="string"||typeof branchInput!=="string")throw new BadRequestException("Invalid payroll dashboard filter");
  const period=periodInput|| (await tx.query<{period:string}>("SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY-MM') period")).rows[0].period;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||period.slice(0,4)<"2000"||period.slice(0,4)>"9999")throw new BadRequestException("Invalid payroll dashboard period");
  const branch=branchInput&&branchInput!=="FOUNDATION"?id(branchInput):null;
  if(branchInput)await this.branches.projectBranch(tx,a,branch);
  const params=[a.realmId,scope.all,scope.branches.map(b=>b.value),period,branchInput,branch];
  type Metric={period:string;runs:number;approvedRuns:number;pendingApprovals:number;employees:number;gross:string;deductions:string;net:string;paid:string;outstanding:string;paidEmployees:number;pendingEmployees:number;unresolvedEmployees:number;failedEmployees:number;unresolvedMinor:string;failedMinor:string;rejectedAttempts:number};
  const trend=(await tx.query<Metric>(`
   WITH scoped AS (
    SELECT id,period_key,status FROM payroll_run WHERE root_realm_id=$1 AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[]))
      AND period_key BETWEEN to_char(($4||'-01')::date-interval '5 months','YYYY-MM') AND $4
      AND ($5='' OR branch_ref IS NOT DISTINCT FROM $6::uuid)
   ), run_counts AS (
    SELECT period_key,count(*)::int runs,count(*) FILTER(WHERE status='APPROVED_FROZEN')::int approved_runs,
      count(*) FILTER(WHERE status='SUBMITTED')::int pending_approvals FROM scoped GROUP BY period_key
   ), line_outcomes AS (
    SELECT r.period_key,l.net_minor,l.gross_minor,l.deduction_minor,coalesce(p.paid,0) paid,coalesce(p.invalid,false) invalid,coalesce(p.pending,false) pending,coalesce(p.failed,false) failed,coalesce(p.rejected,0) rejected
    FROM scoped r JOIN payroll_line l ON l.root_realm_id=$1 AND l.run_id=r.id AND r.status='APPROVED_FROZEN'
    LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
    LEFT JOIN LATERAL(SELECT sum(o.paid_minor) paid,bool_or(o.reversed OR (o.voucher_status='POSTED' AND o.paid_minor<>o.amount_minor)) invalid,
     bool_or(o.attempt_status NOT IN('POSTED','REJECTED','FAILED_VERIFIED')) pending,bool_or(o.attempt_status='FAILED_VERIFIED') failed,count(*) FILTER(WHERE o.attempt_status='REJECTED') rejected
     FROM payroll_attempt_outcome o WHERE o.root_realm_id=i.root_realm_id AND o.item_ref=i.id)p ON true
   ), money AS (
    SELECT period_key,count(*)::int employees,sum(gross_minor)::text gross,sum(deduction_minor)::text deductions,sum(net_minor)::text net,sum(paid)::text paid,
     sum(greatest(net_minor-paid,0))::text outstanding,
     count(*) FILTER(WHERE net_minor>0 AND paid=net_minor AND NOT invalid)::int paid_employees,
     count(*) FILTER(WHERE paid<net_minor AND NOT invalid AND NOT pending AND NOT failed)::int pending_employees,
     count(*) FILTER(WHERE paid<net_minor AND NOT invalid AND NOT pending AND failed)::int failed_employees,
     coalesce(sum(greatest(net_minor-paid,0)) FILTER(WHERE invalid OR paid>net_minor OR pending),0)::text unresolved_minor,
     coalesce(sum(greatest(net_minor-paid,0)) FILTER(WHERE paid<net_minor AND NOT invalid AND NOT pending AND failed),0)::text failed_minor,
     count(*) FILTER(WHERE invalid OR paid>net_minor OR pending)::int unresolved_employees,
     sum(rejected)::int rejected_attempts FROM line_outcomes GROUP BY period_key
   ) SELECT rc.period_key period,rc.runs,rc.approved_runs AS "approvedRuns",rc.pending_approvals AS "pendingApprovals",
    coalesce(m.employees,0) employees,coalesce(m.gross,'0') gross,coalesce(m.deductions,'0') deductions,coalesce(m.net,'0') net,
    coalesce(m.paid,'0') paid,coalesce(m.outstanding,'0') outstanding,coalesce(m.paid_employees,0) AS "paidEmployees",
    coalesce(m.pending_employees,0) AS "pendingEmployees",coalesce(m.unresolved_employees,0) AS "unresolvedEmployees",
    coalesce(m.failed_employees,0) AS "failedEmployees",coalesce(m.unresolved_minor,'0') AS "unresolvedMinor",coalesce(m.failed_minor,'0') AS "failedMinor",coalesce(m.rejected_attempts,0) AS "rejectedAttempts"
    FROM run_counts rc LEFT JOIN money m USING(period_key) ORDER BY rc.period_key`,params)).rows;
  const activeStaff=await this.hr.payrollActiveCount(tx,a,branch);
  await recordPayrollAudit(tx,a,"RUN","READ");
  return {period,activeStaff,selected:trend.find(x=>x.period===period)??null,trend};
 });}
 private async paymentStates(tx:PoolClient,realm:string,rows:Run[]){
  const ids=rows.filter(r=>r.status==="APPROVED_FROZEN").map(r=>r.id);
  if(!ids.length)return new Map<string,string>();
  const totals=(await tx.query<{run:string;due:string;paid:string;invalid:boolean;pending:boolean;failed:boolean}>(`
    SELECT l.run_id run,sum(l.net_minor)::text due,sum(coalesce(p.paid,0))::text paid,
      bool_or(coalesce(p.invalid,false)) invalid,bool_or(coalesce(p.pending,false)) pending,bool_or(coalesce(p.failed,false) AND coalesce(p.paid,0)<l.net_minor) failed
    FROM payroll_line l LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
    LEFT JOIN LATERAL (SELECT sum(o.paid_minor) paid,bool_or(o.reversed OR (o.voucher_status='POSTED' AND o.paid_minor<>o.amount_minor)) invalid,
      bool_or(o.attempt_status NOT IN('POSTED','REJECTED','FAILED_VERIFIED')) pending,bool_or(o.attempt_status='FAILED_VERIFIED') failed FROM payroll_attempt_outcome o WHERE o.root_realm_id=i.root_realm_id AND o.item_ref=i.id)p ON true
    WHERE l.root_realm_id=$1 AND l.run_id=ANY($2::uuid[]) GROUP BY l.run_id`,[realm,ids])).rows;
  const result=new Map<string,string>();
  for(const x of totals){const due=BigInt(x.due),paid=BigInt(x.paid);result.set(x.run,x.invalid||paid>due?"RECONCILIATION_REQUIRED":due===0n?"NO_PAYMENT_DUE":paid===due?"PAID_VERIFIED":paid>0n?"PARTIALLY_PAID":x.pending?"PAYMENT_PENDING":x.failed?"FAILED_TRANSFER_DUE":"APPROVED_NOT_PAID");}
  return result;
 }
 async list(token:string,filters:{period?:string;branchRef?:string;afterPeriod?:string;afterRun?:string}={}){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  const {period="",branchRef="",afterPeriod="",afterRun=""}=filters;
  if((period&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))||(afterPeriod&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(afterPeriod))||!!afterPeriod!==!!afterRun||(afterRun&&!/^CG-PAY-\d{6,20}$/.test(afterRun)))throw new BadRequestException("Invalid payroll history filter");
  const branch=branchRef&&branchRef!=="FOUNDATION"?id(branchRef):null;
  if(branchRef)await this.branches.projectBranch(tx,a,branch);
  const rows=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[])) AND ($4='' OR period_key=$4) AND ($5='' OR branch_ref IS NOT DISTINCT FROM $6::uuid) AND ($7='' OR (period_key,run_number)<($7,$8)) ORDER BY period_key DESC,run_number DESC LIMIT 51",[a.realmId,scope.all,scope.branches.map(b=>b.value),period,branchRef,branch,afterPeriod,afterRun])).rows;
  const visible=rows.slice(0,50),last=visible[visible.length-1],states=await this.paymentStates(tx,a.realmId,visible);
  await recordPayrollAudit(tx,a,"RUN","READ");return {items:visible.map(r=>({...this.view(r),paymentStatus:r.status==="APPROVED_FROZEN"?states.get(r.id)??"RECONCILIATION_REQUIRED":"NOT_AUTHORIZED"})),next:rows.length>50?{period:last.period_key,reference:last.run_number}:null};
 });}
 async detail(token:string,ref:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  const row=(await tx.query<Run>("SELECT "+projection+" FROM payroll_run WHERE root_realm_id=$1 AND id=$2 AND ((branch_ref IS NULL AND $3::boolean) OR branch_ref=ANY($4::uuid[]))",[a.realmId,id(ref),scope.all,scope.branches.map(b=>b.value)])).rows[0];
  if(!row)throw new NotFoundException("Payroll run unavailable");
  const states=await this.paymentStates(tx,a.realmId,[row]);await recordPayrollAudit(tx,a,"RUN","READ");return {...this.view(row),...await this.safeSnapshot(tx,a,row),paymentStatus:row.status==="APPROVED_FROZEN"?states.get(row.id)??"RECONCILIATION_REQUIRED":"NOT_AUTHORIZED"};
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
  return {lines:s?.lines??[],totals:s?.totals??null,sourceDigest:r.snapshot_digest,calculationStatus:s&&s.totals.pending>0?"PENDING_VALIDATION":this.view(r).calculationStatus};
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
   const e=i.employee,adj=adjustments.filter(x=>x.employeeRef===e.id),hold=adj.some(x=>x.kind==="HOLD");
   const days=i.attendance.days;
   const line={employeeRef:e.id,reference:e.reference,name:e.name,branchRef:e.branchRef,designation:e.designation,department:e.department,employmentType:e.employmentType,attendance:{presentDays:days.filter(d=>["PRESENT","LATE"].includes(d.status)&&d.checkOut).reduce((n,d)=>n+1-d.leaveUnits/2,0),leaveDays:days.filter(d=>d.leaveDecisionRef).reduce((n,d)=>n+d.leaveUnits/2,0),absentDays:days.filter(d=>d.status==="ABSENT").length,recordedDays:days.length},adjustments:adj};
   const issues=i.issues.filter(x=>!(hold&&x==="EMPLOYMENT_STATUS_REQUIRES_REVIEW"));
   if(issues.length)return {...line,status:"PENDING_VALIDATION",issues};
   const value=calculatePayroll(r.period_from,r.period_until,i.attendance.days,i.salary);
   if(value.status==="PENDING_VALIDATION")return {...line,status:"PENDING_VALIDATION",issues:value.issues.length?value.issues:["NO_APPROVED_COMPENSATION"]};
   if(!calculate)return {...line,status:"PENDING_VALIDATION",issues:["READY_TO_CALCULATE"]};
   const bonus=adj.filter(x=>x.kind==="BONUS").reduce((n,x)=>n+BigInt(x.minor),0n),arrears=adj.filter(x=>x.kind==="LATE_ARREARS").reduce((n,x)=>n+BigInt(x.minor),0n),extra=adj.filter(x=>x.kind==="DEDUCTION"||x.kind==="LATE_RECOVERY").reduce((n,x)=>n+BigInt(x.minor),0n);
   const gross=BigInt(value.grossMinor)+bonus+arrears,deductions=BigInt(value.deductionMinor)+extra;
   if(deductions>gross)return {...line,status:"PENDING_VALIDATION",issues:["DEDUCTIONS_EXCEED_GROSS"]};
   return {...line,status:hold?"HELD":"CALCULATED",issues:hold?["EXPLICIT_HOLD"]:[],amounts:{...value,bonusMinor:bonus.toString(),arrearsMinor:arrears.toString(),extraDeductionMinor:extra.toString(),grossMinor:gross.toString(),deductionMinor:deductions.toString(),netMinor:(gross-deductions).toString()}};
  });
  const totals=emptyTotals();totals.employees=lines.length;for(const l of lines){
   if(l.status==="HELD"){totals.held++;if(l.amounts)totals.heldNetMinor=(BigInt(totals.heldNetMinor)+BigInt(l.amounts.netMinor)).toString();}else if(l.status==="PENDING_VALIDATION")totals.pending++;else if(l.amounts){totals.calculated++;for(const k of ["grossMinor","deductionMinor","netMinor","employerMinor"] as const)totals[k]=(BigInt(totals[k])+BigInt(l.amounts[k])).toString();}
  }
  return {inputs,inputDigest:digestOf(inputs),adjustments,lines,totals};
 }
 async command(token:string,ref:string,action:"import-current-attendance"|"calculate"|"adjust"|"late-adjustment",raw:unknown){
  return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
   const x=fields(raw,action==="late-adjustment"?["requestKey","expectedRevision","originalLineRef","reason"]:action==="adjust"?["requestKey","expectedRevision","employeeRef","kind","amountMinor","reason"]:["requestKey","expectedRevision"]);
   const key=id(x.requestKey),expected=Number(x.expectedRevision);if(!Number.isSafeInteger(expected)||expected<1)throw conflict();
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
   const r=await this.row(tx,a,ref,true),requestDigest=digestOf([r.id,action,x]);
   const prior=(await tx.query<{run_id:string;request_digest:string}>("SELECT run_id,request_digest FROM payroll_run_command WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.run_id!==r.id||prior.request_digest!==requestDigest)throw conflict();return {...this.view(r),...await this.safeSnapshot(tx,a,r),replayed:true};}
   if(r.revision!==expected||!["DRAFT","ATTENDANCE_IMPORTED","CALCULATED","RETURNED"].includes(r.status))throw conflict();
   const prev=await this.snapshot(tx,a,r);
   let next:Snapshot;
   if(action==="import-current-attendance"){
    const inputs=await this.gather(tx,a,r);const late=await this.lateAdjustments(tx,a,r);next=this.evaluate(r,inputs,late,false);
   }else{
    if(!prev||!["ATTENDANCE_IMPORTED","CALCULATED"].includes(r.status))throw conflict();
    const inputs=await this.gather(tx,a,r);if(digestOf(inputs)!==prev.inputDigest)throw conflict();
    let adjustments=prev.adjustments;
    if(action==="late-adjustment"){await this.createLateAdjustment(tx,a,r,id(x.originalLineRef),label(x.reason));adjustments=[...adjustments.filter(v=>!v.sourceRef),...await this.lateAdjustments(tx,a,r)];}
    if(action==="adjust"){
     const employeeRef=id(x.employeeRef);
     if(!inputs.some(i=>i.employee.id===employeeRef)||!["BONUS","DEDUCTION","HOLD","CLEAR"].includes(String(x.kind)))throw new BadRequestException("Choose an eligible employee adjustment");
     const reason=label(x.reason);
     if(x.kind==="CLEAR"){adjustments=adjustments.filter(v=>v.employeeRef!==employeeRef||!!v.sourceRef);}else{
      const kind=x.kind as "BONUS"|"DEDUCTION"|"HOLD",amount=kind==="HOLD"?"0":minor(x.amountMinor);
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
   return {...this.view(updated),lines:next.lines,totals:next.totals,calculationStatus:next.totals.pending>0?"PENDING_VALIDATION":this.view(updated).calculationStatus,sourceDigest:digest,replayed:false};
  });
 }
 /** Only original frozen approved lines in an earlier period and this employee's current target scope. */
 async lateOptions(token:string,target:string){return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
  const r=await this.row(tx,a,target),snap=await this.snapshot(tx,a,r);
  if(!snap||!["ATTENDANCE_IMPORTED","CALCULATED"].includes(r.status))return {items:[]};
  const scope=await this.branches.projectBranchScope(tx,a);
  const rows=(await tx.query<{ref:string;reference:string;period:string;name:string;netMinor:string}>(
   `SELECT l.id AS ref,o.run_number AS reference,o.period_key AS period,l.source_snapshot->>'name' AS name,l.net_minor::text AS "netMinor"
    FROM payroll_line l JOIN payroll_run o ON o.root_realm_id=l.root_realm_id AND o.id=l.run_id AND o.status='APPROVED_FROZEN'
    WHERE l.root_realm_id=$1 AND o.period_key<$2 AND l.employee_ref=ANY($3::uuid[]) AND (($4::boolean AND o.branch_ref IS NULL) OR o.branch_ref=ANY($5::uuid[]))
    ORDER BY o.period_key DESC,l.id LIMIT 100`,[a.realmId,r.period_key,snap.inputs.map(x=>x.employee.id),scope.all,scope.branches.map(x=>x.value)])).rows;
  return {items:rows};
 });}
 private async lateAdjustments(tx:PoolClient,a:Actor,r:Run):Promise<Adjustment[]>{
  const rows=(await tx.query<{id:string;employee_ref:string;delta:string;reason:string;correction_digest:string;original_line_ref:string}>("SELECT id,employee_ref,delta,reason,correction_digest,original_line_ref FROM (SELECT DISTINCT ON(original_line_ref) id,employee_ref,delta_minor::text AS delta,reason,correction_digest,original_line_ref FROM payroll_adjustment WHERE root_realm_id=$1 AND target_run_ref=$2 ORDER BY original_line_ref,created_at DESC,id DESC) current ORDER BY id",[a.realmId,r.id])).rows;
  const result:Adjustment[]=[];
  for(const x of rows){
   const fresh=await this.correctedOriginal(tx,a,r,x.original_line_ref);
   if(fresh.correctionDigest!==x.correction_digest)throw new ConflictException("The original HR correction changed; review the later adjustment");
   result.push({employeeRef:x.employee_ref,kind:BigInt(x.delta)>0n?"LATE_ARREARS":"LATE_RECOVERY",minor:(BigInt(x.delta)<0n?-BigInt(x.delta):BigInt(x.delta)).toString(),reason:x.reason,sourceRef:x.id,sourceDigest:x.correction_digest});
  }
  return result;
 }
 private async correctedOriginal(tx:PoolClient,a:Actor,target:Run,originalLine:string){
  const line=(await tx.query<{id:string;run_id:string;employee_ref:string;source_revision:number;net_minor:string;source_snapshot:ResultLine}>("SELECT id,run_id,employee_ref,source_revision,net_minor::text,source_snapshot FROM payroll_line WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,originalLine])).rows[0];
  if(!line)throw new NotFoundException("Original approved payroll line unavailable");
  const original=await this.row(tx,a,line.run_id);
  if(original.status!=="APPROVED_FROZEN"||original.period_key>=target.period_key)throw conflict();
  const old=await this.snapshot(tx,a,original),input=old?.inputs.find(x=>x.employee.id===line.employee_ref);
  if(!old||!input||!line.source_snapshot.amounts)throw conflict();
  const actual=await this.hr.payrollPeriod(tx,a,line.employee_ref,original.period_from,original.period_until,original.branch_ref);
  const periodMap=(xs:Attendance["assignments"])=>periodDates(original.period_from,original.period_until).map(date=>xs.filter(a=>a.from<=date&&(!a.until||a.until>date)).map(a=>[a.id,a.branchRef]));
  if(actual.reason||digestOf(periodMap(actual.assignments))!==digestOf(periodMap(input.attendance.assignments)))throw new ConflictException("Original assignment or attendance remains unresolved");
  const before=new Map(input.attendance.days.map(d=>[d.date,d]));
  const changed=actual.days.filter(d=>digestOf(d)!==digestOf(before.get(d.date)??null));
  const newApproved=(d:Attendance["days"][number])=>{const old=before.get(d.date);return !!(d.correctionDecisionRef&&d.correctionDecisionRef!==old?.correctionDecisionRef||d.leaveDecisionRef&&d.leaveDecisionRef!==old?.leaveDecisionRef)&&(!old||d.revision>old.revision);};
  if(!changed.length||changed.some(d=>!newApproved(d))||input.attendance.days.some(d=>!actual.days.some(n=>n.date===d.date)))throw new ConflictException("No new original approved attendance or leave correction");
  const corrected=calculatePayroll(original.period_from,original.period_until,actual.days,input.salary);
  const originalCalc=calculatePayroll(original.period_from,original.period_until,input.attendance.days,input.salary);
  if(corrected.status!=="CALCULATED"||originalCalc.status!=="CALCULATED")throw new ConflictException("The original attendance correction is not fully validated");
  if(corrected.employerMinor!==originalCalc.employerMinor||corrected.statutoryMinor!==originalCalc.statutoryMinor)throw new ConflictException("Employer or statutory correction requires its reviewed accounting treatment");
  const correctionDigest=digestOf([original.id,line.id,periodMap(actual.assignments),actual.days,input.salary]);
  return {line,correctionDigest,delta:BigInt(corrected.netMinor)-BigInt(originalCalc.netMinor),evidence:changed.map(d=>({date:d.date,attendanceRef:d.ref,revision:d.revision,decisionRef:d.correctionDecisionRef??d.leaveDecisionRef}))};
 }
 private async createLateAdjustment(tx:PoolClient,a:Actor,target:Run,originalLine:string,reason:string){
  const original=await this.correctedOriginal(tx,a,target,originalLine);
  const targetSnap=await this.snapshot(tx,a,target);
  if(!targetSnap?.inputs.some(i=>i.employee.id===original.line.employee_ref))throw new ConflictException("Original employee is not in this later run scope");
  const prior=(await tx.query<{delta:string;target_run_ref:string;status:string;consumed:boolean}>("SELECT x.delta_minor::text AS delta,x.target_run_ref,r.status,EXISTS(SELECT 1 FROM payroll_adjustment_consumption c WHERE c.root_realm_id=x.root_realm_id AND c.adjustment_ref=x.id) AS consumed FROM payroll_adjustment x JOIN payroll_run r ON r.root_realm_id=x.root_realm_id AND r.id=x.target_run_ref WHERE x.root_realm_id=$1 AND x.original_line_ref=$2 AND r.status<>'REJECTED' ORDER BY x.id FOR SHARE OF x,r",[a.realmId,originalLine])).rows;
  if(prior.some(x=>x.status!=="APPROVED_FROZEN"&&x.target_run_ref!==target.id))throw new ConflictException("An original correction is already under review");
  const applied=prior.filter(v=>v.consumed).reduce((n,v)=>n+BigInt(v.delta),0n),delta=original.delta-applied;
  if(delta===0n)throw new ConflictException("The corrected payroll difference has already been accounted for");
  const key=digestOf([target.id,original.line.id,original.correctionDigest]);
  await tx.query("INSERT INTO payroll_adjustment(root_realm_id,original_line_ref,target_run_ref,employee_ref,correction_digest,source_key,delta_minor,source_snapshot,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)",[a.realmId,original.line.id,target.id,original.line.employee_ref,original.correctionDigest,key,delta.toString(),JSON.stringify({evidence:original.evidence,originalLine:original.line.id,previousDelta:applied.toString()}),reason,a.accountId]);
 }
 async history(token:string,ref:string){return this.compensation.run(token,"payroll.runs.view",async(tx,a)=>{
  const r=await this.row(tx,a,ref);
  const rows=(await tx.query<{revision:number;created_at:string}>("SELECT revision,created_at::text FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 ORDER BY revision DESC LIMIT 100",[a.realmId,r.id])).rows;
  await recordPayrollAudit(tx,a,"RUN","READ");return {items:rows.map(x=>({revision:x.revision,at:x.created_at}))};
 });}
 async frozenReview(tx:PoolClient,a:Actor,ref:string,revision:number,digest:string){
  const r=await this.row(tx,a,ref);
  const record=(await tx.query<{snapshot:Snapshot}>("SELECT snapshot FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 AND revision=$3 AND source_digest=$4",[a.realmId,r.id,revision,digest])).rows[0];
  if(!record||digestOf(record.snapshot)!==digest)throw conflict();
  const s=record.snapshot;await recordPayrollAudit(tx,a,"RUN","READ");
  return {row:r,digest,preview:{label:r.run_number,period:r.period_key,fiscalYear:r.fiscal_year_label,totals:s.totals,lines:s.lines,status:r.status}};
 }
 async reviewSource(tx:PoolClient,a:Actor,ref:string,lock=false,verifyFresh=false){
  if(lock)await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
  const r=await this.row(tx,a,ref,lock),s=await this.snapshot(tx,a,r);
  if(!s||!r.snapshot_digest||s.totals.pending!==0||s.totals.calculated+s.totals.held===0||s.adjustments.some(x=>x.sourceRef&&!s.lines.some(l=>l.employeeRef===x.employeeRef&&l.status==="CALCULATED")))throw conflict();
  if(verifyFresh){if(digestOf(await this.gather(tx,a,r))!==s.inputDigest)throw conflict();const late=await this.lateAdjustments(tx,a,r);if(digestOf(late)!==digestOf(s.adjustments.filter(v=>v.sourceRef)))throw conflict();}
  return {row:r,snapshot:s,digest:r.snapshot_digest,preview:{label:r.run_number,period:r.period_key,fiscalYear:r.fiscal_year_label,totals:s.totals,lines:s.lines,status:r.status}};
 }
 async applyReview(tx:PoolClient,a:Actor,ref:string,status:"SUBMITTED"|"APPROVED_FROZEN"|"RETURNED"|"REJECTED",expected:number,caseRef:string,decisionRef:string|null){
  const src=await this.reviewSource(tx,a,ref,true,status==="SUBMITTED"||status==="APPROVED_FROZEN"),r=src.row;
  if(r.revision!==expected||(status==="SUBMITTED"?r.status!=="CALCULATED":r.status!=="SUBMITTED"||r.approval_case_ref!==caseRef))throw conflict();
  if(status==="APPROVED_FROZEN"){
   const sourceRevision=(await tx.query<{revision:number}>("SELECT revision FROM payroll_run_revision WHERE root_realm_id=$1 AND run_id=$2 AND source_digest=$3 ORDER BY revision DESC LIMIT 1",[a.realmId,r.id,src.digest])).rows[0].revision;
   for(const adj of src.snapshot.adjustments.filter(x=>x.sourceRef))await tx.query("INSERT INTO payroll_adjustment_consumption(root_realm_id,adjustment_ref,original_line_ref,correction_digest,target_run_ref,decision_ref) SELECT root_realm_id,id,original_line_ref,correction_digest,target_run_ref,$4 FROM payroll_adjustment WHERE root_realm_id=$1 AND id=$2 AND target_run_ref=$3",[a.realmId,adj.sourceRef,r.id,decisionRef]);
   for(const l of src.snapshot.lines){if(!["CALCULATED","HELD"].includes(l.status)||!l.amounts)continue;const m=l.amounts;
    await tx.query("INSERT INTO payroll_line(root_realm_id,run_id,source_revision,employee_ref,period_key,branch_ref,entitlement_state,base_minor,allowance_minor,bonus_minor,arrears_minor,deduction_minor,gross_minor,net_minor,employer_minor,statutory_minor,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)",[a.realmId,r.id,sourceRevision,l.employeeRef,r.period_key,l.branchRef,l.status==="HELD"?"HELD":"RELEASE_ELIGIBLE",m.baseMinor,m.allowanceMinor,m.bonusMinor,m.arrearsMinor,m.deductionMinor,m.grossMinor,m.netMinor,m.employerMinor,m.statutoryMinor,JSON.stringify(l)]);
   }
  }
  const result=await tx.query("UPDATE payroll_run SET status=$3,revision=revision+1,approval_case_ref=$4,approved_decision_ref=$5 WHERE root_realm_id=$1 AND id=$2 AND revision=$6",[a.realmId,r.id,status,caseRef,decisionRef,expected]);
  if(!result.rowCount)throw conflict();await recordPayrollAudit(tx,a,"RUN",status==="APPROVED_FROZEN"?"APPROVED":status);
 }

}
