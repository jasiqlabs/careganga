import type {Metadata} from "next";
import {CmsPublicPage,type PublicCmsPage} from "../../features/cms-public-content/cms-public-page";
import {publishedCmsNavigation,publishedCmsPage} from "../../features/cms-public-content/cms-public-source";
import {Cg19PublicContactForm} from "../../features/cms-public-content/cg19-public-contact-form";

export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 const page=await publishedCmsPage("contact");
 if(page.state!=="PUBLISHED")return {title:"CareGanga Foundation — Contact",
  robots:{index:false,follow:false}};
 return {title:page.page.seoTitle,description:page.page.seoDescription,
  alternates:{canonical:"/contact"},robots:{index:true,follow:true}};
}
/** CG18 only owns public editorial copy and the visual shell.
 * CG19 retains anonymous submission, anti-spam, opaque receipt and case.
 * No second support inbox or CMS message table.
 */
export default async function FoundationContactPage(){
 const [contact,navigation,home]=await Promise.all([
  publishedCmsPage("contact"),publishedCmsNavigation(),publishedCmsPage("home")]);
 const neutral:PublicCmsPage={schemaVersion:1,effectiveGeneration:"NO_PUBLIC_EDITORIAL",
  kind:"CONTACT",slug:"contact",title:"Contact the Foundation",
  seoTitle:"CareGanga Foundation — Contact",seoDescription:"",
  canonicalPath:"/contact",lastPublishedAt:"",sections:[],assets:[]};
 const page=contact.state==="PUBLISHED"?contact.page:neutral;
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 const form=<Cg19PublicContactForm contact={footer??{}}/>;
 const embedded=page.sections.some(s=>s.kind==="CONTACT_INFO");
 return <CmsPublicPage page={page} navigation={navigation} siteFooter={footer} contactForm={embedded?form:undefined}>
  {contact.state==="UNAVAILABLE"&&<p className="cg-site-content cg-site-provenance"
   role="status">Approved Contact page information cannot be verified.
   The Foundation's private support form remains available independently.</p>}
  {!embedded&&form}
 </CmsPublicPage>;
}
