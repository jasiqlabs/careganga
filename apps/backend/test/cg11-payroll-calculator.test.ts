import {test} from "node:test";
import assert from "node:assert/strict";
import {calculatePayroll,paidUnits,periodDates,type Day,type SalaryDay,type Rule} from "../src/modules/cg-11-payroll-compensation/domain/payroll-calculator";
const from="2027-02-01",until="2027-03-01",dates=periodDates(from,until);
const leave="00000000-0000-4000-8000-000000000001";
const rule:Rule={absence:"UNPAID",leave:{[leave]:"UNPAID"}};
const present=(date:string):Day=>({date,status:"PRESENT",checkIn:date+"T04:00:00Z",checkOut:date+"T12:00:00Z",leaveUnits:0,leaveRef:null,leavePolicyRef:null,leaveDecisionRef:null,pendingCorrection:false});
const salary=(date:string):SalaryDay=>({date,branchRef:"A",compensationRef:"salary-v1",baseMinor:"2800000",rules:rule,components:[
 {code:"HRA",label:"Housing",kind:"ALLOWANCE",mode:"PERCENT",minor:null,bp:1000,taxClass:"NOT_CONFIGURED"},
 {code:"DEDUCT",label:"Deduction",kind:"DEDUCTION",mode:"FIXED",minor:"28000",bp:null,taxClass:"NOT_CONFIGURED"},
 {code:"EMPLOYER",label:"Employer contribution",kind:"EMPLOYER_CONTRIBUTION",mode:"FIXED",minor:"100000",bp:null,taxClass:"NOT_CONFIGURED"}
]});
const all=()=>dates.map(present),pay=()=>dates.map(salary);
test("full month exact integer salary; employer contribution never reduces net",()=>{
 const x=calculatePayroll(from,until,all(),pay());assert.equal(x.status,"CALCULATED");if(x.status!=="CALCULATED")return;
 assert.equal(x.baseMinor,"2800000");assert.equal(x.grossMinor,"3080000");assert.equal(x.deductionMinor,"28000");assert.equal(x.netMinor,"3052000");assert.equal(x.employerMinor,"100000");assert.equal(x.statutoryMinor,"0");
});
test("missing attendance and open punch are unresolved, not zero",()=>{
 assert.equal(calculatePayroll(from,until,all().slice(1),pay()).status,"PENDING_VALIDATION");
 const d=all();d[0].checkOut=null;assert.equal(calculatePayroll(from,until,d,pay()).status,"PENDING_VALIDATION");
});
test("approved unpaid leave and actual absence, with explicit configured rules",()=>{
 const d=all();d[0]={...d[0],status:"LEAVE",checkIn:null,checkOut:null,leaveUnits:2,leaveRef:leave,leavePolicyRef:leave,leaveDecisionRef:leave};
 d[1]={...d[1],status:"ABSENT",checkIn:null,checkOut:null};
 const x=calculatePayroll(from,until,d,pay());assert.equal(x.status,"CALCULATED");if(x.status!=="CALCULATED")return;
 assert.equal(x.paidHalfDays,52);assert.equal(x.baseMinor,"2600000");assert.equal(x.netMinor,"2834000");
});
test("unconfigured leave, missing decision and pending correction fail closed",()=>{
 const d={...present(from),status:"LEAVE",checkIn:null,checkOut:null,leaveUnits:2,leaveRef:leave,leavePolicyRef:leave,leaveDecisionRef:leave};
 assert.equal(paidUnits(d,{absence:"UNCONFIGURED",leave:{}}),null);
 assert.equal(paidUnits({...d,leaveDecisionRef:null},rule),null);
 assert.equal(paidUnits({...present(from),pendingCorrection:true},rule),null);
 assert.equal(paidUnits({...present(from),status:"ABSENT",checkIn:null,checkOut:null},{absence:"UNCONFIGURED",leave:{}}),null);
});
test("one half-day with original punch and approved leave",()=>{
 const d={...present(from),leaveUnits:1,leaveRef:leave,leavePolicyRef:leave,leaveDecisionRef:leave};
 assert.equal(paidUnits(d,rule),1);assert.equal(paidUnits(d,{...rule,leave:{[leave]:"PAID"}}),2);
 assert.equal(paidUnits({...d,status:"HALF_DAY_LEAVE",checkIn:null,checkOut:null},rule),null);
});
test("one employee transfer: split allocation within one entitlement",()=>{
 const s=pay().map((v,i)=>i>=14?{...v,branchRef:"B",compensationRef:"salary-v2",baseMinor:"5600000"}:v);
 const x=calculatePayroll(from,until,all(),s);assert.equal(x.status,"CALCULATED");if(x.status!=="CALCULATED")return;
 assert.equal(x.allocation.length,2);assert.equal(x.baseMinor,"4200000");assert.equal(x.paidHalfDays,56);
 assert.equal(x.allocation.reduce((n,a)=>n+BigInt(a.netMinor),0n).toString(),x.netMinor);
});
test("duplicate days, invalid period and negative net rejected",()=>{
 assert.throws(()=>calculatePayroll(from,until,[...all(),present(from)],pay()));
 assert.throws(()=>periodDates(from,"2027-04-01"));
 const s=pay().map(v=>({...v,components:[{code:"BIG",label:"Overgross deduction",kind:"DEDUCTION",mode:"FIXED" as const,minor:"9900000",bp:null,taxClass:"NOT_CONFIGURED"}]}));
 assert.equal(calculatePayroll(from,until,all(),s).status,"PENDING_VALIDATION");
});
test("late correction changes new calculation but never mutates frozen original",()=>{
 const days=all(),s=pay(),old=calculatePayroll(from,until,days,s);const before=JSON.stringify(old);
 const updated=days.map((v,i)=>i===0?{...v,status:"ABSENT",checkIn:null,checkOut:null}:v);
 const next=calculatePayroll(from,until,updated,s);
 assert.equal(JSON.stringify(old),before);assert.equal(old.status,"CALCULATED");assert.equal(next.status,"CALCULATED");
 if(old.status==="CALCULATED"&&next.status==="CALCULATED")assert.equal(BigInt(old.netMinor)-BigInt(next.netMinor),109000n);
});
