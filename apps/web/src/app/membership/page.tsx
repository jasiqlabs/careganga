import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {PublicMembershipPlans} from "../../features/membership/public-membership-plans";
import {publishedPublicIntro} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export const metadata={title:"Membership | CareGanga Foundation",description:"Explore current CareGanga Foundation membership plans."};
export default async function Page(){const intro=await publishedPublicIntro("MEMBERSHIP");return <HealthcarePublicChrome><main id="main-content" className="cg-site"><PublicMembershipPlans intro={intro}/></main></HealthcarePublicChrome>;}
