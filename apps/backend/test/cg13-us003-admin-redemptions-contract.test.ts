import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {BadRequestException} from "@nestjs/common";
import {readFileSync} from "node:fs";
import {ReferralCatalogService} from
 "../src/modules/cg-13-referrals-rewards/application/referral-catalog.service";
const R="11111111-1111-4111-8111-111111111111";
const A="22222222-2222-4222-8222-222222222222";
const P="33333333-3333-4333-8333-333333333333";
const BRANCH="44444444-4444-4444-8444-444444444444";
function fixture(grant=true){
 const seen:{sql:string;params:unknown[]}[]=[];
 const tx={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql.includes("SELECT id,status,audience,active_policy_version FROM referral_program"))
   return {rows:[{id:P,status:"ACTIVE",audience:"BOTH",active_policy_version:1}]};
  if(sql.includes("FROM redemption r JOIN points_account wallet"))
   return {rows:[{kind:"MEMBER",name:"Eligible member",
    productName:"Original frozen digital recognition",pointsCost:"650",
    status:"HELD",requestedAt:"2026-11-23T11:12:00Z"}]};
  return {rows:[],rowCount:1};
 },release:()=>{}};
 const svc=new ReferralCatalogService({connect:async()=>tx} as never,
  {requireAction:async(_token:string,action:string)=>{
   assert.equal(action,"rewards.catalog.view");
   if(!grant)throw Error("Not authorized");
   return {realmId:R,accountId:A,activeSessionId:A};
  }} as never,
  {assertCurrent:async()=>undefined,assertRootSelfSessionCurrent:async()=>undefined} as never,
  {rewardStoreScope:async()=>({full:false,branches:[BRANCH]})} as never);
 return {svc,seen};
}
describe("CG13 US003 B14/B15 verified redemption reporting (mock, NOT live SQL)",()=>{
 test("a branch-granted staff role sees only original scoped frozen product results",async()=>{
  const x=fixture();
  const result=await x.svc.adminRedemptions(
   "staff",P,"2","HELD","digital","2026-11-01","2026-11-23");
  assert.equal(result.page,2);
  assert.equal(result.items[0].status,"HELD");
  assert.equal(result.items[0].productName,"Original frozen digital recognition");
  const query=x.seen.find(v=>v.sql.includes("FROM redemption r JOIN points_account wallet"));
  assert.ok(query);
  assert.deepEqual(query.params,
   [R,P,false,[BRANCH],"HELD","digital","2026-11-01","2026-11-23",25,true,true]);
  assert.match(query.sql,/COALESCE\(m.branch_ref,v.branch_ref\)=ANY\(\$4::uuid\[\]\)/);
  assert.match(query.sql,/JOIN reward_product_revision product/);
  assert.match(query.sql,/product.revision=r.product_revision/);
  // The exact boolean pair gates CG04 member/volunteer name projection in SQL.
  assert.match(query.sql,/wallet.referrer_kind='MEMBER' AND \$10::boolean/);
  assert.match(query.sql,/wallet.referrer_kind='VOLUNTEER' AND \$11::boolean/);
  assert.match(query.sql,/ELSE 'Recipient restricted' END AS name/);
  assert.ok(!query.sql.includes("applicant_account_ref"));
  assert.ok(!query.sql.includes("contact_phone"));
 });
 test("invalid date, status and bounded pages never reach the database",async()=>{
  const x=fixture();
  await assert.rejects(()=>x.svc.adminRedemptions("staff",P,"1","ALL","","2026-02-30"),
   BadRequestException);
  await assert.rejects(()=>x.svc.adminRedemptions("staff",P,"1","REVERSE"),
   BadRequestException);
  await assert.rejects(()=>x.svc.adminRedemptions("staff",P,"10000","ALL"),
   BadRequestException);
  assert.equal(x.seen.length,0);
 });
 test("a role without current rewards catalogue view cannot read redemption events",async()=>{
  const x=fixture(false);
  await assert.rejects(()=>x.svc.adminRedemptions("denied",P,"1","ALL"));
  assert.ok(!x.seen.some(v=>v.sql.includes("FROM redemption r")));
 });
});

describe("CG13 US003 QA17 Internal Android actual CG12 stock issue source boundary",()=>{
 test("native queue is role-gated and prepares only original warehouse ISSUE, not fake delivery",()=>{
  const screen=readFileSync("../android-internal/src/features/referrals/native-reward-requests.tsx","utf8");
  const parent=readFileSync("../android-internal/src/features/identity-access/staff-authentication-screen.tsx","utf8");
  const handover=readFileSync("../android-public/src/features/referrals/native-digital-redemption.tsx","utf8");
  assert.match(parent,/canIssueStock=\{roleActions.includes\("inventory.stock.issue"\)/);
  assert.match(parent,/roleActions.includes\("inventory.stock.view"\)/);
  assert.match(parent,/roleActions.includes\("inventory.catalog.view"\)/);
  assert.match(screen,/\/api\/v1\/rewards\/admin\/redemptions\//);
  assert.match(screen,/prepare-issue/);
  assert.match(screen,/\/api\/v1\/referrals\/programmes\//);
  assert.match(screen,/ISSUED_AWAITING_HANDOVER/);
  assert.match(screen,/canViewMembers/);
  assert.match(screen,/canViewVolunteers/);
  assert.ok(!screen.includes("approve-redemption"));
  assert.ok(!screen.includes("mark-delivered"));
  assert.match(handover,/acknowledge-handover/);
 });
});
