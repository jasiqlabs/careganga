import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {VolunteerStaffWorkspace} from "../../../../features/volunteers/volunteer-staff-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Volunteer Applications & Directory | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function VolunteersPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  const base=process.env.BACKEND_URL;if(!base)throw Error("Service unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Permissions unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Permissions unavailable");
  const actions=(access.actions as unknown[]).filter((v):v is {key:string}=>!!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string").map(v=>v.key);
  const canReview=["volunteers.applications.review","approvals.review","documents.files.view"].every(k=>actions.includes(k));
  const canRoster=actions.includes("volunteers.view");
  if(!canReview&&!canRoster)return <UnavailablePage title="Volunteer management unavailable" description="Your current role does not have access to protected volunteer applications or directory." linkLabel="Return to dashboard"/>;
  return <div className="shell">
   <FoundationAdminNav active="volunteers" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")}
    canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace"><VolunteerStaffWorkspace canReview={canReview} canRoster={canRoster}
    canExport={canRoster&&actions.includes("volunteers.export")}
    canConfigure={canReview&&actions.includes("approvals.process.manage")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Volunteer management unavailable" description="Current Foundation staff permissions or volunteer records could not be verified." linkLabel="Return to dashboard"/>;
 }
}
