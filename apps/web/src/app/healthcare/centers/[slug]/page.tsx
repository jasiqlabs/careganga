import {HealthcarePublicChrome} from "../../../../shared/healthcare-public-chrome";
import type {Metadata} from "next";
import Link from "next/link";
import styles from "../../../health-network/profile.module.css";
import {notFound} from "next/navigation";
import {directory,publicPartnerOffers,type PublicDoctor} from "../../../../features/health-network/public-directory-source";
import {publicLabOffers,rupees} from "../../../../features/diagnostics/public-lab-offers";
import {currentConsultationBenefits,formatRupees}
 from "../../../../features/healthcare-assistance/public-consultation-benefits";
export const dynamic="force-dynamic";
type Params={params:Promise<{slug:string}>};
type Center={
 centerName:string;providerName:string;type:string;
 address:string;pinCode:string;publicPhone:string|null;
 timeZone:string;latitude:number|null;longitude:number|null;
 hours:{weekday:number;opens:string;closes:string;service:string}[];
 declaredServices:string[];notice:string;
 approvedPresentation:null|{description:string;services:string[];facilities:string[];
  hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[];
  media:{fileRef:string;altText:string}[]};
};
const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const format=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
async function current(slug:string):Promise<Center|null>{
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))return null;
 const backend=process.env.BACKEND_URL;
 if(!backend)return null;
 try{
  const r=await fetch(new URL("/api/v1/public/health-network/centers/"+
    encodeURIComponent(slug),backend),{
    cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!r.ok)return null;
  const value:unknown=await r.json();
  if(!value||typeof value!=="object"||
    !("centerName" in value)||typeof value.centerName!=="string"||
    !("providerName" in value)||typeof value.providerName!=="string"||
    !("address" in value)||typeof value.address!=="string"||
    !("hours" in value)||!Array.isArray(value.hours)||
    !("declaredServices" in value)||!Array.isArray(value.declaredServices))
    return null;
  return value as Center;
 }catch{return null;}
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {slug}=await params,c=await current(slug);
 if(!c)return {title:"Healthcare center unavailable | CareGanga",
   robots:{index:false,follow:false}};
 const title=c.centerName+" | CareGanga Healthcare";
 return {title,description:c.providerName+" — verified healthcare center in CareGanga.",
  alternates:{canonical:"/healthcare/centers/"+encodeURIComponent(slug)},
  robots:{index:true,follow:true}};
}
export default async function VerifiedCenterPage({params}:Params){
 const {slug}=await params;
 const c=await current(slug);
 if(!c)notFound();
 const serviceNames=c.declaredServices.map(format);
 const [doctors,labs,benefits,partnerOffers]=await Promise.all([
  directory<PublicDoctor>("doctors",new URLSearchParams({center:slug})),
  publicLabOffers(new URLSearchParams({center:slug})),
  currentConsultationBenefits({centerSlug:slug}),
  publicPartnerOffers(slug)
 ]);
 return <HealthcarePublicChrome><main className="cg-public-shell">
   <header className="cg-public-header">
     <nav aria-label="Healthcare navigation">
       <Link href="/">CareGanga</Link><span aria-hidden="true"> / </span>
       <Link href="/healthcare">Healthcare Assistance</Link>
     </nav>
   </header>
   <section className={"cg-public-section "+styles.profileHero} aria-labelledby="center-title">
     {c.approvedPresentation?.media[0]&&<div className={styles.heroPhoto}>{/* eslint-disable-next-line @next/next/no-img-element */}<img alt={c.approvedPresentation.media[0].altText} src={"/healthcare/centers/"+encodeURIComponent(slug)+"/photos/"+encodeURIComponent(c.approvedPresentation.media[0].fileRef)}/></div>}
     <div>
     <p className="cg-eyebrow">Verified healthcare center</p>
     <h1 id="center-title">{c.centerName}</h1>
     <p className="cg-lead">{c.providerName}</p>
     <p>{format(c.type)} · {c.address}, {c.pinCode}</p>
     <p>{c.notice}</p>
     {c.publicPhone&&<p>Contact: <a href={"tel:"+c.publicPhone}>{c.publicPhone}</a></p>}
     {typeof c.latitude==="number"&&Number.isFinite(c.latitude)&&Math.abs(c.latitude)<=90&&typeof c.longitude==="number"&&Number.isFinite(c.longitude)&&Math.abs(c.longitude)<=180&&
       <p><a href={"https://www.google.com/maps/search/?api=1&query="+
          encodeURIComponent(c.latitude+","+c.longitude)}
         target="_blank" rel="noopener noreferrer">View location on maps</a></p>}
     </div>
   </section>
   <nav className={styles.sectionNav} aria-label="Center sections">{c.approvedPresentation&&<a href="#overview">Overview</a>}{doctors.state==="READY"&&doctors.items.length>0&&<a href="#doctors">Doctors</a>}{benefits.state==="READY"&&benefits.items.length>0&&<a href="#pricing">Consultation support</a>}{labs.state==="READY"&&labs.items.length>0&&<a href="#tests">Tests & prices</a>}{serviceNames.length>0&&<a href="#services">Services</a>}{c.hours.length>0&&<a href="#hours">Operating hours</a>}<a href="#contact">Contact</a></nav>
   <div className={styles.detailGrid}><div className={styles.mainColumn}>
   {c.approvedPresentation&&<section id="overview" className={"cg-public-section "+styles.panel}>
     <h2>About this healthcare center</h2>
     <p>{c.approvedPresentation.description}</p>
     {c.approvedPresentation.media.length>0&&<div
       style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:16}}>
       {c.approvedPresentation.media.slice(1).map(media=><figure key={media.fileRef}>
         {/* eslint-disable-next-line @next/next/no-img-element */}
         <img loading="lazy" decoding="async" width="480" height="300"
          style={{maxWidth:"100%",height:"auto",borderRadius:12}}
          alt={media.altText}
          src={"/healthcare/centers/"+encodeURIComponent(slug)+"/photos/"+
            encodeURIComponent(media.fileRef)}/>
         <figcaption>{media.altText}</figcaption>
       </figure>)}
      </div>}
     {c.approvedPresentation.services.length>0&&<>
       <h3>Approved center services</h3>
       <ul>{c.approvedPresentation.services.map((x,i)=><li key={i}>{x}</li>)}</ul>
     </>}
     {c.approvedPresentation.facilities.length>0&&<>
       <h3>Facilities</h3>
       <ul>{c.approvedPresentation.facilities.map((x,i)=><li key={i}>{x}</li>)}</ul>
     </>}
     {c.approvedPresentation.hoursNote&&
       <p>Center hours note: {c.approvedPresentation.hoursNote}</p>}
     {c.approvedPresentation.publicEmail&&
       <p>Email: <a href={"mailto:"+c.approvedPresentation.publicEmail}>
        {c.approvedPresentation.publicEmail}</a></p>}
     {c.approvedPresentation.faqs.length>0&&<>
       <h3>Frequently asked questions about this center</h3>
       <dl>{c.approvedPresentation.faqs.map((f,i)=>
         <div key={i}><dt><strong>{f.question}</strong></dt><dd>{f.answer}</dd></div>)}</dl>
     </>}
   </section>}
   {doctors.state==="READY"&&doctors.items.length>0&&<section id="doctors" className={"cg-public-section "+styles.panel}>
     <h2>Currently verified doctors at this center</h2>
     <div className={styles.cardGrid}>{doctors.items.map(d=><article className={styles.dataCard} key={d.doctorRef}>
       <Link href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)}>{d.doctorName}</Link>
       {d.specialties.length>0?" · "+d.specialties.join(", "):""}
       {d.fee?" · Current in-person consultation ₹"+(d.fee.amountMinor/100).toLocaleString("en-IN"):" · Fee not currently approved"}
       {d.fee&&<p><Link className="cg-health-link-action primary" href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)+"/schedule?center="+encodeURIComponent(slug)}>Check appointment times</Link></p>}
     </article>)}</div>
   </section>}
   {benefits.state==="READY"&&benefits.items.length>0&&
    <section id="pricing" className={"cg-public-section "+styles.panel}
     aria-label="Currently approved Foundation consultation assistance at this center">
     <h2>Approved consultation support at this center</h2>
     <p>These are conditional, currently active policies; not a patient
      discount guarantee. Your eligibility, verified consultation fee,
      consent and accepted contribution are checked when you book.</p>
     <ul>{benefits.items.slice(0,5).map((item,i)=>
      <li key={item.centerSlug+":"+(item.doctorRef??"center")+":"+i}>
       {item.doctorName?item.doctorName+" · ":""}
       {item.mode==="PERCENT"&&item.percentBasisPoints!==null?
        (item.percentBasisPoints/100).toFixed(2)+"% possible Foundation share":
        "Possible fixed Foundation share "+formatRupees(item.fixedSupportMinor??"0")}
       {" (maximum "+formatRupees(item.maximumSupportMinor)+")"}
       {item.feeMinor!==null?
        " · current verified consultation fee "+formatRupees(item.feeMinor):""}
      </li>)}</ul>
     <p>Current approved benefits do not imply a collected payment,
      an appointment, or support for lab, pharmacy, nursing or procedures.</p>
    </section>}
   {labs.state==="READY"&&labs.items.length>0&&
    <section id="tests" className={"cg-public-section "+styles.panel} aria-label="Approved laboratory tests at this center">
     <h2>Approved laboratory tests at this center</h2>
     <p>Only current partner-approved commercial test prices are shown;
      no online lab booking, Foundation benefit or payment is available.</p>
     <ul>{labs.items.slice(0,5).map(item=><li key={item.offerRef}>
      <strong>{item.name}</strong> · Current patient price {rupees(item.patientPriceMinor)}
      {Number(item.patientPriceMinor)<Number(item.basePriceMinor)?
       " (partner commercial saving included)":""}
     </li>)}</ul>
     <p><Link href={"/health-network/lab-tests?center="+encodeURIComponent(slug)}>
      View all currently approved tests & prices at this lab</Link></p>
     {c.publicPhone&&<p>Ask this center about a test:
      {" "}<a href={"tel:"+c.publicPhone}>Call the currently published center contact</a>.
      Contacting the lab does not create an order or confirm a booking.</p>}
    </section>}
   {partnerOffers.state==="READY"&&partnerOffers.items.length>0&&
    <section className={"cg-public-section "+styles.panel} aria-label="Approved partner medicine and service information">
     <h2>Listed partner medicines, nursing services and procedures</h2>
     <p>Foundation-reviewed indicative information only. The actual bill, performed
      care and any CareGanga contribution require separate verification.</p>
     <ul>{partnerOffers.items.map((item,i)=><li key={item.serviceKind+":"+item.name+":"+i}>
      <strong>{item.name}</strong> · {format(item.serviceKind)}
      {item.indicativePriceMinor!==null?
       " · Indicative price ₹"+(Number(item.indicativePriceMinor)/100).toLocaleString("en-IN",
        {minimumFractionDigits:2,maximumFractionDigits:2}):" · Price on enquiry"}
      {item.description?" — "+item.description:""}
     </li>)}</ul>
     <p>{partnerOffers.caution}</p>
    </section>}
   {serviceNames.length>0&&<section id="services" className={"cg-public-section "+styles.panel}>
     <h2>Services declared by the center</h2>
     <p>Service information does not confirm individual appointment availability.</p>
     <ul>{serviceNames.map(s=><li key={s}>{s}</li>)}</ul>
   </section>}
   </div><aside className={styles.sideColumn}>
   <section className={"cg-public-section "+styles.panel}><h2>Quick actions</h2>{doctors.state==="READY"&&doctors.items.length>0&&<p><a className="cg-health-link-action primary" href="#doctors">Find a doctor at this center</a></p>}{labs.state==="READY"&&labs.items.length>0&&<p><Link href={"/health-network/lab-tests?center="+encodeURIComponent(slug)}>View tests &amp; prices</Link></p>}{c.publicPhone&&<p><a href={"tel:"+c.publicPhone}>Call center</a></p>}<p><Link href="/contact">CareGanga support</Link></p></section>
   {c.hours.length>0&&<section id="hours" className={"cg-public-section "+styles.panel}>
     <h2>Operating hours</h2>
     <ul>{c.hours.map((h,i)=><li key={i}>{days[h.weekday]??"Day"} — {h.opens} to {h.closes}
       {h.service!=="GENERAL"?" · "+format(h.service):""}</li>)}</ul>
     <p>Times are shown in the center’s local time zone ({c.timeZone}). Confirm before visiting.</p>
   </section>}
   <section id="contact" className={"cg-public-section "+styles.panel}>
     <h2>Location &amp; contact</h2><p>{c.address}, {c.pinCode}</p>{c.publicPhone&&<p><a href={"tel:"+c.publicPhone}>{c.publicPhone}</a></p>}
     <p>Confirm services and fees before visiting.</p>
     <Link href="/health-network">Browse verified centers and doctors</Link>
     <p><Link href="/contact">Contact CareGanga</Link></p>
   </section>
 </aside></div>
 </main></HealthcarePublicChrome>;
}
