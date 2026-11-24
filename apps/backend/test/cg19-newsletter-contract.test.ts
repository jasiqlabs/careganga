import test from "node:test";
import assert from "node:assert/strict";
import {BadRequestException,ServiceUnavailableException} from "@nestjs/common";
import {NewsletterConsentService} from "../src/modules/cg-19-documents-notifications/application/newsletter-consent.service";

type Row=Record<string,unknown>;
/** In-memory query doubles exercise real service logic; no network, provider, DB migration
 * or runtime browser/device claims. PostgreSQL locking/constraints need disposable DB QA. */
test("CG19 newsletter: explicit consent, verified code, replay, provider-off withdrawal",async()=>{
 const old=process.env.IDENTITY_ENCRYPTION_KEY;
 process.env.IDENTITY_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("base64");
 const root="11111111-1111-4111-8111-111111111111";
 const email="newsletter-test@example.invalid";
 const challenges=new Map<string,Row>();let subscription:Row|undefined;
 const events:Row[]=[];const sent:string[]=[];
 let configured=true;
 const query=async(sql:string,params:unknown[]=[])=>{
  if(sql.includes("FROM access_realm WHERE realm_key="))return {rows:[{id:root}]};
  if(sql.startsWith("BEGIN")||sql==="COMMIT"||sql==="ROLLBACK"||sql.startsWith("SET LOCAL")||sql.includes("pg_advisory_xact_lock"))return {rows:[]};
  if(sql.includes("SELECT created_at>now()"))return {rows:challenges.has(String(params[2]))?[{fresh:true}]:[]};
  if(sql.startsWith("INSERT INTO cg19_newsletter_challenge")){challenges.set(String(params[2]),{id:params[3],code_digest:params[4],withdrawal_digest:params[5],consent_version:params[6],attempt_count:0,consumed_at:null,confirmed_revision:null,expired:false});return {rows:[]};}
  if(sql.startsWith("DELETE FROM cg19_newsletter_challenge WHERE id IN"))return {rows:[]};
  if(sql.startsWith("SELECT id,code_digest"))return {rows:challenges.has(String(params[2]))?[challenges.get(String(params[2]))]:[]};
  if(sql.startsWith("UPDATE cg19_newsletter_challenge SET attempt_count")){const c=[...challenges.values()].find(x=>x.id===params[0])!;c.attempt_count=Number(c.attempt_count)+1;return {rows:[]};}
  if(sql.startsWith("SELECT state,revision,withdrawal_digest"))return {rows:subscription?[subscription]:[]};
  if(sql.startsWith("INSERT INTO cg19_newsletter_subscription")){
   const revision=Number(subscription?.revision??0)+1;
   subscription={state:params[2],email_encrypted:params[3],withdrawal_digest:params[2]==="WITHDRAWN"?subscription?.withdrawal_digest??null:params[4],revision};
   return {rows:[{revision}]};
  }
  if(sql.startsWith("INSERT INTO cg19_newsletter_consent_event")){events.push({state:params[3],revision:params[5]});return {rows:[]};}
  if(sql.startsWith("UPDATE cg19_newsletter_challenge SET consumed_at")){const c=[...challenges.values()].find(x=>x.id===params[0])!;c.consumed_at=new Date();c.confirmed_revision=params[1];return {rows:[]};}
  if(sql.startsWith("DELETE FROM cg19_newsletter_challenge WHERE root_realm_id=")){
   if(sql.includes("action<>$3")){for(const k of challenges.keys())if(k!==params[2])challenges.delete(k);}else challenges.clear();
   return {rows:[]};
  }
  throw Error("Unexpected test query");
 };
 const db={query,connect:async()=>({query,release(){}})};
 const provider={configured:()=>configured,send:async(m:{to:string;body:string;purpose:string})=>{
  assert.equal(m.to,email);assert.equal(m.purpose,"TRANSACTIONAL");sent.push(m.body);return {state:"ACCEPTED"};
 }};
 const support={newsletterThrottle:async()=>{}};
 const service=new NewsletterConsentService(db as never,provider as never,support as never);
 try{
  await assert.rejects(()=>service.start("test-peer",{email,action:"SUBSCRIBE",consent:false}),BadRequestException);
  assert.equal(sent.length,0);assert.equal(challenges.size,0);
  configured=false;
  await assert.rejects(()=>service.start("test-peer",{email,action:"SUBSCRIBE",consent:true}),ServiceUnavailableException);
  assert.equal(challenges.size,0);configured=true;
  assert.deepEqual(await service.start("test-peer",{email,action:"SUBSCRIBE",consent:true}),{state:"CHECK_EMAIL"});
  assert.equal(subscription,undefined);assert.equal(sent.length,1);
  const code=sent[0].match(/code is (\d{8})/)?.[1]??"";
  const key=sent[0].match(/unsubscribe without another email: ([A-Za-z0-9_-]{43})/)?.[1]??"";
  assert.equal(code.length,8);assert.equal(key.length,43);
  assert.notEqual(challenges.get("SUBSCRIBE")?.code_digest,code);
  assert.deepEqual(await service.start("test-peer",{email,action:"SUBSCRIBE",consent:true}),{state:"CHECK_EXISTING_CODE"});
  assert.equal(sent.length,1);
  await assert.rejects(()=>service.confirm("test-peer",{email,action:"SUBSCRIBE",code:code==="00000000"?"11111111":"00000000"}),BadRequestException);
  assert.equal(challenges.get("SUBSCRIBE")?.attempt_count,1);
  assert.deepEqual(await service.confirm("test-peer",{email,action:"SUBSCRIBE",code}),{state:"SUBSCRIBED"});
  assert.equal(events.length,1);assert.ok(Buffer.isBuffer(subscription?.email_encrypted));
  assert.deepEqual(await service.confirm("test-peer",{email,action:"SUBSCRIBE",code}),{state:"SUBSCRIBED"});
  assert.equal(events.length,1);
  configured=false;
  assert.deepEqual(await service.withdraw("test-peer",{email,key}),{state:"WITHDRAWN"});
  assert.equal(subscription?.email_encrypted,null);assert.equal(events.length,2);
  assert.deepEqual(await service.withdraw("test-peer",{email,key}),{state:"WITHDRAWN"});
  assert.equal(events.length,2);assert.equal(sent.length,1);
  await assert.rejects(()=>service.confirm("test-peer",{email,action:"SUBSCRIBE",code}),BadRequestException);
 }finally{if(old===undefined)delete process.env.IDENTITY_ENCRYPTION_KEY;else process.env.IDENTITY_ENCRYPTION_KEY=old;}
});
