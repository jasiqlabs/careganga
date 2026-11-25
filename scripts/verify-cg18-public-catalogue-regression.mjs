// Offline regression of actual public route and response guards. Run from repository root.
// Does not replace application build, browser, backend or device QA.
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const paths={
  "native": "apps/android-public/src/features/cms/public-cms-screen.tsx",
  "web": "apps/web/src/features/cms-public-content/cms-cta-route.ts",
  "feed": "apps/web/src/features/cms-public-content/cms-public-source.ts",
  "directory": "apps/web/src/app/health-network/page.tsx"
};
const sources=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,readFileSync(p,"utf8")]));
function verify(sources,assert){
 const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,"source boundary "+a);return s.slice(i,j)};
 const routes=["/","/about","/contact","/our-impact","/ngo-information","/gallery","/videos","/publications","/healthcare","/our-work","/upcoming-projects","/collaboration","/membership","/volunteer","/campaigns"];
 const published=routes.filter(x=>!["/","/contact","/videos","/publications","/membership","/volunteer"].includes(x));
 const nativeCode=between(sources.native,"const local=","async function published").replace("(v:unknown)","(v)")+"\n"+between(sources.native,"const canNavigate=","const navigate=").replace("(href:unknown)","(href)");
 const native=new Function("publishedPaths","memberJoin","volunteerJoin","const text=v=>typeof v==='string'?v:'';\n"+nativeCode+"\nreturn canNavigate;");
 const webCode=sources.web.replace(/^import type .*;\n/m,"").replace("const routes:readonly string[]","const routes").replace("export const isCmsCtaRoute=(value:unknown):value is string","const isCmsCtaRoute=(value)").replace("export function effectiveCmsCtaRoute(value:unknown,navigation?:PublicCmsNavigation|null):string|null","function effectiveCmsCtaRoute(value,navigation)");
 const web=new Function(webCode+"\nreturn effectiveCmsCtaRoute;")();
 let cta=0;for(let mask=0;mask<2**published.length;mask++)for(const member of [false,true])for(const volunteer of [false,true]){
  const paths=published.filter((_,i)=>mask&(1<<i));const n=native(paths,member,volunteer);const nav={publishedRoutes:paths.map(path=>({path})),memberJoin:{visible:member,path:"/membership"},volunteerJoin:{visible:volunteer,path:"/volunteer"}};
  for(const r of [...routes,"/admin","https://example.invalid",null]){assert(n(r)===!!web(r,nav),"CTA parity "+r+" mask "+mask);cta++;}
 }
 const row={slug:"approved-news",path:"/blog/approved-news",title:"QA",category:"News",excerpt:"QA excerpt",asOfDate:"2026-11-25"};
 const good={schemaVersion:1,posts:[row],nextCursor:null};
 const cases=[[good,true],[{...good,posts:[]},true],[{...good,nextCursor:"next-page"},true],[{...good,schemaVersion:2},false],[{...good,posts:Array.from({length:21},(_,i)=>({...row,slug:"item-"+i,path:"/blog/item-"+i}))},false],[{...good,posts:[row,row]},false],[{...good,posts:[null]},false],[{...good,posts:[{...row,slug:"../x"}]},false],[{...good,posts:[{...row,path:"/admin"}]},false],[{...good,posts:[{...row,title:{}}]},false],[{...good,posts:[{...row,category:"a".repeat(81)}]},false],[{...good,posts:[{...row,excerpt:{}}]},false],[{...good,posts:[{...row,excerpt:"a".repeat(401)}]},false],[{...good,posts:[{...row,asOfDate:"today"}]},false],[{...good,nextCursor:"../x"},false]];
 let feeds=0;for(const s of [sources.native,sources.feed]){
 const body="const validDate=(value)=>{if(typeof value!==\"string\"||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return false;const parsed=new Date(value+\"T00:00:00.000Z\");return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};\nconst cursor=\"\";\n"+between(s,"const valid=(raw:unknown)"," }catch{return").replace(/\(raw:unknown\):raw is \w+/,"(raw)").replace("raw as Record<string,unknown>","raw");
 const validate=new Function("x","try{"+body+"}catch{return {available:false};}");for(const [x,want] of cases){assert(validate(x).available===want,"article response validation");feeds++;}
 }
 return {cta,feeds};
}
console.log(verify(sources,assert));
