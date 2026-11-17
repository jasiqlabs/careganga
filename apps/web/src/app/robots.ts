import type {MetadataRoute} from "next";
export const dynamic="force-dynamic";
/** Robots guidance is not authorization; draft/API routes are server-protected.
 * Do not publish a sitemap for an unconfigured host.
 */
export default function robots():MetadataRoute.Robots{
 const rules=[{userAgent:"*",allow:"/",disallow:["/admin/","/api/","/internal/"]}];
 const origin=process.env.PUBLIC_SITE_ORIGIN;
 try{
  if(origin){
   const site=new URL(origin);
   if(site.protocol==="https:"&&site.pathname==="/"&&!site.search&&!site.hash)
    return {rules,sitemap:new URL("/sitemap.xml",site).toString()};
  }
 }catch{}
 return {rules};
}
