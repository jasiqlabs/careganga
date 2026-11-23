import Link from "next/link";
import type {Metadata} from "next";
import {CmsPublicPage,CmsPublicShell} from "../features/cms-public-content/cms-public-page";
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
 // A missing or withdrawn Home must NEVER display draft or unapproved
 // screenshot content. Reuse the original public site shell so independently
 // published pages and verified operational links remain navigable.
 return <CmsPublicShell navigation={navigation}>
  <section className="cg-site-content" aria-label="CareGanga website publication status">
   <h1>CareGanga Foundation</h1>
   <p role="status">{result.state==="NOT_PUBLISHED"?
    "Our public homepage has not yet been published.":
    "Our public website content is temporarily unavailable."}</p>
   <p>Other available CareGanga services can be accessed through the website navigation.</p>
   <p><Link href="/contact">Contact the Foundation</Link></p>
  </section>
 </CmsPublicShell>;
}
