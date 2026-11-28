import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {
  Award,
  CreditCard,
  FileCheck,
  BarChart2,
  IndianRupee,
  ShieldCheck,
  FolderOpen,
  Users,
  Megaphone,
  CheckCircle2,
  FileText,
  Download,
  Landmark,
  Calendar,
  ChevronDown,
  Heart,
  User
} from "lucide-react";
import type {PublicCmsPage} from "./cms-public-page";
import {CmsPublicShell} from "./cms-public-page";
import {publishedCmsNavigation,publishedCmsPage,publishedPublicIntro,type PublicCmsNavigation} from "./cms-public-source";
import {CmsNgoAnnualReports,type ApprovedAnnualReport} from "./cms-ngo-annual-client";
import {CmsNgoDocModalButton} from "./cms-ngo-doc-modal";
import {UnavailablePage} from "../../shared/unavailable-page";

type Child="pan-details"|"registration-certificate"|"annual-reports"|"financial-reports";
const allowed=new Set<Child>(["pan-details","registration-certificate","annual-reports","financial-reports"]);
const words=(v:unknown)=>typeof v==="string"?v:"";
type DocItem={type?:string;title?:string;asOfDate?:string;[key:string]:unknown};
type ComplianceDoc=DocItem&{file?:PublicCmsPage["assets"][number]};
const items=(raw:unknown,limit=6):DocItem[]=>Array.isArray(raw)?
 raw.filter((x):x is DocItem=>x!==null&&typeof x==="object"&&!Array.isArray(x)).slice(0,limit):[];
const safeMediaPath=(v:unknown)=>typeof v==="string"&&
 /^\/api\/public\/content\/media\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const chapter:Record<Child,string>={
 "pan-details":"PAN Details",
 "registration-certificate":"Registration Certificate",
 "annual-reports":"Annual Reports","financial-reports":"Financial Reports"
};
const scope=(page:PublicCmsPage)=>{
 const fact=page.sections.find(s=>s.kind==="COMPLIANCE_FACTS")?.fields??{};
 const docs:ComplianceDoc[]=Array.isArray(fact.documents)?fact.documents.slice(0,6).flatMap((raw,i)=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const item=raw as DocItem;
  if(!words(item.title).trim()||!/^\d{4}-\d{2}-\d{2}$/.test(words(item.asOfDate)))return [];
  return [{...item,file:page.assets.find(a=>a.role==="DOCUMENT"&&a.order===i&&safeMediaPath(a.src))}];
 }):[];
 return {fact,docs};
};
const reports=(page:PublicCmsPage,type:"REGISTRATION"|"ANNUAL_REPORT")=>
 scope(page).docs.filter(d=>d.type===type&&d.file?.src);
const canShow=(page:PublicCmsPage,key:Child)=>{
 const {fact}=scope(page);
 if(key==="annual-reports"||key==="financial-reports")return true; // an approved disclosure page may legitimately contain zero reports
 return key==="pan-details"?/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(words(fact.pan)):
  reports(page,"REGISTRATION").length>0;
};
/** All three original visitor views are strictly read-only subsets of the
 * single independently approved/current CG18 COMPLIANCE revision. Their
 * scans are current vetted CG19 placements, not cloned master records.
 * Financial report files are separately reviewed public publications; private CG09/CG20 records never enter this page.
 */
export function CmsNgoSidebar({page,selected="80g",navigation=null}:{
 page:PublicCmsPage;selected?:Child|"80g";navigation?:PublicCmsNavigation|null}){
 const menu=[
  {key:"80g",label:"80G Registration",href:"/ngo-information",icon:Award},
  {key:"pan-details",label:"PAN Details",href:"/ngo-information/pan-details",icon:CreditCard},
  {key:"registration-certificate",label:"Registration Certificate",
   href:"/ngo-information/registration-certificate",icon:FileCheck},
  {key:"annual-reports",label:"Annual Reports",
   href:"/ngo-information/annual-reports",icon:BarChart2},
  {key:"financial-reports",label:"Financial Reports",href:"/ngo-information/financial-reports",icon:IndianRupee},
  {key:"transparency",label:"Transparency & Compliance",icon:ShieldCheck},
  {key:"policies",label:"Policies & Documents",icon:FolderOpen}
 ];
 return <nav aria-label="Original NGO Information sections" className="cg-site-ngo-nav">
  {menu.map(item=>{
   const Icon=item.icon;
   const valid=item.key==="80g"||
    (allowed.has(item.key as Child)&&canShow(page,item.key as Child));
   return valid&&item.href?<Link className={
     item.key===selected?"cg-site-ngo-selected":"cg-site-ngo-item"}
    aria-current={item.key===selected?"page":undefined}
    href={item.href} key={item.key}><Icon size={16} aria-hidden="true" style={{flexShrink:0}}/> <span className="cg-site-ngo-item-label">{item.label}</span></Link>:
    <span className="cg-site-unavailable cg-site-ngo-item" aria-disabled="true" key={item.key}
     title="No current approved public original is available"><Icon size={16} aria-hidden="true" style={{flexShrink:0}}/> <span className="cg-site-ngo-item-label">{item.label}</span></span>;
  })}
  <div className="cg-site-ngo-secondary">
   <Link href="/contact" className="cg-site-ngo-item"><Users size={16} aria-hidden="true" style={{flexShrink:0}}/> <span className="cg-site-ngo-item-label">Join Us</span><ChevronDown size={14} aria-hidden="true" style={{marginLeft:"auto",flexShrink:0,color:"#64748B"}}/></Link>
   {navigation?.publishedRoutes?.some(r=>r.path==="/campaigns")&&<Link href="/campaigns" className="cg-site-ngo-item"><Megaphone size={16} aria-hidden="true" style={{flexShrink:0}}/> <span className="cg-site-ngo-item-label">Campaigns</span><ChevronDown size={14} aria-hidden="true" style={{marginLeft:"auto",flexShrink:0,color:"#64748B"}}/></Link>}
  </div>
  <div className="cg-site-ngo-cta-stack">
   {navigation?.publishedRoutes?.some(r=>r.path==="/donate")?<Link href="/donate" className="cg-site-ngo-cta-donate"><Heart size={15} aria-hidden="true"/> DONATE NOW</Link>:<Link href="/contact" className="cg-site-ngo-cta-donate"><Heart size={15} aria-hidden="true"/> CONTACT TO DONATE</Link>}
   {navigation?.login.visible&&navigation.login.path==="/admin/login"&&<Link href={navigation.login.path} className="cg-site-ngo-cta-login"><User size={15} aria-hidden="true"/> STAFF LOGIN</Link>}
  </div>
 </nav>;
}
export async function cmsNgoChildMetadata(section:string):Promise<Metadata>{
 if(!allowed.has(section as Child))return {robots:{index:false,follow:false}};
 const source=await publishedCmsPage("80g");
 if(source.state!=="PUBLISHED"||source.page.kind!=="COMPLIANCE"||
  !canShow(source.page,section as Child))
  return {title:"CareGanga Foundation",robots:{index:false,follow:false}};
 const slug=section as Child;
 return {title:chapter[slug]+" | CareGanga Foundation",
  description:"Foundation-published "+chapter[slug].toLowerCase()+" documents and information.",
  alternates:{canonical:"/ngo-information/"+slug},
  robots:{index:true,follow:true}};
}
export async function CmsNgoChildRoute({section}:{section:string}){
 if(!allowed.has(section as Child))notFound();
 const key=section as Child;
 const [result,navigation,home,intro,publications]=await Promise.all([
  publishedCmsPage("80g"),publishedCmsNavigation(),publishedCmsPage("home"),key==="annual-reports"?publishedPublicIntro("ANNUAL_REPORTS"):key==="financial-reports"?publishedPublicIntro("FINANCIAL_REPORTS"):Promise.resolve(null),key==="financial-reports"?publishedCmsPage("gallery"):Promise.resolve(null)]);
 if(result.state==="NOT_PUBLISHED")notFound();
 if(result.state!=="PUBLISHED"||result.page.kind!=="COMPLIANCE")
  return <UnavailablePage title="Foundation disclosure unavailable" description="The current approved information cannot be verified." linkHref="/ngo-information" linkLabel="NGO Information" />;
 if(!canShow(result.page,key))notFound();
 const {fact}=scope(result.page);
 const docType=key==="annual-reports"?"ANNUAL_REPORT":"REGISTRATION";
 const matches=reports(result.page,docType);
 const annual:ApprovedAnnualReport[]=matches.map(item=>({
  title:words(item.title),date:words(item.asOfDate),href:item.file!.src
 }));
 // Actual financial report files must be independently published CG19 media in
 // the Financial Reports publication category. Never read private CG09/CG20 reports.
 const financial:ApprovedAnnualReport[]=publications?.state==="PUBLISHED"&&publications.page.kind==="GALLERY"?publications.page.sections.filter(s=>s.kind==="GALLERY_GRID").flatMap(s=>items(s.fields.items,12).flatMap(item=>{
  if(item.mediaType!=="PUBLICATION"||words(item.category).toLocaleLowerCase()!=="financial reports"||item.visible===false||!Number.isSafeInteger(item.originalIndex))return [];
  const file=publications.page.assets.find(a=>a.role==="GALLERY"&&a.order===item.originalIndex&&safeMediaPath(a.src));
  return file&&words(item.title)&&words(item.asOfDate)?[{title:words(item.title),date:words(item.asOfDate),href:file.src}]:[];
 })):[];
 const hasTaxDetails=[fact.registrationNumber,fact.issuer,fact.verifiedAsOf].some(v=>words(v).trim());
 const info=<section className="cg-site-content cg-site-legal cg-site-ngo-child" data-ngo-section={key}>
  <nav className="cg-site-ngo-child-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> › </span><Link href="/ngo-information">NGO Information</Link><span aria-hidden="true"> › </span><span>Legal &amp; Registration</span><span aria-hidden="true"> › </span><span aria-current="page">{chapter[key]}</span></nav>
  <div className="cg-site-ngo-heading-row">
   <h1>{intro?.heading??(key==="registration-certificate"?"REGISTRATION CERTIFICATES":chapter[key])}</h1>
   {fact.verification==="VERIFIED"&&<span className="cg-site-ngo-verified-pill"><CheckCircle2 size={14} aria-hidden="true"/> VERIFIED / ACTIVE</span>}
  </div>
  {intro?.body&&<p className="cg-site-ngo-lead">{intro.body}</p>}
  <p className="cg-site-provenance">Current Foundation-published records only.
   Check the relevant issuing authority for legal or tax applicability.</p>
  {key==="pan-details"&&<div className="cg-site-pan-grid cg-site-ngo-pan-split">
   <article className="cg-site-ngo-navy-pan">
    <div className="cg-site-ngo-navy-pan-top">
     <div className="cg-site-ngo-navy-pan-issuer">
      <Landmark size={18} aria-hidden="true"/>
      <div><strong>INCOME TAX DEPARTMENT</strong><span>GOVT. OF INDIA</span></div>
     </div>
     <span className="cg-site-ngo-navy-tag">FOUNDATION RECORD</span>
    </div>
    <div className="cg-site-ngo-navy-pan-body">
     <span className="cg-site-ngo-navy-label">PERMANENT ACCOUNT NUMBER</span>
     <strong className="cg-site-ngo-navy-number">{words(fact.pan)}</strong>
     <span className="cg-site-ngo-navy-entity">CAREGANGA FOUNDATION</span>
    </div>
    <div className="cg-site-ngo-navy-pan-foot">
     <span>{words(fact.verifiedAsOf)?"Source Reviewed: "+words(fact.verifiedAsOf):"Official Foundation Record"}</span>
     <span className="cg-site-ngo-navy-valid"><CheckCircle2 size={13} aria-hidden="true"/> Published record</span>
    </div>
   </article>
   {hasTaxDetails&&<section className="cg-site-pan-profile cg-site-ngo-profile-card"><h2>Tax Profile Information</h2><dl className="cg-site-ngo-kv-list">
   <div><dt>Legal Entity Name</dt><dd>CAREGANGA FOUNDATION</dd></div>
   {words(fact.registrationNumber)&&<div><dt>Foundation Registration</dt>
    <dd>{words(fact.registrationNumber)}</dd></div>}
   {words(fact.issuer)&&<div><dt>Tax Jurisdiction / Authority</dt>
    <dd>{words(fact.issuer)}</dd></div>}
   {words(fact.source)&&<div><dt>Published Source</dt>
    <dd>{words(fact.source)}</dd></div>}
   {words(fact.verifiedAsOf)&&<div><dt>Source Reviewed On</dt>
    <dd>{words(fact.verifiedAsOf)}</dd></div>}
  </dl></section>}
  </div>}
  {key==="registration-certificate"&&<div className="cg-site-impact-grid cg-site-certificate-grid cg-site-ngo-cert-grid">
   {matches.map((d,i)=>{
    const regNo=words(fact.registrationNumber)||words(fact.approvalNumber);
    const authority=words(fact.issuer)||words(fact.source);
    return <article className="cg-site-ngo-cert-card" key={i}>
     <div className="cg-site-ngo-cert-head">
      <div className="cg-site-ngo-cert-icon"><FileText size={18} aria-hidden="true"/></div>
      <div className="cg-site-ngo-cert-title-wrap">
       <h2>{words(d.title)}</h2>
       {regNo&&<span className="cg-site-ngo-cert-regno">Reg. No: {regNo}</span>}
      </div>
      <span className="cg-site-ngo-active-pill">{fact.verification==="VERIFIED"?"Active":"Published"}</span>
     </div>
     <div className="cg-site-ngo-cert-details">
      <div className="cg-site-ngo-cert-detail-block">
       <span className="cg-site-ngo-cert-label">DOCUMENT TYPE</span>
       <strong>Statutory Registration</strong>
      </div>
      {authority&&<div className="cg-site-ngo-cert-detail-block">
       <span className="cg-site-ngo-cert-label">AUTHORITY</span>
       <strong>{authority}</strong>
      </div>}
      <div className="cg-site-ngo-cert-dates">
       <span>Registration Date: {words(d.asOfDate)}</span>
       <strong>{fact.verification==="VERIFIED"?"Active Record":"Published Record"}</strong>
      </div>
     </div>
     <div className="cg-site-ngo-cert-actions">
      <CmsNgoDocModalButton
       title={words(d.title)}
       meta={words(d.asOfDate)?`Published: ${words(d.asOfDate)}`:"Official Certified Document"}
       src={d.file!.src}
       verifiedBy={authority||undefined}
       active={fact.verification==="VERIFIED"}
       buttonLabel="View Document"
       className="cg-site-ngo-doc-btn"
      />
     </div>
    </article>;
   })}
  </div>}
  {key==="annual-reports"&&<CmsNgoAnnualReports reports={annual}/>}
  {key==="financial-reports"&&((publications?.state==="UNAVAILABLE"||(publications?.state==="PUBLISHED"&&publications.page.kind!=="GALLERY"))?<p role="alert">Published financial reports cannot currently be verified.</p>:<CmsNgoAnnualReports reports={financial} kind="financial"/>)}
  <p className="cg-site-legal-notice">{words(fact.disclaimer)||
   "Confirm current official information with the Foundation."}</p>
 </section>;
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 return <CmsPublicShell navigation={navigation} siteFooter={footer}>
  <div className="cg-site-ngo-layout">
   <aside className="cg-site-ngo-sidebar">
    <CmsNgoSidebar page={result.page} selected={key} navigation={navigation}/>
   </aside>
   {info}
  </div>
 </CmsPublicShell>;
}
