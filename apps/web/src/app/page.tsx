import Link from "next/link";
import type {Metadata} from "next";
import {CmsPublicPage,CmsPublicShell,RichText,Features,JoinCards} from "../features/cms-public-content/cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "../features/cms-public-content/cms-public-source";
import {CmsHomeGalleryMarquee,type HomeGalleryPhoto} from "../features/cms-public-content/cms-home-gallery-marquee";
import {clientScreenshotHome} from "../features/cms-public-content/cms-client-screenshot-reference";
import {CmsHeroCarousel} from "../features/cms-public-content/cms-hero-carousel";

export const dynamic="force-dynamic";

export async function generateMetadata():Promise<Metadata>{
 const r=await publishedCmsPage("home");
 return r.state==="PUBLISHED"?{title:r.page.seoTitle,
  description:r.page.seoDescription,
  alternates:{canonical:r.page.canonicalPath},robots:{index:true,follow:true}}:
  {title:"CareGanga Foundation",robots:{index:false,follow:false}};
}

export default async function PublicHome(){
 const [result,navigation,galleryResult]=await Promise.all([publishedCmsPage("home"),publishedCmsNavigation(),publishedCmsPage("gallery")]);
 const gallerySection=galleryResult.state==="PUBLISHED"&&galleryResult.page.kind==="GALLERY"?galleryResult.page.sections.find(s=>s.kind==="GALLERY_GRID"):undefined;
 const galleryItems=Array.isArray(gallerySection?.fields.items)?gallerySection.fields.items:[];
 const galleryPhotos:HomeGalleryPhoto[]=galleryResult.state==="PUBLISHED"?galleryItems.flatMap(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const item=raw as Record<string,unknown>;
  if(item.visible===false||item.mediaType!=="PHOTO"||!Number.isSafeInteger(item.originalIndex))return [];
  const asset=galleryResult.page.assets.find(a=>a.role==="GALLERY"&&a.order===item.originalIndex);
  if(!asset||!/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(asset.src))return [];
  return [{src:asset.src,alt:asset.altText||String(item.title??""),title:String(item.title??""),category:String(item.category??"")}];
 }):[];
 const homeGalleryIntro=result.state==="PUBLISHED"?result.page.sections.find(s=>s.kind==="RICH_TEXT"&&typeof s.fields.heading==="string"&&/media gallery/i.test(s.fields.heading))?.fields:undefined;
 const galleryEyebrow=typeof homeGalleryIntro?.eyebrow==="string"?homeGalleryIntro.eyebrow:undefined;
 const galleryHeading=typeof homeGalleryIntro?.heading==="string"?homeGalleryIntro.heading:(typeof gallerySection?.fields.heading==="string"?gallerySection.fields.heading:undefined);
 const gallerySub=typeof homeGalleryIntro?.body==="string"?homeGalleryIntro.body:(typeof gallerySection?.fields.description==="string"?gallerySection.fields.description:undefined);
 if(result.state==="PUBLISHED")return <CmsPublicPage page={result.page} navigation={navigation}><CmsHomeGalleryMarquee eyebrow={galleryEyebrow} heading={galleryHeading} subtitle={gallerySub} photos={galleryPhotos}/></CmsPublicPage>;

 // Prepare the 4 reference slides from clientScreenshotHome for local dev & unpopulated fallback
 const referenceSlides = clientScreenshotHome.slides.map((s, idx) => ({
  section: {
   kind: "HERO",
   order: idx,
   fields: {
    eyebrow: s.eyebrow,
    heading: s.heading,
    subtitle: s.subtitle,
    description: s.description,
    tags: s.tags,
    headingFont: s.headingFont,
    headingWeight: s.headingWeight,
    headingSize: s.headingSize,
    headingColor: s.headingColor,
    subtitleColor: s.subtitleColor,
    primaryLabel: s.primaryLabel,
    primaryPath: s.primaryPath,
    secondaryLabel: s.secondaryLabel,
    secondaryPath: s.secondaryPath,
    visible: true
   }
  },
  hero: {
   role: "HERO",
   altText: s.heading,
   src: s.imageSrc,
   order: idx
  }
 }));

 const aboutFields = {
  eyebrow: clientScreenshotHome.bodyEyebrow,
  heading: clientScreenshotHome.bodyHeading,
  variant: clientScreenshotHome.bodyVariant,
  body: clientScreenshotHome.body,
  highlights: clientScreenshotHome.highlights.split("\n").filter(Boolean)
 };
 const aboutAsset = {
  role: "ABOUT",
  altText: "Volunteers and children high-five",
  src: "/volunteer_highfive.jpg",
  order: 0
 };

 const featuresFields = {
  eyebrow: clientScreenshotHome.featuresEyebrow,
  heading: clientScreenshotHome.featuresHeading,
  body: clientScreenshotHome.featuresBody,
  cards: clientScreenshotHome.featureCards
 };
 const featureAssets = [
  { role: "FEATURE", altText: "Flood Relief", src: "/images/Flood-Relief-Operations.jpg", order: 0 },
  { role: "FEATURE", altText: "Education", src: "/careganga-hero-community.jpg", order: 1 },
  { role: "FEATURE", altText: "Healthcare", src: "/images/donateUs.webp", order: 2 }
 ];

 const joinFields = {
  volunteerTitle: clientScreenshotHome.volunteerTitle,
  volunteerBody: clientScreenshotHome.volunteerBody,
  volunteerBenefits: clientScreenshotHome.volunteerBenefits.split("\n").filter(Boolean),
  memberTitle: clientScreenshotHome.memberTitle,
  memberBody: clientScreenshotHome.memberBody,
  memberBenefits: clientScreenshotHome.memberBenefits.split("\n").filter(Boolean)
 };

 // A missing or withdrawn Home must NEVER display draft or unapproved
 // screenshot content. Reuse the original public site shell so independently
 // published pages and verified operational links remain navigable.
 return <CmsPublicShell navigation={navigation}>
  <div className="cg-site-sections cg-site-page-home">
   <CmsHeroCarousel slides={referenceSlides} navigation={navigation}/>
   <RichText fields={aboutFields} asset={aboutAsset}/>
   <Features fields={featuresFields} assets={featureAssets}/>
   <JoinCards fields={joinFields} navigation={navigation}/>
  </div>
  <section className="cg-site-content cg-site-dev-notice" aria-label="CareGanga website publication status" style={{marginTop:"2rem",marginBottom:"2rem",padding:"1.2rem 1.6rem",borderRadius:"14px",background:"rgba(25,74,58,0.04)",border:"1px dashed rgba(25,74,58,0.22)"}}>
   <h3 style={{margin:"0 0 0.5rem",fontSize:"1.05rem",color:"#194a3a"}}>CareGanga Foundation — Public Layout Preview</h3>
   <p role="status" style={{margin:"0 0 0.5rem",fontSize:"0.86rem",color:"#637084"}}>{result.state==="NOT_PUBLISHED"?
    "Our public homepage has not yet been published. Displaying approved reference baseline.":
    "Our public website content is temporarily unavailable. Displaying local reference layout."}</p>
   <p style={{margin:"0",fontSize:"0.85rem"}}><Link href="/contact" style={{color:"#194a3a",fontWeight:700}}>Contact the Foundation</Link></p>
  </section>
 </CmsPublicShell>;
}
