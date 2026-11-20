import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import Link from "next/link";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {HealthReviewInbox} from "../../../../../features/health-network/health-review-inbox";
export const dynamic="force-dynamic";
export default async function HealthcareReviewsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Healthcare reviews unavailable</h1>
  <p>Current access could not be verified.</p><Link href="/admin">My account</Link></main>;
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
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(keys)} active="healthNetwork" displayName={person.displayName}
    roleName={person.roleName}
    canViewSchedules={keys.has("health.schedules.view")} canViewHealthNetwork={keys.has("health.providers.view")}
    canViewRoles={keys.has("roles.view")}
    canViewAccounts={keys.has("accounts.view")}
    canViewFoundation={keys.has("foundation.profile.view")}
    canViewBranches={keys.has("foundation.branches.view")}
    canViewApprovals={keys.has("approvals.view")}
    canViewDocuments={keys.has("documents.files.view")}
    canViewCms={keys.has("cms.content.view")}/>
   <main className="workspace cg-health-admin-workspace"><HealthReviewInbox
      canManageProviders={keys.has("health.providers.manage")}
      canManageDoctors={keys.has("health.doctors.manage")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Review access cannot be verified</h1>
   <p>Private healthcare evidence remains hidden.</p>
   <Link href="/admin">My account</Link></main>;
 }
}
