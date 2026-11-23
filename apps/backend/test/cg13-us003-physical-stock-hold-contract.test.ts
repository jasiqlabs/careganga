import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ConflictException,ForbiddenException} from "@nestjs/common";
import {reserveRewardStock,releaseRewardStock,prepareRewardIssueDraft} from
 "../src/modules/cg-12-inventory-suppliers/application/reward-stock-source";
const ROOT="11111111-1111-4111-8111-111111111111";
const ACCOUNT="22222222-2222-4222-8222-222222222222";
const MEMBER="33333333-3333-4333-8333-333333333333";
const CLAIM="44444444-4444-4444-8444-444444444444";
const ITEM="55555555-5555-4555-8555-555555555555";
const LOCATION="66666666-6666-4666-8666-666666666666";
const KEY="77777777-7777-4777-8777-777777777777";
const HOLD="88888888-8888-4888-8888-888888888888";
const BRANCH="99999999-9999-4999-8999-999999999999";
const source={root:ROOT,redemption:CLAIM,recipient:ACCOUNT,
 relationship:"MEMBER" as const,relationshipRef:MEMBER,
 item:ITEM,location:LOCATION,requestKey:KEY};
function fixture({available="1",storeBranch=null as string|null,
 memberBranch=null as string|null,heldState="HELD"}={}){
 const queries:{sql:string;args:unknown[]}[]=[];
 const tx={query:async(sql:string,args:unknown[]=[])=>{
  queries.push({sql,args});
  if(sql.includes('m.branch_ref AS "branchRef"'))
   return {rows:[{branchRef:memberBranch}],rowCount:1};
  if(sql.includes('l.branch_ref AS "branchRef"'))
   return {rows:[{branchRef:storeBranch,status:"ACTIVE",unit:"PIECE",scale:0}],rowCount:1};
  if(sql.includes("on_hand_qty-reserved_qty")&&sql.includes("AS available"))
   return {rows:[{available}],rowCount:1};
  if(sql.includes("INSERT INTO stock_reward_hold("))
   return {rows:[{id:HOLD}],rowCount:1};
  if(sql.includes("FROM stock_reward_hold WHERE root_realm_id=$1 AND id=$2"))
   return {rows:[{state:heldState}],rowCount:1};
  if(sql.includes("FROM stock_reward_hold "))
   return {rows:[{id:HOLD,item:ITEM,location:LOCATION,status:heldState,requestKey:KEY}],rowCount:1};
  return {rows:[],rowCount:1};
 }};
 return {tx,queries};
}
describe("CG13-US003-QA06/07/12 original CG12 same-ledger one-unit source contracts",()=>{
 test("one original CG12 stock_balance locked once, reserved +1 and receipt stored",async()=>{
  const x=fixture();
  const result=await reserveRewardStock(x.tx as never,source);
  assert.equal(result.status,"HELD");
  const locked=x.queries.find(q=>q.sql.includes("AS available"));
  assert.ok(locked);assert.deepEqual(locked.args,[ROOT,ITEM,LOCATION]);
  const reserved=x.queries.find(q=>q.sql.includes("reserved_qty=reserved_qty+1"));
  assert.ok(reserved);
  assert.deepEqual(reserved.args,[ROOT,ITEM,LOCATION]);
  const receipt=x.queries.find(q=>q.sql.includes("'RESERVED'"));
  assert.ok(receipt);assert.deepEqual(receipt.args,[ROOT,HOLD,KEY,ACCOUNT]);
  assert.ok(!x.queries.some(q=>q.sql.includes("INSERT INTO stock_movement")));
  assert.ok(!x.queries.some(q=>q.sql.includes("UPDATE points_account")));
 });
 test("an unavailable last item fails before any hold/points side effect",async()=>{
  const x=fixture({available:"0"});
  await assert.rejects(()=>reserveRewardStock(x.tx as never,source),ConflictException);
  assert.ok(!x.queries.some(q=>q.sql.includes("INSERT INTO stock_reward_hold")));
  assert.ok(!x.queries.some(q=>q.sql.includes("reserved_qty=reserved_qty+1")));
 });
 test("physical stock from a different current CG04 branch is forbidden",async()=>{
  const x=fixture({storeBranch:BRANCH,memberBranch:null});
  await assert.rejects(()=>reserveRewardStock(x.tx as never,source),ForbiddenException);
  assert.ok(!x.queries.some(q=>q.sql.includes("UPDATE stock_balance")));
 });
 test("matching current branch can reserve one physical item",async()=>{
  const x=fixture({storeBranch:BRANCH,memberBranch:BRANCH});
  assert.equal((await reserveRewardStock(x.tx as never,source)).status,"HELD");
 });
 test("cancel releases exact original reservation, not a fictitious stock return",async()=>{
  const x=fixture();
  const result=await releaseRewardStock(x.tx as never,{
   root:ROOT,redemption:CLAIM,recipient:ACCOUNT});
  assert.equal(result.status,"RELEASED");assert.equal(result.replayed,false);
  const released=x.queries.find(q=>q.sql.includes("reserved_qty=reserved_qty-1"));
  assert.ok(released);assert.deepEqual(released.args,[ROOT,ITEM,LOCATION]);
  const event=x.queries.find(q=>q.sql.includes("'RELEASED'"));
  assert.ok(event);assert.deepEqual(event.args,[ROOT,HOLD,KEY,ACCOUNT]);
  assert.ok(!x.queries.some(q=>q.sql.includes("INSERT INTO stock_movement")));
 });
 test("already-released source key never decrements stock twice",async()=>{
  const x=fixture({heldState:"RELEASED"});
  const result=await releaseRewardStock(x.tx as never,{
   root:ROOT,redemption:CLAIM,recipient:ACCOUNT});
  assert.equal(result.replayed,true);
  assert.ok(!x.queries.some(q=>q.sql.includes("reserved_qty=reserved_qty-1")));
 });
 test("issued stock cannot be silently returned by cancelling a pending claim",async()=>{
  const x=fixture({heldState:"ISSUED"});
  await assert.rejects(()=>releaseRewardStock(x.tx as never,{
   root:ROOT,redemption:CLAIM,recipient:ACCOUNT}),ConflictException);
  assert.ok(!x.queries.some(q=>q.sql.includes("reserved_qty=reserved_qty-1")));
 });
 test("real schema only uses original CG12 stock_balance and deferred source proof",()=>{
  const sql=readFileSync("db/migrations/3509_cg12_original_reward_stock_hold.sql","utf8");
  const core=readFileSync("db/migrations/3507_cg13_us003_digital_reward_holds.sql","utf8");
  for(const x of ["REFERENCES stock_balance(root_realm_id,item_id,location_id)",
   "cg12_reward_hold_at_commit","FROM stock_hold m",
   "stock_reward_hold_event","CG12 actual reserved projection"])
   assert.ok(sql.includes(x),x);
  for(const x of ["NEW.product_type='PHYSICAL'","stock_reward_hold h",
   "h.state='RELEASED'"])
   assert.ok(core.includes(x),x);
  assert.ok(!sql.includes("CREATE TABLE reward_stock_balance"));
 });
});

describe("CG13-US003-QA10 genuine CG12 confirmed-ISSUE retry source",()=>{
 const operation="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const issueKey="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
 const actor={realmId:ROOT,accountId:ACCOUNT};
 function issueFixture({state="ISSUED",confirmed=true,otherActor=false}:{
  state?:"ISSUED"|"HELD";confirmed?:boolean;otherActor?:boolean}={}){
  const queries:{sql:string;args:unknown[]}[]=[];
  const tx={query:async(sql:string,args:unknown[]=[])=>{
   queries.push({sql,args});
   if(sql.includes("FROM stock_reward_hold h JOIN redemption r"))
    return {rows:[{holdId:HOLD,issueKey,item:ITEM,location:LOCATION,
     state,recipient:ACCOUNT,kind:"PHYSICAL",relationshipRef:MEMBER,
     recipientKind:"MEMBER"}],rowCount:1};
   if(sql.includes("FROM stock_operation_draft WHERE"))
    return {rows:confirmed?[{ref:operation,actor:otherActor?BRANCH:ACCOUNT,
     status:"CONFIRMED"}]:[],rowCount:confirmed?1:0};
   if(sql.includes('m.branch_ref AS "branchRef"'))
    return {rows:[{branchRef:null}],rowCount:1};
   if(sql.includes("INSERT INTO stock_operation_draft"))
    return {rows:[{ref:operation}],rowCount:1};
   return {rows:[],rowCount:1};
  }};
  const catalog={store:async()=>({branch_ref:null,delivery_proof_required:true})};
  return {tx,catalog,queries};
 }
 test("confirmed original CG12 ISSUE replays after redemption advanced, no new movement",async()=>{
  const f=issueFixture();
  const result=await prepareRewardIssueDraft(f.tx as never,actor as never,
   f.catalog as never,CLAIM);
  assert.deepEqual(result,{operationRef:operation,status:"CONFIRMED",
   proofRequired:true,replayed:true});
  assert.ok(!f.queries.some(q=>q.sql.includes("INSERT INTO stock_operation_draft")));
  assert.ok(!f.queries.some(q=>q.sql.includes("INSERT INTO stock_event")));
  assert.ok(!f.queries.some(q=>q.sql.includes("FROM member m")));
  assert.match(f.queries[0].sql,/r.state IN\('ISSUED_AWAITING_HANDOVER','FULFILLED'\)/);
  assert.match(f.queries[0].sql,/FOR SHARE OF r,h/);
 });
 test("an issued reward without its original confirmed operation fails closed",async()=>{
  const f=issueFixture({confirmed:false});
  await assert.rejects(()=>prepareRewardIssueDraft(f.tx as never,actor as never,
   f.catalog as never,CLAIM),ConflictException);
  assert.ok(!f.queries.some(q=>q.sql.includes("INSERT INTO stock_operation_draft")));
 });
 test("a different warehouse operator cannot retrieve or duplicate the original ISSUE",async()=>{
  const f=issueFixture({otherActor:true});
  await assert.rejects(()=>prepareRewardIssueDraft(f.tx as never,actor as never,
   f.catalog as never,CLAIM),ForbiddenException);
  assert.ok(!f.queries.some(q=>q.sql.includes("INSERT INTO stock_operation_draft")));
 });
 test("current HELD reward still requires a live CG04 recipient before draft preparation",async()=>{
  const f=issueFixture({state:"HELD",confirmed:false});
  const result=await prepareRewardIssueDraft(f.tx as never,actor as never,
   f.catalog as never,CLAIM);
  assert.equal(result.status,"DRAFT");
  assert.equal(result.replayed,false);
  assert.ok(f.queries.some(q=>q.sql.includes('m.branch_ref AS "branchRef"')));
  assert.ok(f.queries.some(q=>q.sql.includes("INSERT INTO stock_operation_draft")));
 });
});
