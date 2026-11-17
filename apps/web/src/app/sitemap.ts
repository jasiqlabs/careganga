import type {MetadataRoute} from "next";
import {publishedCmsPage} from "../features/cms-public-content/cms-public-source";
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
 const [home,about]=await Promise.all([publishedCmsPage("home"),publishedCmsPage("about")]);
 const results:MetadataRoute.Sitemap=[];
 for(const item of [home,about]){
  if(item.state!=="PUBLISHED")continue;
  const page=item.page;
  if(!["/","/about"].includes(page.canonicalPath))continue;
  const last=new Date(page.lastPublishedAt);
  results.push({url:new URL(page.canonicalPath,origin).toString(),
   ...(Number.isFinite(last.getTime())?{lastModified:last}:{}),
   changeFrequency:"weekly",priority:page.slug==="home"?1:0.65});
 }
 return results;
}
