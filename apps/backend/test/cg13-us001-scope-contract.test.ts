import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {ForbiddenException} from "@nestjs/common";
import {ReferralCatalogService} from "../src/modules/cg-13-referrals-rewards/application/referral-catalog.service";

const ROOT="11111111-1111-4111-8111-111111111111";
const OTHER_ROOT="22222222-2222-4222-8222-222222222222";
const PROGRAMME="33333333-3333-4333-8333-333333333333";
const BRANCH_A="44444444-4444-4444-8444-444444444444";
const STORE_A="55555555-5555-4555-8555-555555555555";
const ITEM="66666666-6666-4666-8666-666666666666";
const actor={realmId:ROOT,accountId:"77777777-7777-4777-8777-777777777777",
 activeSessionId:"88888888-8888-4888-8888-888888888888"};
type Seen={sql:string;params:unknown[]};
function fixture(block=false){
 const seen:Seen[]=[],actions:string[]=[],scopeCalls:string[]=[];
 let connections=0,released=0,storeCalls=0;
 const tx={
  query:async(sql:string,params:unknown[]=[])=>{
   seen.push({sql,params});
   if(sql.includes("FROM referral_program")&&sql.includes("active_policy_version"))
    return {rows:[{id:PROGRAMME,status:"ACTIVE",audience:"BOTH",active_policy_version:1}],rowCount:1};
   if(sql.includes("FROM stock_balance"))
    return {rows:[{available:"7",onHand:"10",reserved:"3"}],rowCount:1};
   if(sql.includes("FROM inventory_item")&&sql.includes("FOR SHARE"))
    return {rows:[{name:"Eligible boxed items",unit_code:"PIECE"}],rowCount:1};
   if(sql.includes("FROM inventory_item"))
    return {rows:[{ref:ITEM,name:"Eligible boxed items"}],rowCount:1};
   if(sql.includes("SELECT DISTINCT p.category"))
    return {rows:[{category:"Recognition"}],rowCount:1};
   return {rows:[],rowCount:0};
  },
  release:()=>{released++;}
 };
 const db={connect:async()=>{connections++;return tx;}};
 const sessions={requireAction:async(_bearer:string,action:string)=>{
  actions.push(action);
  if(block)throw new ForbiddenException("Denied");
  return actor;
 }};
 const identity={
  assertCurrent:async(_tx:unknown,_actor:unknown,action:string)=>{scopeCalls.push(action);},
  assertRootSelfSessionCurrent:async()=>{scopeCalls.push("current-root-self");}
 };
 const inventory={
  rewardStoreScope:async()=>({full:false,branches:[BRANCH_A]}),
  permittedRewardStores:async()=>[{ref:STORE_A,name:"Branch A Store",branchRef:BRANCH_A}],
  store:async()=>{storeCalls++;return {branch_ref:BRANCH_A,status:"ACTIVE"};}
 };
 const service=new ReferralCatalogService(db as never,sessions as never,
  identity as never,inventory as never);
 return {service,seen,actions,scopeCalls,
  stats:()=>({connections,released,storeCalls})};
}
/** Source contracts only. Actual SQL, current CG02 assignment and role-revocation
 * are separately verified in disposable Postgres + device QA; these mocks do not
 * assert a real database or successful end-to-end authorization.
 */
describe("CG13 US001 branch/permission owner boundary",()=>{
 test("reward product queries bind exact realm, programme, assigned branch and global filters",async()=>{
  const f=fixture();
  const result=await f.service.listProducts("actor",PROGRAMME,"2","  RECOGNITION  ","Recognition");
  const read=f.seen.find(x=>x.sql.includes("FROM reward_product p LEFT JOIN inventory_location"));
  assert.ok(read);
  assert.deepEqual(read.params,
   [ROOT,PROGRAMME,41,40,false,[BRANCH_A],"recognition","Recognition"]);
  assert.match(read.sql,/loc\.scope_kind='BRANCH'/);
  assert.match(read.sql,/branc[h]\.status='ACTIVE'/);
  assert.match(read.sql,/p\.category=\$8/);
  assert.ok(!read.params.includes(OTHER_ROOT));
  assert.equal(result.page,2);
  assert.deepEqual(f.actions,["rewards.catalog.view"]);
  assert.deepEqual(f.stats(),{connections:1,released:1,storeCalls:0});
 });
 test("category chips use same current permitted physical-product source",async()=>{
  const f=fixture();
  const result=await f.service.productCategories("actor",PROGRAMME);
  const sql=f.seen.find(x=>x.sql.includes("SELECT DISTINCT p.category"));
  assert.ok(sql);
  assert.deepEqual(sql.params,[ROOT,PROGRAMME,false,[BRANCH_A]]);
  assert.deepEqual(result.items,["Recognition"]);
  assert.equal(result.hasMore,false);
 });
 test("stock selector does not enumerate all Foundation warehouse locations",async()=>{
  const f=fixture();
  const result=await f.service.stockOptions("actor");
  assert.deepEqual(result.stores,
   [{ref:STORE_A,name:"Branch A Store",branchRef:BRANCH_A}]);
  assert.ok(f.scopeCalls.includes("inventory.catalog.view"));
  assert.ok(!f.seen.some(x=>x.sql.includes("FROM inventory_location")));
 });
 test("direct stock preview needs the exact reward view action and CG12 store proof",async()=>{
  const f=fixture();
  const result=await f.service.stockPreview("actor",ITEM,STORE_A);
  assert.equal(result.availableQuantity,"7");
  assert.equal(result.onHandQuantity,"10");
  assert.equal(result.reservedQuantity,"3");
  assert.deepEqual(f.actions,["rewards.catalog.view"]);
  assert.ok(f.scopeCalls.includes("inventory.catalog.view"));
  assert.equal(f.stats().storeCalls,1);
 });
 test("rejected protected action stops before connecting to the database",async()=>{
  const f=fixture(true);
  await assert.rejects(()=>f.service.listProducts("revoked",PROGRAMME),ForbiddenException);
  assert.equal(f.stats().connections,0);
 });
});
