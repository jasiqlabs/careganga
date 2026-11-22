import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {parseAppraisalDraft,parseAppraisalUpdate,parseAppraisalTransition} from "../src/modules/cg-10-human-resources/application/hr-appraisal.service";
const requestKey="33333333-3333-4333-8333-333333333333";
const form={requestKey,employeeReference:"CG-HR-EMP-000001",periodStart:"2026-01-01",periodEnd:"2026-06-30",
 goal:0,competency:70,attendance:100,strengths:"Teamwork",improvement:"Planning"};
const update={requestKey,expectedRevision:1,goal:100,competency:25,attendance:50,strengths:"",improvement:""};
describe("CG10 US003 appraisal contract",()=>{
 test("accepts independent component scores and exact employee period without inventing weights",()=>{
  const p=parseAppraisalDraft(form);assert.equal(p.goal,0);assert.equal(p.competency,70);assert.equal(p.attendance,100);
  assert.equal(p.employeeReference,form.employeeReference);assert.ok(!("overall" in p));assert.ok(!("status" in p));
 });
 test("rejects spoofed root, reviewer and approval fields",()=>{
  for(const key of ["rootRealmId","reviewerRef","status","overall","approval","employeeId","salary"])
   assert.throws(()=>parseAppraisalDraft({...form,[key]:"fake"}));
 });
 test("rejects invalid periods or employee references",()=>{
  for(const v of [{periodStart:"2026-07-01"},{periodEnd:"2026-02-30"},{employeeReference:"fake"},{requestKey:"invalid"}])
   assert.throws(()=>parseAppraisalDraft({...form,...v}));
 });
 test("rejects out-of-range, fractional, nonnumeric and forged scores",()=>{
  for(const v of [-1,101,1.5,"50",null,NaN])assert.throws(()=>parseAppraisalDraft({...form,goal:v}));
 });
 test("protects note length and controls",()=>{
  for(const v of ["x".repeat(1001),"bad\u0000note",["note"]])assert.throws(()=>parseAppraisalDraft({...form,strengths:v}));
  assert.equal(parseAppraisalDraft({...form,strengths:"  good  "}).strengths,"good");
 });
 test("draft changes require current revision and cannot change period or subject",()=>{
  assert.equal(parseAppraisalUpdate(update).expectedRevision,1);
  for(const v of [0,-1,1.5,"1",null])assert.throws(()=>parseAppraisalUpdate({...update,expectedRevision:v}));
  for(const field of ["employeeReference","periodStart","periodEnd","status"])assert.throws(()=>parseAppraisalUpdate({...update,[field]:"fake"}));
 });
 test("submit and release accept only an exact command key and current revision",()=>{
  assert.deepEqual(parseAppraisalTransition({requestKey,expectedRevision:2}),{requestKey,expectedRevision:2});
  for(const v of [{requestKey,expectedRevision:0},{requestKey,expectedRevision:2,goal:100},{requestKey:"bad",expectedRevision:2}])
   assert.throws(()=>parseAppraisalTransition(v));
 });
});
