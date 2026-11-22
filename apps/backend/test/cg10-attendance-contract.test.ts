import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ConflictException} from "@nestjs/common";
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
