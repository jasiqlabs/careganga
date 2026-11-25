import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {FoundationPatientBookings}
 from "../../../../../features/appointments/foundation-patient-bookings";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
export const dynamic="force-dynamic";
export default async function ProtectedH15PatientManagement(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Patient management unavailable" description="Current protected Foundation access cannot be checked." linkHref={null} />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Current patient access unverified.");
  const actor:unknown=await me.json(),scope:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||
   !("displayName" in actor)||typeof actor.displayName!=="string"||
   !("roleName" in actor)||typeof actor.roleName!=="string"||
   !scope||typeof scope!=="object"||!("actions" in scope)||!Array.isArray(scope.actions))
   throw Error("Current Foundation access unavailable.");
  const rightsSet=new Set<string>(scope.actions.flatMap((a:unknown)=>
   a&&typeof a==="object"&&"key" in a&&typeof a.key==="string"?[a.key]:[]));
  if(!rightsSet.has("health.patients.admin.view"))
   return <AccessDeniedView reason="Your current Foundation role cannot view protected patient records." accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthPatientAdmin"
    actor={{displayName:actor.displayName,roleName:actor.roleName}}
    actions={rightsSet}>
    <p><Link href="/admin">Back to account</Link></p>
    {rightsSet.has("health.patients.intake")&&
     <section className="form-section cg-health-action-panel" aria-label="Authorized patient registration and new booking">
       <div>
        <h2>Register patient or create a booking</h2>
        <p>Complete a verified center intake or patient-authorized booking.
         The Virtual Patient ID is not a government-issued health identifier.</p>
       </div>
       <Link className="cg-health-link-action"
        href="/admin/health-network/patient-intake">
        Open patient intake
       </Link>
      </section>}
    <FoundationPatientBookings canOverride={rightsSet.has("health.appointments.override")}/>
   
  </HealthcareAdminShell>;
 }catch(error){
  if(error&&typeof error==="object"&&"digest" in error&&
   typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
  return <UnavailablePage title="Patient management unavailable" description="Protected source data is hidden until permissions can be verified." linkLabel="Back to account" />;
 }
}
