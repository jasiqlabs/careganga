import {CmsSiteHeader} from "../../../features/cms-public-content/cms-site-header";
import {publishedCmsNavigation} from "../../../features/cms-public-content/cms-public-source";
import {MemberDashboard} from "../../../features/membership/member-dashboard";
export const dynamic="force-dynamic";
export const metadata={title:"Apply or Renew Membership | CareGanga Foundation",description:"Securely apply or renew CareGanga Foundation membership."};
export default async function Page(){const navigation=await publishedCmsNavigation();return <main className="cg-site"><CmsSiteHeader navigation={navigation}/><MemberDashboard/></main>;}
