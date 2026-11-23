import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ForbiddenException} from "@nestjs/common";
import {ReferralSelfService} from "../src/modules/cg-13-referrals-rewards/application/referral-self.service";
const ROOT="11111111-1111-4111-8111-111111111111";
const PERSON="22222222-2222-4222-8222-222222222222";
const PROGRAMME="33333333-3333-4333-8333-333333333333";
const MEMBER="44444444-4444-4444-8444-444444444444";
const WALLET="55555555-5555-4555-8555-555555555555";
const ACTOR={realmId:ROOT,accountId:PERSON,
 activeSessionId:"66666666-6666-4666-8666-666666666666"};
type Seen={sql:string;params:unknown[]};
function fixture({member=true,wallet=true,programme=true}={}){
 const seen:Seen[]=[];let began=0,committed=0;
 const tx={
  query:async(sql:string,params:unknown[]=[])=>{
   seen.push({sql,params});
   if(sql.startsWith("BEGIN"))began++;
   if(sql==="COMMIT")committed++;
   if(sql.startsWith("SELECT m.id AS ref FROM member m"))
    return {rows:member?[{ref:MEMBER}]:[],rowCount:member?1:0};
   if(sql.startsWith("SELECT v.id AS ref FROM volunteer v"))
    return {rows:[],rowCount:0};
   if(sql.startsWith("SELECT 1 FROM referral_program p"))
    return {rows:programme?[{exists:1}]:[],rowCount:programme?1:0};
   if(sql.includes("FROM points_account WHERE root_realm_id="))
    return {rows:wallet?[{id:WALLET,earnedPoints:"125",reversedPoints:"50",
     heldPoints:"5",spentPoints:"20",qualifiedReferrals:2,
     currentRankName:"Champion",currentRankSort:3,
     currentRankPolicyVersion:1,revision:4}]:[],rowCount:wallet?1:0};
   if(sql.includes("FROM points_event event"))
    return {rows:[{kind:"QUALIFICATION",points:"75",
     recordedAt:"2026-11-23T10:00:00.000Z",rank:"Champion"}],rowCount:1};
   if(sql.includes("FROM reward_rank_event"))
    return {rows:[{previous:"Starter",current:"Champion",
     qualifiedReferrals:2,eligiblePoints:"50",
     recordedAt:"2026-11-23T10:00:00.000Z"}],rowCount:1};
   return {rows:[],rowCount:1};
  },release:()=>{}
 };
 const svc=new ReferralSelfService({connect:async()=>tx} as never,
  {verifySession:async()=>ACTOR} as never,
  {assertRootSelfSessionCurrent:async()=>undefined} as never);
 return {svc,seen,stats:()=>({began,committed})};
}
describe("CG13 US002 current CG04 self points/rank API source contracts (not executed PG)",()=>{
 test("private balance derives available from original verified immutable projection",async()=>{
  const f=fixture();const res=await f.svc.myBalance("own",PROGRAMME,"MEMBER");
  assert.deepEqual([res.earnedPoints,res.availablePoints,res.heldPoints,
   res.reversedPoints,res.spentPoints,res.adjustmentDuePoints],
   ["125","50","5","50","20","0"]);
  assert.equal(res.currentRankName,"Champion");
  assert.deepEqual(f.stats(),{began:1,committed:1});
 });
 test("zero balance only when genuine eligible source has no credit",async()=>{
  const f=fixture({wallet:false});
  const res=await f.svc.myBalance("own",PROGRAMME,"MEMBER");
  assert.equal(res.availablePoints,"0");
  assert.equal(res.qualifiedReferrals,0);
  assert.equal(res.currentRankName,null);
 });
 test("unapproved member cannot discover wallet or other member balances",async()=>{
  const f=fixture({member:false});
  await assert.rejects(()=>f.svc.myBalance("own",PROGRAMME,"MEMBER"),
   ForbiddenException);
  assert.ok(!f.seen.some(x=>x.sql.includes("FROM points_account WHERE")));
 });
 test("foreign or wrong programme is denied without wallet enumeration",async()=>{
  const f=fixture({programme:false});
  await assert.rejects(()=>f.svc.myHistory("own",PROGRAMME,"MEMBER"),
   ForbiddenException);
  assert.ok(!f.seen.some(x=>x.sql.includes("FROM points_event event")));
 });
 test("history and rank bind current ROOT and self-only WALLET for every page",async()=>{
  const f=fixture();
  const history=await f.svc.myHistory("own",PROGRAMME,"MEMBER","2");
  assert.equal(history.page,2);
  assert.equal(history.items[0].status,"QUALIFIED");
  const e=f.seen.find(x=>x.sql.includes("FROM points_event event"))!;
  assert.deepEqual(e.params,[ROOT,WALLET,25]);
  const rank=await f.svc.myRank("own",PROGRAMME,"MEMBER","2");
  assert.equal(rank.rank,"Champion");
  assert.equal(rank.history[0].current,"Champion");
  const h=f.seen.find(x=>x.sql.includes("FROM reward_rank_event"))!;
  assert.deepEqual(h.params,[ROOT,WALLET,25]);
  assert.match(h.sql,/root_realm_id=\$1 AND points_account_id=\$2/);
 });
});
