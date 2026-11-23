import type {Metadata} from "next";
import Link from "next/link";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import styles from "./collaboration.module.css";
import {publishedCmsPage} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";

export const metadata:Metadata={
 title:"Corporate Partnerships | CareGanga Foundation",
 description:"Partner with CareGanga Foundation. Explore responsible CSR collaborations and verified healthcare service partnerships.",
 alternates:{canonical:"/collaboration"},robots:{index:true,follow:true}
};

/** Original client-owned corporate-partner destination. All public names
 * come exclusively from a currently EFFECTIVE CG18 publication with current
 * CG08/C03/C19 checked rights, never screenshot sample brands. */
export default async function Partnerships(){
 const result=await publishedCmsPage("collaboration");
 const section=result.state==="PUBLISHED"&&result.page.kind==="PARTNERS"?
  result.page.sections.find(s=>s.kind==="PARTNER_CARDS"):undefined;
 const safeCards=Array.isArray(section?.fields.cards)?section.fields.cards.flatMap(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const x=raw as Record<string,unknown>;
  if(typeof x.name!=="string"||x.name.trim().length<2||x.name.length>200||
   typeof x.summary!=="string"||x.summary.trim().length<10||x.summary.length>500||
   !Number.isSafeInteger(x.originalIndex)||Number(x.originalIndex)<0||Number(x.originalIndex)>11)return [];
  return [{name:x.name,summary:x.summary,originalIndex:x.originalIndex as number}];
 }):[];
 const approvedAssets=result.state==="PUBLISHED"&&result.page.kind==="PARTNERS"?result.page.assets:[];
 const logoFor=(index:number)=>approvedAssets.find(a=>a.role==="FEATURE"&&a.order===index&&
  /^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(a.src));
 const partnerHeading=typeof section?.fields.heading==="string"?section.fields.heading:"Meet Our Partners";
 const partnerIntro=typeof section?.fields.intro==="string"&&section.fields.intro.trim()?section.fields.intro:
  "Only organizations with verified Foundation approval and current permission for public attribution appear here.";
 return <HealthcarePublicChrome>
  <main className={styles.shell}>
   <section className={styles.hero} aria-labelledby="corporate-heading">
    <div className={styles.heroInner}>
     <p className={styles.eyebrow}>CareGanga Foundation · Collaboration</p>
     <h1 id="corporate-heading">Corporate Partners</h1>
     <p className={styles.lead}>Make a meaningful difference through responsible
      partnerships that support people and communities.</p>
     <p className={styles.intro}>We welcome genuine corporate social responsibility
      discussions, service collaborations and long-term support. Every
      partnership is verified before we describe it publicly.</p>
     <div className={styles.heroActions}>
      <Link className={styles.primary} href="/contact">Partner With Us</Link>
      <a className={styles.secondary} href="#corporate-partners">Meet Our Partners</a>
     </div>
    </div>
   </section>
   <section className={styles.section} aria-labelledby="why-partner">
    <div className={styles.sectionHeading}>
     <p className={styles.kicker}>COLLABORATION WITH PURPOSE</p>
     <h2 id="why-partner">Why Partner With Us?</h2>
     <p>Build a transparent working relationship around agreed Foundation
      programmes and the communities they are intended to serve.</p>
    </div>
    <div className={styles.cards}>
     <article className={styles.card}>
      <div className={styles.cardMark} aria-hidden="true">01</div>
      <h3>Community Impact</h3>
      <p>Support meaningful programmes and access initiatives grounded in genuine
       community needs.</p>
     </article>
     <article className={styles.card}>
      <div className={styles.cardMark} aria-hidden="true">02</div>
      <h3>Responsible Partnerships</h3>
      <p>Agree on scope, documents, responsibilities and measurable goals before
       any partnership is announced.</p>
     </article>
     <article className={styles.card}>
      <div className={styles.cardMark} aria-hidden="true">03</div>
      <h3>Clear Communication</h3>
      <p>Discuss activities and progress with the Foundation through the agreed
       collaboration process.</p>
     </article>
    </div>
   </section>
   <section id="corporate-partners" className={styles.partners} aria-labelledby="partners-heading">
    <div className={styles.sectionHeading}>
     <p className={styles.kicker}>TRUSTED COLLABORATION</p>
     <h2 id="partners-heading">{partnerHeading}</h2>
     <p>{partnerIntro}</p>
    </div>
    {safeCards.length>0?<div className={styles.partnerCards}>
     {safeCards.map((partner,i)=>{
      const logo=logoFor(partner.originalIndex);
      return <article key={partner.name+String(i)} className={styles.partnerCard}>
       {logo&&<img className={styles.partnerLogo} src={logo.src} alt={logo.altText} loading="lazy"/>}
       <h3>{partner.name}</h3>
       <p>{partner.summary}</p>
      </article>;
     })}
    </div>:<div className={styles.emptyPartners} role="status">
     <h3>{result.state==="UNAVAILABLE"?"Partner announcements are temporarily unavailable":
      "Partner announcements will appear here"}</h3>
     <p>{result.state==="UNAVAILABLE"?
      "We cannot verify the current approved public partner information right now. Please try again later.":
      "We are not displaying unverified corporate names or logos. Please contact the Foundation for current collaboration information."}</p>
    </div>}
   </section>
   <section className={styles.secondaryCta} aria-labelledby="healthcare-heading">
    <div>
     <p className={styles.kicker}>HEALTHCARE SERVICE COLLABORATIONS</p>
     <h2 id="healthcare-heading">Are you a healthcare provider?</h2>
     <p>Hospitals, doctors, laboratories and other eligible healthcare providers
      can apply through a dedicated verification process. Service registration
      is different from a corporate CSR commitment.</p>
    </div>
    <Link className={styles.outline} href="/collaboration/healthcare-partner">Apply as a Healthcare Partner</Link>
   </section>
   <section className={styles.finalCta} aria-labelledby="collaborate-heading">
    <p className={styles.kicker}>WORK WITH CAREGANGA</p>
    <h2 id="collaborate-heading">Let&apos;s Collaborate</h2>
    <p>Share your organization's interest and we will help direct the enquiry
     to the relevant Foundation team. An enquiry is not a registered or verified partnership.</p>
    <Link className={styles.primary} href="/contact">Get in Touch</Link>
   </section>
  </main>
 </HealthcarePublicChrome>;
}
