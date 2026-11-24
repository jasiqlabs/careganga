import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import type {PublicCmsPage} from "./cms-public-page";
import {CmsPublicShell} from "./cms-public-page";
import {publishedCmsNavigation,publishedCmsPage,publishedPublicIntro} from "./cms-public-source";
import {CmsNgoAnnualReports,type ApprovedAnnualReport} from "./cms-ngo-annual-client";
import {UnavailablePage} from "../../shared/unavailable-page";

type Child="pan-details"|"registration-certificate"|"annual-reports";
const allowed=new Set<Child>(["pan-details","registration-certificate","annual-reports"]);
const words=(v:unknown)=>typeof v==="string"?v:"";
type DocItem={type?:string;title?:string;asOfDate?:string;[key:string]:unknown};
type ComplianceDoc=DocItem&{file?:PublicCmsPage["assets"][number]};
const items=(raw:unknown):DocItem[]=>Array.isArray(raw)?
 raw.filter((x):x is DocItem=>x!==null&&typeof x==="object"&&!Array.isArray(x)).slice(0,6):[];
const safeMediaPath=(v:unknown)=>typeof v==="string"&&
 /^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(v);
const chapter:Record<Child,string>={
 "pan-details":"PAN Details",
 "registration-certificate":"Registration Certificate",
 "annual-reports":"Annual Reports"
};
const scope=(page:PublicCmsPage)=>{
 const fact=page.sections.find(s=>s.kind==="COMPLIANCE_FACTS")?.fields??{};
 const docs:ComplianceDoc[]=items(fact.documents).map((item,i)=>({
  ...item,file:page.assets.find(a=>a.role==="DOCUMENT"&&a.order===i&&safeMediaPath(a.src))
 }));
 return {fact,docs};
};
const reports=(page:PublicCmsPage,type:"REGISTRATION"|"ANNUAL_REPORT")=>
 scope(page).docs.filter(d=>d.type===type&&d.file?.src);
const canShow=(page:PublicCmsPage,key:Child)=>{
 const {fact}=scope(page);
 if(key==="annual-reports")return true; // an approved disclosure page may legitimately contain zero reports
 return key==="pan-details"?/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(words(fact.pan)):
  reports(page,"REGISTRATION").length>0;
};
/** All three original visitor views are strictly read-only subsets of the
 * single independently approved/current CG18 COMPLIANCE revision. Their
 * scans are current vetted CG19 placements, not cloned master records.
 * Financial reports require a real CG09/CG20 published projection.
 */
export function CmsNgoSidebar({page,selected="80g"}:{
 page:PublicCmsPage;selected?:Child|"80g"}){
 const menu=[
  {key:"80g",label:"80G Registration",href:"/ngo-information"},
  {key:"pan-details",label:"PAN Details",href:"/ngo-information/pan-details"},
  {key:"registration-certificate",label:"Registration Certificate",
   href:"/ngo-information/registration-certificate"},
  {key:"annual-reports",label:"Annual Reports",
   href:"/ngo-information/annual-reports"},
  {key:"financial-reports",label:"Financial Reports"},
  {key:"transparency",label:"Transparency & Compliance"},
  {key:"policies",label:"Policies & Documents"}
 ];
 return <nav aria-label="Original NGO Information sections">
  <p className="cg-site-ngo-breadcrumb"><Link href="/">Home</Link> / NGO Information</p>
  <h2>NGO Information</h2>
  {menu.map(item=>{
   const valid=item.key==="80g"||
    (allowed.has(item.key as Child)&&canShow(page,item.key as Child));
   return valid&&item.href?<Link className={
     item.key===selected?"cg-site-ngo-selected":undefined}
    aria-current={item.key===selected?"page":undefined}
    href={item.href} key={item.key}>{item.label}</Link>:
    <span className="cg-site-unavailable" aria-disabled="true" key={item.key}
     title="No current approved public original is available">{item.label}</span>;
  })}
  <div className="cg-site-ngo-secondary">
   <span className="cg-site-unavailable" aria-disabled="true">Join Us</span>
   <span className="cg-site-unavailable" aria-disabled="true">Campaigns</span>
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
 const [result,navigation,home,intro]=await Promise.all([
  publishedCmsPage("80g"),publishedCmsNavigation(),publishedCmsPage("home"),key==="annual-reports"?publishedPublicIntro("ANNUAL_REPORTS"):Promise.resolve(null)]);
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
 const info=<section className="cg-site-content cg-site-legal cg-site-ngo-child">
  <p className="cg-site-eyebrow">Foundation official information</p>
  <h1>{intro?.heading??chapter[key]}</h1>
  {intro?.body&&<p>{intro.body}</p>}
  <p className="cg-site-provenance">Current Foundation-published records only.
   Check the relevant issuing authority for legal or tax applicability.</p>
  {key==="pan-details"&&<dl className="cg-site-legal-data">
   <div><dt>Published PAN</dt><dd>{words(fact.pan)}</dd></div>
   {words(fact.registrationNumber)&&<div><dt>Foundation registration</dt>
    <dd>{words(fact.registrationNumber)}</dd></div>}
   {words(fact.issuer)&&<div><dt>Issuing authority</dt>
    <dd>{words(fact.issuer)}</dd></div>}
   {words(fact.verifiedAsOf)&&<div><dt>Source reviewed on</dt>
    <dd>{words(fact.verifiedAsOf)}</dd></div>}
  </dl>}
  {key==="registration-certificate"&&<div className="cg-site-impact-grid">
   {matches.map((d,i)=><article className="cg-site-impact-card" key={i}>
    <h2>{words(d.title)}</h2><p>Document date: {words(d.asOfDate)}</p>
    <a href={d.file!.src} download>View current approved certificate</a>
   </article>)}
  </div>}
  {key==="annual-reports"&&<><CmsNgoAnnualReports reports={annual}/>{intro?.eyebrow&&<h2>{intro.eyebrow}</h2>}</>}
  <p className="cg-site-legal-notice">{words(fact.disclaimer)||
   "Confirm current official information with the Foundation."}</p>
 </section>;
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 return <CmsPublicShell navigation={navigation} siteFooter={footer}>
  <div className="cg-site-ngo-layout">
   <aside className="cg-site-ngo-sidebar">
    <CmsNgoSidebar page={result.page} selected={key}/>
   </aside>
   {info}
  </div>
 </CmsPublicShell>;
}
