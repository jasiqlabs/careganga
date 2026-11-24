import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {VolunteerSelfService} from "../../features/volunteers/volunteer-self-service";
import {publishedPublicIntro} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export const metadata={title:"Become a Volunteer | CareGanga Foundation",description:"Submit a verified volunteer application to CareGanga Foundation."};
export default async function VolunteerPage(){
 const intro=await publishedPublicIntro("VOLUNTEER");
 
 return <HealthcarePublicChrome><main id="main-content" className="cg-site"><VolunteerSelfService intro={intro}/></main></HealthcarePublicChrome>;
}
