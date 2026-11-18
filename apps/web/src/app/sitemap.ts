import type {MetadataRoute} from "next";
import {publishedCmsPage,publishedCmsArticles} from "../features/cms-public-content/cms-public-source";
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
 const [home,about,impact,legal,gallery,healthcare,articles]=await Promise.all([
  publishedCmsPage("home"),publishedCmsPage("about"),publishedCmsPage("our-impact"),
  publishedCmsPage("80g"),publishedCmsPage("gallery"),
  publishedCmsPage("healthcare"),publishedCmsArticles()]);
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
 if(articles.available)for(const article of articles.posts){
  if(!/^\/blog\/[a-z0-9-]{1,70}$/.test(article.path))continue;
  results.push({url:new URL(article.path,origin).toString(),
   changeFrequency:"weekly",priority:0.55});
 }
 return results;
}
