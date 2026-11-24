import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {baseline} from "./verify-cms-first-publication.mjs";
import {requireCompleteManifest,deployFirstPublication} from "./deploy-cms-first-publication.mjs";
const entries=baseline.map(([slug])=>({slug}));
const env={CG_CMS_BACKEND_ORIGIN:"http://127.0.0.1:8080",CG_CMS_STAFF_TOKEN:"mock-only"};
async function fixture(t,data=entries){
 const directory=await mkdtemp(join(tmpdir(),"cg-first-release-"));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const manifest=join(directory,"private.json");
 await writeFile(manifest,JSON.stringify(data));
 return manifest;
}
test("complete eight-page approval manifest required before any publication command",()=>{
 assert.equal(requireCompleteManifest(entries),entries);
 for(const invalid of [[],entries.slice(1),[...entries.slice(1),entries[1]], [...entries.slice(1),{slug:"policy"}],null])
  assert.throws(()=>requireCompleteManifest(invalid),/complete eight-page/);
});
test("dry run checks original manifest without applying publication",async t=>{
 const manifest=await fixture(t),calls=[];
 await deployFirstPublication({manifest,env:{},run:(exe,args)=>{calls.push(args.slice(1));return {status:0};}});
 assert.deepEqual(calls,[["--manifest",manifest]]);
});
test("first deployment runs validation then publication and readiness",async t=>{
 const manifest=await fixture(t),calls=[];
 await deployFirstPublication({manifest,apply:true,env,run:(exe,args)=>{calls.push(args.slice(1));return {status:0};}});
 assert.deepEqual(calls,[["--manifest",manifest],["--manifest",manifest,"--apply"]]);
});
test("incomplete manifest, dry-run failure and missing publisher token block writes",async t=>{
 const missing=await fixture(t,entries.slice(1)),manifest=await fixture(t);
 let calls=0;
 await assert.rejects(deployFirstPublication({manifest:missing,apply:true,env,run:()=>{calls++;return {status:0};}}),/complete eight-page/);
 assert.equal(calls,0);
 await assert.rejects(deployFirstPublication({manifest,apply:true,env,run:()=>{calls++;return {status:1};}}),/release blocked/);
 assert.equal(calls,1);
 await assert.rejects(deployFirstPublication({manifest,apply:true,env:{},run:()=>{calls++;return {status:0};}}),/authorized publisher/);
 assert.equal(calls,2);
});
test("publisher failure prevents successful release promotion",async t=>{
 const manifest=await fixture(t);let calls=0;
 await assert.rejects(deployFirstPublication({manifest,apply:true,env,run:()=>({status:++calls===1?0:1})}),/release blocked/);
 assert.equal(calls,2);
});
