import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {HealthReviewInbox} from "../../../../../features/health-network/health-review-inbox";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
export const dynamic="force-dynamic";
export default async function HealthcareReviewsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Healthcare reviews unavailable" description="Current access could not be verified." />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Session unavailable");
  const person:unknown=await me.json(),rights:unknown=await access.json();
  if(!person||typeof person!=="object"||!("displayName" in person)||
   typeof person.displayName!=="string"||!("roleName" in person)||
   typeof person.roleName!=="string"||
   !rights||typeof rights!=="object"||!("actions" in rights)||
   !Array.isArray(rights.actions))throw Error("Invalid current role");
  const keys=new Set<string>(rights.actions.flatMap((a:unknown)=>
   a&&typeof a==="object"&&"key" in a&&typeof a.key==="string"?[a.key]:[]));
  if(!(keys.has("health.providers.verify")||keys.has("health.doctors.verify"))||!keys.has("approvals.review"))
   return <AccessDeniedView reason="Your current role cannot review healthcare registrations." accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthNetwork" pageLabel="Registration reviews"
    actor={{displayName:person.displayName,roleName:person.roleName}}
    actions={keys}><HealthReviewInbox
      canManageProviders={keys.has("health.providers.manage")}
      canManageDoctors={keys.has("health.doctors.manage")}
       canVerifyProviders={keys.has("health.providers.verify")}
       canVerifyDoctors={keys.has("health.doctors.verify")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Review access cannot be verified" description="Private healthcare evidence remains hidden." />;
 }
}
