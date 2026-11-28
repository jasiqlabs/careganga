import type {Metadata} from "next";
import {CmsPublicPage,type PublicCmsPage} from "../../features/cms-public-content/cms-public-page";
import {publishedCmsNavigation,publishedCmsPage} from "../../features/cms-public-content/cms-public-source";
import {Cg19PublicContactForm} from "../../features/cms-public-content/cg19-public-contact-form";

export const dynamic="force-dynamic";
function validContactPage(page:PublicCmsPage){
 return page.kind==="CONTACT"&&page.canonicalPath==="/contact"&&page.sections.some(s=>s.kind==="RICH_TEXT")&&
  page.sections.every(s=>["RICH_TEXT","CTA","CONTACT_INFO"].includes(s.kind))&&page.sections.filter(s=>s.kind==="CONTACT_INFO").length<=1;
}
export async function generateMetadata():Promise<Metadata>{
 const page=await publishedCmsPage("contact");
 if(page.state!=="PUBLISHED"||!validContactPage(page.page))return {title:"CareGanga Foundation — Contact",
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
 const verified=contact.state==="PUBLISHED"&&validContactPage(contact.page);
 const page=verified?contact.page:neutral;
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 const contactInfoFields=page.sections.find(s=>s.kind==="CONTACT_INFO")?.fields;
 const form=<Cg19PublicContactForm contact={footer??{}} contactInfo={contactInfoFields??{}}/>;
 const embedded=page.sections.some(s=>s.kind==="CONTACT_INFO");
 return <CmsPublicPage page={page} navigation={navigation} siteFooter={footer} contactForm={embedded?form:undefined}>
  {!embedded&&<header className="cg-site-content cg-site-page-heading cg-site-contact-fallback"><p className="cg-site-eyebrow">CareGanga Foundation</p><h1>{page.title||"Contact the Foundation"}</h1></header>}
  {!verified&&contact.state!=="NOT_PUBLISHED"&&<p className="cg-site-content cg-site-provenance"
   role="status">Approved Contact page information cannot be verified.
   The Foundation's private support form remains available independently.</p>}
  {!embedded&&form}
 </CmsPublicPage>;
}
