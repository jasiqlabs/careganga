import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {ProjectsWorkspace} from "../../../../features/projects/projects-workspace";
export const dynamic="force-dynamic";
export default async function ProjectsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)redirect("/admin/login");
 const endpoint=process.env.BACKEND_URL;
 try{
  if(!endpoint)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([fetch(new URL("/api/identity/me",endpoint),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),fetch(new URL("/api/access/effective",endpoint),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Access unavailable");
  const actions=access.actions.filter((x:unknown):x is {key:string}=>!!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map((x:{key:string})=>x.key);
  if(!actions.includes("projects.view"))return <UnavailablePage title="Projects access unavailable" description="Your current role cannot view projects." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="projects" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/><main className="workspace"><header style={{marginBottom:18}}><h1>Projects Management</h1><p style={{color:"var(--cg-muted)"}}>Manage Foundation projects, activities and operational progress</p></header><ProjectsWorkspace canManage={actions.includes("projects.manage")} canExport={actions.includes("projects.export")}/></main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;return <UnavailablePage title="Projects unavailable" description="We cannot confirm your project access." linkLabel="Return to dashboard"/>;}
}
