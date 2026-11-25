import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {BadRequestException,ForbiddenException} from "@nestjs/common";
import {SupportService} from "../src/modules/cg-19-documents-notifications/application/support.service";

// Real service validation and query parameter binding with a DB double.
// PostgreSQL execution and end-to-end UI/device testing remain separate.
const realmId="11111111-1111-4111-8111-111111111111";
const accountId="22222222-2222-4222-8222-222222222222";
const caseId="33333333-3333-4333-8333-333333333333";
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
function fixture(allowed=true){
  const calls:{sql:string;params:unknown[]}[]=[];
  const db={query:async(sql:string,params:unknown[]=[])=>{
    calls.push({sql,params});
    if(sql.startsWith("SELECT 1 FROM access_realm"))return {rowCount:1,rows:[{}]};
    if(sql.startsWith("SELECT c.*"))return {rowCount:0,rows:[]};
    if(sql.startsWith("SELECT count(*) AS total"))return {rowCount:1,rows:[{total:"2",open:"1",replied:"1",closed:"1",unread:"0",archived:"0",received_today:"1"}]};
    throw Error("Unexpected query");
  }};
  const sessions={requireAction:async(_token:string,action:string)=>{
    assert.equal(action,"support.cases.view");
    if(!allowed)throw new ForbiddenException("Denied");
    return {realmId,accountId};
  }};
  return {service:new SupportService(db as never,sessions as never,{} as never,{} as never),calls};
}
test("CG19 support search: default contract, real parameters, aggregate status filters",async()=>{
  const {service,calls}=fixture();
  const original=await service.cases("test",30,"ALL",null,"");
  assert.equal(original.counts.total,2);
  assert.deepEqual(calls[1].params,[realmId,accountId,"ALL",31,null,null,null,"ALL",null,null]);
  assert.equal(original.nextCursor,null);
  calls.length=0;
  await service.cases("test",10,"OPEN_GROUP",null,"","WEEK","2026-11-01","2026-11-25");
  assert.deepEqual(calls[1].params,[realmId,accountId,"OPEN_GROUP",11,null,null,null,"WEEK","2026-11-01","2026-11-25"]);
  assert.match(calls[1].sql,/c\.realm_id=\$1/);
  assert.match(calls[1].sql,/OPEN_GROUP/);
  assert.match(calls[1].sql,/CLOSED_GROUP/);
  assert.match(calls[1].sql,/\$10::date/);
  assert.ok(!calls[1].sql.includes("2026-11-01"));
});
test("CG19 support search: reject invalid dates, limits and unauthorized requests",async()=>{
  const {service,calls}=fixture();
  for(const [activity,from,to] of [["BAD","",""],["ALL","2026-02-30",""],["ALL","2026-11-26","2026-11-25"],["ALL","2026-1-1",""]]){
    await assert.rejects(()=>service.cases("test",10,"ALL",null,"",activity,from,to),BadRequestException);
  }
  await assert.rejects(()=>service.cases("test",50,"ALL"),BadRequestException);
  assert.ok(calls.every(c=>c.sql.startsWith("SELECT 1 FROM access_realm")));
  const denied=fixture(false);
  await assert.rejects(()=>denied.service.cases("test"),ForbiddenException);
  assert.equal(denied.calls.length,0);
});
test("CG19 support search: cursors bind to status and date range, old defaults remain valid",async()=>{
  const {service,calls}=fixture();
  const cursor=(filter:string,proof:string)=>Buffer.from(JSON.stringify({t:"2026-11-25 10:00:00+00",id:caseId,filter,searchProof:proof})).toString("base64url");
  const old=cursor("ALL",sha(""));
  await service.cases("test",10,"ALL",old,"");
  assert.equal(calls[1].params[5],caseId);
  const from="2026-11-01",to="2026-11-25";
  const bound=cursor("OPEN_GROUP",sha("|"+JSON.stringify(["WEEK",from,to])));
  await service.cases("test",10,"OPEN_GROUP",bound,"","WEEK",from,to);
  await assert.rejects(()=>service.cases("test",10,"CLOSED_GROUP",bound,"","WEEK",from,to),BadRequestException);
  await assert.rejects(()=>service.cases("test",10,"OPEN_GROUP",bound,"","MONTH",from,to),BadRequestException);
});
