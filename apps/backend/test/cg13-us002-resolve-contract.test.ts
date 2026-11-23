import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {HttpException,ServiceUnavailableException} from "@nestjs/common";
import {ReferralResolveService} from "../src/modules/cg-13-referrals-rewards/application/referral-resolve.service";
const CODE="A".repeat(32);
const IP="203.0.113.9";
const SECRET=Buffer.alloc(32,7).toString("base64");
function setup(current=true){
 const seen:{sql:string;params:unknown[]}[]=[];
 let attempts=0;
 const db={query:async(sql:string,params:unknown[]=[])=>{
  seen.push({sql,params});
  if(sql.startsWith("INSERT INTO cg13_referral_resolve_attempt")){
   attempts++;return {rows:[{attempt_count:attempts}]};
  }
  if(sql.includes("FROM referral_code c")&&sql.includes("cg13_referral_code_current"))
   return {rows:current?[{name:"Foundation Invitation"}]:[]};
  return {rows:[]};
 }};
 return {service:new ReferralResolveService(db as never),seen,
  attempts:()=>attempts};
}
describe("CG13 US002 anonymous referral resolve — fake source contracts only",()=>{
 test("valid code returns only programme eligibility and no referrer fields",async()=>{
  const old=process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
  try{
   process.env.CG13_RESOLVE_HMAC_KEY_BASE64=SECRET;
   const f=setup();
   const output=await f.service.resolve({code:CODE},IP);
   assert.deepEqual(Object.keys(output).sort(),["eligible","notice","programmeName"]);
   assert.equal(output.eligible,true);
   assert.equal(output.programmeName,"Foundation Invitation");
   const lookup=f.seen.find(x=>x.sql.includes("FROM referral_code c"));
   assert.ok(lookup);
   assert.deepEqual(lookup.params,[CODE]);
   assert.ok(!lookup.sql.includes("referrer_account_ref AS"));
   assert.match(lookup.sql,/cg13_referral_code_current/);
   assert.match(lookup.sql,/root.realm_key='FOUNDATION_ROOT'/);
   const throttle=f.seen.find(x=>x.sql.startsWith("INSERT INTO cg13_referral_resolve_attempt"));
   assert.ok(throttle);
   assert.equal(throttle.params.length,1);
   assert.match(String(throttle.params[0]),/^[0-9a-f]{64}$/);
   assert.ok(!JSON.stringify(f.seen).includes(IP));
  }finally{
   if(old===undefined)delete process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
   else process.env.CG13_RESOLVE_HMAC_KEY_BASE64=old;
  }
 });
 test("invalid unknown or revoked code returns identical non-identifying shape",async()=>{
  const old=process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
  try{
   process.env.CG13_RESOLVE_HMAC_KEY_BASE64=SECRET;
   const f=setup(false);
   const unknown=await f.service.resolve({code:CODE},IP);
   const malformed=await f.service.resolve({code:"not-a-code"},IP);
   const unexpected=await f.service.resolve({code:CODE,referrer:"guess"},IP);
   for(const result of [unknown,malformed,unexpected]){
    assert.equal(result.eligible,false);
    assert.equal(result.programmeName,null);
    assert.deepEqual(Object.keys(result).sort(),["eligible","notice","programmeName"]);
   }
   assert.equal(f.attempts(),3);
   assert.equal(f.seen.filter(x=>x.sql.includes("FROM referral_code c")).length,1);
  }finally{
   if(old===undefined)delete process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
   else process.env.CG13_RESOLVE_HMAC_KEY_BASE64=old;
  }
 });
 test("25 anonymous checks permitted, request 26 is rejected and persisted",async()=>{
  const old=process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
  try{
   process.env.CG13_RESOLVE_HMAC_KEY_BASE64=SECRET;
   const f=setup(false);
   for(let i=0;i<25;i++)await f.service.resolve({code:"invalid"},IP);
   await assert.rejects(()=>f.service.resolve({code:CODE},IP),(e:unknown)=>{
    assert.ok(e instanceof HttpException);
    assert.equal(e.getStatus(),429);return true;
   });
   assert.equal(f.attempts(),26);
   assert.equal(f.seen.filter(x=>x.sql.includes("FROM referral_code c")).length,0);
  }finally{
   if(old===undefined)delete process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
   else process.env.CG13_RESOLVE_HMAC_KEY_BASE64=old;
  }
 });
 test("unconfigured HMAC key or untrusted remote IP fails closed before DB",async()=>{
  const old=process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
  try{
   delete process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
   const f=setup();
   await assert.rejects(()=>f.service.resolve({code:CODE},IP),ServiceUnavailableException);
   process.env.CG13_RESOLVE_HMAC_KEY_BASE64=SECRET;
   await assert.rejects(()=>f.service.resolve({code:CODE},"attacker,x-forwarded-for"),
    ServiceUnavailableException);
   assert.equal(f.seen.length,0);
  }finally{
   if(old===undefined)delete process.env.CG13_RESOLVE_HMAC_KEY_BASE64;
   else process.env.CG13_RESOLVE_HMAC_KEY_BASE64=old;
  }
 });
});
