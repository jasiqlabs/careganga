import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {
 parseSafeReport,suppressAppointmentCells
} from "../src/modules/cg-20-mis-reporting/application/mis-report-source.service";
import {
 zonedLocalDate,nextScheduleOccurrence
} from "../src/modules/cg-20-mis-reporting/application/mis-report-schedule.service";

/** CG-20 original US-002/003/005 deterministic contract tests.
 * These tests perform no network, database, external API, provider send or
 * privileged background task. Integration and scoped role tests require a
 * separate verified disposable PostgreSQL environment.
 */
describe("CG-20 — guarded server report request contracts",()=>{
 test("CG09 typed original source accepts supported view/group/sort",()=>{
  const p=parseSafeReport({
   kind:"FINANCE_POSTED_GROUPED",view:"PIVOT",groupBy:"CATEGORY",
   sortBy:"DEBIT",sortDirection:"DESC",offset:0
  });
  assert.equal(p.groupBy,"CATEGORY");
  assert.equal(p.sortBy,"DEBIT");
  assert.equal(p.sortDirection,"DESC");
  assert.equal(p.view,"PIVOT");
  assert.equal(p.offset,0);
 });
 test("CG09 rejects arbitrary group names, SQL and unexpected joins",()=>{
  for(const x of [
   {kind:"FINANCE_POSTED_GROUPED",view:"PIVOT",groupBy:"category; DROP TABLE journal"},
   {kind:"FINANCE_POSTED_GROUPED",view:"TABLE",join:"patient"},
   {kind:"FINANCE_POSTED_GROUPED",view:"SUMMARY",sortBy:"SUM(money)"},
   {kind:"FINANCE_POSTED_GROUPED",view:"CHART",sortDirection:"DESC;--"},
   {kind:"FINANCE_POSTED_GROUPED",view:"PIVOT",offset:500}
  ])assert.throws(()=>parseSafeReport(x),BadRequestException);
 });
 test("current-only CG16 denies historical dates and cross-owner filters",()=>{
  assert.equal(parseSafeReport({
   kind:"DIAGNOSTICS_CATALOG_SUMMARY",view:"SUMMARY"
  }).kind,"DIAGNOSTICS_CATALOG_SUMMARY");
  for(const x of [
   {fromDay:"2026-10-01",untilDay:"2026-10-31"},
   {status:"COMPLETED"},
   {branchRef:"22222222-2222-4222-8222-222222222222"},
   {view:"PIVOT"}
  ]){
   const options={kind:"DIAGNOSTICS_CATALOG_SUMMARY",view:"SUMMARY",...x};
   assert.throws(()=>parseSafeReport(options),BadRequestException);
  }
 });
 test("CG06 live beneficiary report rejects unrelated filters and unsupported views",()=>{
  const kind="BENEFICIARY_ASSISTANCE_SUMMARY";
  assert.equal(parseSafeReport({kind,view:"SUMMARY"}).kind,kind);
  for(const filter of [{branchRef:"22222222-2222-4222-8222-222222222222"},{centerRef:"22222222-2222-4222-8222-222222222222"},{fromDay:"2026-10-01",untilDay:"2026-10-31"},{status:"COMPLETED"},{view:"TABLE"},{offset:50}])
   assert.throws(()=>parseSafeReport({kind,view:"SUMMARY",...filter}),BadRequestException);
 });
 test("CG04, CG07 and CG11 live reports accept only current summary scope",()=>{
  for(const kind of ["MEMBERSHIP_ROSTER_SUMMARY","VOLUNTEER_ROSTER_SUMMARY","DONATION_RECEIPT_SUMMARY"]){
   assert.equal(parseSafeReport({kind,view:"SUMMARY"}).kind,kind);
   for(const filter of [{branchRef:"22222222-2222-4222-8222-222222222222"},{centerRef:"22222222-2222-4222-8222-222222222222"},{fromDay:"2026-10-01",untilDay:"2026-10-31"},{status:"COMPLETED"},{view:"TABLE"},{offset:50}])
    assert.throws(()=>parseSafeReport({kind,view:"SUMMARY",...filter}),BadRequestException);
  }
 });
 test("CG11 payroll accepts only original month and branch filters",()=>{
  const kind="PAYROLL_STATUS_SUMMARY",view="SUMMARY",branchRef="22222222-2222-4222-8222-222222222222";
  assert.equal(parseSafeReport({kind,view,payrollMonth:"2026-10",branchRef}).branchRef,branchRef);
  assert.equal(parseSafeReport({kind,view,payrollMonth:"2026-10",branchRef:"FOUNDATION"}).payrollMonth,"2026-10");
  for(const filter of [{payrollMonth:"2026-13"},{payrollMonth:"1999-01"},{branchRef:"other"},{centerRef:branchRef},{yearRef:branchRef},{fromDay:"2026-10-01",untilDay:"2026-10-31"}])assert.throws(()=>parseSafeReport({kind,view,...filter}),BadRequestException);
  assert.throws(()=>parseSafeReport({kind:"BENEFICIARY_ASSISTANCE_SUMMARY",view,payrollMonth:"2026-10"}),BadRequestException);
 });
 test("CG08 CSR summary accepts bounded proposal update dates only",()=>{
  const kind="CSR_FUNDING_SUMMARY",view="SUMMARY";
  const q=parseSafeReport({kind,view,fromDay:"2026-10-01",untilDay:"2026-10-31"});
  assert.equal(q.fromDay,"2026-10-01");assert.equal(q.untilDay,"2026-10-31");
  for(const filter of [{branchRef:"22222222-2222-4222-8222-222222222222"},{centerRef:"22222222-2222-4222-8222-222222222222"},{fromDay:"2026-10-01"},{fromDay:"2025-01-01",untilDay:"2026-10-31"},{status:"COMPLETED"},{view:"TABLE"},{offset:50}])
   assert.throws(()=>parseSafeReport({kind,view,...filter}),BadRequestException);
 });
 test("CG21 original audit accepts 90-day bounded original safe window only",()=>{
  const value=parseSafeReport({
   kind:"PLATFORM_AUDIT_ACTIVITY",view:"TABLE",
   fromDay:"2026-11-01",untilDay:"2026-11-21"
  });
  assert.equal(value.fromDay,"2026-11-01");
  for(const x of [
   {fromDay:"2026-01-01",untilDay:"2026-06-01"},
   {fromDay:"2026-11-20"},
   {centerRef:"22222222-2222-4222-8222-222222222222"},
   {view:"CHART"}
  ]){
   assert.throws(()=>parseSafeReport({
    kind:"PLATFORM_AUDIT_ACTIVITY",view:"TABLE",...x
   }),BadRequestException);
  }
 });
 test("CG15 appointment report accepts verified center syntax but not finance fields",()=>{
  const v=parseSafeReport({
   kind:"APPOINTMENT_STATUS",view:"CHART",
   centerRef:"22222222-2222-4222-8222-222222222222",
   status:"COMPLETED",fromDay:"2026-10-01",untilDay:"2026-10-31"
  });
  assert.equal(v.status,"COMPLETED");
  assert.throws(()=>parseSafeReport({
   ...v,branchRef:"33333333-3333-4333-8333-333333333333"
  }),BadRequestException);
 });
 test("CG15 groups are available only through privacy-safe summary/table/chart",()=>{
  const table=parseSafeReport({
   kind:"APPOINTMENT_STATUS_GROUPED",view:"TABLE",
   centerRef:"22222222-2222-4222-8222-222222222222"
  });
  assert.equal(table.kind,"APPOINTMENT_STATUS_GROUPED");
  assert.equal(parseSafeReport({
   kind:"APPOINTMENT_STATUS_GROUPED",view:"CHART"
  }).view,"CHART");
  assert.throws(()=>parseSafeReport({
   kind:"APPOINTMENT_STATUS_GROUPED",view:"PIVOT"
  }),BadRequestException);
 });
 test("CG15 suppression covers total and disclosive status remainder",()=>{
  assert.equal(suppressAppointmentCells({
   bookings:"4",completed:"4",waiting:"0",cancelled:"0"
  }),true);
  assert.equal(suppressAppointmentCells({
   bookings:"9",completed:"5",waiting:"4",cancelled:"0"
  }),true);
  assert.equal(suppressAppointmentCells({
   bookings:"10",completed:"5",waiting:"5",cancelled:"0"
  }),false);
  assert.equal(suppressAppointmentCells({
   bookings:"0",completed:"0",waiting:"0",cancelled:"0"
  }),false);
  assert.equal(suppressAppointmentCells({
   bookings:"5",completed:"6",waiting:"0",cancelled:"0"
  }),true);
 });
 test("unknown owner, arbitrary extra column or unsafe page denied before DB",()=>{
  for(const request of [
   {kind:"FUTURE_CG05",view:"TABLE"},
   {kind:"FINANCE_POSTED_LEDGER",view:"TABLE",offset:49},
   {kind:"FINANCE_POSTED_LEDGER",view:"TABLE",offset:550},
   {kind:"FINANCE_POSTED_LEDGER",view:"TABLE",rawSql:"SELECT * FROM patient"},
   {kind:"FINANCE_POSTED_LEDGER",view:"CHART"}
  ])assert.throws(()=>parseSafeReport(request),BadRequestException);
 });
});
describe("CG-20 — IANA local calendar and bounded recurrence",()=>{
 test("CG20 India local 09:00 converts to actual UTC, no fixed browser offset",()=>{
  assert.equal(
   zonedLocalDate("2026-11-22","09:00","Asia/Kolkata").toISOString(),
   "2026-11-22T03:30:00.000Z");
 });
 test("CG20 spring-forward nonexistent local time is rejected",()=>{
  assert.throws(
   ()=>zonedLocalDate("2026-03-08","02:30","America/New_York"),
   BadRequestException);
 });
 test("CG20 autumn repeat chooses a real matching local 01:30",()=>{
  const date=zonedLocalDate("2026-11-01","01:30","America/New_York");
  const fmt=new Intl.DateTimeFormat("en-CA",{
   timeZone:"America/New_York",year:"numeric",month:"2-digit",
   day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  });
  const items=Object.fromEntries(fmt.formatToParts(date).map(x=>[x.type,x.value]));
  assert.equal(items.year,"2026");
  assert.equal(items.month,"11");
  assert.equal(items.day,"01");
  assert.equal(items.hour,"01");
  assert.equal(items.minute,"30");
 });
 test("CG20 next DAILY occurrence keeps the same wall time across 23-hour DST day",()=>{
  const next=nextScheduleOccurrence({
   cadence:"DAILY",timezone:"America/New_York",
   local_time:"09:00:00",weekday:null,monthday:null,annual_month:null
  },new Date("2026-03-07T14:00:00.000Z"));
  assert.equal(next.toISOString(),"2026-03-08T13:00:00.000Z");
 });
 test("CG20 monthly and yearly schedule never invents day 29/30/31",()=>{
  const next=nextScheduleOccurrence({
   cadence:"MONTHLY",timezone:"Asia/Kolkata",
   local_time:"09:00:00",weekday:null,monthday:28,annual_month:null
  },new Date("2026-11-21T03:30:00.000Z"));
  assert.equal(next.toISOString(),"2026-11-28T03:30:00.000Z");
  const yearly=nextScheduleOccurrence({
   cadence:"YEARLY",timezone:"Asia/Kolkata",
   local_time:"09:00:00",weekday:null,monthday:28,annual_month:1
  },new Date("2026-11-21T03:30:00.000Z"));
  assert.equal(yearly.toISOString(),"2027-01-28T03:30:00.000Z");
 });
});
