import Link from "next/link";
import {Suspense,type ReactNode} from "react";
import {
  CheckCircle2,
  ShieldCheck,
  Award,
  CreditCard,
  Calendar,
  Clock,
  Landmark,
  FileText,
  Download,
  Gift,
  AlertTriangle,
  ArrowRight,
  Heart,
  TrendingUp,
  MapPin,
  PieChart,
  Target,
  Quote,
  Megaphone
} from "lucide-react";
import type {PublicCmsPage,PublicCmsSection} from "./cms-public-page";
import type {PublicCmsNavigation} from "./cms-public-source";
import {CmsGalleryGridClient,type CmsMediaType} from "./cms-gallery-grid-client";
import {CmsNgoDocModalButton} from "./cms-ngo-doc-modal";
import {CmsImpactGeoCard} from "./cms-impact-geo-card";
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

export function CmsImpactPage({sections,assets,navigation}:{
 sections:PublicCmsSection[];assets:Asset[];navigation?:PublicCmsNavigation|null}){
 const byGroup=(name:string)=>sections.find(s=>s.kind==="IMPACT_GROUP"&&text(s.fields.group)===name);
 const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
 const validPct=(v:unknown):v is number=>finite(v)&&v>=0&&v<=100;
 const hero=byGroup("HERO"),pillars=byGroup("PILLARS"),stats=byGroup("STATS");
 const growth=byGroup("GROWTH"),geo=byGroup("GEOGRAPHY"),breakdown=byGroup("BREAKDOWN");
 const focus=byGroup("FOCUS"),stories=byGroup("STORIES"),updates=byGroup("UPDATES"),cta=byGroup("CTA");
 const growthRows=growth?records(growth.fields.items).filter(v=>finite(v.value)&&v.value>=0):[];
 const growthMax=Math.max(1,...growthRows.map(v=>Number(v.value)||0));
 const growthPts=growthRows.map((v,i)=>{
  const x=growthRows.length===1?130:20+(i/(growthRows.length-1))*220;
  const y=95-((Number(v.value)||0)/growthMax)*70;
  return {x,y,label:typeof v.year==="number"?String(v.year):text(v.title),val:Number(v.value)||0};
 });
 const geoRows=geo?records(geo.fields.items):[];
 const geoHigh=geoRows.filter(v=>text(v.level)==="HIGH").length;
 const geoMed=geoRows.filter(v=>text(v.level)==="MEDIUM").length;
 const geoExp=geoRows.filter(v=>text(v.level)==="EXPANDING").length;
 const bdRows=breakdown?records(breakdown.fields.items).filter(v=>validPct(v.percentage)):[];
 const bdColors=["#15803D","#2563EB","#EAB308","#DC2626","#7C3AED","#0D9488"];
 const bdTotal=bdRows.reduce((a,b)=>a+Number(b.percentage||0),0);
 const pillarColors=["is-green","is-pink","is-mint","is-amber"];
 return <div className="cg-site-impact-dashboard">
  {hero&&<CmsImpactGroup section={hero} assets={assets} navigation={navigation}/>}
  {pillars&&<section className="cg-site-content cg-site-impact-pillars-wrap" aria-label={text(pillars.fields.heading)||"Our Pillars"}>
   {records(pillars.fields.items).length>0?<div className="cg-site-impact-pillars-row">
    {records(pillars.fields.items).map((item,i)=><article key={i} className="cg-site-impact-pillar-item">
     <span className={"cg-site-impact-pillar-dot "+pillarColors[i%pillarColors.length]} aria-hidden="true">{text(item.title).slice(0,1)||"•"}</span>
     <div><h3>{text(item.title)}</h3>{text(item.description)&&<p>{text(item.description)}</p>}</div>
    </article>)}
   </div>:<CmsImpactGroup section={pillars} assets={assets} navigation={navigation}/>}
  </section>}
  {stats&&records(stats.fields.items).length>0&&<section className="cg-site-content cg-site-impact-stats-row" aria-label={text(stats.fields.heading)||"Impact Statistics"}>
   {records(stats.fields.items).map((item,i)=><article key={i} className="cg-site-impact-stat-card">
    <strong>{finite(item.value)?item.value.toLocaleString("en-IN"):0}{text(item.unit)?" "+text(item.unit):""}</strong>
    <h3>{text(item.title)}</h3>
    {text(item.description)&&<p>{text(item.description)}</p>}
   </article>)}
  </section>}
  <section className="cg-site-content cg-site-impact-analytics-grid" aria-label="Impact Analytics">
   <article className="cg-site-impact-dash-card">
    <div className="cg-site-impact-dash-head">
     <h3><TrendingUp size={17} aria-hidden="true"/> {text(growth?.fields.heading)||"Impact Growth"}</h3>
     <span className="cg-site-impact-dash-pill">{text(growth?.fields.asOfDate)||"Source Data"}</span>
    </div>
    <div className="cg-site-impact-growth-viz">
     {growthPts.length>0?<svg viewBox="0 0 260 118" className="cg-site-impact-svg" role="img" aria-label="Impact growth chart">
      <line x1="16" y1="96" x2="244" y2="96" stroke="#99F6E4" strokeWidth="6" strokeLinecap="round"/>
      {growthPts.length>1?<polyline fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={growthPts.map(p=>`${p.x},${p.y}`).join(" ")}/>:<path d="M 32 76 Q 130 62 224 22" fill="none" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round"/>}
      {growthPts.map((p,i)=><g key={i}><circle cx={p.x} cy={growthPts.length>1?p.y:80} r="4" fill="#15803D"/><text x={p.x} y={growthPts.length>1?Math.max(14,p.y-8):88} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A">{p.val.toLocaleString("en-IN")}</text><text x={p.x} y="113" textAnchor="middle" fontSize="10" fill="#64748B">{p.label}</text></g>)}
     </svg>:<svg viewBox="0 0 260 118" className="cg-site-impact-svg" role="img" aria-label="Impact growth baseline">
      <path d="M 32 76 Q 130 62 224 22" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="224,22 216,23 221,30" fill="#15803D"/>
      <text x="130" y="84" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0F172A">0</text>
      <line x1="16" y1="96" x2="244" y2="96" stroke="#99F6E4" strokeWidth="6" strokeLinecap="round"/>
      <text x="130" y="113" textAnchor="middle" fontSize="10" fill="#64748B">No data yet</text>
     </svg>}
    </div>
    {text(growth?.fields.intro)&&<p className="cg-site-impact-dash-note">{text(growth?.fields.intro)}</p>}
    {growth&&growthRows.length>0&&label(growth.fields.source,growth.fields.asOfDate)}
   </article>
   <CmsImpactGeoCard
    heading={text(geo?.fields.heading)||"Geographical Reach"}
    items={geoRows}
    sourceNode={geo&&geoRows.length>0?label(geo.fields.source,geo.fields.asOfDate):null}
   />
   <article className="cg-site-impact-dash-card">
    <div className="cg-site-impact-dash-head">
     <h3><PieChart size={17} aria-hidden="true"/> {text(breakdown?.fields.heading)||"Impact by Category"}</h3>
    </div>
    <div className="cg-site-impact-bd-split">
     <div className="cg-site-impact-donut-wrap">
      <svg viewBox="0 0 100 100" className="cg-site-impact-donut" role="img" aria-label="Impact category breakdown">
       <circle cx="50" cy="50" r="36" fill="none" stroke="#E2E8F0" strokeWidth="12"/>
       {(()=>{let off=0;return bdRows.map((v,i)=>{const pct=Number(v.percentage)||0;const len=(pct/100)*226.2;const el=<circle key={i} cx="50" cy="50" r="36" fill="none" stroke={bdColors[i%bdColors.length]} strokeWidth="12" strokeDasharray={`${len} ${226.2-len}`} strokeDashoffset={-off} transform="rotate(-90 50 50)"/>;off+=len;return el;});})()}
      </svg>
      <span className="cg-site-impact-donut-center">{bdTotal>0?`${bdTotal}%`:"Total Impact"}</span>
     </div>
     <ul className="cg-site-impact-legend">
      {bdRows.length>0?bdRows.map((v,i)=><li key={i}><span className="cg-dot" style={{background:bdColors[i%bdColors.length]}}/> {text(v.title)} <strong>{Number(v.percentage)}%</strong></li>):<li className="cg-site-impact-empty-inline">No category breakdown published yet.</li>}
     </ul>
    </div>
    {breakdown&&bdRows.length>0&&label(breakdown.fields.source,breakdown.fields.asOfDate)}
   </article>
  </section>
  <section className="cg-site-content cg-site-impact-highlights-grid" aria-label="Impact Highlights">
   {[
    {sec:focus,Icon:Target,fallback:"Key Impact Areas",empty:"No impact areas published yet."},
    {sec:stories,Icon:Quote,fallback:"Success Stories",empty:"No stories published yet."},
    {sec:updates,Icon:Megaphone,fallback:"Latest Updates",empty:"No updates published yet."}
   ].map(({sec,Icon,fallback,empty},idx)=>{
    const list=sec?records(sec.fields.items):[];
    const pic=sec?assets.find(a=>a.role==="IMPACT"&&a.order===sec.order):undefined;
    return <article key={idx} className="cg-site-impact-dash-card">
     <div className="cg-site-impact-dash-head">
      <h3><Icon size={17} aria-hidden="true"/> {text(sec?.fields.heading)||fallback}</h3>
      <span className="cg-site-impact-dash-pill">{list.length}</span>
     </div>
     {photo(pic,"cg-site-impact-card-photo")}
     {list.length>0?<ul className="cg-site-impact-mini-list">
      {list.slice(0,4).map((item,j)=><li key={j}><strong>{text(item.title)}</strong>{text(item.description)&&<p>{text(item.description)}</p>}</li>)}
     </ul>:<p className="cg-site-impact-empty-inline">{empty}</p>}
    </article>;
   })}
  </section>
  {cta&&<CmsImpactGroup section={cta} assets={assets} navigation={navigation}/>}
 </div>;
}
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
 const safeDocument=(a:Asset)=>a.role==="DOCUMENT"&&/^\/api\/public\/content\/media\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(a.src);
 const supported=f.verification==="VERIFIED",proof=assets.find(safeDocument);
 const documents=Array.isArray(f.documents)?f.documents.slice(0,6).flatMap((raw,i)=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const record=raw as Record<string,unknown>;
  if(!text(record.title).trim()||!/^\d{4}-\d{2}-\d{2}$/.test(text(record.asOfDate)))return [];
  const document=assets.find(a=>a.order===i&&safeDocument(a));
  return document?[{record,document}]:[];
 }):[];
 return <section className="cg-site-content cg-site-legal cg-site-ngo-child">
  <nav className="cg-site-ngo-child-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> › </span><span>NGO Information</span><span aria-hidden="true"> › </span><span>Legal &amp; Registration</span><span aria-hidden="true"> › </span><span aria-current="page">80G Tax Benefit</span></nav>
  <div className="cg-site-ngo-heading-row">
   <h1>{text(f.heading)||"80G TAX BENEFIT"}</h1>
   {supported&&<span className="cg-site-ngo-verified-pill"><CheckCircle2 size={14} aria-hidden="true"/> {text(f.badgeText)||"VERIFIED / ACTIVE"}</span>}
  </div>
  {text(f.subtitle)&&<h2 className="cg-site-legal-subtitle cg-site-ngo-orange-sub">{text(f.subtitle)}</h2>}
  <p className="cg-site-ngo-lead">{text(f.summary)}</p>
  <div className="cg-site-ngo-80g-top-grid">
   <div className="cg-site-ngo-80g-main">
    <div className="cg-site-ngo-cert-split">
     <div className="cg-site-ngo-navy-brand">
      <div className="cg-site-ngo-navy-emblem"><ShieldCheck size={28} aria-hidden="true"/></div>
      <strong>CareGanga Foundation</strong>
      <span>{supported?"Eligible Charitable Organisation":"Foundation disclosure"}</span>
     </div>
     <dl className="cg-site-ngo-kv-list cg-site-ngo-kv-card">
      <div>
       <dt><ShieldCheck size={15} aria-hidden="true"/> 80G Status</dt>
       <dd><span className={supported?"cg-site-ngo-status-active":"cg-site-ngo-status-pending"}>{supported?"● Active":"Not verified"}</span></dd>
      </div>
      {([
       ["Approval / Registration No.",f.approvalNumber||f.registrationNumber,Award],
       ["PAN",f.pan,CreditCard],
       ["Valid From",f.validFrom,Calendar],
       ["Validity",f.validUntil,Clock],
       ["Issuing Authority",f.issuer,Landmark],
       ["Source",f.source,FileText],
       ["Reviewed On",text(f.source)?f.verifiedAsOf:"",Calendar]
      ] as [string,unknown,typeof Award][]).filter(([,v])=>!!text(v)).map(([key,value,Icon])=><div key={key}>
       <dt><Icon size={15} aria-hidden="true"/> {key}</dt><dd>{text(value)}</dd>
      </div>)}
     </dl>
    </div>
   </div>
   <aside className="cg-site-ngo-80g-aside" aria-label="Tax benefit illustration and donate">
    <div className="cg-site-ngo-80g-illus-card" aria-hidden="true">
     <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="44" y="14" width="152" height="132" rx="12" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2"/>
      <rect x="90" y="6" width="60" height="16" rx="6" fill="#64748B"/>
      <text x="120" y="40" textAnchor="middle" fill="#14452F" fontSize="13" fontWeight="800" fontFamily="sans-serif">TAX BENEFIT 80G</text>
      <rect x="62" y="52" width="16" height="16" rx="4" fill="#DCFCE7"/>
      <path d="M66 60l3 3 5-6" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="86" y="64" fill="#1E293B" fontSize="10" fontWeight="700" fontFamily="sans-serif">Section 80G</text>
      <rect x="62" y="75" width="16" height="16" rx="4" fill="#DCFCE7"/>
      <path d="M66 83l3 3 5-6" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="86" y="87" fill="#1E293B" fontSize="10" fontWeight="700" fontFamily="sans-serif">Deduction Claim</text>
      <rect x="62" y="98" width="16" height="16" rx="4" fill="#DCFCE7"/>
      <path d="M66 106l3 3 5-6" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="86" y="110" fill="#1E293B" fontSize="10" fontWeight="700" fontFamily="sans-serif">Donation Receipt</text>
      <rect x="62" y="121" width="16" height="16" rx="4" fill="#DCFCE7"/>
      <path d="M66 129l3 3 5-6" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="86" y="133" fill="#1E293B" fontSize="10" fontWeight="700" fontFamily="sans-serif">Tax Savings</text>
      <circle cx="204" cy="126" r="14" fill="#FACC15"/>
      <circle cx="204" cy="118" r="14" fill="#EAB308"/>
      <text x="204" y="122" textAnchor="middle" fill="#14452F" fontSize="12" fontWeight="800" fontFamily="sans-serif">₹</text>
     </svg>
    </div>
    <div className="cg-site-ngo-donate-card">
     <div className="cg-site-ngo-donate-icon"><Gift size={22} aria-hidden="true"/></div>
     <h3>DONATE &amp; GET TAX BENEFIT</h3>
     <p>Subject to applicable law and eligibility</p>
     <Link href="/contact" className="cg-site-ngo-donate-cta">
      <Heart size={14} aria-hidden="true"/> DONATE NOW <ArrowRight size={14} aria-hidden="true"/>
     </Link>
    </div>
   </aside>
  </div>
  <div className="cg-site-ngo-3col">
   <article className="cg-site-ngo-info-card">
    <div className="cg-site-ngo-info-head">
     <span className="cg-site-ngo-info-icon cg-site-ngo-info-icon-green"><ShieldCheck size={16} aria-hidden="true"/></span>
     <h3>DONOR TAX BENEFIT</h3>
    </div>
    {text(f.summary).trim()?<ul className="cg-site-ngo-check-list">
     {text(f.summary).split(/\n+|(?<=\.)\s+/).map(s=>s.trim()).filter(Boolean).map((line,idx)=>
      <li key={idx}><CheckCircle2 size={14} aria-hidden="true"/><span>{line}</span></li>
     )}
    </ul>:<p className="cg-site-ngo-empty-note">No donor tax benefit details published yet.</p>}
   </article>
   <article className="cg-site-ngo-info-card">
    <div className="cg-site-ngo-info-head">
     <span className="cg-site-ngo-info-icon cg-site-ngo-info-icon-green"><FileText size={16} aria-hidden="true"/></span>
     <h3>DOCUMENTS</h3>
    </div>
    {documents.length>0?<div className="cg-site-ngo-doc-stack">
     {documents.map(({record,document},i)=>document?<div key={i} className="cg-site-ngo-doc-item">
      <div className="cg-site-ngo-doc-item-title">
       <FileText size={15} aria-hidden="true"/>
       <div>
        <strong>{text(record.title)}</strong>
        <span>{text(record.type).replaceAll("_"," ")} · {text(record.asOfDate)}</span>
       </div>
      </div>
      <CmsNgoDocModalButton
       title={text(record.title)}
       meta={`${text(record.type).replaceAll("_"," ")} · ${text(record.asOfDate)}`}
       src={document.src}
       verifiedBy={text(f.source)||undefined}
       active={supported}
       buttonLabel="VIEW DOCUMENT"
      />
     </div>:null)}
    </div>:supported&&proof?.src?<div className="cg-site-ngo-doc-stack">
     <div className="cg-site-ngo-doc-item">
      <div className="cg-site-ngo-doc-item-title">
       <FileText size={15} aria-hidden="true"/>
       <div><strong>80G Approval / Supporting Document</strong></div>
      </div>
      <CmsNgoDocModalButton
       title="80G Approval / Supporting Document"
       src={proof.src}
       verifiedBy={text(f.source)||undefined}
       active={supported}
       buttonLabel="VIEW DOCUMENT"
      />
     </div>
    </div>:<p className="cg-site-ngo-empty-note">No published 80G supporting documents attached yet.</p>}
   </article>
   <article className="cg-site-ngo-info-card">
    <div className="cg-site-ngo-info-head">
     <span className="cg-site-ngo-info-icon cg-site-ngo-info-icon-amber"><AlertTriangle size={16} aria-hidden="true"/></span>
     <h3>IMPORTANT</h3>
    </div>
    {(text(f.importantNote).trim()||text(f.disclaimer).trim())?<ul className="cg-site-ngo-bullet-list">
     {text(f.importantNote).trim()&&<li>{text(f.importantNote)}</li>}
     {text(f.disclaimer).trim()&&<li>{text(f.disclaimer)}</li>}
    </ul>:<p className="cg-site-ngo-empty-note">No additional notes published.</p>}
   </article>
  </div>
  <div className="cg-site-ngo-disclaimer-bar">
   {text(f.verifiedAsOf)&&<span><Calendar size={13} aria-hidden="true" style={{verticalAlign:"-2px",marginRight:"0.3rem"}}/><strong>Last Updated:</strong> {text(f.verifiedAsOf)}</span>}
   <span><ShieldCheck size={13} aria-hidden="true" style={{verticalAlign:"-2px",marginRight:"0.3rem"}}/><strong>Disclaimer:</strong> Only the current Foundation-published information is shown. Confirm tax applicability with the issuing authority.</span>
  </div>
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
 const f=section.fields,event=f.event&&typeof f.event==="object"&&!Array.isArray(f.event)?f.event as Record<string,unknown>:null;
 const safeMedia=(v:unknown)=>/^\/api\/public\/content\/media\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(text(v));
 const cover=event?(safeMedia(event.coverSrc)?{role:"ARTICLE",order:0,altText:text(f.heading),src:text(event.coverSrc)}:undefined):assets.find(a=>a.role==="ARTICLE"&&a.order===0&&safeMedia(a.src));
 const stamp=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):"";
 const eventStatus=event?({SCHEDULED:"Scheduled",ONGOING:"Ongoing",COMPLETED:"Completed"} as Record<string,string>)[text(event.status)]:undefined;
 const start=stamp(event?.scheduledStart),end=stamp(event?.scheduledEnd);
 const validSchedule=!!start&&!!end&&Date.parse(text(event?.scheduledEnd))>Date.parse(text(event?.scheduledStart));
 const tags=Array.isArray(f.tags)?f.tags.map(text).filter(t=>t.trim()):[];
 return <article className="cg-site-content cg-site-article-body cg-site-editorial-detail">
  <Link className="cg-site-editorial-back" href={event?"/events":"/blog"}>{event?"Back to events":"Back to news"}</Link>
  <p className="cg-site-eyebrow">{text(f.category)}</p>
  <h1>{text(f.heading)}</h1>
  {!!text(f.excerpt)&&<p className="cg-site-article-lead">{text(f.excerpt)}</p>}
  {event&&<div className="cg-site-event-facts"><p>{eventStatus||"Current event status unavailable"}{text(event.area)?" · "+text(event.area):""}</p>{validSchedule?<p>{start} – {end} IST</p>:<p>Current event timing unavailable</p>}</div>}
  {(text(f.source)||text(f.asOfDate)||text(f.authorLabel))&&<div className="cg-site-editorial-meta">{text(f.source)&&<span>Source: {text(f.source)}</span>}{text(f.asOfDate)&&<span>As of {text(f.asOfDate)}</span>}{text(f.authorLabel)&&<span>Editorial credit: {text(f.authorLabel)}</span>}</div>}
  {photo(cover,"cg-site-article-cover")}
  {text(f.body).split(/\n{2,}/).filter(Boolean).map((paragraph,i)=>
   <p key={i}>{paragraph}</p>)}
  {tags.length>0&&<div className="cg-site-tags">{tags.map((tag,i)=>
   <span key={i}>{tag}</span>)}</div>}
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
 const safeSocial=social.filter(link=>allowedSocial[text(link.network)]&&secure(link.url,allowedSocial[text(link.network)]));
 return <section className="cg-site-contact-original cg-site-content">
  <header className="cg-site-contact-hero">
   <p className="cg-site-eyebrow">Contact the Foundation</p>
   <h1>{text(f.heroTitle).trim()||"Contact the Foundation"}</h1>
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
  {safeSocial.length>0&&<section className="cg-site-contact-social">
   <h2>Follow the Foundation</h2>
   <div>{safeSocial
    .map((link,i)=><a key={i}
     href={secure(link.url,allowedSocial[text(link.network)])}
     target="_blank" rel="noopener noreferrer">{text(link.network)}</a>)}</div>
  </section>}
 </section>;
}
