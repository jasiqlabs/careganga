import {HealthcarePublicChrome} from "../../../../../shared/healthcare-public-chrome";
import Link from "next/link";
import type {Metadata} from "next";
import {PatientAppointmentDetail}
 from "../../../../../features/appointments/patient-appointment-detail";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"My Consultation | CareGanga",robots:{index:false,follow:false}
};
type Props={params:Promise<{bookingRef:string}>};
export default async function PrivateAppointmentPage({params}:Props){
 const {bookingRef}=await params;
 return <HealthcarePublicChrome><main className="cg-public-shell cg-private-appointment-page">
  <header className="cg-public-header">
   <Link href="/patients/me">Back to my private patient profile</Link>
  </header>
  <PatientAppointmentDetail key={bookingRef} bookingRef={bookingRef}/>
 </main></HealthcarePublicChrome>;
}
