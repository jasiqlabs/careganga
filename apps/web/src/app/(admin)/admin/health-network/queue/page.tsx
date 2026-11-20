import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {CenterVisitQueue} from "../../../../../features/appointments/center-visit-queue";
export const dynamic="force-dynamic";
export default async function CenterQueuePage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main">
  <h1>Consultation queue unavailable</h1><p>Current permissions cannot be checked.</p>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    cache:"no-store",headers,signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{
    cache:"no-store",headers,signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Current role unavailable");
  const person:unknown=await me.json(),rights:unknown=await access.json();
  if(!person||typeof person!=="object"||
    !("displayName" in person)||typeof person.displayName!=="string"||
    !("roleName" in person)||typeof person.roleName!=="string"||
    !rights||typeof rights!=="object"||!("actions" in rights)||!Array.isArray(rights.actions))
   throw Error("Current role unavailable");
  const allowed=new Set<string>(rights.actions.flatMap((i:unknown)=>
   i&&typeof i==="object"&&"key" in i&&typeof i.key==="string"?[i.key]:[]));
  if(!allowed.has("health.visits.manage"))return <AccessDeniedView reason="Your current role cannot manage visits at a healthcare center." accountHref="/admin"/>;
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(allowed)} active="healthVisitQueue"
    displayName={person.displayName} roleName={person.roleName}
    canViewRoles={allowed.has("roles.view")}
    canViewAccounts={allowed.has("accounts.view")}
    canViewSchedules={allowed.has("health.schedules.view")}
    canViewHealthNetwork={allowed.has("health.providers.view")}
    canViewPatientIntake={allowed.has("health.patients.intake")}
    canViewVisitQueue/>
   <main className="workspace cg-health-admin-workspace"><p><Link href="/admin">Back to my account</Link></p>
    <CenterVisitQueue/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main">
   <h1>Visit queue unavailable</h1>
   <p>Current assigned-center permission could not be confirmed.</p>
   <Link href="/admin">Back to my account</Link></main>;
 }
}
