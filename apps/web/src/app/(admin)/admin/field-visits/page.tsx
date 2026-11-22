import {OperationsSummaryPanel} from "../../../../features/projects/operations-summary-panel";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {FieldVisitsWorkspace} from "../../../../features/projects/field-visits-workspace";
export const dynamic="force-dynamic";
export default async function FieldVisitsPage(){
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
  if(!actions.includes("projects.visits.view"))return <UnavailablePage title="Field visits access unavailable" description="Your current role cannot view field visits." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="fieldVisits" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/><main className="workspace"><header style={{marginBottom:18}}><h1>Field Visits</h1><p style={{color:"var(--cg-muted)"}}>Manage permitted field visits, check-in, reports and original approvals</p></header>{actions.includes("projects.operations.view")&&<OperationsSummaryPanel canExport={actions.includes("projects.operations.export")}/>}<FieldVisitsWorkspace canManage={actions.includes("projects.visits.manage")} canExport={actions.includes("projects.visits.export")} canReadEvidence={actions.includes("documents.files.view")} canUploadEvidence={actions.includes("documents.files.view")&&actions.includes("documents.files.manage")}/></main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;return <UnavailablePage title="Field visits unavailable" description="We cannot confirm your field visit access." linkLabel="Return to dashboard"/>;}
}
