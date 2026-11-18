import Link from "next/link";
import {Suspense} from "react";
import type {PublicCmsPage,PublicCmsSection} from "./cms-public-page";
import type {PublicCmsNavigation} from "./cms-public-source";
import {CmsGalleryGridClient} from "./cms-gallery-grid-client";
type Asset=PublicCmsPage["assets"][number];
const text=(v:unknown)=>typeof v==="string"?v:"";
const records=(v:unknown)=>Array.isArray(v)?v.filter(x=>!!x&&typeof x==="object"&&!Array.isArray(x))
 .slice(0,16) as Record<string,unknown>[]:[];
const photo=(asset:Asset|undefined,cls:string)=>asset?.src?
 <img src={asset.src} alt={asset.altText} className={cls} loading="lazy"/>:null;
const label=(source:unknown,asOf:unknown)=>source||asOf?
 <p className="cg-site-provenance">
  {source&&<span>Source: {text(source)}</span>}
  {asOf&&<span> · As of {text(asOf)}</span>}
  <span> · Editorial information; not an audited financial statement</span>
 </p>:null;

export function CmsImpactGroup({section,assets,navigation}:{
 section:PublicCmsSection;assets:Asset[];navigation?:PublicCmsNavigation|null}){
 const f=section.fields,group=text(f.group),rows=records(f.items);
 const pic=assets.find(a=>a.role==="IMPACT"&&a.order===section.order);
 const tabular=["STATS","GROWTH","BREAKDOWN"].includes(group);
 const heading=text(f.heading);
 return <section className={"cg-site-content cg-site-impact-group cg-site-impact-"+group.toLowerCase()}>
  <div className="cg-site-impact-heading">
   <p className="cg-site-eyebrow">{group==="HERO"&&text(f.eyebrow)?
    text(f.eyebrow):group.replaceAll("_"," ")}</p>
   <h2>{heading}{group==="HERO"&&!!text(f.highlight)&&<>
    {" "}<span className="cg-site-impact-highlight">{text(f.highlight)}</span></>}</h2>
   {group==="HERO"&&!!text(f.quote)&&
    <blockquote className="cg-site-impact-quote">{text(f.quote)}</blockquote>}
   {text(f.intro)&&<p>{text(f.intro)}</p>}
   {label(f.source,f.asOfDate)}
  </div>
  {photo(pic,"cg-site-impact-photo")}
  {tabular&&rows.length>0?<div className="cg-site-table-wrap">
   <table className="cg-site-evidence-table">
    <caption>{heading} — source-reported information</caption>
    <thead><tr><th scope="col">Description</th><th scope="col">Value</th>
     <th scope="col">Notes</th></tr></thead>
    <tbody>{rows.map((item,i)=><tr key={i}>
     <th scope="row">{text(item.title)}
      {typeof item.year==="number"?" ("+item.year+")":""}</th>
     <td>{typeof item.percentage==="number"?item.percentage+"%":
      typeof item.value==="number"?String(item.value)+" "+text(item.unit):"—"}</td>
     <td>{text(item.description)}</td>
    </tr>)}</tbody>
   </table>
  </div>:rows.length>0?<div className="cg-site-impact-grid">{rows.map((v,i)=>
   <article key={i} className="cg-site-impact-card">
    <h3>{text(v.title)}</h3>{text(v.description)&&<p>{text(v.description)}</p>}
    {group==="GEOGRAPHY"&&["HIGH","MEDIUM","EXPANDING"].includes(text(v.level))&&
     <span className="cg-site-impact-reach">
      {text(v.level).charAt(0)+text(v.level).slice(1).toLowerCase()} reach
     </span>}
    {typeof v.percentage==="number"&&<strong>{v.percentage}%</strong>}
    {typeof v.value==="number"&&<strong>{v.value} {text(v.unit)}</strong>}
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
 const supported=f.verification==="VERIFIED",proof=assets.find(a=>a.role==="DOCUMENT");
 return <section className="cg-site-content cg-site-legal">
  <p className="cg-site-eyebrow">Registration &amp; public disclosures</p>
  <h1>{text(f.heading)}</h1>
  {supported&&text(f.badgeText)&&<span className="cg-site-legal-badge">
   {text(f.badgeText)}</span>}
  {text(f.subtitle)&&<h2 className="cg-site-legal-subtitle">{text(f.subtitle)}</h2>}
  <p>{text(f.summary)}</p>
  <p className="cg-site-legal-status">{supported?
   "Document-supported Foundation declaration":"Not currently verified — no tax eligibility is promised"}</p>
  <dl className="cg-site-legal-data">
   {([["Issuing authority",f.issuer],["PAN",f.pan],["Registration",f.registrationNumber],
    ["Approval reference",f.approvalNumber],["Valid from",f.validFrom],
    ["Valid until",f.validUntil],["Source",f.source],
    ["Reviewed on",f.verifiedAsOf]] as [string,unknown][])
    .filter(([,v])=>!!text(v)).map(([key,value])=><div key={key}>
     <dt>{key}</dt><dd>{text(value)}</dd></div>)}
  </dl>
  {records(f.documents).length>0&&<section aria-label="Published original reports">
   <h2>Verified source documents and annual reports</h2>
   <div className="cg-site-impact-grid">{records(f.documents).map((record,i)=>{
    const document=assets.find(a=>a.role==="DOCUMENT"&&a.order===i);
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
  <p className="cg-site-legal-notice">{text(f.disclaimer)}</p>
  <p className="cg-site-provenance">Only the current Foundation-published information is shown.
   Confirm tax applicability with the issuing authority.</p>
 </section>;
}
export function CmsGallery({section,assets}:{
 section:PublicCmsSection;assets:Asset[]}){
 const fields=section.fields;
 return <section className="cg-site-content cg-site-gallery">
  <p className="cg-site-eyebrow">Media &amp; Resources</p>
  <h1>{text(fields.heading)}</h1>
  {text(fields.description)&&<p>{text(fields.description)}</p>}
  <Suspense fallback={<p role="status">Loading approved gallery filters…</p>}>
   <CmsGalleryGridClient fields={{heading:fields.heading,
    description:fields.description,items:fields.items}} assets={assets}/>
  </Suspense>
 </section>;
}
export function CmsArticle({section,assets}:{
 section:PublicCmsSection;assets:Asset[]}){
 const f=section.fields,cover=assets.find(a=>a.role==="ARTICLE"&&a.order===0);
 return <article className="cg-site-content cg-site-article-body">
  <p className="cg-site-eyebrow">{text(f.category)}</p>
  <h1>{text(f.heading)}</h1>
  <p className="cg-site-article-lead">{text(f.excerpt)}</p>
  {label(f.source,f.asOfDate)}
  <p className="cg-site-provenance">Editorial credit: {text(f.authorLabel)}</p>
  {photo(cover,"cg-site-article-cover")}
  {text(f.body).split(/\n{2,}/).filter(Boolean).map((paragraph,i)=>
   <p key={i}>{paragraph}</p>)}
  <div className="cg-site-tags">{Array.isArray(f.tags)&&f.tags.map((tag,i)=>
   <span key={i}>{text(tag)}</span>)}</div>
 </article>;
}
export function CmsHealthcare({section}:{
 section:PublicCmsSection}){
 const f=section.fields;
 return <section className="cg-site-content cg-site-healthcare">
  <p className="cg-site-eyebrow">Healthcare Assistance</p>
  <h1>{text(f.heading)}</h1><p className="cg-site-article-lead">{text(f.intro)}</p>
  <div className="cg-site-healthcare-grid">{records(f.categories).map((v,i)=>
   <article key={i} className="cg-site-impact-card">
    <h2>{text(v.title)}</h2><p>{text(v.description)}</p>
   </article>)}</div>
  {f.ctaPath==="/contact"&&text(f.ctaLabel)&&
   <Link className="cg-site-action" href="/contact">{text(f.ctaLabel)}</Link>}
  <p className="cg-site-provenance">General Foundation information only.
   Provider availability, clinical advice and bookings are not represented here.</p>
 </section>;
}
