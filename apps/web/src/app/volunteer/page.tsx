import {CmsSiteHeader} from "../../features/cms-public-content/cms-site-header";
import {publishedCmsNavigation} from "../../features/cms-public-content/cms-public-source";
import {VolunteerSelfService} from "../../features/volunteers/volunteer-self-service";
export const dynamic="force-dynamic";
export const metadata={title:"Become a Volunteer | CareGanga Foundation",description:"Submit a verified volunteer application to CareGanga Foundation."};
export default async function VolunteerPage(){
 const navigation=await publishedCmsNavigation();
 return <main className="cg-site"><CmsSiteHeader navigation={navigation}/><VolunteerSelfService/></main>;
}
