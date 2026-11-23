import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recordCommittedReferralAttribution} from
 "../src/modules/cg-13-referrals-rewards/application/committed-referral.source";
const ROOT="11111111-1111-4111-8111-111111111111";
const APPLICANT="22222222-2222-4222-8222-222222222222";
const APP="33333333-3333-4333-8333-333333333333";
const PROGRAM="44444444-4444-4444-8444-444444444444";
const REFERRER="55555555-5555-4555-8555-555555555555";
const REL="66666666-6666-4666-8666-666666666666";
const CODE_REF="77777777-7777-4777-8777-777777777777";
const KEY="88888888-8888-4888-8888-888888888888";
const CODE="X".repeat(32),DIGEST="a".repeat(64);
function fixture(options:{renewal?:boolean;valid?:boolean;prior?:boolean;
 circular?:boolean;self?:boolean}={}){
 const seen:{sql:string;params:unknown[]}[]=[];
 const tx={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql.startsWith("SELECT 1 FROM member WHERE"))
   return {rows:options.renewal?[{ok:true}]:[],rowCount:options.renewal?1:0};
  if(sql.includes("FROM referral_code c JOIN referral_program p"))
   return {rows:options.valid===false?[]:[{
    programme:PROGRAM,codeRef:CODE_REF,
    referrerAccount:options.self?APPLICANT:REFERRER,
    referrerKind:"MEMBER",referrerRelationship:REL,
    policyVersion:2,qualifyingEvent:params[3],awardPoints:"75"
   }],rowCount:options.valid===false?0:1};
  if(sql.startsWith("SELECT id FROM referral_attribution")&&
   sql.includes("AND applicant_account_ref=$3"))
   return {rows:options.prior?[{id:CODE_REF}]:[],rowCount:options.prior?1:0};
  if(sql.startsWith("SELECT id FROM referral_attribution")&&
   sql.includes("referrer_account_ref=$4"))
   return {rows:options.circular?[{id:CODE_REF}]:[],rowCount:options.circular?1:0};
  if(sql.includes("INSERT INTO referral_attribution("))
   return {rows:[{id:CODE_REF}],rowCount:1};
  return {rows:[],rowCount:0};
 }};
 return {tx,seen};
}
function input(kind:"MEMBER"|"VOLUNTEER"="MEMBER",code:string|null=CODE){
 return {root:ROOT,applicantAccount:APPLICANT,application:APP,kind,
  applicationRevision:2,submittedDigest:DIGEST,originalSubmitKey:KEY,code};
}
describe("CG13 US002 original CG03 application submission attribution (mock source only)",()=>{
 test("click/no code creates no attribution and cannot mint points",async()=>{
  const f=fixture();
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input("MEMBER",null)),"NONE");
  assert.equal(f.seen.length,0);
 });
 test("renewal with a genuine existing CG04 member never credits a new signup",async()=>{
  const f=fixture({renewal:true});
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input()),"NONE");
  assert.ok(!f.seen.some(x=>x.sql.includes("INSERT INTO referral_attribution(")));
 });
 test("valid original submitted application freezes one policy and source digest",async()=>{
  const f=fixture();
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input()),"RECORDED");
  const created=f.seen.find(x=>x.sql.includes("INSERT INTO referral_attribution("));
  assert.ok(created);
  assert.deepEqual(created.params,
   [ROOT,PROGRAM,"MEMBER",APP,null,APPLICANT,CODE_REF,REFERRER,
    "MEMBER",REL,2,DIGEST,KEY,2,"MEMBERSHIP_ACTIVATED_VERIFIED","75","PENDING"]);
  assert.ok(!f.seen.some(x=>x.sql.includes("INSERT INTO points_event")));
 });
 test("volunteer submission records only an actual VOLUNTEER application",async()=>{
  const f=fixture();
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input("VOLUNTEER")),"RECORDED");
  const created=f.seen.find(x=>x.sql.includes("INSERT INTO referral_attribution("));
  assert.ok(created);
  assert.deepEqual(created.params.slice(2,6),["VOLUNTEER",null,APP,APPLICANT]);
 });
 test("same CG01 actor cannot refer itself",async()=>{
  const f=fixture({self:true});
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input()),"NONE");
  assert.ok(!f.seen.some(x=>x.sql.includes("INSERT INTO referral_attribution(")));
 });
 test("first committed source wins; later links cannot hijack original applicant",async()=>{
  const f=fixture({prior:true});
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input()),"PREVIOUS");
  assert.ok(!f.seen.some(x=>x.sql.includes("INSERT INTO referral_attribution(")));
 });
 test("known reciprocal referral loop is fraud-held, not awarded",async()=>{
  const f=fixture({circular:true});
  assert.equal(await recordCommittedReferralAttribution(f.tx as never,input()),"RECORDED");
  const created=f.seen.find(x=>x.sql.includes("INSERT INTO referral_attribution("));
  assert.ok(created);
  assert.equal(created.params[16],"HELD_FRAUD_REVIEW");
 });
 test("membership and volunteer original CG03 SUBMIT invoke attribution after signed snapshot",()=>{
  for(const owner of ["membership-approval","volunteer-approval"]){
   const source=readFileSync("src/modules/cg-03-registration-approvals/application/"+owner+".service.ts","utf8");
   const snapshot=source.indexOf("INSERT INTO "+(owner.startsWith("membership")?
    "membership_review_snapshot":"volunteer_review_snapshot"));
   const commit=source.indexOf("await recordCommittedReferralAttribution");
   assert.ok(snapshot>0&&commit>snapshot,owner);
   assert.ok(source.includes('originalSubmitKey:key'));
  }
 });
});
