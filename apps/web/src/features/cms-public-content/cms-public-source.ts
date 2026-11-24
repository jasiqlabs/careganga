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
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(response.status===404)return {state:"NOT_PUBLISHED",page:null};
  if(!response.ok)return {state:"UNAVAILABLE",page:null};
  const p:unknown=await response.json();
  if(!p||typeof p!=="object"||Array.isArray(p))throw Error();
  const source=p as Record<string,unknown>;
  if(source.schemaVersion!==1||typeof source.effectiveGeneration!=="string"||
    typeof source.title!=="string"||typeof source.seoTitle!=="string"||
    typeof source.seoDescription!=="string"||!Array.isArray(source.sections)||
    !Array.isArray(source.assets)||source.slug!==slug||
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
  return {state:"PUBLISHED",page:p as PublicCmsPage};
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
   cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!res.ok)return null;
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  const nav=data as Record<string,unknown>,login=nav.login;
  if(nav.schemaVersion!==1||!login||typeof login!=="object"||
   !("visible" in login)||typeof login.visible!=="boolean")return null;
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
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!res.ok)throw Error();
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data)||
    !("posts" in data)||!Array.isArray(data.posts))throw Error();
  const x=data as {posts:unknown[];nextCursor?:unknown};
  const posts=x.posts.filter(p=>p&&typeof p==="object"&&
   "slug" in p&&typeof p.slug==="string"&&
   "title" in p&&typeof p.title==="string"&&
   "path" in p&&typeof p.path==="string"&&
   /^\/blog\/[a-z0-9-]{1,70}$/.test(p.path))
   .slice(0,20) as CmsArticleSummary[];
  return {posts,nextCursor:typeof x.nextCursor==="string"?x.nextCursor:null,
   available:true};
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
   cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error();
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
  const source=data as Record<string,unknown>;
  if(source.schemaVersion!==1||!Array.isArray(source.notices))throw Error();
  const isNotice=(v:unknown):v is CmsPublicNotice=>{
   if(!v||typeof v!=="object"||Array.isArray(v))return false;
   const n=v as Record<string,unknown>;
   return typeof n.title==="string"&&n.title.length<=120&&
    typeof n.body==="string"&&n.body.length<=480&&
    typeof n.category==="string"&&n.category.length<=80&&
    (n.priority==="NORMAL"||n.priority==="IMPORTANT")&&
    typeof n.publishedOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(n.publishedOn)&&
    typeof n.expiresOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(n.expiresOn)&&
    typeof n.path==="string"&&/^\/blog\/[a-z0-9-]{1,70}$/.test(n.path);
  };
  if(source.notices.length>60||!source.notices.every(isNotice))throw Error();
  return {available:true,notices:source.notices};
 }catch{return {available:false,notices:[]};}
}

/** Public editorial intros read the same effective About revision. No owner availability or private record is inferred. */
export type PublicIntroPlacement="TEAM"|"MEMBERSHIP"|"VOLUNTEER"|"NOTICES"|"UPCOMING_PROJECTS"|"ANNUAL_REPORTS";
export type PublicIntro={heading:string;body:string;eyebrow:string;highlights:string[]};
export function selectPublicIntro(result:CmsPageResult,placement:PublicIntroPlacement):PublicIntro|null{
 if(result.state!=="PUBLISHED")return null;
 const fields=result.page.sections.find(s=>s.kind==="RICH_TEXT"&&s.fields.placement===placement)?.fields;
 if(!fields||typeof fields.heading!=="string"||typeof fields.body!=="string")return null;
 return {heading:fields.heading,body:fields.body,eyebrow:typeof fields.eyebrow==="string"?fields.eyebrow:"",highlights:Array.isArray(fields.highlights)?fields.highlights.filter((x):x is string=>typeof x==="string").slice(0,4):[]};
}
export async function publishedPublicIntro(placement:PublicIntroPlacement){return selectPublicIntro(await publishedCmsPage("about"),placement);}
