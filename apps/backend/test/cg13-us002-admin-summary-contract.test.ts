import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ReferralCatalogService} from "../src/modules/cg-13-referrals-rewards/application/referral-catalog.service";
const ROOT="11111111-1111-4111-8111-111111111111";
const ACCOUNT="22222222-2222-4222-8222-222222222222";
const PROGRAMME="33333333-3333-4333-8333-333333333333";
const BRANCH="44444444-4444-4444-8444-444444444444";
const actor={realmId:ROOT,accountId:ACCOUNT,
 activeSessionId:"55555555-5555-4555-8555-555555555555"};
function fixture(allowed=true){
 const seen:{sql:string;params:unknown[]}[]=[];
 const tx={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql.includes("SELECT id,status,audience,active_policy_version FROM referral_program"))
   return {rows:[{id:PROGRAMME,status:"ACTIVE",audience:"BOTH",active_policy_version:1}]};
  if(sql.includes('AS "activeReferrers"'))return {rows:[{
   activeReferrers:"2",successfulReferrals:"5",earnedPoints:"500",netPoints:"450"
  }]};
  if(sql.includes('AS "spentPoints"'))return {rows:[{
   pending:"2",cancelled:"1",fulfilled:"0",total:"3",spentPoints:"0"
  }]};
  if(sql.includes("wallet.current_rank_name AS rank"))return {rows:[
   {kind:"MEMBER",rank:"Gold",count:"2",referrals:"5",points:"450",lastActivity:"2026-11-23T10:00:00Z"}
  ]};
  return {rows:[],rowCount:1};
 },release:()=>{}};
 const db={connect:async()=>tx};
 const sessions={requireAction:async(_token:string,action:string)=>{
  assert.equal(action,"referrals.programmes.view");
  if(!allowed)throw Error("Denied");
  return actor;
 }};
 const identity={assertCurrent:async()=>{},assertRootSelfSessionCurrent:async()=>{}};
 const inventory={rewardStoreScope:async()=>({full:false,branches:[BRANCH]})};
 const service=new ReferralCatalogService(db as never,sessions as never,
  identity as never,inventory as never);
 return {service,seen};
}
describe("CG13 US002 B11 branch-scoped verified ledger aggregates source contracts",()=>{
 test("Admin only receives scoped aggregate counts, never referrer/applicant PII",async()=>{
  const f=fixture();
  const result=await f.service.adminSummary("staff",PROGRAMME);
  assert.equal(result.metrics.successfulReferrals,"5");
  assert.equal(result.metrics.netPoints,"450");
  assert.equal(result.rankCounts[0].rank,"Gold");
  assert.equal(result.redemptionMetrics.spentPoints,"0");
  assert.equal(result.redemptionMetrics.pending,"2");
  assert.equal(result.redemptionMetrics.fulfilled,"0");
  const spent=f.seen.find(v=>v.sql.includes('AS "spentPoints"'))!;
  assert.ok(spent);
  assert.match(spent.sql,/spent.event_kind='POINTS_SPENT'/);
  assert.deepEqual(spent.params,[ROOT,PROGRAMME,false,[BRANCH]]);
  assert.ok(!JSON.stringify(result).includes(ACCOUNT));
  const walletReads=f.seen.filter(x=>x.sql.includes("FROM points_account wallet"));
  assert.equal(walletReads.length,2);
  for(const query of walletReads){
   assert.deepEqual(query.params,[ROOT,PROGRAMME,false,[BRANCH]]);
   assert.match(query.sql,/COALESCE\(m.branch_ref,v.branch_ref\)=ANY\(\$4::uuid\[\]\)/);
   assert.ok(!query.sql.includes("applicant_account_ref"));
  }
 });
 test("missing programme/view grant cannot reach verified wallet query",async()=>{
  const f=fixture(false);
  await assert.rejects(()=>f.service.adminSummary("denied",PROGRAMME));
  assert.equal(f.seen.some(x=>x.sql.includes("FROM points_account")),false);
 });
});
