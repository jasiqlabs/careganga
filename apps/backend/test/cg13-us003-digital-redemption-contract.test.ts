import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {BadRequestException,ConflictException,NotFoundException}
 from "@nestjs/common";
import {RedemptionService} from
 "../src/modules/cg-13-referrals-rewards/application/redemption.service";
const R="11111111-1111-4111-8111-111111111111";
const ACCOUNT="22222222-2222-4222-8222-222222222222";
const P="33333333-3333-4333-8333-333333333333";
const PRODUCT="44444444-4444-4444-8444-444444444444";
const MEMBER="55555555-5555-4555-8555-555555555555";
const WALLET="66666666-6666-4666-8666-666666666666";
const KEY="77777777-7777-4777-8777-777777777777";
const REDEMPTION="88888888-8888-4888-8888-888888888888";
const EVENT="99999999-9999-4999-8999-999999999999";
const request={programmeRef:P,productRef:PRODUCT,relationship:"MEMBER" as const,
 expectedProductVersion:2,requestKey:KEY};
const DIGEST=createHash("sha256").update(JSON.stringify([P,PRODUCT,"MEMBER",2])).digest("hex");
type Seen={sql:string;params:unknown[]};
function setup({available="900",product=true,existing=false,
 cancelled=false,account=true,minimumClaim="700",rewardPrice="600"}={}){
 const seen:Seen[]=[],issued:{value:boolean}={value:false};
 let commits=0,rollbacks=0;
 const tx={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql==="COMMIT")commits++;
  if(sql==="ROLLBACK")rollbacks++;
  if(sql.includes("SELECT m.id AS ref FROM member"))
   return {rows:account?[{ref:MEMBER}]:[],rowCount:account?1:0};
  if(sql.includes('payload_digest AS "payloadDigest"'))
   return {rows:existing?[{ref:REDEMPTION,state:"HELD",pointsCost:"600",
    payloadDigest:DIGEST}]:[],rowCount:existing?1:0};
  if(sql.includes("p.points_price::text AS price"))
   return {rows:product?[{price:rewardPrice,version:2,name:"Verified digital badge",policyVersion:1,
    minimumClaimPoints:minimumClaim,type:"DIGITAL",itemRef:null,storeRef:null}]:[],rowCount:product?1:0};
  if(sql.includes('earned_points::text AS earned'))
   return {rows:[{id:WALLET,earned:available,reversed:"0",held:"0",spent:"0"}],rowCount:1};
  if(sql.includes("INSERT INTO redemption("))
   return {rows:[{ref:REDEMPTION}],rowCount:1};
  if(sql.includes("INSERT INTO points_event("))
   return {rows:[{ref:EVENT,id:EVENT}],rowCount:1};
  if(sql.includes("UPDATE points_account SET held_points="))
   return {rows:[],rowCount:1};
  if(sql.includes("INSERT INTO redemption_event("))
   return {rows:[],rowCount:1};
  if(sql.includes("FROM redemption WHERE root_realm_id=$1 AND id=$2"))
   return {rows:account?[{ref:REDEMPTION,state:cancelled?"CANCELLED":"HELD",
    price:"600",wallet:WALLET,relationship:"MEMBER",
    relationshipRef:MEMBER,type:"DIGITAL"}]:[],rowCount:account?1:0};
  if(sql.includes("FROM points_account WHERE root_realm_id=$1 AND id=$2"))
   return {rows:[{exists:true}],rowCount:1};
  if(sql.includes("UPDATE redemption SET state='CANCELLED'"))
   return {rows:[],rowCount:1};
  if(sql.includes("FROM redemption r ")&&sql.includes("JOIN reward_product_revision p"))
   return {rows:[{ref:REDEMPTION,state:"HELD",productName:"Verified digital badge",
    pointsCost:"600",requestedAt:"2026-11-23T10:00:00Z",revision:1}],rowCount:1};
  return {rows:[],rowCount:1};
 },release:()=>{}};
 const service=new RedemptionService({connect:async()=>tx} as never,
  {verifySession:async()=>({realmId:R,accountId:ACCOUNT})} as never,
  {assertRootSelfSessionCurrent:async()=>undefined} as never);
 return {service,seen,stats:()=>({commits,rollbacks})};
}
describe("CG13 US003 digital points hold/cancel contracts (mock only; no real PG)",()=>{
 test("900 verified points allow one 600-point digital request with exact locked wallet",async()=>{
  const f=setup();
  const x=await f.service.request("own",request);
  assert.equal(x.state,"HELD");assert.equal(x.pointsCost,"600");
  assert.equal(x.replayed,false);
  const lock=f.seen.find(x=>x.sql.includes("FROM points_account ")&&
   x.sql.includes("FOR UPDATE"));
  assert.ok(lock);
  assert.deepEqual(lock.params,[R,P,"MEMBER",MEMBER,ACCOUNT]);
  const frozen=f.seen.find(x=>x.sql.includes("INSERT INTO redemption("));
  assert.ok(frozen);assert.deepEqual(frozen.params.slice(0,4),[R,P,1,WALLET]);
  const event=f.seen.find(x=>x.sql.includes("INSERT INTO points_event("));
  assert.ok(event);assert.match(event.sql,/POINTS_HOLD/);
  assert.equal(event.params[0],R);assert.equal(event.params[2],REDEMPTION);
  assert.equal(f.stats().commits,1);
 });
 test("existing same source key is replayed without a second hold",async()=>{
  const f=setup({existing:true});
  const x=await f.service.request("own",request);
  assert.equal(x.replayed,true);
  assert.equal(x.ref,REDEMPTION);
  assert.ok(!f.seen.some(v=>v.sql.includes("INSERT INTO redemption(")));
 });
 test("concurrent other request with only 300 points remaining fails without hold",async()=>{
  const f=setup({available:"300"});
  await assert.rejects(()=>f.service.request("own",request),ConflictException);
  assert.equal(f.stats().rollbacks,1);
  assert.ok(!f.seen.some(v=>v.sql.includes("INSERT INTO points_event(")));
 });
 test("a real programme minimum claim of 700 rejects 650 points even for a 600-point gift",async()=>{
  const f=setup({available:"650",minimumClaim:"700"});
  await assert.rejects(()=>f.service.request("own",request),ConflictException);
  assert.ok(!f.seen.some(v=>v.sql.includes("INSERT INTO redemption(")));
 });
 test("an incompatible DIGITAL catalogue price above 1 billion fails before source writes",async()=>{
  const f=setup({rewardPrice:"1000000000001"});
  await assert.rejects(()=>f.service.request("own",request),ConflictException);
  assert.ok(!f.seen.some(v=>v.sql.includes("INSERT INTO redemption(")));
 });
 test("stale reward version and unverified member fail before wallet/hold",async()=>{
  const stale=setup({product:false});
  await assert.rejects(()=>stale.service.request("own",request),ConflictException);
  const invalid=setup({account:false});
  await assert.rejects(()=>invalid.service.request("own",request));
  assert.ok(!invalid.seen.some(x=>x.sql.includes("INSERT INTO redemption(")));
 });
 test("unknown body fields and malformed source keys fail before connecting",async()=>{
  const f=setup();
  await assert.rejects(()=>f.service.request("own",{...request,fulfilled:true}),BadRequestException);
  await assert.rejects(()=>f.service.request("own",{...request,requestKey:"bad"}),BadRequestException);
  assert.equal(f.seen.length,0);
 });
 test("original pending digital hold cancels once with matching points release",async()=>{
  const f=setup();
  const result=await f.service.cancel("own",REDEMPTION);
  assert.equal(result.state,"CANCELLED");
  const event=f.seen.find(x=>x.sql.includes("INSERT INTO points_event("));
  assert.ok(event);assert.match(event.sql,/POINTS_RELEASE/);
  const wallet=f.seen.find(x=>x.sql.includes("held_points=held_points-$3"));
  assert.ok(wallet);assert.deepEqual(wallet.params,[R,WALLET,"600"]);
  const receipt=f.seen.find(x=>x.sql.includes("INSERT INTO redemption_event("));
  assert.ok(receipt);assert.match(receipt.sql,/CANCELLED/);
 });
 test("duplicate cancellation is stable, guessed redemption stays private",async()=>{
  const replay=setup({cancelled:true});
  const r=await replay.service.cancel("own",REDEMPTION);
  assert.equal(r.replayed,true);
  assert.ok(!replay.seen.some(x=>x.sql.includes("UPDATE points_account SET")));
  const unknown=setup({account:false});
  await assert.rejects(()=>unknown.service.cancel("own",REDEMPTION),NotFoundException);
 });
 test("history scoped only to current signed-in account and Foundation root",async()=>{
  const f=setup();
  const result=await f.service.myHistory("own","2");
  assert.equal(result.page,2);assert.equal(result.items[0].state,"HELD");
  const listing=f.seen.find(x=>x.sql.includes('AS "productName"'));
  assert.ok(listing);assert.deepEqual(listing.params,[R,ACCOUNT,25]);
  assert.match(listing.sql,/r\.recipient_account_ref=\$2/);
  assert.match(listing.sql,/p\.revision=r\.product_revision/);
 });
 test("source migrations enforce original same-ledger projection and fail closed on fulfillment",()=>{
  const ledger=readFileSync("db/migrations/3506_cg13_us002_verified_points_rank_ledger.sql","utf8");
  const digital=readFileSync("db/migrations/3507_cg13_us003_digital_reward_holds.sql","utf8");
  for(const x of ["POINTS_HOLD","POINTS_RELEASE","POINTS_SPENT",
   "totals.held,totals.spent","Verified original redemption points source required"])
   assert.ok(ledger.includes(x),x);
  for(const x of ["CREATE TRIGGER cg13_digital_redemption_source_guard",
   "CREATE CONSTRAINT TRIGGER cg13_redemption_commit",
   "AND product.product_type='DIGITAL'","wallet.earned_points-wallet.reversed_points",
   "CREATE UNIQUE INDEX ux_cg13_points_redemption_effect",
   "CREATE TRIGGER cg13_redemption_event_immutable"])
   assert.ok(digital.includes(x),x);
  assert.ok(!digital.includes("UPDATE stock_balance"));
 });
});
