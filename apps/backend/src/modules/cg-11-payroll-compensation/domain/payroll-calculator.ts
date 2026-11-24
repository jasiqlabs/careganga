import {BadRequestException} from "@nestjs/common";
import {componentMinor,date,minor} from "./payroll-input";
export type PayComponent={code:string;label:string;kind:string;mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null;taxClass:string};
export type Rule={absence:"UNCONFIGURED"|"UNPAID"|"PAID";leave:Record<string,"PAID"|"UNPAID">;lateDeductionMinor?:string};
export type Day={date:string;status:string;checkIn:string|null;checkOut:string|null;leaveUnits:number;leaveRef:string|null;leavePolicyRef:string|null;leaveDecisionRef:string|null;pendingCorrection:boolean};
export type SalaryDay={date:string;branchRef:string;compensationRef:string;baseMinor:string;components:PayComponent[];rules:Rule};
const round=(n:bigint,d:bigint)=>(n+d/2n)/d;
export function periodDates(from:string,until:string){
 const a=Date.parse(date(from)),b=Date.parse(date(until));if(b<=a||b-a>31*86400000)throw new BadRequestException("Invalid monthly period");
 return Array.from({length:(b-a)/86400000},(_,i)=>new Date(a+i*86400000).toISOString().slice(0,10));
}
export function paidUnits(d:Day,r:Rule):number|null{
 if(d.pendingCorrection||d.checkIn&&!d.checkOut||!Number.isInteger(d.leaveUnits)||d.leaveUnits<0||d.leaveUnits>2)return null;
 if(d.leaveUnits>0&&(!d.leaveRef||!d.leavePolicyRef||!d.leaveDecisionRef||!r.leave[d.leavePolicyRef]))return null;
 const leavePaid=d.leaveUnits&&d.leavePolicyRef&&r.leave[d.leavePolicyRef]==="PAID"?d.leaveUnits:0;
 if(d.status==="WEEKLY_OFF"&&d.leaveUnits===0&&!d.checkIn&&!d.checkOut)return 2;
 if(d.status==="ABSENT"&&d.leaveUnits===0&&!d.checkIn&&!d.checkOut)return r.absence==="UNPAID"?0:r.absence==="PAID"?2:null;
 if((d.status==="PRESENT"||d.status==="LATE")&&d.checkIn&&d.checkOut&&d.leaveUnits<=1)return 2-d.leaveUnits+leavePaid;
 if(d.status==="LEAVE"&&d.leaveUnits===2&&!d.checkIn&&!d.checkOut)return leavePaid;
 // An unpunched half-day cannot establish the other half's status.
 return null;
}
/** Calendar-day monthly pro-rating, integer half-up once per component across
 * each frozen compensation version; no inferred days, overtime or tax. */
export function calculatePayroll(from:string,until:string,days:Day[],salary:SalaryDay[]){
 const calendar=periodDates(from,until),dateSet=new Set(calendar),byDate=new Map(days.map(d=>[d.date,d]));
 if(byDate.size!==days.length||days.some(d=>!dateSet.has(d.date))||new Set(salary.map(d=>d.date)).size!==salary.length||salary.some(d=>!dateSet.has(d.date)))throw new BadRequestException("Duplicate or out-of-period payroll day");
 const groups=new Map<string,{sample:SalaryDay;units:number;lateDays:number}>(),issues:string[]=[];
 let paid=0;for(const s of salary){const d=byDate.get(s.date),units=d?paidUnits(d,s.rules):null;if(units===null){issues.push(s.date);continue;}
  paid+=units;const key=s.branchRef+":"+s.compensationRef;const g=groups.get(key);const late=d?.status==="LATE"&&units>0?1:0;if(g){g.units+=units;g.lateDays+=late;}else groups.set(key,{sample:s,units,lateDays:late});}
 if(issues.length||!salary.length)return {status:"PENDING_VALIDATION" as const,issues};
 const denominator=BigInt(calendar.length*2);
 let base=0n,allowance=0n,deduction=0n,employer=0n;
 const allocation=[];const components=[];
 for(const {sample:s,units,lateDays} of groups.values()){
  const prorate=(n:bigint)=>round(n*BigInt(units),denominator);
  const b=prorate(BigInt(minor(s.baseMinor)));let a=0n,d=0n,e=0n;
  for(const c of s.components){const n=prorate(componentMinor(s.baseMinor,c));
   if(c.kind==="ALLOWANCE")a+=n;else if(c.kind==="DEDUCTION")d+=n;else if(c.kind==="EMPLOYER_CONTRIBUTION")e+=n;else throw new BadRequestException("Unsupported component");
   components.push({branchRef:s.branchRef,compensationRef:s.compensationRef,code:c.code,label:c.label,kind:c.kind,minor:n.toString(),taxClass:c.taxClass});
  }
  const late=BigInt(minor(s.rules.lateDeductionMinor??"0",true))*BigInt(lateDays);
  if(late>0n){d+=late;components.push({branchRef:s.branchRef,compensationRef:s.compensationRef,code:"RECORDED_LATE_DEDUCTION",label:"Approved recorded-late deduction",kind:"DEDUCTION",minor:late.toString(),taxClass:"NOT_CONFIGURED"});}
  if(d>b+a)return {status:"PENDING_VALIDATION" as const,issues:["DEDUCTIONS_EXCEED_GROSS"]};
  base+=b;allowance+=a;deduction+=d;employer+=e;allocation.push({branchRef:s.branchRef,compensationRef:s.compensationRef,paidHalfDays:units,baseMinor:b.toString(),allowanceMinor:a.toString(),deductionMinor:d.toString(),netMinor:(b+a-d).toString(),employerMinor:e.toString()});
 }
 return {status:"CALCULATED" as const,paidHalfDays:paid,calendarDays:calendar.length,baseMinor:base.toString(),allowanceMinor:allowance.toString(),deductionMinor:deduction.toString(),grossMinor:(base+allowance).toString(),netMinor:(base+allowance-deduction).toString(),employerMinor:employer.toString(),statutoryMinor:"0",allocation,components};
}
