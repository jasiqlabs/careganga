import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException,ForbiddenException} from "@nestjs/common";
import {ReferralSelfService} from "../src/modules/cg-13-referrals-rewards/application/referral-self.service";

const ROOT="11111111-1111-4111-8111-111111111111";
const ACCOUNT="22222222-2222-4222-8222-222222222222";
const PROGRAMME="33333333-3333-4333-8333-333333333333";
const MEMBER="44444444-4444-4444-8444-444444444444";
const VOLUNTEER="55555555-5555-4555-8555-555555555555";
const OTHER="66666666-6666-4666-8666-666666666666";
const actor={realmId:ROOT,accountId:ACCOUNT,
 activeSessionId:"77777777-7777-4777-8777-777777777777"};
type Trace={sql:string;params:unknown[]};
function setup({member=true,volunteer=false,programActive=true,
 audience="BOTH" as "BOTH"|"MEMBER"|"VOLUNTEER",
 qualifyingEvent="MEMBERSHIP_ACTIVATED_VERIFIED" as
  "MEMBERSHIP_ACTIVATED_VERIFIED"|"VOLUNTEER_APPROVED_ACTIVE"}={}){
 const traces:Trace[]=[];
 let code="",connected=0,commits=0,rollbacks=0;
 const client={
  query:async(sql:string,params:unknown[]=[])=>{
   traces.push({sql,params});
   if(sql.startsWith("SELECT m.id AS ref FROM member m"))
    return {rows:member?[{ref:MEMBER}]:[]};
   if(sql.startsWith("SELECT v.id AS ref FROM volunteer v"))
    return {rows:volunteer?[{ref:VOLUNTEER}]:[]};
   if(sql.includes("ORDER BY p.display_name,p.id LIMIT"))
    return {rows:programActive?[{ref:PROGRAMME,name:"Community invitations",audience}]:[]};
   if(sql.includes("SELECT p.id AS ref,p.display_name AS name FROM referral_program p"))
    return {rows:programActive?[{ref:PROGRAMME,name:"Community invitations",qualifyingEvent}]:[]};
   if(sql.startsWith("INSERT INTO referral_code(")){
    if(!code)code=params[5] as string;
    return {rowCount:code?1:0,rows:[]};
   }
   if(sql.startsWith("SELECT code_value AS code"))
    return {rows:code?[{code}]:[]};
   if(sql==="COMMIT")commits++;
   if(sql==="ROLLBACK")rollbacks++;
   return {rows:[],rowCount:1};
  },
  release:()=>{}
 };
 const db={connect:async()=>{connected++;return client;}};
 const sessions={verifySession:async()=>actor};
 const identity={assertRootSelfSessionCurrent:async()=>undefined};
 const service=new ReferralSelfService(db as never,sessions as never,identity as never);
 return {service,traces,stats:()=>({connected,commits,rollbacks}),code:()=>code};
}
describe("CG13 US002 active CG04 own opaque referral code contracts (NOT live DB)",()=>{
 test("current member only obtains applicable named programme choices",async()=>{
  const f=setup({member:true,volunteer:false});
  const x=await f.service.options("own-community-session","1");
  assert.deepEqual(x.items,[{programmeRef:PROGRAMME,
   programmeName:"Community invitations",relationship:"MEMBER"}]);
  assert.deepEqual(f.stats(),{connected:1,commits:1,rollbacks:0});
  const member=f.traces.find(t=>t.sql.startsWith("SELECT m.id AS ref FROM member m"));
  assert.ok(member);
  assert.deepEqual(member.params,[ROOT,ACCOUNT]);
  assert.match(member.sql,/term\.expires_on IS NULL/);
  assert.match(member.sql,/m\.status='ACTIVE'/);
  assert.match(member.sql,/b\.status='ACTIVE'/);
  const volunteer=f.traces.find(t=>t.sql.startsWith("SELECT v.id AS ref FROM volunteer v"));
  assert.ok(volunteer);
  assert.match(volunteer.sql,/cg04_current_volunteer/);
 });
 test("volunteer without membership receives only current volunteer code option",async()=>{
  const f=setup({member:false,volunteer:true,audience:"VOLUNTEER"});
  const x=await f.service.options("own-community-session");
  assert.deepEqual(x.items.map(i=>i.relationship),["VOLUNTEER"]);
  assert.ok(!x.items.some(i=>i.relationship==="MEMBER"));
 });
 test("one verified dual relationship preserves distinct programme choices",async()=>{
  const f=setup({member:true,volunteer:true});
  const x=await f.service.options("own-community-session");
  assert.deepEqual(x.items.map(i=>i.relationship),["MEMBER","VOLUNTEER"]);
 });
 test("repeat issue for same member-programme returns original opaque code",async()=>{
  const f=setup({member:true});
  const first=await f.service.myCode("own-community-session",PROGRAMME,"MEMBER");
  const second=await f.service.myCode("own-community-session",PROGRAMME,"MEMBER");
  assert.equal(first.code,second.code);
  assert.match(first.code,/^[A-Za-z0-9_-]{32}$/);
  assert.equal(first.sharePath,"/membership?ref="+first.code);
  assert.match(first.notice,/independent verification/);
  const insertion=f.traces.find(t=>t.sql.startsWith("INSERT INTO referral_code"));
  assert.ok(insertion);
  assert.deepEqual(insertion.params.slice(0,5),[ROOT,PROGRAMME,"MEMBER",MEMBER,ACCOUNT]);
  assert.match(insertion.sql,/ON CONFLICT\(root_realm_id,programme_id,referrer_kind,referrer_relationship_ref\) DO NOTHING/);
  assert.equal(f.stats().commits,2);
 });
 test("a volunteer referrer for MEMBER-event programme shares MEMBER applicant link",async()=>{
  const f=setup({member:false,volunteer:true,audience:"BOTH",
   qualifyingEvent:"MEMBERSHIP_ACTIVATED_VERIFIED"});
  const code=await f.service.myCode("own",PROGRAMME,"VOLUNTEER");
  assert.equal(code.relationship,"VOLUNTEER");
  assert.equal(code.sharePath,"/membership?ref="+code.code);
 });
 test("member referrer for VOLUNTEER-event programme shares volunteer intake",async()=>{
  const f=setup({member:true,volunteer:false,audience:"BOTH",
   qualifyingEvent:"VOLUNTEER_APPROVED_ACTIVE"});
  const code=await f.service.myCode("own",PROGRAMME,"MEMBER");
  assert.equal(code.sharePath,"/volunteer?ref="+code.code);
 });
 test("inactive/unapproved member cannot create a code even with a guessed programme UUID",async()=>{
  const f=setup({member:false,volunteer:false});
  await assert.rejects(()=>f.service.myCode("own-community-session",PROGRAMME,"MEMBER"),
   ForbiddenException);
  assert.equal(f.traces.some(t=>t.sql.startsWith("INSERT INTO referral_code")),false);
  assert.equal(f.stats().rollbacks,1);
 });
 test("inactive programmes cannot issue codes",async()=>{
  const f=setup({programActive:false});
  await assert.rejects(()=>f.service.myCode("own-community-session",PROGRAMME,"MEMBER"),
   ForbiddenException);
  assert.equal(f.traces.some(t=>t.sql.startsWith("INSERT INTO referral_code")),false);
 });
 test("code API rejects malformed programme and arbitrary relationship before DB",async()=>{
  const f=setup();
  await assert.rejects(()=>f.service.myCode("own","../../../other","MEMBER"),BadRequestException);
  await assert.rejects(()=>f.service.myCode("own",PROGRAMME,"ADMIN"),BadRequestException);
  assert.deepEqual(f.stats(),{connected:0,commits:0,rollbacks:0});
 });
 test("one signed-in actor never selects a second account or foreign realm",async()=>{
  const f=setup();
  await f.service.myCode("own-community-session",PROGRAMME,"MEMBER");
  const reads=f.traces.filter(t=>t.sql.includes("FROM referral_code")||t.sql.includes("FROM member m"));
  assert.ok(reads.length>=2);
  assert.ok(reads.every(t=>t.params.includes(ROOT)&&t.params.includes(ACCOUNT)));
  assert.ok(reads.every(t=>!t.params.includes(OTHER)));
 });
});
