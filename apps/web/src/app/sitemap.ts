import type {MetadataRoute} from "next";
import {publishedCmsPage,publishedCmsArticles,publishedCmsNotices} from "../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
/** Origin URL is the actually configured public host, not an invented route.
 * Pages stay out of search results until their current CG03/CG19 approved
 * publication is effective. No stale static sitemap after withdrawal.
 */
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const configured=process.env.PUBLIC_SITE_ORIGIN;
 if(!configured)return [];
 let origin:URL;
 try{
  origin=new URL(configured);
  if(origin.protocol!=="https:"||origin.username||origin.password||
    origin.search||origin.hash||origin.pathname!=="/")return [];
 }catch{return [];}
 const [home,about,impact,legal,gallery,healthcare,articles,notices]=await Promise.all([
  publishedCmsPage("home"),publishedCmsPage("about"),publishedCmsPage("our-impact"),
  publishedCmsPage("80g"),publishedCmsPage("gallery"),
  publishedCmsPage("healthcare"),publishedCmsArticles(),publishedCmsNotices()]);
 const results:MetadataRoute.Sitemap=[];
 for(const item of [home,about,impact,legal,gallery,healthcare]){
  if(item.state!=="PUBLISHED")continue;
  const page=item.page;
  if(!["/","/about","/our-impact","/ngo-information","/gallery","/healthcare"].includes(page.canonicalPath))continue;
  const last=new Date(page.lastPublishedAt);
  results.push({url:new URL(page.canonicalPath,origin).toString(),
   ...(Number.isFinite(last.getTime())?{lastModified:last}:{}),
   changeFrequency:"weekly",priority:page.slug==="home"?1:0.65});
 }
 // Original /videos and /publications are distinct safe views over the same
 // current approved Gallery revision, never shadow media publications.
 if(gallery.state==="PUBLISHED"&&gallery.page.kind==="GALLERY"){
  for(const route of ["/videos","/publications"]){
   results.push({url:new URL(route,origin).toString(),
    changeFrequency:"weekly",priority:0.55});
  }
 }
 // Only currently approved 80G source documents create original NGO child URLs.
 if(legal.state==="PUBLISHED"&&legal.page.kind==="COMPLIANCE"){
  const fields=legal.page.sections.find(s=>s.kind==="COMPLIANCE_FACTS")?.fields??{};
  const docs=Array.isArray(fields.documents)?fields.documents:[];
  const proof=(type:string)=>docs.some((item,i)=>{
   if(!item||typeof item!=="object"||Array.isArray(item))return false;
   return (item as {type?:unknown}).type===type&&
    legal.page.assets.some(a=>a.role==="DOCUMENT"&&a.order===i&&Boolean(a.src));
  });
  const pan=typeof fields.pan==="string"&&/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(fields.pan);
  const paths=[
   ...(pan?["/ngo-information/pan-details"]:[]),
   ...(proof("REGISTRATION")?["/ngo-information/registration-certificate"]:[]),
   ...(proof("ANNUAL_REPORT")?["/ngo-information/annual-reports"]:[])
  ];
  for(const slug of paths)results.push({url:new URL(slug,origin).toString(),
   changeFrequency:"weekly",priority:0.45});
 }
 if(notices.available)results.push({url:new URL("/notices",origin).toString(),
  changeFrequency:"weekly",priority:0.55});
 if(articles.available)for(const article of articles.posts){
  if(!/^\/blog\/[a-z0-9-]{1,70}$/.test(article.path))continue;
  results.push({url:new URL(article.path,origin).toString(),
   changeFrequency:"weekly",priority:0.55});
 }
 return results;
}
