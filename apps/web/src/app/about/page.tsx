import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsPublicPage} from "../../features/cms-public-content/cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 const r=await publishedCmsPage("about");
 return r.state==="PUBLISHED"?{title:r.page.seoTitle,
  description:r.page.seoDescription,
  alternates:{canonical:r.page.canonicalPath},robots:{index:true,follow:true}}:
  {title:"CareGanga Foundation — About",robots:{index:false,follow:false}};
}
export default async function FoundationAbout(){
 const r=await publishedCmsPage("about");
 const navigation=await publishedCmsNavigation();
 if(r.state==="NOT_PUBLISHED")notFound();
 if(r.state!=="PUBLISHED")return <main className="page main">
  <h1>Foundation information temporarily unavailable</h1>
  <p>We could not verify the currently published About page.</p>
  <a href="/">Return home</a>
 </main>;
 return <CmsPublicPage page={r.page} navigation={navigation}/>;
}
