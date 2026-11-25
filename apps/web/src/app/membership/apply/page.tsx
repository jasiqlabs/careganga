import Link from "next/link";
import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import {MemberSelfService} from "../../../features/membership/member-self-service";
export const dynamic="force-dynamic";
export const metadata={title:"Apply for Membership | CareGanga Foundation",robots:{index:false,follow:false}};
export default function Page(){return <HealthcarePublicChrome><main id="main-content" className="cg-membership-page"><nav className="cg-account-breadcrumb" aria-label="Breadcrumb"><Link href="/membership">Back to membership plans</Link></nav><MemberSelfService/></main></HealthcarePublicChrome>;}
