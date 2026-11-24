import {test} from "node:test";
import assert from "node:assert/strict";
import {baseline,origin,readiness} from "./verify-cms-first-publication.mjs";
const routes=[...baseline,["our-work","PROJECTS","/our-work"],["upcoming-projects","PROJECTS","/upcoming-projects"]];
const requiredIntros=["TEAM","MEMBERSHIP","VOLUNTEER","NOTICES","UPCOMING_PROJECTS","ANNUAL_REPORTS","FINANCIAL_REPORTS"];
function fixture({missing=[],badSlug="",navigation=true,omitNavSlug="",badNavGeneration=false,offlineSlug="",incompleteCopy=false,missingMedia=false,missingHealthcareMedia=false}={}){
 const called=[];
 const request=async(url,init)=>{
  assert.equal(url.origin,"http://127.0.0.1:8080");
  assert.equal(init.redirect,"error");
  assert.equal(init.cache,"no-store");
  assert.ok(init.signal);
  assert.equal(init.method,undefined);
  assert.equal(init.headers,undefined);
  called.push(url.pathname);
  if(url.pathname==="/api/public/content/navigation")return {ok:navigation,json:async()=>({schemaVersion:1,effectiveGeneration:badNavGeneration?null:"home-nav",publishedRoutes:routes.filter(([slug])=>slug!==omitNavSlug).map(([slug,kind,path])=>({slug,kind,path}))})};
  const slug=url.pathname.split("/").at(-1),route=routes.find(([s])=>s===slug);
  if(slug===offlineSlug)throw Error("offline");
  if(!route||missing.includes(slug))return {ok:false};
  return {ok:true,json:async()=>({schemaVersion:1,effectiveGeneration:"approved",slug:slug===badSlug?"wrong":slug,kind:route[1],canonicalPath:route[2],title:"Published editorial",sections:incompleteCopy?[{kind:"RICH_TEXT",fields:{heading:"Editorial"}}]:slug==="home"?["HERO","RICH_TEXT","CTA","FEATURE_CARDS","JOIN_CARDS","PROJECT_TEASER","SITE_FOOTER"].map(kind=>({kind,fields:{heading:"Editorial"}})):slug==="about"?requiredIntros.map(placement=>({kind:"RICH_TEXT",fields:{placement,heading:"Editorial",body:"Approved introduction"}})):slug==="healthcare"?[{kind:"HERO",fields:{heading:"Integrated Healthcare Assistance"}},{kind:"HEALTHCARE_CATEGORIES",fields:{categories:["Poly Clinic","Diagnostic Centre","Dental Clinic","Medical Laboratory","Hospital & Nursing Home","Retail Pharmacy","Orthopedic Centre","Homoeopathy Centre","Ayurvedic Centre"].map(title=>({title,description:"Approved healthcare category"}))}}]:slug==="contact"?[{kind:"CONTACT_INFO",fields:{faqs:[{},{},{},{}]}}]:[{kind:"RICH_TEXT",fields:{heading:"Editorial"}}],assets:(slug==="healthcare"&&!missingHealthcareMedia?[["HERO",0],...Array.from({length:9},(_,i)=>["FEATURE",i])]:slug==="home"&&!missingMedia?[["HERO",0],["ABOUT",20],["PROMO",30],["FEATURE",0],["FEATURE",1],["FEATURE",2]]:[]).map(([role,order])=>({role,order,altText:"Approved editorial illustration",src:"/api/public/content/media/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}))})};
 };
 return {request,called};
}
test("first-publication readiness checks all ten public routes and navigation without auth or writes",async()=>{
 const {request,called}=fixture();
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),[]);
 assert.equal(called.length,11);
});
test("missing home, invalid contact DTO and unavailable navigation fail closed",async()=>{
 const {request}=fixture({missing:["home"],badSlug:"contact",navigation:false});
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),["home","contact","navigation"]);
});
test("missing effective nav, absent required project route and transport error fail closed",async()=>{
 const {request}=fixture({omitNavSlug:"upcoming-projects",badNavGeneration:true,offlineSlug:"gallery"});
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),["gallery","navigation"]);
});
test("credentials, alternate paths, query strings and nonlocal insecure origins are refused",()=>{
 for(const invalid of ["https://user:pass@example.com","https://example.com/api","https://example.com/?a=1","https://example.com/#x","http://example.com","file:///tmp/test"])assert.throws(()=>origin(invalid));
 assert.equal(origin("https://example.com").href,"https://example.com/");
});

test("initial installation refuses incomplete screenshot-derived editorial sections even with a published page response",async()=>{
 const {request}=fixture({incompleteCopy:true});
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),["home-editorial-sections","about-editorial-intros","healthcare-editorial-sections","contact-faqs"]);
});

test("initial installation requires all six public Home media placements",async()=>{
 const {request}=fixture({missingMedia:true});
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),["home-editorial-media"]);
});

test("first install rejects missing healthcare category illustrations",async()=>{
 const {request}=fixture({missingHealthcareMedia:true});
 assert.deepEqual(await readiness("http://127.0.0.1:8080",request),["healthcare-editorial-media"]);
});
