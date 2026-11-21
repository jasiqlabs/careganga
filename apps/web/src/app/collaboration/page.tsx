import type {Metadata} from "next";
import Link from "next/link";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";

export const metadata:Metadata={
 title:"Partnerships | CareGanga Foundation",
 description:"Partner with CareGanga Foundation in healthcare or enquire about CSR collaboration.",
 alternates:{canonical:"/collaboration"},robots:{index:true,follow:true}
};
/** Original client Partnerships destination. No unverified partner logos,
 * CSR grants or published healthcare discounts are invented by CMS. */
export default function Partnerships(){
 return <HealthcarePublicChrome><main className="cg-public-shell">
  <header className="cg-public-header">
   <p className="cg-eyebrow">CareGanga Foundation · Partnerships</p>
   <h1>Partner With Us</h1>
   <p className="cg-lead">Work with CareGanga to help eligible people
    access essential services. Applications are reviewed before any
    organization or professional becomes a verified partner.</p>
  </header>
  <section className="cg-public-section" aria-label="Choose partnership type">
   <h2>How would you like to partner?</h2>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:16}}>
    <article style={{border:"1px solid #d7dfdb",borderRadius:16,padding:22}}>
     <h3>Healthcare service partner</h3>
     <p>Hospitals, doctors, diagnostic laboratories, pharmacies, nursing
      providers and qualifying surgery or procedure centers.</p>
     <p>Partner registration and Foundation verification do not require any
      pharmacy, nursing or OT management ERP.</p>
     <Link className="cg-site-action" href="/collaboration/healthcare-partner">
      Apply as a healthcare partner</Link>
    </article>
    <article style={{border:"1px solid #d7dfdb",borderRadius:16,padding:22}}>
     <h3>Corporate / CSR collaboration</h3>
     <p>Explore partnership opportunities with the Foundation.
      Corporate partnership verification and funding proposals are a
      separate approval process.</p>
     <Link className="cg-site-action" href="/contact">
      Enquire about CSR partnership</Link>
     <p style={{fontSize:13}}>An enquiry is not a registered or verified CSR partner.</p>
    </article>
   </div>
  </section>
  <section className="cg-public-section">
   <h2>Already supporting CareGanga?</h2>
   <p>Existing verified healthcare partners can contact the Foundation for
    account access, approved service discounts and settlement information.
    An application alone never makes a discount available.</p>
   <p><Link href="/health-network">Browse currently verified healthcare partners</Link></p>
  </section>
 </main></HealthcarePublicChrome>;
}
