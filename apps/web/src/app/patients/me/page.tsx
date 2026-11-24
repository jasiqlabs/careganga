import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import type {Metadata} from "next";
import Link from "next/link";
import {PatientProfilePanel} from "../../../features/patients/patient-profile-panel";
import {MyLabReports} from "../../../features/diagnostics/my-lab-reports";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"My Patient Profile | CareGanga",
 description:"Manage your private CareGanga virtual patient profile and consent.",
 robots:{index:false,follow:false}
};
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
function safeReturn(raw:unknown):string|null{
 if(typeof raw!=="string"||raw.length>1400||!raw.startsWith("/health-network/doctors/")||/[\\\u0000-\u001f\u007f]/.test(raw))return null;
 try{const u=new URL(raw,"https://careganga.invalid");if(u.origin!=="https://careganga.invalid"||!/^\/health-network\/doctors\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/schedule$/i.test(u.pathname))return null;
  const allowed=new Set(["date","mode","centerRef","time","center","slot","choice","reschedule","version"]);for(const key of u.searchParams.keys())if(!allowed.has(key)||u.searchParams.getAll(key).length!==1)return null;
  return u.pathname+u.search+(u.hash==="#booking-summary"?u.hash:"");}catch{return null;}
}
export default async function MyPatient({searchParams}:Props){
 const query=await searchParams,returnTo=safeReturn(query.returnTo);
 return <HealthcarePublicChrome><main className="cg-public-shell">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb"><Link href="/">CareGanga</Link>{" / "}
    <Link href="/health-network">Healthcare Network</Link>{" / "} My patient profile
   </nav>
  </header>
  {returnTo&&<section className="cg-public-section"><h2>Continue your appointment</h2><p>Register or sign in, complete any required patient verification and consent, then return to your selected time. Availability and fee are rechecked.</p><Link className="cg-health-link-action primary" href={returnTo}>Return to selected appointment</Link></section>}
  <PatientProfilePanel/>
  <MyLabReports/>
 </main></HealthcarePublicChrome>;
}
