import type {Metadata} from "next";
import Link from "next/link";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import styles from "./collaboration.module.css";

export const metadata:Metadata={
 title:"Corporate Partnerships | CareGanga Foundation",
 description:"Partner with CareGanga Foundation. Explore responsible CSR collaborations and verified healthcare service partnerships.",
 alternates:{canonical:"/collaboration"},robots:{index:true,follow:true}
};

/** Original CareGanga corporate-partner destination.
 * CG08 company approval alone never permits public attribution.
 * A future original CG18 editorial + CG19 rights projection will fill the
 * partner directory only after a real approved subject, logo and consent.
 * Until then the empty state is intentional, not a fake endorsement. */
export default function Partnerships(){
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
     <h2 id="partners-heading">Meet Our Partners</h2>
     <p>Only organizations with both verified Foundation approval and current
      permission for public attribution may be shown here.</p>
    </div>
    <div className={styles.emptyPartners} role="status">
     <h3>Partner announcements will appear here</h3>
     <p>We are not displaying unverified corporate names or logos.
      Please contact the Foundation for current collaboration information.</p>
    </div>
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
