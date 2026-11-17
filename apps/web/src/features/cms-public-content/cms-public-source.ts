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
