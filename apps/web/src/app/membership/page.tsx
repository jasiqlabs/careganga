import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {PublicMembershipPlans} from "../../features/membership/public-membership-plans";
export const dynamic="force-dynamic";
export const metadata={title:"Membership | CareGanga Foundation",description:"Explore current CareGanga Foundation membership plans."};
export default async function Page(){return <HealthcarePublicChrome><main id="main-content" className="cg-site"><PublicMembershipPlans/></main></HealthcarePublicChrome>;}
