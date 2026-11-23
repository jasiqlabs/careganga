import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BadRequestException,ConflictException} from "@nestjs/common";
import {RedemptionService} from
 "../src/modules/cg-13-referrals-rewards/application/redemption.service";
const ROOT="11111111-1111-4111-8111-111111111111";
const ACCOUNT="22222222-2222-4222-8222-222222222222";
const RELATIONSHIP="33333333-3333-4333-8333-333333333333";
const CLAIM="44444444-4444-4444-8444-444444444444";
const WALLET="55555555-5555-4555-8555-555555555555";
const KEY="66666666-6666-4666-8666-666666666666";
const EVENT="77777777-7777-4777-8777-777777777777";
const PROOF="88888888-8888-4888-8888-888888888888";
function setup(mode:"HELD"|"FULFILLED"|"CANCELLED"="HELD",
 recognition=true,relation=RELATIONSHIP){
 const calls:{sql:string;args:unknown[]}[]=[];
 let commits=0,rollbacks=0;
 const tx={query:async(sql:string,args:unknown[]=[])=>{
  calls.push({sql,args});
  if(sql==="COMMIT")commits++;
  if(sql==="ROLLBACK")rollbacks++;
  if(sql.includes("FROM redemption WHERE root_realm_id=$1 AND id=$2")&&
    sql.includes("FOR UPDATE"))
   return {rows:[{id:CLAIM,state:mode,wallet:WALLET,relationship:"MEMBER",
    relationshipRef:RELATIONSHIP,price:"75",requestKey:KEY}],rowCount:1};
  if(sql.includes("SELECT m.id AS ref FROM member"))
   return {rows:[{ref:relation}],rowCount:1};
  if(sql.includes("FROM points_account WHERE root_realm_id=$1 AND id=$2"))
   return {rows:[{id:WALLET}],rowCount:1};
  if(sql.includes("FROM redemption r JOIN reward_product_revision p"))
   return {rows:recognition?[{title:"Community recognition",
    description:"Verified recognition for a member",product:CLAIM,revision:1}]:[],
    rowCount:recognition?1:0};
  if(sql.includes("INSERT INTO cg19_reward_recognition"))
   return {rows:[{id:PROOF}],rowCount:1};
  if(sql.includes("FROM cg19_reward_recognition")&&sql.includes("SELECT title"))
   return {rows:[{title:"Community recognition",
    description:"Verified recognition for a member"}],rowCount:1};
  if(sql.includes("INSERT INTO points_event("))
   return {rows:[{id:EVENT}],rowCount:1};
  if(sql.includes("UPDATE redemption SET state='FULFILLED'"))
   return {rows:[],rowCount:1};
  if(sql.includes("UPDATE points_account SET held_points="))
   return {rows:[],rowCount:1};
  return {rows:[],rowCount:1};
 },release:()=>undefined};
 const service=new RedemptionService({connect:async()=>tx} as never,
  {verifySession:async()=>({realmId:ROOT,accountId:ACCOUNT})} as never,
  {assertRootSelfSessionCurrent:async()=>undefined} as never);
 return {service,calls,stats:()=>({commits,rollbacks})};
}
describe("CG13-US003-QA02 on-platform CG19-recipient recognition (source mocks; SQL NOT_RUN)",()=>{
 test("real recipient recognition atomically spends one original 75-point held reward",async()=>{
  const f=setup();
  const result=await f.service.claimRecognition("self",CLAIM);
  assert.equal(result.state,"FULFILLED");assert.equal(result.replayed,false);
  assert.equal(result.recognition.title,"Community recognition");
  const proof=f.calls.find(c=>c.sql.includes("INSERT INTO cg19_reward_recognition"));
  const spent=f.calls.find(c=>c.sql.includes("'POINTS_SPENT'"));
  const wallet=f.calls.find(c=>c.sql.includes("spent_points=spent_points+$3"));
  const receipt=f.calls.find(c=>c.sql.includes("'RECOGNIZED'"));
  assert.ok(proof&&spent&&wallet&&receipt);
  assert.deepEqual(wallet.args,[ROOT,WALLET,"75"]);
  assert.equal(spent.args[2],CLAIM);
  assert.deepEqual(receipt.args,[ROOT,CLAIM,EVENT,KEY]);
  assert.equal(f.stats().commits,1);
 });
 test("same claimed recognition replays original proof without another points event",async()=>{
  const f=setup("FULFILLED");
  const result=await f.service.claimRecognition("self",CLAIM);
  assert.equal(result.replayed,true);
  assert.ok(!f.calls.some(x=>x.sql.includes("INSERT INTO cg19_reward_recognition")));
  assert.ok(!f.calls.some(x=>x.sql.includes("'POINTS_SPENT'")));
 });
 test("unconfigured digital provider cannot claim a fake on-platform recognition",async()=>{
  const f=setup("HELD",false);
  await assert.rejects(()=>f.service.claimRecognition("self",CLAIM),ConflictException);
  assert.ok(!f.calls.some(x=>x.sql.includes("UPDATE redemption SET state='FULFILLED'")));
  assert.equal(f.stats().rollbacks,1);
 });
 test("a different CG04 membership relationship for the same CG01 principal cannot claim",async()=>{
  const f=setup("HELD",true,KEY);
  await assert.rejects(()=>f.service.claimRecognition("self",CLAIM));
  assert.ok(!f.calls.some(x=>x.sql.includes("INSERT INTO cg19_reward_recognition")));
 });
 test("cancelled rewards cannot be marked delivered by a later claim",async()=>{
  const f=setup("CANCELLED");
  await assert.rejects(()=>f.service.claimRecognition("self",CLAIM),ConflictException);
  assert.ok(!f.calls.some(x=>x.sql.includes("'POINTS_SPENT'")));
 });
 test("guessed recognition id fails input validation before any SQL",async()=>{
  const f=setup();
  await assert.rejects(()=>f.service.claimRecognition("self","guessed"),BadRequestException);
  assert.equal(f.calls.length,0);
 });
 test("original DB triggers require identical immutable CG19 recipient source and spent points",()=>{
  const ledger=readFileSync("db/migrations/3506_cg13_us002_verified_points_rank_ledger.sql","utf8");
  const hold=readFileSync("db/migrations/3507_cg13_us003_digital_reward_holds.sql","utf8");
  const proof=readFileSync("db/migrations/3508_cg19_original_on_platform_recognition.sql","utf8");
  for(const fragment of [
   "NEW.event_kind='POINTS_SPENT'","cg19_reward_recognition",
   "r.payload_digest=NEW.qualifying_source_digest","ON_PLATFORM_RECOGNITION"])
   assert.ok(ledger.includes(fragment),fragment);
  for(const fragment of ["OLD.state='HELD' AND NEW.state='FULFILLED'",
   "receipt.event_kind='RECOGNIZED'","proof.source_key=NEW.request_key"])
   assert.ok(hold.includes(fragment),fragment);
  assert.ok(proof.includes("recipient_account_ref"));
  assert.ok(proof.includes("cg19_reward_recognition_immutable"));
  assert.ok(!proof.includes("gift_card_code"));
 });
});

/** Original US-003-QA10/11/16 source contract. Requires live CG12/CG19
 * PostgreSQL trigger, CSRF/browser, actual recipient and stock SQL QA later.
 */
function physicalHandoverSetup(mode:"ISSUED_AWAITING_HANDOVER"|"FULFILLED"|"HELD"="ISSUED_AWAITING_HANDOVER",
 relationship=RELATIONSHIP){
 const calls:{sql:string;args:unknown[]}[]=[];
 let commits=0,rollbacks=0;
 const tx={query:async(sql:string,args:unknown[]=[])=>{
  calls.push({sql,args});
  if(sql==="COMMIT")commits++;
  if(sql==="ROLLBACK")rollbacks++;
  if(sql.includes("FROM redemption WHERE root_realm_id=$1 AND id=$2")&&
   sql.includes("FOR UPDATE"))
   return {rows:[{state:mode,type:"PHYSICAL",wallet:WALLET,relationship:"MEMBER",
    relationshipRef:RELATIONSHIP,price:"75",requestKey:KEY}],rowCount:1};
  if(sql.includes("SELECT m.id AS ref FROM member"))
   return {rows:[{ref:relationship}],rowCount:1};
  if(sql.includes("FROM points_account WHERE root_realm_id=$1 AND id=$2"))
   return {rows:[{id:WALLET}],rowCount:1};
  if(sql.includes("SELECT id FROM cg19_reward_handover"))
   return {rows:[{id:PROOF}],rowCount:1};
  if(sql.includes("INSERT INTO cg19_reward_handover"))
   return {rows:[{id:PROOF}],rowCount:1};
  if(sql.includes("UPDATE redemption SET state='FULFILLED'"))
   return {rows:[],rowCount:1};
  if(sql.includes("INSERT INTO points_event("))
   return {rows:[{id:EVENT}],rowCount:1};
  if(sql.includes("UPDATE points_account SET held_points="))
   return {rows:[],rowCount:1};
  return {rows:[],rowCount:1};
 },release:()=>undefined};
 const service=new RedemptionService({connect:async()=>tx} as never,
  {verifySession:async()=>({realmId:ROOT,accountId:ACCOUNT})} as never,
  {assertRootSelfSessionCurrent:async()=>undefined} as never);
 return {service,calls,stats:()=>({commits,rollbacks})};
}
describe("CG13 US003 original CG19 physical recipient handover (source only, DB NOT_RUN)",()=>{
 test("recipient proof, frozen CG12 ISSUE, one points spend and redemption history atomic",async()=>{
  const f=physicalHandoverSetup();
  const result=await f.service.acknowledgeHandover("self",CLAIM);
  assert.equal(result.state,"FULFILLED");
  assert.equal(result.replayed,false);
  const proof=f.calls.find(c=>c.sql.includes("INSERT INTO cg19_reward_handover"))!;
  assert.ok(proof);
  assert.deepEqual(proof.args,[ROOT,CLAIM,ACCOUNT,KEY]);
  assert.match(proof.sql,/issued.original_stock_event_id/);
  assert.match(proof.sql,/hold.state='ISSUED'/);
  const spent=f.calls.find(c=>c.sql.includes("'POINTS_SPENT'"))!;
  assert.ok(spent);assert.deepEqual(spent.args,[ROOT,WALLET,CLAIM,ACCOUNT]);
  const wallet=f.calls.find(c=>c.sql.includes("spent_points=spent_points+$3"))!;
  assert.deepEqual(wallet.args,[ROOT,WALLET,"75"]);
  const event=f.calls.find(c=>c.sql.includes("'HANDED_OVER'"))!;
  assert.deepEqual(event.args,[ROOT,CLAIM,EVENT,KEY]);
  assert.ok(!f.calls.some(c=>c.sql.includes("INSERT INTO stock_movement")));
  assert.ok(!f.calls.some(c=>c.sql.includes("UPDATE stock_balance")));
  assert.equal(f.stats().commits,1);
 });
 test("duplicate confirmed recipient acknowledgment replays without double spend",async()=>{
  const f=physicalHandoverSetup("FULFILLED");
  const result=await f.service.acknowledgeHandover("self",CLAIM);
  assert.equal(result.replayed,true);
  assert.ok(!f.calls.some(c=>c.sql.includes("INSERT INTO cg19_reward_handover")));
  assert.ok(!f.calls.some(c=>c.sql.includes("'POINTS_SPENT'")));
 });
 test("warehouse unit HELD but not really issued can never be marked delivered",async()=>{
  const f=physicalHandoverSetup("HELD");
  await assert.rejects(()=>f.service.acknowledgeHandover("self",CLAIM),ConflictException);
  assert.ok(!f.calls.some(c=>c.sql.includes("INSERT INTO cg19_reward_handover")));
  assert.equal(f.stats().rollbacks,1);
 });
 test("changed original CG04 member relationship denies physical acknowledgment",async()=>{
  const f=physicalHandoverSetup("ISSUED_AWAITING_HANDOVER",KEY);
  await assert.rejects(()=>f.service.acknowledgeHandover("self",CLAIM));
  assert.ok(!f.calls.some(c=>c.sql.includes("INSERT INTO cg19_reward_handover")));
 });
 test("original SQL trigger enforces verified staff issue, distinct recipient and immutable proof",()=>{
  const ledger=readFileSync("db/migrations/3506_cg13_us002_verified_points_rank_ledger.sql","utf8");
  const handover=readFileSync("db/migrations/3511_cg19_original_reward_recipient_handover.sql","utf8");
  const redeemed=readFileSync("db/migrations/3507_cg13_us003_digital_reward_holds.sql","utf8");
  for(const x of ["r.product_type='PHYSICAL'","cg19_reward_handover proof",
   "proof.stock_issue_event_id=issued.original_stock_event_id",
   "r.payload_digest=NEW.qualifying_source_digest"])assert.ok(ledger.includes(x),x);
  for(const x of ["issued.event_kind='ISSUE'","op.status='CONFIRMED'",
   "issued.actor_ref<>r.recipient_account_ref","cg19_reward_handover_immutable"])
   assert.ok(handover.includes(x),x);
  for(const x of ["OLD.state='ISSUED_AWAITING_HANDOVER' AND NEW.state='FULFILLED'",
   "actual.source_key=NEW.request_key"])assert.ok(redeemed.includes(x),x);
 });
});
