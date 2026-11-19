import type {Metadata} from "next";
import Link from "next/link";
import {PatientProfilePanel} from "../../../features/patients/patient-profile-panel";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"My Patient Profile | CareGanga",
 description:"Manage your private CareGanga virtual patient profile and consent.",
 robots:{index:false,follow:false}
};
export default function MyPatient(){
 return <main className="cg-public-shell">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb"><Link href="/">CareGanga</Link>{" / "}
    <Link href="/health-network">Healthcare Network</Link>{" / "} My patient profile
   </nav>
  </header>
  <PatientProfilePanel/>
 </main>;
}
