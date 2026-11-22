import {CmsSiteHeader} from "../../../features/cms-public-content/cms-site-header";
import {publishedCmsNavigation} from "../../../features/cms-public-content/cms-public-source";
import {MemberSelfService} from "../../../features/membership/member-self-service";
export const dynamic="force-dynamic";
export const metadata={title:"Apply for Membership | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function Page(){const navigation=await publishedCmsNavigation();return <main className="cg-site"><CmsSiteHeader navigation={navigation}/><MemberSelfService/></main>;}
