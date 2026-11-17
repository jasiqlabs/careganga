import "server-only";
import type {PublicCmsPage} from "./cms-public-page";
export type CmsPageResult={state:"PUBLISHED";page:PublicCmsPage}|
 {state:"NOT_PUBLISHED"|"UNAVAILABLE";page:null};
export async function publishedCmsPage(slug:"home"|"about"):Promise<CmsPageResult>{
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
    source.kind!==(slug==="home"?"HOME":"ABOUT"))
   throw Error();
  return {state:"PUBLISHED",page:p as PublicCmsPage};
 }catch{return {state:"UNAVAILABLE",page:null};}
}

export type PublicCmsNavigation={schemaVersion:number;effectiveGeneration:string|null;
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
