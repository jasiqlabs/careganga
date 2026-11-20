import Link from "next/link";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsPublicPage} from "./cms-public-page";
import {CmsNgoSidebar} from "./cms-ngo-pages";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";
import {UnavailablePage} from "../../shared/unavailable-page";

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
 if(page.state!=="PUBLISHED")return <UnavailablePage title="Foundation content temporarily unavailable" description="We could not verify the currently approved public information." linkHref="/" linkLabel="Return to the homepage" />;
 return <CmsPublicPage page={page.page} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?
   home.page.sections.find(section=>section.kind==="SITE_FOOTER")?.fields:null}>
  {slug==="healthcare"&&<section className="cg-site-content"
   aria-label="Verified healthcare consultation booking">
   <h2>Find an approved doctor and request a consultation</h2>
   <p>CareGanga lists only currently verified healthcare providers and doctors.
    Where live working hours and consultation fees are available, an eligible
    patient can request an in-person appointment. Payment is due at the
    healthcare center, not through an online checkout.</p>
   <Link className="cg-site-action" href="/health-network?tab=doctors">
    View verified doctors &amp; book an appointment</Link>
   <p>Bookings depend on a current available slot and final confirmation.
    This is not an approval for financial assistance.</p>
  </section>}
 </CmsPublicPage>;
}

type OriginalMediaType="VIDEO"|"PUBLICATION";
const originalMediaPath=(mediaType:OriginalMediaType)=>
 mediaType==="VIDEO"?"/videos":"/publications";
const originalMediaHeading=(section:Record<string,unknown>|undefined,mediaType:OriginalMediaType)=>{
 const key=mediaType==="VIDEO"?"videosHeading":"publicationsHeading";
 const value=section?.[key];
 return typeof value==="string"&&value.trim()?
  value:mediaType==="VIDEO"?"Videos":"Publications";
};
const originalMediaDescription=(section:Record<string,unknown>|undefined,mediaType:OriginalMediaType)=>{
 const key=mediaType==="VIDEO"?"videosDescription":"publicationsDescription";
 const value=section?.[key];
 return typeof value==="string"?value:"";
};
/** Separate original visitor routes, one approved CG-18/CG-19 media source.
 * Unpublished Gallery/media remain inaccessible; nothing is auto-seeded.
 */
export async function originalMediaMetadata(mediaType:OriginalMediaType):Promise<Metadata>{
 const r=await publishedCmsPage("gallery");
 if(r.state!=="PUBLISHED"||r.page.kind!=="GALLERY")
  return {title:"CareGanga Foundation",robots:{index:false,follow:false}};
 const fields=r.page.sections.find(s=>s.kind==="GALLERY_GRID")?.fields;
 return {title:originalMediaHeading(fields,mediaType),description:
  originalMediaDescription(fields,mediaType)||r.page.seoDescription,
  alternates:{canonical:originalMediaPath(mediaType)},
  robots:{index:true,follow:true}};
}
export async function CmsOriginalMediaRoute({mediaType}:{mediaType:OriginalMediaType}){
 const [r,navigation,home]=await Promise.all([
  publishedCmsPage("gallery"),publishedCmsNavigation(),publishedCmsPage("home")]);
 if(r.state==="NOT_PUBLISHED")notFound();
 if(r.state!=="PUBLISHED"||r.page.kind!=="GALLERY")
  return <UnavailablePage title="Foundation media temporarily unavailable" description="Approved media information could not be verified." linkHref="/" linkLabel="Return to the homepage" />;
 return <CmsPublicPage page={{...r.page,canonicalPath:originalMediaPath(mediaType)}}
  mediaScope={mediaType} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?
   home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null}/>;
}

/** Original screenshot NGO Information 80G landing. CG-02 owns the legal
 * source, CG-19 verified proof and CG-18 only the approved presentation.
 * Other sidebar pages are intentionally not fake active destinations.
 */
export async function originalNgoInformationMetadata():Promise<Metadata>{
 const r=await publishedCmsPage("80g");
 if(r.state!=="PUBLISHED"||r.page.kind!=="COMPLIANCE")
  return {title:"CareGanga Foundation",robots:{index:false,follow:false}};
 return {title:r.page.seoTitle,description:r.page.seoDescription,
  alternates:{canonical:"/ngo-information"},robots:{index:true,follow:true}};
}
export async function CmsOriginalNgoInformationRoute(){
 const [r,navigation,home]=await Promise.all([
  publishedCmsPage("80g"),publishedCmsNavigation(),publishedCmsPage("home")]);
 if(r.state==="NOT_PUBLISHED")notFound();
 if(r.state!=="PUBLISHED"||r.page.kind!=="COMPLIANCE")
  return <UnavailablePage title="Foundation registration information unavailable" description="We cannot verify the current approved official information." linkHref="/" linkLabel="Return to the homepage" />;
 return <CmsPublicPage page={{...r.page,canonicalPath:"/ngo-information"}}
  sidebar={<CmsNgoSidebar page={r.page}/>} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?
   home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null}/>;
}
