import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {creditVerifiedCG04Qualification} from
 "../src/modules/cg-13-referrals-rewards/application/verified-qualification.source";
const ROOT="11111111-1111-4111-8111-111111111111";
const APPLICANT="22222222-2222-4222-8222-222222222222";
const APPLICATION="33333333-3333-4333-8333-333333333333";
const ATTRIBUTION="44444444-4444-4444-8444-444444444444";
const PROGRAMME="55555555-5555-4555-8555-555555555555";
const REFERRER="66666666-6666-4666-8666-666666666666";
const RELATIONSHIP="77777777-7777-4777-8777-777777777777";
const WALLET="88888888-8888-4888-8888-888888888888";
const EVENT="99999999-9999-4999-8999-999999999999";
const DIGEST="a".repeat(64);
type Trace={sql:string;params:unknown[]};
function fixture(kind:"MEMBER"|"VOLUNTEER"="MEMBER",
 options:{attribution?:boolean;fraud?:boolean;already?:boolean;current?:boolean;
  latestDigest?:string;changedCode?:boolean;autoRank?:boolean}={}){
 const trace:Trace[]=[];
 const client={
  query:async(sql:string,params:unknown[]=[])=>{
   trace.push({sql,params});
   if(sql.includes("FROM referral_attribution att")&&sql.includes("FOR UPDATE OF att"))
    return {rows:options.attribution===false?[]:[{
     id:ATTRIBUTION,programme:PROGRAMME,referrerKind:"MEMBER",
     referrerRelationship:RELATIONSHIP,referrerAccount:REFERRER,
     policyVersion:2,awardPoints:"75",submittedDigest:DIGEST,
     state:options.fraud?"HELD_FRAUD_REVIEW":"PENDING",codeValue:"C".repeat(32)
    }]};
   if(sql.includes("SELECT 1 FROM points_event"))
    return {rows:options.already?[{exists:true}]:[],rowCount:options.already?1:0};
   if(sql.includes("SELECT cg13_referral_code_current"))
    return {rows:[{current:options.current!==false}]};
   if(sql.includes("SELECT submitted_digest AS digest,referral_input AS referral FROM "))
    return {rows:[{digest:options.latestDigest??DIGEST,
     referral:options.changedCode?"Q".repeat(32):"C".repeat(32)}]};
   if(sql.includes("FROM points_account")&&sql.includes("FOR UPDATE"))
    return {rows:[{id:WALLET,earnedPoints:"125",reversedPoints:"0",
     spentPoints:"0",heldPoints:"0",qualifiedReferrals:2,currentRankName:"Starter",
     currentRankSort:1,currentRankPolicyVersion:1}]};
   if(sql.includes("INSERT INTO points_event("))return {rows:[{id:EVENT}]};
   if(sql.includes("FROM referral_policy_version"))
    return {rows:[{autoRankUpgrade:options.autoRank!==false}]};
   if(sql.includes("FROM referral_rank_rule"))
    return {rows:sql.includes("minimum_verified_referrals<=$4")?
     [{name:"Champion",sort:3}]:[{name:"Starter",sort:1}]};
   return {rows:[],rowCount:1};
  }
 };
 const input={root:ROOT,applicantKind:kind,application:APPLICATION,applicantAccount:APPLICANT};
 return {client,trace,input};
}
describe("CG13 US002 genuine CG04 qualification adapter source-contract, NOT live PG",()=>{
 test("a real member activation records one award and frozen rank snapshot",async()=>{
  const x=fixture();const result=await creditVerifiedCG04Qualification(x.client as never,x.input);
  assert.equal(result,"CREDITED");
  const insert=x.trace.find(t=>t.sql.includes("INSERT INTO points_event("));
  assert.ok(insert);assert.deepEqual(insert.params,[ROOT,WALLET,ATTRIBUTION,2,"75",DIGEST]);
  const wallet=x.trace.find(t=>t.sql.includes("UPDATE points_account SET"));
  assert.ok(wallet);assert.deepEqual(wallet.params,[ROOT,WALLET,"200",3,"Champion",3,2]);
  const rank=x.trace.find(t=>t.sql.includes("INSERT INTO reward_rank_event("));
  assert.ok(rank);assert.deepEqual(rank.params,[ROOT,WALLET,EVENT,2,"Starter","Champion",3,3,"200"]);
  assert.ok(!x.trace.some(t=>/UPDATE referral_attribution|INSERT INTO member|INSERT INTO volunteer/.test(t.sql)));
 });
 test("auto-rank disabled preserves current rank without inventing a promotion",async()=>{
  const x=fixture("MEMBER",{autoRank:false});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"CREDITED");
  const wallet=x.trace.find(t=>t.sql.includes("UPDATE points_account SET"));
  assert.ok(wallet);
  assert.deepEqual(wallet.params,[ROOT,WALLET,"200",3,"Starter",1,1]);
  const event=x.trace.find(t=>t.sql.includes("INSERT INTO reward_rank_event("));
  assert.ok(event);
  assert.deepEqual(event.params,[ROOT,WALLET,EVENT,2,"Starter","Starter",1,3,"200"]);
  assert.ok(x.trace.some(t=>t.sql.includes("SELECT auto_rank_upgrade")));
 });
 test("a corrected CG04 application uses its CURRENT approved digest but preserves original award",async()=>{
  const newDigest="b".repeat(64);
  const x=fixture("MEMBER",{latestDigest:newDigest});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"CREDITED");
  const event=x.trace.find(t=>t.sql.includes("INSERT INTO points_event("));
  assert.ok(event);
  assert.deepEqual(event.params,[ROOT,WALLET,ATTRIBUTION,2,"75",newDigest]);
  const current=x.trace.find(t=>t.sql.includes("SELECT submitted_digest AS digest"));
  assert.ok(current);
  assert.match(current.sql,/membership_application/);
  assert.deepEqual(current.params,[ROOT,APPLICATION,APPLICANT]);
 });
 test("a corrected application cannot swap the first attributed referrer",async()=>{
  const x=fixture("MEMBER",{changedCode:true});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"INELIGIBLE");
  assert.ok(!x.trace.some(t=>t.sql.includes("INSERT INTO points_event(")));
 });
 test("volunteer credits require actual volunteer application and SAME frozen event",async()=>{
  const x=fixture("VOLUNTEER");
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"CREDITED");
  const sql=x.trace.find(t=>t.sql.includes("FROM referral_attribution att"))!;
  assert.match(sql.sql,/att\.volunteer_application_ref=\$3/);
  assert.deepEqual(sql.params,[ROOT,"VOLUNTEER",APPLICATION,APPLICANT]);
 });
 test("no committed attribution grants nothing, not even an empty wallet",async()=>{
  const x=fixture("MEMBER",{attribution:false});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"NONE");
  assert.ok(!x.trace.some(t=>t.sql.includes("INSERT INTO points_")));
 });
 test("possible circular fraud never receives automatic points",async()=>{
  const x=fixture("MEMBER",{fraud:true});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"HELD_FRAUD_REVIEW");
  assert.ok(!x.trace.some(t=>t.sql.includes("INSERT INTO points_")));
 });
 test("ineligible or revoked referrer receives no automatic credit",async()=>{
  const x=fixture("MEMBER",{current:false});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"INELIGIBLE");
  assert.ok(!x.trace.some(t=>t.sql.includes("INSERT INTO points_")));
 });
 test("duplicate activation/transaction retry yields original immutable credit",async()=>{
  const x=fixture("MEMBER",{already:true});
  assert.equal(await creditVerifiedCG04Qualification(x.client as never,x.input),"PREVIOUS");
  assert.ok(!x.trace.some(t=>t.sql.includes("UPDATE points_account")));
 });
 test("source wiring occurs after original CG04 approval and never in referral controller",()=>{
  const member=readFileSync("src/modules/cg-04-membership-volunteers/application/membership-activation.service.ts","utf8");
  const volunteer=readFileSync("src/modules/cg-04-membership-volunteers/application/volunteer-activation.service.ts","utf8");
  for(const src of [member,volunteer]){
   const completed=src.indexOf("await this.approvals.complete");
   const credited=src.indexOf("await creditVerifiedCG04Qualification");
   assert.ok(completed>0&&credited>completed);
  }
 });
 test("verified credit is in the ORIGINAL CG04 activation transaction, not a best-effort callback",()=>{
  for(const owner of ["membership-activation","volunteer-activation"]){
   const src=readFileSync(
    "src/modules/cg-04-membership-volunteers/application/"+owner+".service.ts","utf8");
   assert.match(src,/await tx\.query\("BEGIN"\)/);
   assert.match(src,/await tx\.query\("COMMIT"\)/);
   assert.match(src,/await tx\.query\("ROLLBACK"\)/);
   const completion=owner.startsWith("membership")?
    "await this.approvals.completeMembership":"await this.approvals.completeVolunteer";
   const start=src.indexOf("async activate(");
   assert.ok(start>=0);
   const body=src.slice(start);
   assert.ok(body.indexOf(completion)>=0);
   assert.ok(body.indexOf("await creditVerifiedCG04Qualification")>
    body.indexOf(completion));
   // Same transaction worker fn contains activation and award; failure
   // rolls both back. No out-of-TX asynchronous points callback exists.
   assert.ok(body.includes("return this.run(token,async(tx,a)=>"));
  }
 });
 test("migration requires immutable CG04 effects and defers balance projection check",()=>{
  const migration=readFileSync("db/migrations/3506_cg13_us002_verified_points_rank_ledger.sql","utf8");
  for(const signature of ["CREATE FUNCTION cg13_points_event_source_guard",
   "JOIN membership_application_effect effect","JOIN volunteer_approval_effect effect",
   "finance_membership_verified_collection","finance_membership_verified_refund",
   "CREATE CONSTRAINT TRIGGER cg13_points_account_projection_commit",
   "CREATE CONSTRAINT TRIGGER cg13_points_event_projection_commit",
   "CREATE TRIGGER cg13_rank_event_insert_guard",
   "e.points_account_id=NEW.points_account_id",
   "wallet.qualified_referrals=NEW.qualified_referrals_snapshot",
   "wallet.current_rank_sort IS NOT DISTINCT FROM NEW.resulting_rank_sort"])
   assert.ok(migration.includes(signature),signature);
  assert.ok(!migration.includes("CREATE TABLE reward_stock"));
 });
});
