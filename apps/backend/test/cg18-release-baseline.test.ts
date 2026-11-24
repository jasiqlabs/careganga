import {test} from "node:test";
import assert from "node:assert/strict";
import type {Pool} from "pg";
import {CmsEditorialService} from "../src/modules/cg-18-cms-public-content/application/cms-editorial.service";
import {releaseIllustrations,verifyReleaseIllustrations} from "../src/modules/cg-18-cms-public-content/application/cms-release-illustrations";

// Exercises the actual initializer and content parser using a deterministic
// transaction harness. Database constraint/runtime tests are separate.
function fixture(existing:string[]=[]){
 const pages=new Set(existing),writes:string[]=[],published:string[]=[],assets:string[]=[];
 let installed=false,sequence=0;
 let activeSlug="";
 const tx={
  async query(sql:string,args:unknown[]=[]){
   if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return {rows:[],rowCount:0};
   if(sql.startsWith("INSERT INTO access_realm"))return {rows:[],rowCount:0};
   if(sql.startsWith("SELECT id FROM access_realm"))return {rows:[{id:"root"}],rowCount:1};
   if(sql.startsWith("SELECT 1 FROM cms_release_install"))return {rows:installed?[{}]:[],rowCount:installed?1:0};
   if(sql.startsWith("SELECT 1 FROM cms_page WHERE"))return {rows:pages.has(String(args[1]))?[{}]:[],rowCount:pages.has(String(args[1]))?1:0};
   writes.push(sql);
   if(sql.startsWith("INSERT INTO cms_page(")){activeSlug=String(args[1]);pages.add(activeSlug);}
   if(sql.startsWith("INSERT INTO cms_publication("))published.push(activeSlug);
   if(sql.startsWith("INSERT INTO cms_release_asset("))assets.push(String(args[2]));
   if(sql.startsWith("INSERT INTO cms_release_install("))installed=true;
   if(sql.startsWith("SELECT COALESCE(MAX(revision_no)"))return {rows:[{revision_no:1}],rowCount:1};
   return {rows:[{id:String(++sequence)}],rowCount:1};
  },
  release(){}
 };
 const db={connect:async()=>tx} as unknown as Pool;
 const cms=new CmsEditorialService(db,null as never,null as never,null as never,null as never,null as never,null as never,null as never);
 return {cms,pages,writes,published,assets};
}
test("bundled source-controlled artwork is exact and valid",async()=>{
 await verifyReleaseIllustrations();
 assert.equal(releaseIllustrations.length,6);
});
test("first installation publishes eight editorial pages and leaves seven policies unpublished",async()=>{
 const x=fixture();
 await x.cms.initializeReleaseBaseline();
 assert.equal(x.pages.size,15);
 assert.deepEqual(x.published.sort(),["80g","about","collaboration","contact","gallery","healthcare","home","our-impact"]);
 assert.equal(x.assets.length,6);
 const count=x.writes.length;
 await x.cms.initializeReleaseBaseline();
 assert.equal(x.writes.length,count,"redeploy must not write CMS content");
});
test("existing CMS pages are preserved, including intentionally unpublished pages",async()=>{
 const x=fixture(["home","about"]);
 await x.cms.initializeReleaseBaseline();
 assert.equal(x.pages.size,15);
 assert.equal(x.published.length,6);
 assert.ok(!x.published.includes("home"));
 assert.ok(!x.published.includes("about"));
 assert.equal(x.assets.length,0,"do not attach default images to existing editorial pages");
});
