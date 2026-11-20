import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {CenterPatientIntakeWorkspace}
 from "../../../../../features/patients/center-patient-intake-workspace";
export const dynamic="force-dynamic";

/** A receptionist only needs health.patients.intake, never a CG14 profile
 * editing role. All actual patient writes recheck original CG14 affiliation.
 */
export default async function ReceptionPatientIntake(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main">
  <h1>Patient intake unavailable</h1>
  <p>Current Foundation access cannot be verified.</p>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Cannot verify current staff role.");
  const actor:unknown=await me.json(),effective:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||
   !("displayName" in actor)||typeof actor.displayName!=="string"||
   !("roleName" in actor)||typeof actor.roleName!=="string"||
   !effective||typeof effective!=="object"||
   !("actions" in effective)||!Array.isArray(effective.actions))
   throw Error("Current role cannot be confirmed.");
  const actions=new Set<string>(effective.actions.flatMap((item:unknown)=>
   item&&typeof item==="object"&&"key" in item&&
   typeof item.key==="string"?[item.key]:[]));
  if(!actions.has("health.patients.intake"))return <AccessDeniedView reason="Your current role is not assigned to register patients at a healthcare center." accountHref="/admin"/>return <HealthcareAdminShell active="healthPatientIntake"
    actor={{displayName:actor.displayName,roleName:actor.roleName}}
    actions={actions}>ce">
    <p><Link href="/admin">Back to my account</Link></p>
    <CenterPatientIntakeWorkspace/></HealthcareAdminShell>;iv>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
   typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Patient intake unavailable</h1>
   <p>Current staff permission could not be confirmed. Patient information stays private.</p>
   <Link href="/admin">Back to my account</Link>
  </main>;
 }
}
