import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {parseHrDraft} from "../src/modules/cg-10-human-resources/application/hr-enrollment.service";

/** CG-10 US-001: executable, pure DTO contract tests.
 * Does not assert SQL migrations, CG03 approval, CG19 evidence or live Web/native QA.
 */
const id="22222222-2222-4222-8222-222222222222";
const base=()=>({requestKey:id,name:"Amina Rahman",designation:"Field Coordinator",
 employmentType:"FULL_TIME",branchRef:id,departmentRef:null,
 hireDate:"2026-11-21",accountRef:null,managerRef:null,roleRef:null});
describe("CG-10 employee draft validation",()=>{
 test("minimum trusted employee draft accepts no fake salary, role or approval flags",()=>{
  const value=parseHrDraft(base());
  assert.equal(value.name,"Amina Rahman");
  assert.equal(value.employmentType,"FULL_TIME");
  assert.equal(value.accountRef,null);
  assert.equal(value.roleRef,null);
  assert.equal(value.managerRef,null);
  assert.ok(!("employeeStatus" in value));
 });
 test("all employee types are explicitly allowlisted",()=>{
  for(const kind of ["FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"])
   assert.equal(parseHrDraft({...base(),employmentType:kind}).employmentType,kind);
  for(const kind of ["SUPER_ADMIN","ROOT","FULL_TIME; DROP TABLE hr_employee",""])
   assert.throws(()=>parseHrDraft({...base(),employmentType:kind}),BadRequestException);
 });
 test("rejects fake approval, bank, admin or arbitrary fields",()=>{
  for(const unexpected of ["status","permissions","salary",
    "bankAccount","cg03Approved","employeeRef","actorRef","rootRealmId"]){
   assert.throws(()=>parseHrDraft({...base(),[unexpected]:"test"}),BadRequestException);
  }
 });
 test("real manager and CG01 role ID remain proposals, not permissions",()=>{
  const value=parseHrDraft({...base(),managerRef:id,roleRef:id});
  assert.equal(value.managerRef,id);
  assert.equal(value.roleRef,id);
  assert.ok(!("permissions" in value));
  assert.ok(!("grantAccess" in value));
 });
 test("rejects invalid dates including overflow days and unsafe input",()=>{
  for(const hireDate of ["2026-02-30","2026-13-01","2026-00-01",
   "2026-11-32","2026-11-21T00:00:00Z","2026-11-21; SELECT 1",""])
   assert.throws(()=>parseHrDraft({...base(),hireDate}),BadRequestException);
 });
 test("request, branch, department and existing account identifiers are validated",()=>{
  for(const field of ["requestKey","branchRef","departmentRef","accountRef","managerRef","roleRef"])
   assert.throws(()=>parseHrDraft({...base(),[field]:"foreign"}),BadRequestException);
 });
 test("source name and designation reject blank, controls and huge payload",()=>{
  for(const name of ["","x","\u0000Eve","a".repeat(161)])
   assert.throws(()=>parseHrDraft({...base(),name}),BadRequestException);
  for(const designation of ["","x","Chief\u0007Officer","a".repeat(121)])
   assert.throws(()=>parseHrDraft({...base(),designation}),BadRequestException);
 });
 test("update requires expected revision; create forbids injecting it",()=>{
  const x=parseHrDraft({...base(),expectedRevision:2},true);
  assert.equal(x.expectedRevision,2);
  assert.throws(()=>parseHrDraft({...base(),expectedRevision:2}),BadRequestException);
  for(const expectedRevision of [0,-1,1.2,"1",undefined,null])
   assert.throws(()=>parseHrDraft({...base(),expectedRevision},true),BadRequestException);
 });
 test("normalizes whitespace without silently adding login or privileges",()=>{
  const x=parseHrDraft({...base(),name:"  Amina   Rahman  ",designation:"  Field   Coordinator  "});
  assert.equal(x.name,"Amina Rahman");
  assert.equal(x.designation,"Field Coordinator");
  assert.equal(x.accountRef,null);
 });
});
