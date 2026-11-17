import Link from "next/link";
import type {PublicCmsNavigation} from "./cms-public-source";
import {CmsSiteHeader} from "./cms-site-header";
import {CmsHeroCarousel} from "./cms-hero-carousel";

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
  return target?.visible&&target.path&&/^\/[a-z0-9/-]+$/.test(target.path)?
   target.path:null;
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
function SiteFooter({data}:{data:Record<string,unknown>}){
 const phone=text(data.phone),email=text(data.email),number=phone.replace(/[^0-9]/g,"");
 const legal=["Terms & Conditions","Privacy Policy","Cookie Policy","Disclaimer",
  "Refund & Cancellation","Grievance Redressal","Copyright & Intellectual Property"];
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
    <div><h3>QUICK LINKS</h3><Link href="/about">About Us</Link>
     <Link href="/contact">Contact</Link></div>
    <div><h3>POLICIES & LEGAL</h3>
     {legal.map(item=><span key={item}>{item}</span>)}</div>
    <div><h3>SUBSCRIBE TO NEWSLETTER</h3>
     {!!text(data.newsletterText)&&<p>{text(data.newsletterText)}</p>}
     <p className="cg-site-muted">Newsletter registration is not yet available.</p>
    </div>
   </div>
   <div className="cg-site-footer-bottom"><span>© CareGanga Foundation. All rights reserved.</span>
    <span>Community care and development</span></div>
  </footer>
  <div className="cg-site-floating">
   <span className="cg-site-float-donate" aria-label="Donation service is not available yet"
    title="Donation service will be available when published">♥ &nbsp; DONATE NOW</span>
   {number.length>=10&&number.length<=15&&
    <a className="cg-site-float-whatsapp" href={"https://wa.me/"+number}
     target="_blank" rel="noopener noreferrer" aria-label="Contact CareGanga on WhatsApp">
     <span aria-hidden="true">◉</span></a>}
  </div>
 </>;
}
/** Greenfield site uses the CLIENT-owned original gold/green public reference.
 * Only vetted CG-18 published DTO reaches this view; no private author data.
 * Admin blue design tokens are intentionally not used for public appearance.
 */
export function CmsPublicPage({page,navigation,siteFooter}:{
 page:PublicCmsPage;navigation?:PublicCmsNavigation|null;
 siteFooter?:Record<string,unknown>|null}){
 const sections=[...page.sections].sort((a,b)=>a.order-b.order);
 const assets=page.assets??[];
 const ownFooter=sections.find(x=>x.kind==="SITE_FOOTER")?.fields;
 const footer=ownFooter??siteFooter??{};
 const heroes=sections.filter(x=>x.kind==="HERO").map(section=>({
  section,hero:assets.find(x=>x.role==="HERO"&&x.order===section.order),
  mobile:assets.find(x=>x.role==="MOBILE_HERO"&&x.order===section.order)
 }));
 return <main className="cg-site">
  <CmsSiteHeader navigation={navigation} contact={{
   address:text(footer.address),phone:text(footer.phone),email:text(footer.email)}}/>
  <div className="cg-site-sections">
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
     // Never infer operational projects from CMS-only teaser text.
     return null;
    })}
  </div>
  <SiteFooter data={footer}/>
 </main>;
}
