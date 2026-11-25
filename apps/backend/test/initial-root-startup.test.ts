import {test} from "node:test";
import assert from "node:assert/strict";
import type {Pool} from "pg";
import {provisionInitialRoot} from "../src/modules/cg-01-identity-access/infrastructure/bootstrap-root";
import {verifyPassword} from "../src/modules/cg-01-identity-access/domain/secret-crypto";
const env={CAREGANGA_ROOT_NAME:"Isolated QA admin",CAREGANGA_ROOT_MOBILE:"9990000001",CAREGANGA_ROOT_PASSWORD:"qa-fixture-only-password"};
function fixture(existing=false,race=false,fail=false){
 const writes:string[]=[];let credential="";let connected=0;
 const tx={
  async query(sql:string,args:unknown[]=[]){
   writes.push(sql);
   if(sql.startsWith("SELECT id FROM access_realm"))return {rows:[{id:"root"}],rowCount:1};
   if(sql.startsWith("SELECT id FROM account"))return {rows:race?[{id:"existing"}]:[],rowCount:race?1:0};
   if(sql.startsWith("INSERT INTO identity_credential"))credential=String(args[1]);
   if(fail&&sql.startsWith("INSERT INTO role("))throw Error("fixture DB failure");
   return {rows:[{id:"fixture"}],rowCount:1};
  },
  release(){}
 };
 const pool={query:async()=>({rows:existing?[{}]:[],rowCount:existing?1:0}),connect:async()=>{connected++;return tx;}} as unknown as Pool;
 return {pool,writes,get connected(){return connected;},get credential(){return credential;}};
}
test("existing administrator/account store is never reinitialized",async()=>{
 const x=fixture(true);
 assert.equal(await provisionInitialRoot(x.pool,"startup",env),"existing");
 assert.equal(x.connected,0);
 await assert.rejects(provisionInitialRoot(x.pool,"operator",env),/already closed/);
});
test("empty account store refuses absent or invalid protected credentials before writes",async()=>{
 const x=fixture();
 await assert.rejects(provisionInitialRoot(x.pool,"startup",{}),/configuration is required/);
 await assert.rejects(provisionInitialRoot(x.pool,"startup",{...env,CAREGANGA_ROOT_PASSWORD:""}));
 assert.equal(x.connected,0);
});
test("first root transaction writes salted credential and audit",async()=>{
 const x=fixture();
 assert.equal(await provisionInitialRoot(x.pool,"startup",env),"created");
 assert.ok(await verifyPassword(env.CAREGANGA_ROOT_PASSWORD,x.credential));
 assert.notEqual(x.credential,env.CAREGANGA_ROOT_PASSWORD);
 assert.equal(x.writes.at(-1),"COMMIT");
 assert.ok(x.writes.some(sql=>sql.startsWith("INSERT INTO access_audit")));
});
test("concurrent account creation prevents second admin and failures roll back",async()=>{
 const x=fixture(false,true);
 assert.equal(await provisionInitialRoot(x.pool,"startup",env),"existing");
 assert.ok(!x.writes.some(sql=>sql.startsWith("INSERT INTO account(")));
 const y=fixture(false,false,true);
 await assert.rejects(provisionInitialRoot(y.pool,"startup",env),/fixture DB failure/);
 assert.equal(y.writes.at(-1),"ROLLBACK");
});
