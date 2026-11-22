import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ConflictException} from "@nestjs/common";
import {parseAttendanceCorrection} from "../src/modules/cg-10-human-resources/application/hr-attendance-correction-source.facade";
import {parseLeaveReviewFilters,parsePendingLeaveWithdrawal} from "../src/modules/cg-03-registration-approvals/application/hr-leave-approval.service";
import {countedLeaveDates,parseLeaveRequest} from "../src/modules/cg-10-human-resources/application/hr-leave-source.facade";
import {shiftCheckInAt,verifiedWorkedMinutes,leavePolicyInput} from "../src/modules/cg-10-human-resources/application/hr-attendance.service";

/** US-002 source-only time-zone/overnight safety tests; no DB/device/manual QA. */
describe("CG-10 original attendance business-day classification",()=>{
 test("same instant follows the configured branch shift timezone, not the server clock",()=>{
  const now=new Date("2026-11-21T20:01:00.000Z");
  const x=shiftCheckInAt(now,"Asia/Kolkata","01:00","09:00",10);
  assert.equal(x.businessDate,"2026-11-22");
  assert.equal(x.late,true);
 });
 test("late check-in after midnight belongs to the previous overnight shift date",()=>{
  const afterMidnight=new Date("2026-11-21T20:00:00.000Z"); // 01:30 in Asia/Kolkata
  const x=shiftCheckInAt(afterMidnight,"Asia/Kolkata","22:00","06:00",15);
  assert.equal(x.businessDate,"2026-11-21");
  assert.equal(x.late,true);
 });
 test("inside grace is present; outside grace is late",()=>{
  const start=new Date("2026-11-21T03:37:00.000Z"); // 09:07 in India
  assert.equal(shiftCheckInAt(start,"Asia/Kolkata","09:00","17:00",10).late,false);
  assert.equal(shiftCheckInAt(start,"Asia/Kolkata","09:00","17:00",5).late,true);
 });
 test("recorded minutes subtract break without producing negative work",()=>{
  const start=new Date("2026-11-21T03:30:00.000Z");
  const end=new Date("2026-11-21T11:30:00.000Z");
  assert.equal(verifiedWorkedMinutes(start,end,60),420);
  assert.equal(verifiedWorkedMinutes(start,new Date(start.getTime()+5*60000),30),0);
 });
 test("reversed, stale and corrupt checkout instants are rejected",()=>{
  const start=new Date("2026-11-21T11:30:00.000Z");
  assert.throws(()=>verifiedWorkedMinutes(start,new Date("2026-11-21T11:29:00.000Z"),0),
   ConflictException);
  assert.throws(()=>verifiedWorkedMinutes(start,new Date(start.getTime()+37*3600000),0),
   ConflictException);
  assert.throws(()=>verifiedWorkedMinutes(start,new Date(start.getTime()+3600000),-1),
   ConflictException);
 });
 test("outside current shift period never produces fabricated presence",()=>{
  assert.throws(()=>shiftCheckInAt(new Date("2026-11-21T13:00:00.000Z"),
   "Asia/Kolkata","09:00","17:00",10),ConflictException);
  assert.throws(()=>shiftCheckInAt(new Date("2026-11-21T09:00:00.000Z"),
   "Asia/Kolkata","22:00","06:00",10),ConflictException);
 });
});

describe("CG-10 leave rule source contract",()=>{
 const valid={requestKey:"c350419e-c3b2-4984-8e32-7483aca3a6ab",
  leaveType:"Annual leave",annualHalfDays:24,allowHalfDays:true,countWeeklyOff:false,effectiveFrom:"2027-01-01"};
 test("leave entitlement uses exact half-day units and normalized type",()=>{
  const r=leavePolicyInput({...valid,leaveType:" Annual   Leave "});
  assert.equal(r.typeKey,"annual leave");assert.equal(r.annualHalfDays,24);
  assert.equal(r.countWeeklyOff,false);
 });
 test("invalid entitlement, non-boolean rule and impossible date fail",()=>{
  for(const change of [{annualHalfDays:1.5},{annualHalfDays:0},{annualHalfDays:733},
   {annualHalfDays:3,allowHalfDays:false},{countWeeklyOff:"false"},{effectiveFrom:"2027-02-30"}])
   assert.throws(()=>leavePolicyInput({...valid,...change}));
 });
});

describe("CG-10 original employee leave request",()=>{
 const valid={requestKey:"c350419e-c3b2-4984-8e32-7483aca3a6ab",policyRef:"c350419e-c3b2-4984-8e32-7483aca3a6ac",
  startDate:"2026-11-21",endDate:"2026-11-23",halfDay:false,reason:"Personal leave"};
 test("weekly off counting follows the selected policy",()=>{
  assert.deepEqual(countedLeaveDates("2026-11-21","2026-11-23",[0],false),["2026-11-21","2026-11-23"]);
  assert.deepEqual(countedLeaveDates("2026-11-21","2026-11-23",[0],true),["2026-11-21","2026-11-22","2026-11-23"]);
 });
 test("half day is one date, and invalid year, range, hidden fields and private reason are rejected",()=>{
  assert.equal(parseLeaveRequest({...valid,endDate:valid.startDate,halfDay:true}).halfDay,true);
  for(const x of [{halfDay:true},{endDate:"2027-01-01"},{startDate:"2026-02-30"},{startDate:"2026-11-24"},
   {reason:" "},{employeeRef:"spoofed"},{halfDay:"true"}])assert.throws(()=>parseLeaveRequest({...valid,...x}));
 });
 test("no invented days for a weekly off-only request or impossible range",()=>{
  assert.deepEqual(countedLeaveDates("2026-11-22","2026-11-22",[0],false),[]);
  assert.throws(()=>countedLeaveDates("2026-12-31","2027-01-01",[],true));
  assert.throws(()=>countedLeaveDates("2026-11-23","2026-11-21",[],true));
 });
});

describe("CG-10 original attendance correction contract",()=>{
 const valid={requestKey:"c350419e-c3b2-4984-8e32-7483aca3a6ab",date:"2026-11-21",expectedVersion:1,result:"WORKED",checkInLocal:"2026-11-21T09:00",checkOutLocal:"2026-11-21T17:00",reason:"Incorrect recorded punch"};
 test("correction retains original version and local times",()=>{const r=parseAttendanceCorrection(valid);assert.equal(r.expectedVersion,1);assert.equal(r.checkInLocal,valid.checkInLocal);});
 test("rejects stale-shaped input, impossible times, fabricated scope and hidden fields",()=>{for(const patch of [{expectedVersion:0},{expectedVersion:"1"},{date:"2026-02-30"},{checkInLocal:"2026-11-21T25:00"},{employeeReference:"fake"},{status:"APPROVED"},{checkOutLocal:null}])assert.throws(()=>parseAttendanceCorrection({...valid,...patch}));});
 test("nonworked requests cannot carry fabricated punches",()=>{const r=parseAttendanceCorrection({...valid,result:"ABSENT",checkInLocal:null,checkOutLocal:null});assert.equal(r.checkInLocal,null);for(const value of [false,0,"2026-11-21T09:00"])assert.throws(()=>parseAttendanceCorrection({...valid,result:"ABSENT",checkInLocal:value,checkOutLocal:null}));});
});

describe("CG10 original leave withdrawal and filtered review",()=>{
 const key="c350419e-c3b2-4984-8e32-7483aca3a6ab";
 test("withdrawal accepts only the real business case reference and original request key",()=>{
  assert.deepEqual(parsePendingLeaveWithdrawal("CG-AP-123456",{requestKey:key}),{reference:"CG-AP-123456",requestKey:key});
  for(const [ref,body] of [["fake",{requestKey:key}],["CG-AP-123456",{requestKey:"fake"}],["CG-AP-123456",{requestKey:key,status:"APPROVED"}]])
   assert.throws(()=>parsePendingLeaveWithdrawal(ref,body));
 });
 test("date overlap and employee filters retain bounded normalized parameters",()=>{
  assert.deepEqual(parseLeaveReviewFilters("25","CANCELLED",{from:"2026-11-01",to:"2026-11-30",type:" Annual ",employee:" Alice "}),
   {offset:25,status:"CANCELLED",from:"2026-11-01",to:"2026-11-30",type:"annual",employee:"alice"});
 });
 test("reject reversed, impossible and malformed review filters",()=>{
  const invalid: Array<[unknown,unknown,{from?:unknown;to?:unknown;type?:unknown;employee?:unknown}]>=[[-1,"ALL",{}],[0,["ALL"],{}],[0,"ALL",{from:"2026-02-30"}],[0,"ALL",{from:"2026-12-01",to:"2026-11-01"}],[0,"ALL",{employee:"a".repeat(81)}],[0,"ALL",{type:["annual"]}]];
  for(const [offset,status,filters] of invalid)
   assert.throws(()=>parseLeaveReviewFilters(offset,status,filters));
 });
});
