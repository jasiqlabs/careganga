import type {Metadata} from "next";
import Link from "next/link";
import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import {HealthcarePartnerApplication} from "../../../features/health-network/healthcare-partner-application";

export const metadata:Metadata={
 title:"Healthcare Partner Application | CareGanga",
 description:"Apply for CareGanga Foundation healthcare partner verification.",
 alternates:{canonical:"/collaboration/healthcare-partner"},
 robots:{index:true,follow:true}
};
export default function ApplyHealthcarePartner(){
 return <HealthcarePublicChrome><main className="cg-public-shell cg-health-partner-page">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb"><Link href="/collaboration">Partnerships</Link>
    <span aria-hidden="true"> / </span>Healthcare partner application</nav>
   <p className="cg-eyebrow">CareGanga Foundation · Healthcare Network</p>
   <h1>Become a healthcare partner</h1>
   <p className="cg-lead">Use one application for your organization or professional
    service. The Foundation will review eligibility and contact you.
    Registration does not automatically approve a partner, publish services
    or activate any discount.</p>
  </header>
  <section className="cg-public-section">
   <HealthcarePartnerApplication/>
  </section>
 </main></HealthcarePublicChrome>;
}
