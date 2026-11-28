import "server-only";
import type {PublicCmsPage} from "./cms-public-page";
export type CmsPageResult={state:"PUBLISHED";page:PublicCmsPage}|
 {state:"NOT_PUBLISHED"|"UNAVAILABLE";page:null};
export async function publishedCmsPage(slug:string):Promise<CmsPageResult>{
 if(!/^[a-z0-9][a-z0-9-]{0,69}$/.test(slug))return {state:"NOT_PUBLISHED",page:null};
 const backend=process.env.BACKEND_URL;
 if(!backend)return {state:"UNAVAILABLE",page:null};
 try{
  const response=await fetch(new URL("/api/public/content/pages/"+slug,backend),
   {cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(response.status===404)return {state:"NOT_PUBLISHED",page:null};
  if(!response.ok)return {state:"UNAVAILABLE",page:null};
  const p:unknown=await response.json();
  if(!p||typeof p!=="object"||Array.isArray(p))throw Error();
  const source=p as Record<string,unknown>;
  if(source.schemaVersion!==1||typeof source.effectiveGeneration!=="string"||
    typeof source.title!=="string"||typeof source.seoTitle!=="string"||
    typeof source.seoDescription!=="string"||!Array.isArray(source.sections)||
    !source.sections.every(section=>!!section&&typeof section==="object"&&!Array.isArray(section)&&
      typeof section.kind==="string"&&Number.isSafeInteger(section.order)&&section.order>=0&&
      !!section.fields&&typeof section.fields==="object"&&!Array.isArray(section.fields))||
    !Array.isArray(source.assets)||!source.assets.every(asset=>!!asset&&typeof asset==="object"&&!Array.isArray(asset)&&
      ["HERO","MOBILE_HERO","TEAM","ABOUT","PROMO","FEATURE","GALLERY","ARTICLE","DOCUMENT","IMPACT","CONTACT"].includes(asset.role)&&
      Number.isSafeInteger(asset.order)&&asset.order>=0&&asset.order<=100&&typeof asset.altText==="string"&&asset.altText.trim().length>0&&
      typeof asset.src==="string"&&(/^\/api\/public\/content\/media\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(asset.src)||
       /^\/api\/public\/content\/release-media\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.src)))||source.slug!==slug||
    !["HOME","ABOUT","IMPACT","COMPLIANCE","GALLERY","ARTICLE","CONTACT","HEALTHCARE","POLICY","PARTNERS","PROJECTS"].includes(
       String(source.kind))||
    (source.kind==="PROJECTS"&&!["our-work","upcoming-projects"].includes(slug))||
    (source.kind==="HOME"&&slug!=="home")||
    (source.kind==="ABOUT"&&slug!=="about")||
    (source.kind==="IMPACT"&&slug!=="our-impact")||
    (source.kind==="COMPLIANCE"&&slug!=="80g")||
    (source.kind==="GALLERY"&&slug!=="gallery")||
    (source.kind==="HEALTHCARE"&&slug!=="healthcare")||
    (source.kind==="CONTACT"&&slug!=="contact")||
    (source.kind==="PARTNERS"&&slug!=="collaboration")||
    (source.kind==="POLICY"&&
     !["terms-and-conditions","privacy-policy","cookie-policy","disclaimer",
      "refund-and-cancellation","grievance-redressal",
      "copyright-and-intellectual-property"].includes(slug)))
   throw Error();
  const page=p as PublicCmsPage;
  const reservedArticleSlugs=new Set(["home","about","our-impact","80g","gallery","contact","healthcare","collaboration","our-work","upcoming-projects","terms-and-conditions","privacy-policy","cookie-policy","disclaimer","refund-and-cancellation","grievance-redressal","copyright-and-intellectual-property","admin","api","login","join","volunteer","auth","internal","_next"]);
  if(page.kind==="ARTICLE"&&reservedArticleSlugs.has(slug))throw Error();
  const canonical=page.kind==="HOME"?"/":page.kind==="COMPLIANCE"?"/ngo-information":page.kind==="ARTICLE"?"/blog/"+slug:page.kind==="POLICY"?"/policies/"+slug:"/"+slug;
  if(page.canonicalPath!==canonical)throw Error();
  if(page.kind==="ARTICLE"&&(page.canonicalPath!=="/blog/"+slug||page.sections.length!==1||page.sections[0].kind!=="ARTICLE_BODY"))throw Error();
  if(page.kind==="POLICY"&&(page.canonicalPath!=="/policies/"+slug||page.sections.length<1||page.sections.length>12||page.sections.some(section=>section.kind!=="RICH_TEXT")||page.assets.length>0))throw Error();
  if(!page.title.trim()||!page.seoTitle.trim()||page.sections.length<1||page.sections.length>24||new Set(page.sections.map(s=>s.kind+":"+s.order)).size!==page.sections.length)throw Error();
  const count=(kind:string)=>page.sections.filter(s=>s.kind===kind).length;
  const calendarDay=(value:unknown):value is string=>{
   if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
   const parsed=new Date(value+"T00:00:00Z");
   return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  };
  const today=new Date().toISOString().slice(0,10);
  if(page.kind==="HOME"&&(count("HERO")<1||count("HERO")>6))throw Error();
  if(page.kind==="HEALTHCARE"&&(count("HEALTHCARE_CATEGORIES")!==1||page.sections.some(s=>!["HERO","RICH_TEXT","HEALTHCARE_CATEGORIES","CTA"].includes(s.kind))))throw Error();
  if(page.kind==="IMPACT"){
   const groups=["HERO","PILLARS","STATS","GROWTH","GEOGRAPHY","BREAKDOWN","FOCUS","STORIES","UPDATES","CTA"];
   if(page.sections.length!==groups.length||page.sections.some(s=>s.kind!=="IMPACT_GROUP")||groups.some(g=>page.sections.filter(s=>s.fields.group===g).length!==1))throw Error();
   for(const s of page.sections){
    const f=s.fields,group=f.group;
    if(typeof f.heading!=="string"||!f.heading.trim()||!Array.isArray(f.items)||f.items.length>16)throw Error();
    if(f.items.length&&(!calendarDay(f.asOfDate)||f.asOfDate>today||typeof f.source!=="string"||!f.source.trim()))throw Error();
    for(const raw of f.items){
     if(!raw||typeof raw!=="object"||Array.isArray(raw)||typeof raw.title!=="string"||!raw.title.trim())throw Error();
     if(raw.value!==undefined&&(typeof raw.value!=="number"||!Number.isFinite(raw.value)||raw.value<0||raw.value>1e12))throw Error();
     if(raw.percentage!==undefined&&(typeof raw.percentage!=="number"||!Number.isFinite(raw.percentage)||raw.percentage<0||raw.percentage>100))throw Error();
     if((group==="STATS"||group==="GROWTH")&&typeof raw.value!=="number")throw Error();
     if(group==="BREAKDOWN"&&typeof raw.percentage!=="number")throw Error();
     if(group==="STORIES"&&raw.consentConfirmed!==true)throw Error();
    }
    if(group==="BREAKDOWN"&&f.claimsFullBreakdown===true&&Math.abs(f.items.reduce((n,r)=>n+r.percentage,0)-100)>0.001)throw Error();
   }
  }
  if(page.kind==="COMPLIANCE"){
   if(page.sections.length!==1||count("COMPLIANCE_FACTS")!==1)throw Error();
   const f=page.sections[0].fields;
   if(typeof f.heading!=="string"||!f.heading.trim()||!["VERIFIED","NOT_VERIFIED"].includes(String(f.verification))||!calendarDay(f.verifiedAsOf)||f.verifiedAsOf>today)throw Error();
   if(f.pan!==undefined&&f.pan!==""&&(typeof f.pan!=="string"||!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)))throw Error();
   if(f.documents!==undefined&&(!Array.isArray(f.documents)||f.documents.length>6||f.documents.some(d=>!d||typeof d!=="object"||Array.isArray(d)||!["80G","REGISTRATION","ANNUAL_REPORT","OTHER"].includes(String(d.type))||typeof d.title!=="string"||!d.title.trim()||!calendarDay(d.asOfDate)||d.asOfDate>today)))throw Error();
   if(f.verification==="VERIFIED"&&(!calendarDay(f.validFrom)||!calendarDay(f.validUntil)||f.validFrom>today||f.validUntil<today||typeof f.issuer!=="string"||!f.issuer.trim()||typeof f.approvalNumber!=="string"||!f.approvalNumber.trim()||typeof f.source!=="string"||!f.source.trim()||!Array.isArray(f.documents)||f.documents[0]?.type!=="80G"||!page.assets.some(a=>a.role==="DOCUMENT"&&a.order===0&&/^\/api\/public\/content\/media\//.test(a.src))))throw Error();
  }
  return {state:"PUBLISHED",page};
 }catch{return {state:"UNAVAILABLE",page:null};}
}

export type PublicCmsNavigation={schemaVersion:number;effectiveGeneration:string|null;
 publishedRoutes?:{kind:string;slug:string;path:string}[];
 login:{visible:boolean;label:string;path:string|null};
 memberJoin:{visible:boolean;label:string;path:string|null};
 volunteerJoin:{visible:boolean;label:string;path:string|null}};
export async function publishedCmsNavigation():Promise<PublicCmsNavigation|null>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return null;
 try{
  const res=await fetch(new URL("/api/public/content/navigation",backend),{
   cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(!res.ok)return null;
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  const nav=data as Record<string,unknown>,login=nav.login;
  if(nav.schemaVersion!==1||!login||typeof login!=="object"||
   !("visible" in login)||typeof login.visible!=="boolean"||
   (nav.publishedRoutes!==undefined&&(!Array.isArray(nav.publishedRoutes)||
    !nav.publishedRoutes.every(v=>!!v&&typeof v==="object"&&!Array.isArray(v)&&
     typeof v.path==="string"&&typeof v.slug==="string"&&typeof v.kind==="string"))))return null;
  return data as PublicCmsNavigation;
 }catch{return null;}
}

export type CmsArticleSummary={slug:string;title:string;category:string;
 excerpt:string;asOfDate:string;path:string};
export async function publishedCmsArticles(category="",cursor="",eventsOnly=false):
 Promise<{posts:CmsArticleSummary[];nextCursor:string|null;available:boolean}>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return {posts:[],nextCursor:null,available:false};
 try{
  const url=new URL(eventsOnly?"/api/public/content/events":"/api/public/content/articles",backend);
  if(category)url.searchParams.set("category",category);
  if(cursor)url.searchParams.set("cursor",cursor);
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(!res.ok)throw Error();
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data)||
    !("posts" in data)||!Array.isArray(data.posts))throw Error();
  const x=data as {schemaVersion?:unknown;posts:unknown[];nextCursor?:unknown};
  const validDate=(value:unknown)=>{
   if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
   const parsed=new Date(value+"T00:00:00.000Z");
   return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  };
  const valid=(raw:unknown):raw is CmsArticleSummary=>{
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
   const p=raw as Record<string,unknown>;
   return typeof p.slug==="string"&&/^[a-z0-9][a-z0-9-]{0,69}$/.test(p.slug)&&
    p.path==="/blog/"+p.slug&&typeof p.title==="string"&&
    typeof p.category==="string"&&p.category.length<=80&&
    typeof p.excerpt==="string"&&p.excerpt.length<=400&&
    validDate(p.asOfDate);
  };
  if(x.schemaVersion!==1||x.posts.length>20||!x.posts.every(valid)||
    new Set(x.posts.map(p=>p.slug)).size!==x.posts.length||
    (x.nextCursor!==null&&(typeof x.nextCursor!=="string"||!/^[a-z0-9][a-z0-9-]{0,69}$/.test(x.nextCursor)||x.nextCursor===cursor)))throw Error();
  return {posts:x.posts,nextCursor:x.nextCursor,available:true};
 }catch{return {posts:[],nextCursor:null,available:false};}
}

export type CmsPublicNotice={title:string;body:string;category:string;
 priority:"NORMAL"|"IMPORTANT";publishedOn:string;expiresOn:string;path:string};
/** Anonymous notice board reads only the approved CG19+CG18 intersection. */
export async function publishedCmsNotices():Promise<{available:boolean;notices:CmsPublicNotice[]}>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return {available:false,notices:[]};
 try{
  const response=await fetch(new URL("/api/public/content/notices",backend),{
   cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error();
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
  const source=data as Record<string,unknown>;
  if(source.schemaVersion!==1||!Array.isArray(source.notices))throw Error();
  const today=new Date().toISOString().slice(0,10);
  const validDay=(v:unknown):v is string=>{
   if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
   const date=new Date(v+"T00:00:00Z");
   return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;
  };
  const isNotice=(v:unknown):v is CmsPublicNotice=>{
   if(!v||typeof v!=="object"||Array.isArray(v))return false;
   const n=v as Record<string,unknown>;
   return typeof n.title==="string"&&n.title.length<=120&&
    typeof n.body==="string"&&n.body.length<=480&&
    typeof n.category==="string"&&n.category.length<=80&&
    (n.priority==="NORMAL"||n.priority==="IMPORTANT")&&
    validDay(n.publishedOn)&&validDay(n.expiresOn)&&
    n.publishedOn<=today&&n.expiresOn>=today&&n.publishedOn<=n.expiresOn&&
    typeof n.path==="string"&&/^\/blog\/[a-z0-9-]{1,70}$/.test(n.path);
  };
  if(source.notices.length>60||!source.notices.every(isNotice)||
   new Set(source.notices.map(n=>n.path)).size!==source.notices.length)throw Error();
  return {available:true,notices:source.notices};
 }catch{return {available:false,notices:[]};}
}

/** Public editorial intros read the same effective About revision. No owner availability or private record is inferred. */
export type PublicIntroPlacement="TEAM"|"MEMBERSHIP"|"VOLUNTEER"|"NOTICES"|"UPCOMING_PROJECTS"|"ANNUAL_REPORTS"|"FINANCIAL_REPORTS";
export type PublicIntro={heading:string;body:string;eyebrow:string;highlights:string[]};
export function selectPublicIntro(result:CmsPageResult,placement:PublicIntroPlacement):PublicIntro|null{
 if(result.state!=="PUBLISHED")return null;
 const fields=result.page.sections.find(s=>s.kind==="RICH_TEXT"&&s.fields.placement===placement)?.fields;
 if(!fields||typeof fields.heading!=="string"||typeof fields.body!=="string")return null;
 return {heading:fields.heading,body:fields.body,eyebrow:typeof fields.eyebrow==="string"?fields.eyebrow:"",highlights:Array.isArray(fields.highlights)?fields.highlights.filter((x):x is string=>typeof x==="string").slice(0,4):[]};
}
export async function publishedPublicIntro(placement:PublicIntroPlacement){return selectPublicIntro(await publishedCmsPage("about"),placement);}
