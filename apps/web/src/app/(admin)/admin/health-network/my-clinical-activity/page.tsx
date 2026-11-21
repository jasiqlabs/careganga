import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {MyClinicianActivity} from "../../../../../features/appointments/my-clinician-activity";
export const dynamic="force-dynamic";
/** Original CG01 role + CG14 clinician identity are required; this page
 * never reads another doctor's queue or a Foundation financial ledger.
 */
export default async function MyClinicalActivityPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Doctor dashboard unavailable"
  description="Your clinical access cannot currently be checked."/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    cache:"no-store",headers,signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{
    cache:"no-store",headers,signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Current clinician role unavailable");
  const person:unknown=await me.json(),rights:unknown=await access.json();
  if(!person||typeof person!=="object"||
   !("displayName" in person)||typeof person.displayName!=="string"||
   !("roleName" in person)||typeof person.roleName!=="string"||
   !rights||typeof rights!=="object"||
   !("actions" in rights)||!Array.isArray(rights.actions))
   throw Error("Current clinical role is invalid");
  const allowed=new Set<string>(rights.actions.flatMap((x:unknown)=>
   x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?[x.key]:[]));
  if(!allowed.has("health.visits.clinical.manage"))
   return <AccessDeniedView reason="This account is not authorized for clinician activity."
    accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthClinicianActivity"
    actor={{displayName:person.displayName,roleName:person.roleName}}
    actions={allowed}><MyClinicianActivity/></HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Doctor dashboard unavailable"
   description="Your original clinical identity and assignment could not be verified."/>;
 }
}
