import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {VolunteerSelfService} from "../../features/volunteers/volunteer-self-service";
export const dynamic="force-dynamic";
export const metadata={title:"Become a Volunteer | CareGanga Foundation",description:"Submit a verified volunteer application to CareGanga Foundation."};
export default async function VolunteerPage(){
 
 return <HealthcarePublicChrome><main id="main-content" className="cg-site"><VolunteerSelfService/></main></HealthcarePublicChrome>;
}
