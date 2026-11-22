import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException,ConflictException} from "@nestjs/common";
import {HrEnrollmentSourceFacade,sourceHash} from "../src/modules/cg-10-human-resources/application/hr-enrollment-source.facade";
import {HrEnrollmentService,parseHrDraft} from "../src/modules/cg-10-human-resources/application/hr-enrollment.service";

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
 test("department selection produces a balanced real linked-branch query",async()=>{
  const calls:string[]=[];
  // Source-only regression: exercise the production branch/dept validation path
  // with a minimal transaction fake. PostgreSQL execution remains NOT_RUN.
  const service=Object.create(HrEnrollmentService.prototype) as {
   branch:(tx:unknown,actor:unknown,ref:string)=>Promise<unknown>;
   validSource:(tx:unknown,actor:unknown,fields:unknown)=>Promise<void>;
  };
  service.branch=async()=>({name:"Active Foundation Branch"});
  const fakeTx={query:async(sql:string)=>{
   calls.push(sql);
   return {rowCount:1,rows:[{id}]};
  }};
  await service.validSource(fakeTx,{realmId:id,accountId:id},
    parseHrDraft({...base(),departmentRef:id}));
  assert.equal(calls.length,1);
  const sql=calls[0];
  assert.match(sql,/link\.ended_at IS NULL\)\)\) FOR SHARE$/);
  assert.equal([...sql].filter(x=>x==="(").length,
    [...sql].filter(x=>x===")").length,
    "unclosed SQL grouping must not block normal employee enrollment");
 });
 test("both real HR department pickers share syntactically balanced linked-branch SQL",async()=>{
  const actor={realmId:id,accountId:id};
  const observed:string[]=[];
  const tx={query:async(sql:string)=>{
    observed.push(sql);
    return {rowCount:1,rows:[{id,name:"Field Operations"}]};
  },release:()=>{}};
  const service=Object.create(HrEnrollmentService.prototype) as {
    branch:(tx:unknown,actor:unknown,ref:string)=>Promise<unknown>;
    actor:(token:string,capability:string)=>Promise<unknown>;
    sessions:{requireAction:(token:string,capability:string)=>Promise<unknown>};
    db:{connect:()=>Promise<unknown>};
    departmentOptions:(token:string,ref:string)=>Promise<{items:Array<{departmentRef:string}>}>;
    employeeDepartmentOptions:(token:string,ref:string)=>Promise<{items:Array<{departmentRef:string}>}>;
  };
  service.branch=async()=>({name:"Active Foundation Branch"});
  service.actor=async()=>actor;
  service.sessions={requireAction:async()=>actor};
  service.db={connect:async()=>tx};
  const form=await service.departmentOptions("internal-session",id);
  const directory=await service.employeeDepartmentOptions("internal-session",id);
  assert.equal(form.items[0]?.departmentRef,id);
  assert.equal(directory.items[0]?.departmentRef,id);
  assert.equal(observed.length,2);
  for(const sql of observed){
    assert.match(sql,/link\.ended_at IS NULL\)\)\) ORDER BY/);
    assert.equal([...sql].filter(x=>x==="(").length,
      [...sql].filter(x=>x===")").length);
  }
 });
 test("normalizes whitespace without silently adding login or privileges",()=>{
  const x=parseHrDraft({...base(),name:"  Amina   Rahman  ",designation:"  Field   Coordinator  "});
  assert.equal(x.name,"Amina Rahman");
  assert.equal(x.designation,"Field Coordinator");
  assert.equal(x.accountRef,null);
 });
});

describe("CG-10 B20 scoped dashboard",()=>{
 test("department and joining counts use the same scoped staff source without exposing employee IDs",async()=>{
  const observed:{sql:string;params?:unknown[]}[]=[];
  const tx={query:async(sql:string,params?:unknown[])=>{
   observed.push({sql,params});
   return {rows:sql.includes("WITH scoped AS")?[{status:"ACTIVE",quantity:"2",new_joiners:"1",on_leave:"0",pending_leave:"0",departments:[{label:"Operations",count:2}],joiners:[{month:"2026-11",count:1}]}]:[]};
  },release:()=>{}};
  const service=Object.create(HrEnrollmentService.prototype) as HrEnrollmentService;
  Object.assign(service,{sessions:{requireAction:async()=>({realmId:id,accountId:id})},identity:{assertCurrent:async()=>{}},db:{connect:async()=>tx}});
  const result=await service.employeeSummary("test");
  const query=observed.find(x=>x.sql.includes("WITH scoped AS"))!;
  assert.deepEqual(query.params,[id,id,true]);
  assert.match(query.sql,/WHERE e\.root_realm_id=\$1 AND \(b\.manager_account_ref=\$2/);
  assert.match(query.sql,/dep\.root_realm_id=e\.root_realm_id/);
  assert.match(query.sql,/FROM scoped WHERE current_assignment AND status IN\('ACTIVE','PROBATION'\)/);
  assert.match(query.sql,/rank<=10/);
  assert.deepEqual(result.departments,[{label:"Operations",count:2}]);
  assert.deepEqual(result.joiners,[{month:"2026-11",count:1}]);
  assert.equal(result.total,2);
 });
});

describe("CG-10 original enrollment source integrity",()=>{
 test("current frozen approval asserts ciphertext version and digest without reading private plaintext",async()=>{
  const digest="a".repeat(64),snapshot={id,root_realm_id:id,revision_no:1,private_record_version:2,private_payload_digest:digest};
  const row={application_id:id,root_realm_id:id,revision_no:1,source_digest:sourceHash(snapshot),submitted_by:id,private_file_versions:[],source_snapshot:snapshot,app_state:"SUBMITTED",app_revision_no:1};
  const service=Object.create(HrEnrollmentSourceFacade.prototype) as HrEnrollmentSourceFacade;
  const sql:string[]=[];let privateDigest=digest;
  const tx={query:async(q:string)=>{
   sql.push(q);
   return {rows:q.includes("FROM hr_application_private")?[{record_version:2,payload_digest:privateDigest}]:[row]};
  }} as unknown as Parameters<HrEnrollmentSourceFacade["frozen"]>[0];
  await service.frozen(tx,id,id,1,row.source_digest);
  assert.ok(sql.some(q=>q.includes("SELECT record_version,payload_digest")&&q.includes("FOR SHARE")));
  assert.ok(sql.every(q=>!q.includes("payload_ciphertext")));
  privateDigest="b".repeat(64);
  await assert.rejects(service.frozen(tx,id,id,1,row.source_digest),ConflictException);
  // Historical inspection does not confuse a later authorized correction with the old snapshot.
  await service.frozen(tx,id,id,1,row.source_digest,false);
 });
 test("same submitted key cannot replay a different document set",async()=>{
  const initial={fileRef:id,fileVersion:1,classification:"HR_IDENTITY_PROOF"};
  const app={id,cg03_case_ref:id};
  const tx={query:async(q:string)=>({rows:q.startsWith("SELECT * FROM hr_employee_application")?[app]:q.includes("FROM cg03_case c")?[{id,case_number:"CG-AP-000001",request_key:id,hr_revision_no:1,status:"SUBMITTED",private_file_versions:[initial]}]:[]}),release:()=>{}};
  const service=Object.create(HrEnrollmentService.prototype) as HrEnrollmentService;
  Object.assign(service,{sessions:{requireAction:async()=>({realmId:id,accountId:id})},db:{connect:async()=>tx},source:{draft:async()=>app}});
  assert.equal((await service.submit("test",id,{requestKey:id,expectedRevision:1,files:[initial]})).replayed,true);
  await assert.rejects(service.submit("test",id,{requestKey:id,expectedRevision:1,files:[{...initial,fileVersion:2}]}),ConflictException);
 });
});
