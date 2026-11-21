import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ConflictException} from "@nestjs/common";
import {shiftCheckInAt} from "../src/modules/cg-10-human-resources/application/hr-attendance.service";

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
 test("outside current shift period never produces fabricated presence",()=>{
  assert.throws(()=>shiftCheckInAt(new Date("2026-11-21T13:00:00.000Z"),
   "Asia/Kolkata","09:00","17:00",10),ConflictException);
  assert.throws(()=>shiftCheckInAt(new Date("2026-11-21T09:00:00.000Z"),
   "Asia/Kolkata","22:00","06:00",10),ConflictException);
 });
});
