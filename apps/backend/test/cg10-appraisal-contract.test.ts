import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {HrAppraisalService,parseAppraisalDraft,parseAppraisalUpdate,parseAppraisalTransition} from "../src/modules/cg-10-human-resources/application/hr-appraisal.service";
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

describe("CG10 B26 appraisal overview and read scope",()=>{
 test("one scoped summary and filtered 25-row page omit protected feedback",async()=>{
  const queries:{sql:string;params?:unknown[]}[]=[];
  const row={reference:"CG-HR-APR-000001",employee_code:"CG-HR-EMP-000001",employee_name:"Example",period_start:"2026-01-01",period_end:"2026-06-30",goal_delivery_score:80,competency_score:60,attendance_conduct_score:100,status:"SUBMITTED",revision:2};
  const summary={total:28,draft:1,submitted:26,released:1,averageScore:4.09,outstanding:1};
  const tx={query:async(sql:string,params?:unknown[])=>{queries.push({sql,params});return {rows:sql.includes("WITH targets AS")?[{page:Array.from({length:26},()=>row),summary}]:[]};},release:()=>{}};
  const service=Object.create(HrAppraisalService.prototype) as HrAppraisalService;
  Object.assign(service,{sessions:{requireAction:async()=>({realmId:"root",accountId:"reviewer"})},identity:{assertCurrent:async()=>{}},db:{connect:async()=>tx}});
  const result=await service.list("test",0,"SUBMITTED");
  assert.equal(result.items.length,25);assert.equal(result.hasMore,true);assert.equal(result.items[0].goal,80);
  assert.deepEqual(result.summary,summary);assert.ok(!("feedback_ciphertext" in result.items[0]));
  const sql=queries.filter(x=>x.sql.includes("WITH targets AS"));assert.equal(sql.length,1);
  assert.deepEqual(sql[0].params,["root","reviewer",0,"SUBMITTED"]);
  assert.match(sql[0].sql,/ar\.root_realm_id=\$1 AND ar\.reviewer_account_ref=\$2/);
  assert.match(sql[0].sql,/t\.assignment_id=ar\.assignment_id/);
  assert.match(sql[0].sql,/LIMIT 26 OFFSET \$3/);
  assert.doesNotMatch(sql[0].sql,/ar\.\*|feedback_ciphertext|feedback_nonce|feedback_tag/);
  await assert.rejects(service.list("test",0,"APPROVED"));
 });
 test("released own result reads only safe score columns",async()=>{
  const queries:string[]=[];
  const tx={query:async(sql:string)=>{queries.push(sql);return {rows:sql.includes("SELECT e.id FROM hr_employee")?[{id:"self"}]:sql.includes("FROM hr_appraisal WHERE")?[{reference:"CG-HR-APR-000001",period_start:"2026-01-01",period_end:"2026-06-30",goal_delivery_score:80,competency_score:60,attendance_conduct_score:100,status:"RELEASED"}]:[]};},release:()=>{}};
  const service=Object.create(HrAppraisalService.prototype) as HrAppraisalService;
  Object.assign(service,{sessions:{verifySession:async()=>({realmId:"root",accountId:"self-account"})},identity:{assertPatientSessionCurrent:async()=>{}},db:{connect:async()=>tx}});
  const result=await service.mine("test");
  assert.equal(result.linked,true);assert.equal(result.items[0].status,"RELEASED");assert.ok(!("reviewer_account_ref" in result.items[0]));
  const sql=queries.find(q=>q.includes("FROM hr_appraisal WHERE"))!;
  assert.match(sql,/status='RELEASED'/);assert.match(sql,/LIMIT 50/);
  assert.doesNotMatch(sql,/SELECT \*|feedback_|request_key|reviewer_account_ref/);
 });
});
