import type {Metadata} from "next";
import Link from "next/link";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import styles from "./collaboration.module.css";
import {publishedCmsPage} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";

const fallbackMetadata:Metadata={
 title:"Corporate Partnerships | CareGanga Foundation",
 description:"Partner with CareGanga Foundation. Explore responsible CSR collaborations and verified healthcare service partnerships.",
 alternates:{canonical:"/collaboration"},robots:{index:true,follow:true}
};

export async function generateMetadata():Promise<Metadata>{
 const original=await publishedCmsPage("collaboration");
 return original.state==="PUBLISHED"&&original.page.kind==="PARTNERS"?{
  ...fallbackMetadata,title:original.page.seoTitle,
  description:original.page.seoDescription,
  alternates:{canonical:"/collaboration"}
 }:fallbackMetadata;
}

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
 const approved=result.state==="PUBLISHED"&&result.page.kind==="PARTNERS"?result.page.sections:[];
 const hero=approved.find(s=>s.kind==="HERO")?.fields;
 const final=approved.find(s=>s.kind==="CTA")?.fields;
 const copy=(value:unknown,fallback:string,max=700)=>
  typeof value==="string"&&value.trim().length>0&&value.length<=max?value:fallback;
 const published=result.state==="PUBLISHED"&&result.page.kind==="PARTNERS";
 const narrative=approved.filter(s=>s.kind==="RICH_TEXT").sort((a,b)=>a.order-b.order);
 const heroTitle=copy(hero?.heading,"Corporate Partners",180);
 const heroEyebrow=copy(hero?.eyebrow,"",100);
 const heroSubtitle=copy(hero?.subtitle,"",700);
 const heroIntro=copy(hero?.description,"",400);
 const heroCta=published&&hero?.primaryPath==="/contact"?copy(hero.primaryLabel,"",60):"";
 const finalTitle=copy(final?.heading,"",160);
 const finalEyebrow=copy(final?.eyebrow,"",80);
 const finalBody=copy(final?.body,"",400);
 const finalLabel=final?.path==="/contact"?copy(final.label,"",80):"";
 const partnerHeading=typeof section?.fields.heading==="string"?section.fields.heading:"Meet Our Partners";
 const partnerIntro=typeof section?.fields.intro==="string"&&section.fields.intro.trim()?section.fields.intro:
  "Only organizations with verified Foundation approval and current permission for public attribution appear here.";
 return <HealthcarePublicChrome>
  <main className={styles.shell}>
   <section className={styles.hero} aria-labelledby="corporate-heading">
    <div className={styles.heroInner}>
     <p className={styles.eyebrow}>{heroEyebrow}</p>
     <h1 id="corporate-heading">{heroTitle}</h1>
     <p className={styles.lead}>{heroSubtitle}</p>
     <p className={styles.intro}>{heroIntro}</p>
     <div className={styles.heroActions}>
      {heroCta&&<Link className={styles.primary} href="/contact">{heroCta}</Link>}
      {!published&&<Link className={styles.primary} href="/contact">Partner With Us</Link>}
      <a className={styles.secondary} href="#corporate-partners">Meet Our Partners</a>
     </div>
    </div>
   </section>
   {narrative.map((item,i)=>{
    const f=item.fields,highlights=Array.isArray(f.highlights)?f.highlights.filter((v):v is string=>typeof v==="string").slice(0,4):[];
    return <section key={item.order} className={styles.section} aria-labelledby={"partner-copy-"+i}>
     <div className={styles.sectionHeading}>
      {copy(f.eyebrow,"",100)&&<p className={styles.kicker}>{copy(f.eyebrow,"",100)}</p>}
      <h2 id={"partner-copy-"+i}>{copy(f.heading,"",160)}</h2>
      <p>{copy(f.body,"",4000)}</p>
     </div>
     {highlights.length>0&&<div className={styles.cards}>{highlights.map((v,j)=><article className={styles.card} key={j}><div className={styles.cardMark} aria-hidden="true">{String(j+1).padStart(2,"0")}</div><h3>{v}</h3></article>)}</div>}
    </section>;
   })}
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
   {finalTitle&&<section className={styles.finalCta} aria-labelledby="collaborate-heading">
    <p className={styles.kicker}>{finalEyebrow}</p>
    <h2 id="collaborate-heading">{finalTitle}</h2>
    <p>{finalBody}</p>
    {finalLabel&&<Link className={styles.primary} href="/contact">{finalLabel}</Link>}
   </section>}
  </main>
 </HealthcarePublicChrome>;
}
