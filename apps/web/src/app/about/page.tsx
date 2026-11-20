import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsPublicPage} from "../../features/cms-public-content/cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "../../features/cms-public-content/cms-public-source";
import {UnavailablePage} from "../../shared/unavailable-page";
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
 const [navigation,home]=await Promise.all([publishedCmsNavigation(),publishedCmsPage("home")]);
 if(r.state==="NOT_PUBLISHED")notFound();
 if(r.state!=="PUBLISHED")return <UnavailablePage title="Foundation information temporarily unavailable" description="We could not verify the currently published About page." linkHref="/" linkLabel="Return home" />;
 return <CmsPublicPage page={r.page} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null}/>;
}
