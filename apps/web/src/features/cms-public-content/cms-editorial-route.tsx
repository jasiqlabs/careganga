import Link from "next/link";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsPublicPage} from "./cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";

/** One SSR source for each approved Foundation editorial route.
 * The Home publication supplies only shared original CMS footer content.
 */
export async function editorialMetadata(slug:string):Promise<Metadata>{
 const r=await publishedCmsPage(slug);
 if(r.state!=="PUBLISHED")return {title:"CareGanga Foundation",robots:{index:false,follow:false}};
 return {title:r.page.seoTitle,description:r.page.seoDescription,
  alternates:{canonical:r.page.canonicalPath},
  robots:{index:true,follow:true}};
}
export async function CmsEditorialRoute({slug}:{slug:string}){
 const [page,navigation,home]=await Promise.all([
  publishedCmsPage(slug),publishedCmsNavigation(),publishedCmsPage("home")]);
 if(page.state==="NOT_PUBLISHED")notFound();
 if(page.state!=="PUBLISHED")return <main className="page main">
  <h1>Foundation content temporarily unavailable</h1>
  <p>We could not verify the currently approved public information.</p>
  <Link href="/">Return to the homepage</Link>
 </main>;
 return <CmsPublicPage page={page.page} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?
   home.page.sections.find(section=>section.kind==="SITE_FOOTER")?.fields:null}/>;
}
