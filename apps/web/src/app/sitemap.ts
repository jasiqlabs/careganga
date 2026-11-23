import type {MetadataRoute} from "next";
import {publishedCmsPage,publishedCmsArticles,publishedCmsNotices} from "../features/cms-public-content/cms-public-source";
import {publishedCampaigns} from "../features/campaigns/campaign-public-source";
export const dynamic="force-dynamic";
/** Origin URL is the actually configured public host, not an invented route.
 * Pages stay out of search results until their current CG03/CG19 approved
 * publication is effective. No stale static sitemap after withdrawal.
 */
async function approvedHealthSitemap(){
 const backend=process.env.BACKEND_URL;
 if(!backend)return {centers:[] as string[],doctors:[] as string[]};
 try{
  const r=await fetch(new URL("/api/v1/public/health-network/sitemap",backend),{
   cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!r.ok)throw Error("Current publication unavailable");
  const d:unknown=await r.json();
  if(!d||typeof d!=="object"||!("centers" in d)||!("doctors" in d)||
   !Array.isArray(d.centers)||!Array.isArray(d.doctors))throw Error("Invalid");
  return {
   centers:d.centers.filter((x:unknown):x is string=>
    typeof x==="string"&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(x)).slice(0,1000),
   doctors:d.doctors.filter((x:unknown):x is string=>
    typeof x==="string"&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x))
    .slice(0,1000)
  };
 }catch{return {centers:[] as string[],doctors:[] as string[]};}
}
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const configured=process.env.PUBLIC_SITE_ORIGIN;
 if(!configured)return [];
 let origin:URL;
 try{
  origin=new URL(configured);
  if(origin.protocol!=="https:"||origin.username||origin.password||
    origin.search||origin.hash||origin.pathname!=="/")return [];
 }catch{return [];}
 const [home,about,impact,legal,gallery,healthcare,articles,notices,healthDirectory,campaigns]=await Promise.all([
  publishedCmsPage("home"),publishedCmsPage("about"),publishedCmsPage("our-impact"),
  publishedCmsPage("80g"),publishedCmsPage("gallery"),
  publishedCmsPage("healthcare"),publishedCmsArticles(),publishedCmsNotices(),
  approvedHealthSitemap(),publishedCampaigns()]);
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
 if(campaigns.state==="PUBLISHED"){
  results.push({url:new URL("/campaigns",origin).toString(),changeFrequency:"daily",priority:0.65});
  for(const item of campaigns.cards)
   results.push({url:new URL("/campaigns/"+item.slug,origin).toString(),changeFrequency:"daily",priority:0.6});
 }
 if(notices.available)results.push({url:new URL("/notices",origin).toString(),
  changeFrequency:"weekly",priority:0.55});
 if(articles.available)for(const article of articles.posts){
  if(!/^\/blog\/[a-z0-9-]{1,70}$/.test(article.path))continue;
  results.push({url:new URL(article.path,origin).toString(),
   changeFrequency:"weekly",priority:0.55});
 }
 if(healthDirectory.centers.length||healthDirectory.doctors.length)
  results.push({url:new URL("/health-network",origin).toString(),
   changeFrequency:"daily",priority:0.7});
 for(const slug of healthDirectory.centers)
  results.push({url:new URL("/healthcare/centers/"+encodeURIComponent(slug),origin).toString(),
   changeFrequency:"daily",priority:0.6});
 for(const doctorRef of healthDirectory.doctors)
  results.push({url:new URL("/health-network/doctors/"+encodeURIComponent(doctorRef),origin).toString(),
   changeFrequency:"daily",priority:0.6});
 return results;
}
