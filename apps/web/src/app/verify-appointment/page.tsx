import type {Metadata} from "next";
import Link from "next/link";
import {AppointmentStatusVerifier} from "../../features/appointments/appointment-status-verifier";
export const metadata:Metadata={
 title:"Verify Appointment Status | CareGanga",
 description:"Check only whether a CareGanga consultation slip QR is currently valid.",
 robots:{index:false,follow:false}
};
export default function VerifyAppointment(){
 return <main className="cg-public-shell">
  <header className="cg-public-header">
   <Link href="/">CareGanga</Link>
  </header>
  <section className="cg-public-section">
   <h1>Verify a consultation slip</h1>
   <p>Enter the opaque code printed beneath a CareGanga consultation QR.
    Verification reveals only whether that slip is currently valid. It will
    never reveal patient identity, doctor, center, date, fee or medical records.</p>
   <AppointmentStatusVerifier/>
  </section>
 </main>;
}
