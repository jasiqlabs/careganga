import {CmsSiteHeader} from "../../features/cms-public-content/cms-site-header";
import {publishedCmsNavigation} from "../../features/cms-public-content/cms-public-source";
import {PublicMembershipPlans} from "../../features/membership/public-membership-plans";
export const dynamic="force-dynamic";
export const metadata={title:"Membership | CareGanga Foundation",description:"Explore current CareGanga Foundation membership plans."};
export default async function Page(){const navigation=await publishedCmsNavigation();return <main className="cg-site"><CmsSiteHeader navigation={navigation}/><PublicMembershipPlans/></main>;}
