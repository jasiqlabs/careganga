import Link from "next/link";
import type {ReactNode} from "react";
import type {PublicCmsNavigation} from "./cms-public-source";
import {CmsSiteHeader} from "./cms-site-header";
import type {CmsMediaType} from "./cms-gallery-grid-client";
import {CmsHeroCarousel} from "./cms-hero-carousel";
import {CampaignPublicCards} from "../campaigns/campaign-public-cards";
import type {PublicCampaign} from "../campaigns/campaign-public-source";
import {CmsImpactGroup,CmsCompliance,CmsGallery,CmsArticle,CmsHealthcare,CmsContactInfo} from "./cms-public-extended";

export type PublicCmsSection={kind:string;order:number;fields:Record<string,unknown>};
export type PublicCmsPage={schemaVersion:number;effectiveGeneration:string;
 kind:string;slug:string;title:string;seoTitle:string;seoDescription:string;
 canonicalPath:string;lastPublishedAt:string;
 sections:PublicCmsSection[];assets:{role:string;altText:string;src:string;order:number}[]};
type Asset=PublicCmsPage["assets"][number];
const text=(v:unknown)=>typeof v==="string"?v:"";
const safeLocal=(v:unknown)=>["/","/about","/contact"].includes(text(v))?text(v):null;
const list=(v:unknown)=>Array.isArray(v)?v.filter(x=>typeof x==="string").slice(0,5) as string[]:[];
function CmsAction({label,href,variant}:{label:unknown;href:unknown;variant?:string}){
 const dest=safeLocal(href);
 return dest&&text(label)?<Link className={"cg-site-action "+(variant??"")} href={dest}>
  {text(label)}</Link>:null;
}
function Photo({asset,className}:{asset?:Asset;className:string}){
 return asset?<img className={className} src={asset.src} alt={asset.altText} loading="lazy"/>:null;
}
function RichText({fields,asset}:{fields:Record<string,unknown>;asset?:Asset}){
 const split=fields.variant==="SPLIT";
 return <section className={split?"cg-site-about cg-site-content":"cg-site-content cg-site-article"}>
  {split&&<div className="cg-site-about-photo"><Photo asset={asset} className="cg-site-about-img"/></div>}
  <div className="cg-site-copy">
   {text(fields.eyebrow)&&<p className="cg-site-eyebrow">{text(fields.eyebrow)}</p>}
   <h2>{text(fields.heading)}</h2>
   {text(fields.body)&&<p className="cg-site-body">{text(fields.body)}</p>}
   {list(fields.highlights).length>0&&<ul className="cg-site-highlights">
    {list(fields.highlights).map((line,i)=><li key={i}>{line}</li>)}
   </ul>}
  </div>
 </section>;
}
function Promo({fields,asset}:{fields:Record<string,unknown>;asset?:Asset}){
 return <section className="cg-site-promo">
  <Photo asset={asset} className="cg-site-promo-img"/>
  <div className="cg-site-promo-inner">
   {!!text(fields.eyebrow)&&<p className="cg-site-eyebrow">{text(fields.eyebrow)}</p>}
   {!!text(fields.heading)&&<h2>{text(fields.heading)}</h2>}
   {!!text(fields.body)&&<p>{text(fields.body)}</p>}
   <CmsAction label={fields.label} href={fields.path}/>
  </div>
 </section>;
}
function Features({fields,assets}:{fields:Record<string,unknown>;assets:Asset[]}){
 const cards=Array.isArray(fields.cards)?fields.cards.slice(0,3):[];
 return <section className="cg-site-features cg-site-content">
  {text(fields.eyebrow)&&<p className="cg-site-eyebrow">{text(fields.eyebrow)}</p>}
  <div className="cg-site-feature-title"><h2>{text(fields.heading)}</h2>
   {text(fields.body)&&<p>{text(fields.body)}</p>}</div>
  <div className="cg-site-feature-grid">{cards.map((value,i)=>{
   if(!value||typeof value!=="object"||Array.isArray(value))return null;
   const card=value as Record<string,unknown>;
   return <article className="cg-site-feature-card" key={i}>
    <div className="cg-site-feature-image">
     <Photo asset={assets.find(x=>x.role==="FEATURE"&&x.order===i)} className="cg-site-card-img"/>
     {!!text(card.label)&&<span className="cg-site-card-tag">{text(card.label)}</span>}
    </div>
    <h3>{text(card.title)}</h3><p>{text(card.body)}</p>
   </article>;
  })}</div>
 </section>;
}
function JoinCards({fields,navigation}:{fields:Record<string,unknown>;navigation?:PublicCmsNavigation|null}){
 const joinLink=(type:"memberJoin"|"volunteerJoin")=>{
  const target=navigation?.[type];
  // No fictional registration screen: only actual owner-published destinations.
  const expected=type==="memberJoin"?"/membership":"/volunteer";
  return target?.visible===true&&target.path===expected?expected:null;
 };
 return <section className="cg-site-join-grid cg-site-content" aria-label="Join CareGanga">
  {(["volunteer","member"] as const).map(kind=>{
   const ownVolunteer=kind==="volunteer";
   const href=joinLink(ownVolunteer?"volunteerJoin":"memberJoin");
   return <article className={"cg-site-join-card "+(ownVolunteer?"volunteer":"member")} key={kind}>
    <span className="cg-site-join-icon" aria-hidden="true">{ownVolunteer?"♡":"♙"}</span>
    <h2>{text(fields[ownVolunteer?"volunteerTitle":"memberTitle"])}</h2>
    <p>{text(fields[ownVolunteer?"volunteerBody":"memberBody"])}</p>
    <ul>{list(fields[ownVolunteer?"volunteerBenefits":"memberBenefits"]).map((item,i)=>
     <li key={i}>{item}</li>)}</ul>
    {href&&<Link href={href} className="cg-site-action is-white">
     {ownVolunteer?"Start Volunteering":"Join as Member"}</Link>}
   </article>;
  })}
 </section>;
}
function Team({fields,assets}:{fields:Record<string,unknown>;assets:Asset[]}){
 const members=Array.isArray(fields.members)?fields.members:[];
 return <section className="cg-site-team cg-site-content">
  <h2>{text(fields.heading)||"Our team"}</h2>
  <div className="cg-site-team-grid">{members.map((person,i)=>{
   if(!person||typeof person!=="object"||Array.isArray(person)||
      person.consentConfirmed!==true)return null;
   const p=person as Record<string,unknown>;
   return <article className="cg-site-person" key={i}>
    <Photo asset={assets.find(x=>x.role==="TEAM"&&x.order===i)} className="cg-site-person-img"/>
    <h3>{text(p.name)}</h3><strong>{text(p.designation)}</strong>
    {!!text(p.bio)&&<p>{text(p.bio)}</p>}
   </article>;
  })}</div>
 </section>;
}
export function SiteFooter({data,navigation}:{data:Record<string,unknown>;
 navigation?:PublicCmsNavigation|null}){
 const isPublished=(path:string)=>navigation?.publishedRoutes?.some(v=>v.path===path)===true;
 const phone=text(data.phone),email=text(data.email);
 const whatsapp=text(data.whatsappNumber);
 const number=/^\+?[1-9][0-9]{9,14}$/.test(whatsapp)?whatsapp.replace(/\D/g,""):"";
 const legal=[["Terms & Conditions","terms-and-conditions"],
  ["Privacy Policy","privacy-policy"],["Cookie Policy","cookie-policy"],
  ["Disclaimer","disclaimer"],["Refund & Cancellation","refund-and-cancellation"],
  ["Grievance Redressal","grievance-redressal"],
  ["Copyright & Intellectual Property","copyright-and-intellectual-property"]] as const;
 return <>
  <footer className="cg-site-footer">
   <div className="cg-site-footer-grid">
    <div><Link href="/" className="cg-site-footer-brand">
     <img src="/careganga-mark.png" width={54} height={54} alt=""/>
     <span><strong>CareGanga</strong><small>FOUNDATION</small></span></Link>
     {!!text(data.mission)&&<p>{text(data.mission)}</p>}
     <address>{text(data.address)}
      {phone&&<a href={"tel:"+phone.replace(/[^+0-9]/g,"")}>{phone}</a>}
      {email&&<a href={"mailto:"+email}>{email}</a>}</address>
    </div>
    <div><h3>QUICK LINKS</h3>
     {isPublished("/about")?<Link href="/about">About Us</Link>:<span>About Us</span>}
     {isPublished("/campaigns")?<Link href="/campaigns">Campaigns</Link>:
      <span aria-disabled="true" className="cg-site-unavailable">Campaigns</span>}
     {isPublished("/donate")?<Link href="/donate">Donate</Link>:
      <span aria-disabled="true" className="cg-site-unavailable">Donate</span>}
     {isPublished("/our-impact")&&<Link href="/our-impact">Our Impact</Link>}
     {isPublished("/gallery")&&<Link href="/gallery">Media Gallery</Link>}
     <Link href={isPublished("/healthcare")?"/healthcare":"/health-network"}>Healthcare Assistance</Link>
     <Link href="/contact">Contact</Link></div>
    <div><h3>POLICIES & LEGAL</h3>
     {legal.map(([label,slug])=>isPublished("/policies/"+slug)?
      <Link key={slug} href={"/policies/"+slug}>{label}</Link>:
      <span key={slug} aria-disabled="true">{label}</span>)}
     {isPublished("/ngo-information")&&<Link href="/ngo-information">NGO Information &amp; 80G</Link>}</div>
    <div><h3>SUBSCRIBE TO NEWSLETTER</h3>
     {!!text(data.newsletterText)&&<p>{text(data.newsletterText)}</p>}
     <label className="cg-site-newsletter-field">
      <span className="cg-site-sr-only">Email address for Foundation newsletter</span>
      <input type="email" autoComplete="email" placeholder="Enter your email" disabled
       aria-label="Newsletter subscription is not available yet"/>
     </label>
     <button type="button" disabled className="cg-site-newsletter-button">
      Subscribe</button>
     <p className="cg-site-muted">Newsletter registration is not yet available.</p>
    </div>
   </div>
   <div className="cg-site-footer-bottom"><span>© CareGanga Foundation. All rights reserved.</span>
    <span>Community care and development</span></div>
  </footer>
  <div className="cg-site-floating">
   {isPublished("/donate")?
    <Link className="cg-site-float-donate" href="/donate"
     aria-label="Donate to CareGanga Foundation">♥ &nbsp; DONATE NOW</Link>:
    <span className="cg-site-float-donate" aria-disabled="true"
     aria-label="Donation service is not available yet"
     title="Donation service will be available when verified">♥ &nbsp; DONATE NOW</span>}
   {number.length>=10&&number.length<=15&&
    <a className="cg-site-float-whatsapp" href={"https://wa.me/"+number}
     target="_blank" rel="noopener noreferrer" aria-label="Contact CareGanga on WhatsApp">
     <span aria-hidden="true">◉</span></a>}
  </div>
 </>;
}
/** Shared original public shell for genuine non-CMS owner projections.
 * This does not invent a second CMS page or reusable business master.
 */
export function CmsPublicShell({children,navigation,siteFooter}:{children:ReactNode;
 navigation?:PublicCmsNavigation|null;siteFooter?:Record<string,unknown>|null}){
 const footer=siteFooter??{};
 return <main className="cg-site">
  <CmsSiteHeader navigation={navigation} contact={{
   address:text(footer.address),phone:text(footer.phone),email:text(footer.email)}}/>
  {children}
  <SiteFooter data={footer} navigation={navigation}/>
 </main>;
}
/** Greenfield site uses the CLIENT-owned original gold/green public reference.
 * Only vetted CG-18 published DTO reaches this view; no private author data.
 * Admin blue design tokens are intentionally not used for public appearance.
 */
export function CmsPublicPage({page,navigation,siteFooter,children,mediaScope,sidebar}:{
 page:PublicCmsPage;navigation?:PublicCmsNavigation|null;
 siteFooter?:Record<string,unknown>|null;children?:ReactNode;
 mediaScope?:CmsMediaType;sidebar?:ReactNode}){
 const sections=[...page.sections].sort((a,b)=>a.order-b.order);
 const assets=page.assets??[];
 const ownFooter=sections.find(x=>x.kind==="SITE_FOOTER")?.fields;
 const footer=ownFooter??siteFooter??{};
 const heroes=sections.filter(x=>x.kind==="HERO"&&x.fields.visible!==false).map(section=>({
  section,hero:assets.find(x=>x.role==="HERO"&&x.order===section.order),
  mobile:assets.find(x=>x.role==="MOBILE_HERO"&&x.order===section.order)
 }));
 return <main className="cg-site">
  <CmsSiteHeader navigation={navigation} contact={{
   address:text(footer.address),phone:text(footer.phone),email:text(footer.email)}}/>
  <div className={sidebar?"cg-site-ngo-layout":undefined}>
   {sidebar&&<aside className="cg-site-ngo-sidebar">{sidebar}</aside>}
   <div className="cg-site-sections">
   {page.kind==="POLICY"&&<header className="cg-site-content cg-site-policy-title">
    <p className="cg-site-eyebrow">Policies &amp; Legal</p><h1>{page.title}</h1>
   </header>}
   {heroes.length>0&&<CmsHeroCarousel slides={heroes}/>}
   {sections.filter(x=>x.kind!=="HERO"&&x.kind!=="SITE_FOOTER")
    .map((section,i)=>{
     const key=section.kind+"-"+section.order+"-"+i;
     if(section.kind==="RICH_TEXT")return <RichText key={key} fields={section.fields}
      asset={assets.find(x=>x.role==="ABOUT"&&x.order===section.order)}/>;
     if(section.kind==="CTA")return <Promo key={key} fields={section.fields}
      asset={assets.find(x=>x.role==="PROMO"&&x.order===section.order)}/>;
     if(section.kind==="FEATURE_CARDS")return <Features key={key}
      fields={section.fields} assets={assets}/>;
     if(section.kind==="JOIN_CARDS")return <JoinCards key={key}
      fields={section.fields} navigation={navigation}/>;
     if(section.kind==="TEAM")return <Team key={key}
      fields={section.fields} assets={assets}/>;
     if(section.kind==="IMPACT_GROUP")return <CmsImpactGroup key={key}
      section={section} assets={assets} navigation={navigation}/>;
     if(section.kind==="COMPLIANCE_FACTS")return <CmsCompliance key={key}
      section={section} assets={assets}/>;
     if(section.kind==="GALLERY_GRID")return <CmsGallery key={key}
      section={section} assets={assets} mediaScope={mediaScope}/>;
     if(section.kind==="ARTICLE_BODY")return <CmsArticle key={key}
      section={section} assets={assets}/>;
     if(section.kind==="HEALTHCARE_CATEGORIES")return <CmsHealthcare key={key}
      section={section}/>;
     if(section.kind==="PARTNER_CARDS"){
      const cards=Array.isArray(section.fields.cards)?section.fields.cards.flatMap((value,index)=>{
       if(!value||typeof value!=="object"||Array.isArray(value))return [];
       const x=value as Record<string,unknown>;
       if(typeof x.name!=="string"||typeof x.summary!=="string"||!Number.isSafeInteger(x.originalIndex))return [];
       return [{name:x.name,summary:x.summary,originalIndex:x.originalIndex as number,index}];
      }):[];
      return <section key={key} className="cg-site-content" aria-label="Original approved partner selections">
       <h2>{text(section.fields.heading)||"Corporate Partners"}</h2>
       {text(section.fields.intro)&&<p>{text(section.fields.intro)}</p>}
       {cards.length===0?<p>No currently verified partner names to preview or publish.</p>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16}}>
         {cards.map(card=>{
          const logo=assets.find(v=>v.role==="FEATURE"&&v.order===card.originalIndex);
          return <article key={card.index} style={{border:"1px solid var(--cg-border,#dce6e2)",borderRadius:12,padding:20}}>
           {logo&&<Photo asset={logo} className="cg-site-about-img"/>}
           <h3>{card.name}</h3><p>{card.summary}</p>
          </article>;
         })}
        </div>}
      </section>;
     }
     if(section.kind==="CONTACT_INFO")return <CmsContactInfo key={key} section={section} assets={assets}/>;
     if(section.kind==="CAMPAIGN_TEASER"){
      const cards=Array.isArray(section.fields.cards)?
       section.fields.cards.filter(x=>x&&typeof x==="object"&&
        typeof (x as Record<string,unknown>).slug==="string"&&
        /^cg-camp-[0-9]{8}$/.test(String((x as Record<string,unknown>).slug))) as PublicCampaign[]:[];
      return <CampaignPublicCards key={key} heading={text(section.fields.heading)||"Campaigns"} cards={cards}/>;
     }
     if(section.kind==="PROJECT_TEASER"){const cards=Array.isArray(section.fields.cards)?section.fields.cards:[];return <section key={key} className="cg-site-content"><h2>{text(section.fields.heading)||"Projects"}</h2>{!cards.length?<p>No currently approved projects to display.</p>:cards.map((item,j)=>{if(!item||typeof item!=="object")return null;const p=item as Record<string,unknown>;return <article key={j} style={{background:"#fffaf0",border:"1px solid #e5ddc9",borderRadius:16,padding:24,margin:"16px 0"}}>{/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(text(p.coverSrc))&&<img src={text(p.coverSrc)} alt={text(p.title)} loading="lazy" style={{width:"100%",maxHeight:320,objectFit:"cover",borderRadius:12}}/>}<p className="cg-site-eyebrow">{text(p.category)} · {text(p.status)==="PLANNED"?"Planned":"Active"}</p><h3>{text(p.title)}</h3><p>{text(p.area)}</p><p>{text(p.summary)}</p>{text(p.launch)&&<p>Planned start: {text(p.launch)}</p>}</article>;})}</section>;}
     // Never infer operational projects from CMS-only teaser text.
     return null;
    })}
   </div>
  </div>
  {children}
  <SiteFooter data={footer} navigation={navigation}/>
 </main>;
}
