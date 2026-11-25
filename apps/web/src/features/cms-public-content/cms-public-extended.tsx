import Link from "next/link";
import {Suspense,type ReactNode} from "react";
import type {PublicCmsPage,PublicCmsSection} from "./cms-public-page";
import type {PublicCmsNavigation} from "./cms-public-source";
import {CmsGalleryGridClient,type CmsMediaType} from "./cms-gallery-grid-client";
type Asset=PublicCmsPage["assets"][number];
const text=(v:unknown)=>typeof v==="string"?v:"";
const records=(v:unknown)=>Array.isArray(v)?v.filter(x=>!!x&&typeof x==="object"&&!Array.isArray(x))
 .slice(0,16) as Record<string,unknown>[]:[];
const photo=(asset:Asset|undefined,cls:string)=>asset?.src?
 <img src={asset.src} alt={asset.altText} className={cls} loading="lazy"/>:null;
const label=(source:unknown,asOf:unknown)=>source||asOf?
 <p className="cg-site-provenance">
  {Boolean(source)&&<span>Source: {text(source)}</span>}
  {Boolean(asOf)&&<span> · As of {text(asOf)}</span>}
  <span> · Editorial information; not an audited financial statement</span>
 </p>:null;

export function CmsImpactGroup({section,assets,navigation}:{
 section:PublicCmsSection;assets:Asset[];navigation?:PublicCmsNavigation|null}){
 const f=section.fields,group=text(f.group),rows=records(f.items);
 const pic=assets.find(a=>a.role==="IMPACT"&&a.order===section.order);
 const tabular=["STATS","GROWTH","BREAKDOWN"].includes(group);
 const heading=text(f.heading);
 const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
 const validPercentage=(v:unknown):v is number=>finite(v)&&v>=0&&v<=100;
 const chartRows=rows.filter(v=>group==="BREAKDOWN"?validPercentage(v.percentage):finite(v.value)&&v.value>=0);
 const peak=Math.max(0,...chartRows.map(v=>finite(v.value)?v.value:0));
 return <section className={"cg-site-content cg-site-impact-group cg-site-impact-"+group.toLowerCase()}>
  <div className="cg-site-impact-heading">
   <p className="cg-site-eyebrow">{group==="HERO"&&text(f.eyebrow)?
    text(f.eyebrow):group.replaceAll("_"," ")}</p>
   {group==="HERO"?<h1>{heading}{!!text(f.highlight)&&<>
    {" "}<span className="cg-site-impact-highlight">{text(f.highlight)}</span></>}</h1>:<h2>{heading}</h2>}
   {group==="HERO"&&!!text(f.quote)&&
    <blockquote className="cg-site-impact-quote">{text(f.quote)}</blockquote>}
   {text(f.intro)&&<p>{text(f.intro)}</p>}
   {rows.length>0&&label(f.source,f.asOfDate)}
   {!rows.length&&!["HERO","CTA","PILLARS"].includes(group)&&<div className="cg-site-empty" role="status">No approved information has been published yet.</div>}
  </div>
  {photo(pic,"cg-site-impact-photo")}
  {tabular&&rows.length>0?<div className="cg-site-table-wrap" role="region" aria-label={heading+" — scrollable data table"} tabIndex={0}>
   <table className="cg-site-evidence-table">
    <caption>{heading} — source-reported information</caption>
    <thead><tr><th scope="col">Description</th><th scope="col">Value</th>
     <th scope="col">Notes</th></tr></thead>
    <tbody>{rows.map((item,i)=><tr key={i}>
     <th scope="row">{text(item.title)}
      {typeof item.year==="number"?" ("+item.year+")":""}</th>
     <td>{validPercentage(item.percentage)?item.percentage+"%":
      finite(item.value)?String(item.value)+" "+text(item.unit):"—"}</td>
     <td>{text(item.description)}</td>
    </tr>)}</tbody>
   </table>
   {["GROWTH","BREAKDOWN"].includes(group)&&chartRows.length>0&&
    <div className="cg-site-source-bars" aria-hidden="true">
     {chartRows.map((item,i)=>{
      const numeric=group==="BREAKDOWN"?
       (typeof item.percentage==="number"?item.percentage:0):
       (typeof item.value==="number"?item.value:0);
      const width=group==="BREAKDOWN"?Math.max(0,Math.min(100,numeric)):
       peak>0?Math.max(0,Math.min(100,numeric/peak*100)):0;
      return <div key={i} className="cg-site-source-bar-row">
       <span>{text(item.title)}</span>
       <span className="cg-site-source-bar-track">
        <span className="cg-site-source-bar-fill"
         style={{width:width+"%"}}/>
       </span>
      </div>;
     })}
    </div>}
  </div>:rows.length>0?<div className="cg-site-impact-grid">{rows.map((v,i)=>
   <article key={i} className="cg-site-impact-card">
    <h3>{text(v.title)}</h3>{text(v.description)&&<p>{text(v.description)}</p>}
    {group==="GEOGRAPHY"&&["HIGH","MEDIUM","EXPANDING"].includes(text(v.level))&&
     <span className="cg-site-impact-reach">
      {text(v.level).charAt(0)+text(v.level).slice(1).toLowerCase()} reach
     </span>}
    {validPercentage(v.percentage)&&<strong>{v.percentage}%</strong>}
    {finite(v.value)&&<strong>{v.value} {text(v.unit)}</strong>}
   </article>)}</div>:null}
  {["CTA","HERO"].includes(group)&&text(f.ctaPath)&&text(f.ctaLabel)&&
   (["/","/contact"].includes(text(f.ctaPath))||
    navigation?.publishedRoutes?.some(p=>p.path===text(f.ctaPath)))&&
   <Link className="cg-site-action" href={text(f.ctaPath)}>{text(f.ctaLabel)}</Link>}
 </section>;
}
export function CmsCompliance({section,assets}:{
 section:PublicCmsSection;assets:Asset[]}){
 const f=section.fields;
 const safeDocument=(a:Asset)=>a.role==="DOCUMENT"&&/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(a.src);
 const supported=f.verification==="VERIFIED",proof=assets.find(safeDocument);
 const documents=records(f.documents).map((record,i)=>({record,document:assets.find(a=>a.order===i&&safeDocument(a))})).filter(entry=>entry.document);
 return <section className="cg-site-content cg-site-legal">
  <p className="cg-site-eyebrow">Registration &amp; public disclosures</p>
  <h1>{text(f.heading)}</h1>
  {supported&&text(f.badgeText)&&<span className="cg-site-legal-badge">
   {text(f.badgeText)}</span>}
  {text(f.subtitle)&&<h2 className="cg-site-legal-subtitle">{text(f.subtitle)}</h2>}
  <p>{text(f.summary)}</p>
  <p className="cg-site-legal-status">{supported?
   "Document-supported Foundation declaration":"Not currently verified — no tax eligibility is promised"}</p>
  {([f.issuer,f.pan,f.registrationNumber,f.approvalNumber,f.validFrom,f.validUntil,f.source].some(v=>!!text(v)))&&<dl className="cg-site-legal-data">
   {([["Issuing authority",f.issuer],["PAN",f.pan],["Registration",f.registrationNumber],
    ["Approval reference",f.approvalNumber],["Valid from",f.validFrom],
    ["Valid until",f.validUntil],["Source",f.source],
    ["Reviewed on",text(f.source)?f.verifiedAsOf:""]] as [string,unknown][])
    .filter(([,v])=>!!text(v)).map(([key,value])=><div key={key}>
     <dt>{key}</dt><dd>{text(value)}</dd></div>)}
  </dl>}
  {documents.length>0&&<section aria-label="Published original reports">
   <h2>Verified source documents and annual reports</h2>
   <div className="cg-site-impact-grid">{documents.map(({record,document},i)=>{
    if(!document)return null;
    return <article key={i} className="cg-site-impact-card">
     <p className="cg-site-eyebrow">{text(record.type).replaceAll("_"," ")}</p>
     <h3>{text(record.title)}</h3><p>Document date: {text(record.asOfDate)}</p>
     <a href={document.src} download>View approved source document</a>
    </article>;
   })}</div>
  </section>}
  {supported&&proof?.src&&records(f.documents).length===0&&
   <a className="cg-site-action" href={proof.src} download>
    View approved supporting document</a>}
  {text(f.importantNote)&&<aside className="cg-site-legal-important">
   <strong>Important</strong><p>{text(f.importantNote)}</p>
  </aside>}
  {text(f.disclaimer)&&<p className="cg-site-legal-notice">{text(f.disclaimer)}</p>}
  <p className="cg-site-provenance">Only the current Foundation-published information is shown.
   Confirm tax applicability with the issuing authority.</p>
 </section>;
}
export function CmsGallery({section,assets,mediaScope="PHOTO",embedded=false}:{
 section:PublicCmsSection;assets:Asset[];mediaScope?:CmsMediaType;embedded?:boolean}){
 const fields=section.fields;
 const heading=mediaScope==="VIDEO"?fields.videosHeading:
  mediaScope==="PUBLICATION"?fields.publicationsHeading:fields.heading;
 const intro=mediaScope==="VIDEO"?fields.videosDescription:
  mediaScope==="PUBLICATION"?fields.publicationsDescription:fields.description;
 const Heading=embedded?"h2":"h1";
 return <section className="cg-site-content cg-site-gallery">
  <header className="cg-site-resource-hero">
   <p className="cg-site-eyebrow">Media &amp; Resources</p>
   <Heading>{text(heading)||text(fields.heading)}</Heading>
   {text(intro)&&<p>{text(intro)}</p>}
  </header>
  <Suspense fallback={<p role="status">Loading approved media filters…</p>}>
   <CmsGalleryGridClient key={mediaScope} fields={{
    heading:fields.heading,description:fields.description,items:fields.items,
    photosEmptyText:fields.photosEmptyText,videosEmptyText:fields.videosEmptyText,
    publicationsEmptyText:fields.publicationsEmptyText}}
    mediaType={mediaScope} assets={assets}/>
  </Suspense>
 </section>;
}
export function CmsArticle({section,assets}:{
 section:PublicCmsSection;assets:Asset[]}){
 const f=section.fields,event=f.event&&typeof f.event==="object"?f.event as Record<string,unknown>:null;
 const cover=event&&/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(text(event.coverSrc))?{role:"ARTICLE",order:0,altText:text(f.heading),src:text(event.coverSrc)}:assets.find(a=>a.role==="ARTICLE"&&a.order===0);
 const stamp=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):"";
 return <article className="cg-site-content cg-site-article-body">
  <p className="cg-site-eyebrow">{text(f.category)}</p>
  <h1>{text(f.heading)}</h1>
  <p className="cg-site-article-lead">{text(f.excerpt)}</p>
  {event&&<div className="cg-site-article-lead"><p>{text(event.status)==="SCHEDULED"?"Scheduled":text(event.status)==="ONGOING"?"Ongoing":"Completed"} · {text(event.area)}</p><p>{stamp(event.scheduledStart)} – {stamp(event.scheduledEnd)} IST</p></div>}
  {label(f.source,f.asOfDate)}
  <p className="cg-site-provenance">Editorial credit: {text(f.authorLabel)}</p>
  {photo(cover,"cg-site-article-cover")}
  {text(f.body).split(/\n{2,}/).filter(Boolean).map((paragraph,i)=>
   <p key={i}>{paragraph}</p>)}
  <div className="cg-site-tags">{Array.isArray(f.tags)&&f.tags.map((tag,i)=>
   <span key={i}>{text(tag)}</span>)}</div>
 </article>;
}
export function CmsHealthcare({section,assets}:{
 section:PublicCmsSection;assets:Asset[]}){
 const f=section.fields,categories=records(f.categories);
 // Titles/descriptions stay CMS-owned. Known approved category labels resolve only
 // to canonical CG14 filters; unknown editorial labels use the full directory.
 const codes:Record<string,string>={"poly clinic":"POLYCLINIC",polyclinic:"POLYCLINIC","diagnostic centre":"DIAGNOSTIC_CENTER","diagnostic center":"DIAGNOSTIC_CENTER","dental clinic":"DENTAL_CLINIC","medical laboratories":"MEDICAL_LABORATORY","medical laboratory":"MEDICAL_LABORATORY","hospital & nursing home":"HOSPITAL","hospital and nursing home":"HOSPITAL","retail pharmacy":"PHARMACY","orthopedic centre":"ORTHOPEDIC_CLINIC","orthopedic center":"ORTHOPEDIC_CLINIC","homoeopathy centre":"HOMEOPATHY_CLINIC","homeopathy centre":"HOMEOPATHY_CLINIC","ayurvedic centre":"AYURVEDIC_CLINIC","ayurvedic center":"AYURVEDIC_CLINIC"};
 const code=(v:Record<string,unknown>)=>codes[text(v.title).trim().toLowerCase()]??"";
 return <section className="cg-site-content cg-site-healthcare">
  <p className="cg-site-eyebrow">Healthcare Assistance</p>
  <h2 className="cg-site-healthcare-heading">{text(f.heading)}</h2><p className="cg-site-article-lead">{text(f.intro)}</p>
  <form className="cg-health-discovery" action="/health-network" method="get" aria-label="Find healthcare services"><input type="hidden" name="tab" value="centers"/><label>Center or provider<input type="search" name="q" maxLength={80} placeholder="Find a verified center"/></label><label>Service category<select name="category"><option value="">All centers</option>{categories.filter(v=>code(v)).map((v,i)=><option key={i} value={code(v)}>{text(v.title)}</option>)}</select></label><label>PIN code (optional)<input name="pin" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" placeholder="Six-digit PIN"/></label><button className="cg-site-action" type="submit">Search centers</button></form>
  <div className="cg-site-healthcare-grid">{categories.map((v,i)=>
   <article key={i} className="cg-site-impact-card">
    {photo(assets.find(a=>a.role==="FEATURE"&&a.order===i),"cg-health-category-photo")}
    {assets.find(a=>a.role==="FEATURE"&&a.order===i)?.altText.match(/^(AI-generated illustration|Editorial illustration)/)&&<p className="cg-site-provenance">Illustration; not a photograph of a verified facility.</p>}
    <h3>{text(v.title)}</h3><p>{text(v.description)}</p>
    <Link className="cg-site-action" href={"/health-network?tab=centers"+(code(v)?"&category="+encodeURIComponent(code(v)):"")} aria-label={"Find centers — "+text(v.title)}>Find centers</Link>
   </article>)}</div>
  {f.ctaPath==="/contact"&&text(f.ctaLabel)&&
   <Link className="cg-site-action" href="/contact">{text(f.ctaLabel)}</Link>}
  <p className="cg-site-provenance">General Foundation information only.
   Provider availability, clinical advice and bookings are not represented here.</p>
 </section>;
}

/** Original 3-inquiry/FAQ/office/map/social presentation. All wording and
 * external destinations are strictly authorized CMS fields; actual support
 * submission remains CG19, CSR remains CG08 and membership remains CG04.
 */
export function CmsContactInfo({section,assets,form}:{section:PublicCmsSection;assets:Asset[];form?:ReactNode}){
 const f=section.fields,faq=records(f.faqs),inquiries=records(f.inquiries);
 const social=records(f.socialLinks);
 const secure=(value:unknown,hosts:string[])=>{
  const entry=text(value);
  try{
   const url=new URL(entry);
   return url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&!url.hash&&
    hosts.includes(url.hostname.toLowerCase())?entry:"";
  }catch{return "";}
 };
 const map=secure(f.mapUrl,["www.google.com","google.com","maps.google.com"]);
 // Render an embedded map only if Admin supplied an explicit Google Maps embed
 // URL; normal approved location links remain ordinary outbound links.
 const embeddedMap=(()=>{
  if(!map)return "";
  try{
   const u=new URL(map);
   return ["www.google.com","google.com"].includes(u.hostname.toLowerCase())&&
    u.pathname==="/maps/embed"&&u.searchParams.has("pb")?map:"";
  }catch{return "";}
 })();
 const allowedSocial:Record<string,string[]>={
  Facebook:["facebook.com","www.facebook.com"],
  Instagram:["instagram.com","www.instagram.com"],
  YouTube:["youtube.com","www.youtube.com"]
 };
 return <section className="cg-site-contact-original cg-site-content">
  <header className="cg-site-contact-hero">
   <p className="cg-site-eyebrow">Contact the Foundation</p>
   <h1>{text(f.heroTitle)}</h1>
   {text(f.heroIntro)&&<p>{text(f.heroIntro)}</p>}
  </header>
  {inquiries.length>0&&<div className="cg-site-contact-inquiries">
   {inquiries.map((item,i)=><article key={i} className="cg-site-contact-inquiry">
    <h2>{text(item.title)}</h2><p>{text(item.description)}</p>
   </article>)}
  </div>}
  {form}
  {assets.some(a=>a.role==="CONTACT"&&a.order>=0&&a.order<3&&
   /^\/api\/public\/content\/media\/[0-9a-f-]{36}$/i.test(a.src))&&
   <div className="cg-site-contact-photo-strip" aria-label="Approved Foundation photographs">
    {[0,1,2].map(index=>{
     const asset=assets.find(a=>a.role==="CONTACT"&&a.order===index&&
      /^\/api\/public\/content\/media\/[0-9a-f-]{36}$/i.test(a.src));
     return asset?<img key={index} src={asset.src} alt={asset.altText}
      loading="lazy"/>:null;
    })}
   </div>}
  {(text(f.officeHours)||map)&&<section className="cg-site-contact-details-public">
   <h2>Visit or connect</h2>
   {text(f.officeHours)&&<p>Foundation hours: {text(f.officeHours)}</p>}
   {embeddedMap&&<iframe className="cg-site-contact-map-embed" title="Foundation location on Google Maps"
    src={embeddedMap} loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"/>}
   {map&&<a href={map} rel="noopener noreferrer" target="_blank">
    View verified Foundation location on Google Maps</a>}
  </section>}
  {faq.length>0&&<section className="cg-site-contact-faq">
   <h2>Frequently Asked Questions</h2>
   <div className="cg-site-contact-faq-grid">
    {faq.map((item,i)=><details key={i}>
     <summary>{text(item.question)}</summary><p>{text(item.answer)}</p>
    </details>)}
   </div>
  </section>}
  {social.length>0&&<section className="cg-site-contact-social">
   <h2>Follow the Foundation</h2>
   <div>{social.filter(link=>allowedSocial[text(link.network)]&&
     secure(link.url,allowedSocial[text(link.network)]))
    .map((link,i)=><a key={i}
     href={secure(link.url,allowedSocial[text(link.network)])}
     target="_blank" rel="noopener noreferrer">{text(link.network)}</a>)}</div>
  </section>}
 </section>;
}
