import Link from "next/link";
import type {ReactNode} from "react";
import {UnavailablePage} from "../../shared/unavailable-page";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsPublicPage,CmsPublicShell} from "./cms-public-page";
import {CmsHealthcareView} from "./cms-healthcare-page";
import {CmsNgoSidebar} from "./cms-ngo-pages";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";
import {publicLabOffers} from "../diagnostics/public-lab-offers";
import {currentConsultationBenefits} from "../healthcare-assistance/public-consultation-benefits";

/** One SSR source for each approved Foundation editorial route.
 * The Home publication supplies only shared original CMS footer content.
 */
export async function editorialMetadata(slug:string,expectedKind?:"ARTICLE"|"POLICY"):Promise<Metadata>{
 const r=await publishedCmsPage(slug);
 if(r.state!=="PUBLISHED"||(expectedKind&&r.page.kind!==expectedKind))return {title:"CareGanga Foundation",robots:{index:false,follow:false}};
 return {title:r.page.seoTitle,description:r.page.seoDescription,
  alternates:{canonical:r.page.canonicalPath},
  robots:{index:true,follow:true}};
}
export async function CmsEditorialRoute({slug,extra,expectedKind}:{slug:string;extra?:ReactNode;expectedKind?:"ARTICLE"|"POLICY"}){
 const [page,navigation,home,labOffers,benefits]=await Promise.all([
  publishedCmsPage(slug),publishedCmsNavigation(),publishedCmsPage("home"),
  slug==="healthcare"?publicLabOffers(new URLSearchParams()):Promise.resolve(null),
  slug==="healthcare"?currentConsultationBenefits():Promise.resolve(null)]);
 if(page.state==="NOT_PUBLISHED"||(page.state==="PUBLISHED"&&expectedKind&&page.page.kind!==expectedKind))notFound();
 if(page.state!=="PUBLISHED")return <UnavailablePage title="Foundation content temporarily unavailable" description="We could not verify the currently approved public information." linkHref="/" linkLabel="Return to the homepage" />;
 const siteFooter=home.state==="PUBLISHED"?home.page.sections.find(section=>section.kind==="SITE_FOOTER")?.fields:null;
 if(slug==="healthcare"&&page.page.kind==="HEALTHCARE"){
  return <CmsPublicShell navigation={navigation} siteFooter={siteFooter}>
   <CmsHealthcareView page={page.page} navigation={navigation} benefits={benefits} labOffers={labOffers}/>
   {extra??null}
  </CmsPublicShell>;
 }
 return <CmsPublicPage page={page.page} navigation={navigation} siteFooter={siteFooter}>
  {extra??null}
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
  return <main className="page main"><h1>Foundation media temporarily unavailable</h1>
   <p>Approved media information could not be verified.</p>
   <Link href="/">Return to the homepage</Link></main>;
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
  return <main className="page main"><h1>Foundation registration information unavailable</h1>
   <p>We cannot verify the current approved official information.</p>
   <Link href="/">Return to the homepage</Link></main>;
 return <CmsPublicPage page={{...r.page,canonicalPath:"/ngo-information"}}
  sidebar={<CmsNgoSidebar page={r.page} navigation={navigation}/>} navigation={navigation}
  siteFooter={home.state==="PUBLISHED"?
   home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null}/>;
}
