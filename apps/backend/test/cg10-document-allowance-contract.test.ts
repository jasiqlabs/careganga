import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException,ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../src/modules/cg-01-identity-access/public-api";
import {parseFinanceClaimDraft,allowancePurpose} from "../src/modules/cg-09-finance-accounting/application/finance-expense-claim.service";
import {currentHrAllowanceOrigin,assertOwnClaimOrigin,assertHrAllowanceOrigin} from "../src/modules/cg-10-human-resources/application/hr-allowance-origin";
import {hrTemplateHash,hrLetterBlocks} from "../src/modules/cg-19-documents-notifications/application/hr-document-renderer";
const requestKey="22222222-2222-4222-8222-222222222222";
const draft={requestKey,purpose:"Business travel",category:"Travel",expenseDate:"2026-11-21",amount:"125.50"};
const actor={realmId:"realm",accountId:"account"} as VerifiedFoundationActor;
const origin={hr_employee_id:"employee",hr_assignment_id:"assignment",hr_branch_id:"branch"};
describe("CG10 original finance claim and private document source contracts",()=>{
 test("general default unchanged; HR amount uses integer minor units",()=>{
  assert.equal(parseFinanceClaimDraft(draft).sourceKind,"GENERAL");
  const v=parseFinanceClaimDraft({...draft,sourceKind:"HR_ALLOWANCE"});assert.equal(v.amountMinor,"12550");assert.equal(v.sourceKind,"HR_ALLOWANCE");
 });
 test("claim draft rejects caller-supplied employee/branch, approval, payment and currency",()=>{
  for(const field of ["employeeRef","branchRef","status","paid","currency"])
   assert.throws(()=>parseFinanceClaimDraft({...draft,[field]:"fake"}),BadRequestException);
  assert.throws(()=>parseFinanceClaimDraft({...draft,sourceKind:"PAYROLL"}),BadRequestException);
 });
 test("B51 description is canonical in the original purpose, not a second amount",()=>{
  assert.equal(allowancePurpose("Travel","Bus and metro"),"Travel | Breakdown: Bus and metro");
  assert.equal(parseFinanceClaimDraft({...draft,sourceKind:"HR_ALLOWANCE",breakdown:"Bus and metro"}).purpose,"Business travel | Breakdown: Bus and metro");
  assert.throws(()=>parseFinanceClaimDraft({...draft,breakdown:"not HR"}),BadRequestException);
  assert.throws(()=>allowancePurpose("Travel","x".repeat(301)),BadRequestException);
 });
 test("claim draft rejects invalid amount and overflow date",()=>{
  for(const amount of ["0","-1","1.001","NaN","9999999999999"])
   assert.throws(()=>parseFinanceClaimDraft({...draft,amount}),BadRequestException);
  assert.throws(()=>parseFinanceClaimDraft({...draft,expenseDate:"2026-02-30"}),BadRequestException);
 });
 test("eligibility selects exactly one current scoped employment",async()=>{
  const tx={query:async(sql:string,params:unknown[])=>{assert.match(sql,/e\.account_ref=\$2/);assert.match(sql,/FOR SHARE OF e,p,a,b,ac/);assert.deepEqual(params,["realm","account"]);return {rows:[origin]};}} as unknown as PoolClient;
  assert.deepEqual(await currentHrAllowanceOrigin(tx,actor),origin);
 });
 test("changed assignment cannot mutate pinned allowance",async()=>{
  const tx={query:async()=>({rows:[origin]})} as unknown as PoolClient;
  await assert.rejects(()=>assertHrAllowanceOrigin(tx,actor,{...origin,source_kind:"HR_ALLOWANCE",hr_assignment_id:"old"}),ConflictException);
 });
 test("missing claimant rejected under exclusive mutation lock",async()=>{
  const tx={query:async(sql:string,params:unknown[])=>{assert.match(sql,/requested_by=\$3 FOR UPDATE/);assert.deepEqual(params,["realm","claim","account"]);return {rows:[]};}} as unknown as PoolClient;
  await assert.rejects(()=>assertOwnClaimOrigin(tx,actor,"claim",true),ConflictException);
 });
 test("letter formatting is line-based and plain text is preserved",()=>{
  assert.deepEqual(hrLetterBlocks("# Conditions\n- Joining details\nPlain content\n"),[
   {kind:"heading",text:"Conditions"},{kind:"bullet",text:"Joining details"},{kind:"paragraph",text:"Plain content"},{kind:"paragraph",text:""}]);
  assert.deepEqual(hrLetterBlocks("Text # inside\n-"),[{kind:"paragraph",text:"Text # inside"},{kind:"paragraph",text:"-"}]);
 });
 test("signatory and exact asset version digests change template proof without changing legacy hash",()=>{
  const old=hrTemplateHash("APPOINTMENT","Title","Body");
  assert.equal(old,hrTemplateHash("APPOINTMENT","Title","Body"));
  const assets={signatoryName:"Authorized signer",signatureSha256:"a".repeat(64),sealSha256:"b".repeat(64)};
  const v2=hrTemplateHash("APPOINTMENT","Title","Body",assets);
  assert.notEqual(v2,old);assert.notEqual(v2,hrTemplateHash("APPOINTMENT","Title","Body",{...assets,sealSha256:"c".repeat(64)}));
 });
});
