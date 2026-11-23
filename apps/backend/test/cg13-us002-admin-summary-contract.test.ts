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
  // B14 unfulfilled includes physically issued but not recipient-acknowledged rewards.
  assert.match(spent.sql,/r\.state IN\('HELD','ISSUED_AWAITING_HANDOVER'\)/);
  assert.match(spent.sql,/r\.state='FULFILLED'/);
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

/** Source-contract only: do not call this a real PostgreSQL/CG02 or privacy PASS. */
function recordsFixture({roster=true,kind="MEMBER"}:{roster?:boolean;kind?:"MEMBER"|"VOLUNTEER"}={}){
 const seen:{sql:string;params:unknown[]}[]=[],actions:string[]=[],checks:string[]=[];
 const tx={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql.includes("SELECT id,status,audience,active_policy_version FROM referral_program"))
   return {rows:[{id:PROGRAMME,status:"ACTIVE",audience:"BOTH",active_policy_version:1}]};
  if(sql.includes("wallet.current_rank_name AS rank")&&sql.includes("LIMIT 15"))
   return {rows:[{name:"Eligible Referrer",participantNumber:"CG/MEM/01",
    rank:"Gold",referrals:"5",points:"450",lastActivity:"2026-11-23T10:00:00Z",
    status:"ACTIVE"}],rowCount:1};
  if(sql.includes("FROM points_event event JOIN points_account wallet"))
   return {rows:[{name:"Eligible Referrer",participantNumber:"CG/MEM/01",
    status:"QUALIFICATION",points:"100",recordedAt:"2026-11-23T10:00:00Z",
    rank:"Gold"}],rowCount:1};
  return {rows:[],rowCount:1};
 },release:()=>{}};
 const svc=new ReferralCatalogService({connect:async()=>tx} as never,
  {requireAction:async(_token:string,action:string)=>{
   actions.push(action);
   if(!roster&&action!=="referrals.programmes.view")throw Error("Roster grant revoked");
   return actor;
  }} as never,
  {assertCurrent:async(_tx:unknown,_actor:unknown,action:string)=>{
   checks.push(action);
  },assertRootSelfSessionCurrent:async()=>{}} as never,
  {rewardStoreScope:async()=>({full:false,branches:[BRANCH]})} as never);
 return {svc,seen,actions,checks,kind};
}
describe("CG13 US002 B12 individual records require existing current CG04 roster grants",()=>{
 test("member top and immutable event records bind current root, programme, branch, dates and page",async()=>{
  const f=recordsFixture();
  const rows=await f.svc.adminReferralRecords("staff",PROGRAMME,"MEMBER","2","ACTIVE",
   "2026-11-01","2026-11-23","Eligible");
  assert.equal(rows.topReferrers[0]?.name,"Eligible Referrer");
  assert.equal(rows.recentEvents[0]?.status,"QUALIFICATION");
  assert.equal(rows.page,2);
  assert.deepEqual(f.actions,["membership.members.view","referrals.programmes.view"]);
  assert.ok(f.checks.includes("membership.members.view"));
  const top=f.seen.find(x=>x.sql.includes("wallet.current_rank_name AS rank")&&x.sql.includes("LIMIT 15"))!;
  assert.ok(top);
  assert.deepEqual(top.params,[ROOT,PROGRAMME,"MEMBER",false,[BRANCH],"eligible","ACTIVE"]);
  assert.match(top.sql,/wallet.referrer_kind=\$3/);
  assert.match(top.sql,/COALESCE\(m.branch_ref,v.branch_ref\)=ANY\(\$5::uuid\[\]\)/);
  assert.match(top.sql,/cg04_current_volunteer/);
  const event=f.seen.find(x=>x.sql.includes("FROM points_event event JOIN points_account wallet"))!;
  assert.ok(event);
  assert.deepEqual(event.params,
   [ROOT,PROGRAMME,"MEMBER",false,[BRANCH],"eligible","ACTIVE","2026-11-01","2026-11-23",25]);
  assert.match(event.sql,/event.event_kind IN\('QUALIFICATION','QUALIFICATION_REVERSAL'\)/);
  assert.match(event.sql,/event.source_recorded_at AT TIME ZONE 'Asia\/Kolkata'/);
  for(const query of [top,event]){
   assert.ok(!query.sql.includes("applicant_account_ref"));
   assert.ok(!query.sql.includes("contact_phone"));
   assert.ok(!query.sql.includes("finance_membership_collection"));
  }
 });
 test("volunteer history demands volunteer roster grant instead of member grant",async()=>{
  const f=recordsFixture({kind:"VOLUNTEER"});
  const rows=await f.svc.adminReferralRecords("staff",PROGRAMME,"VOLUNTEER");
  assert.equal(rows.kind,"VOLUNTEER");
  assert.deepEqual(f.actions,["volunteers.view","referrals.programmes.view"]);
  const top=f.seen.find(x=>x.sql.includes("LIMIT 15"))!;
  assert.equal(top.params[2],"VOLUNTEER");
 });
 test("revoked CG04 roster grant never enumerates programme or private ledger",async()=>{
  const f=recordsFixture({roster:false});
  await assert.rejects(()=>f.svc.adminReferralRecords("staff",PROGRAMME,"MEMBER"));
  assert.deepEqual(f.actions,["membership.members.view"]);
  assert.equal(f.seen.length,0);
 });
 test("bad kind/date/page rejects before authorization and private SQL",async()=>{
  const f=recordsFixture();
  await assert.rejects(()=>f.svc.adminReferralRecords("staff",PROGRAMME,"STAFF"));
  await assert.rejects(()=>f.svc.adminReferralRecords("staff",PROGRAMME,"MEMBER","10000"));
  await assert.rejects(()=>f.svc.adminReferralRecords(
   "staff",PROGRAMME,"MEMBER","1","ALL","2026-02-30"));
  assert.deepEqual(f.actions,[]);
  assert.equal(f.seen.length,0);
 });
});
