import Link from "next/link";
import type {Metadata} from "next";
import {CmsPublicPage} from "../features/cms-public-content/cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 const r=await publishedCmsPage("home");
 return r.state==="PUBLISHED"?{title:r.page.seoTitle,
  description:r.page.seoDescription,
  alternates:{canonical:r.page.canonicalPath},robots:{index:true,follow:true}}:
  {title:"CareGanga Foundation",robots:{index:false,follow:false}};
}
export default async function PublicHome(){
 const [result,navigation]=await Promise.all([publishedCmsPage("home"),publishedCmsNavigation()]);
 if(result.state==="PUBLISHED")return <CmsPublicPage page={result.page} navigation={navigation}/>;
 return <main className="page main">
  <header className="topbar"><span className="cg-brandline"><img src="/careganga-mark.png"
   width="40" height="40" alt=""/><strong>CareGanga Foundation</strong></span>
   <Link href="/admin/login">Foundation staff login</Link></header>
  <h1>CareGanga Foundation</h1>
  <p>{result.state==="NOT_PUBLISHED"?
   "Our public homepage has not yet been published.":
   "Our public website content is temporarily unavailable."}</p>
  <Link href="/contact">Contact the Foundation</Link>
 </main>;
}
