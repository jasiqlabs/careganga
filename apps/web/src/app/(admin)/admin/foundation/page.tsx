import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { FoundationStructurePanel } from "../../../../features/foundation-structure/foundation-structure-panel";
export const dynamic="force-dynamic";

export default async function FoundationStructurePage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Foundation information unavailable</h1>
    <p>Protected records stay hidden until the service is available.</p>
    <Link href="/admin">Return to my account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [actorResult,rightsResult]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(actorResult.status===401||rightsResult.status===401)redirect("/admin/login");
    if(!actorResult.ok||!rightsResult.ok)throw new Error("Unverified Foundation access");
    const actor:unknown=await actorResult.json(),rights:unknown=await rightsResult.json();
    if(!actor||typeof actor!=="object"||!("displayName" in actor)||typeof actor.displayName!=="string"||
      !("roleName" in actor)||typeof actor.roleName!=="string"||
      !rights||typeof rights!=="object"||!("actions" in rights)||!Array.isArray(rights.actions))
      throw new Error("Unverified Foundation access");
    const actions=(rights.actions as unknown[])
      .filter((x):x is {key:string}=>Boolean(x)&&typeof x==="object"&&"key" in x&&typeof x.key==="string")
      .map(x=>x.key);
    const canView=actions.some(key=>["foundation.profile.view","foundation.geography.view","foundation.departments.view"].includes(key));
    if(!canView)return <main className="page main"><h1>Foundation access not permitted</h1>
      <p>You do not have permission to view this Foundation information.</p>
      <Link href="/admin">Return to my account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="foundation" displayName={actor.displayName} roleName={actor.roleName}
        canViewRoles={actions.includes("roles.view")}
        canViewAccounts={actions.includes("accounts.view")}
        canManageSecurityPolicy={actions.includes("identity.security-policy.manage")}
        canViewSettings={actions.includes("platform.settings.view")}
        canViewAudit={actions.includes("platform.audit.view")}
        canViewRecovery={actions.includes("platform.recovery.view")}
        canViewFoundation={canView}/>
      <main className="workspace"><FoundationStructurePanel actions={actions}/></main>
    </div>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
    return <main className="page main"><h1>Foundation access cannot be verified</h1>
      <p>Protected information stays hidden until your role and session are confirmed.</p>
      <Link href="/admin">Return to my account</Link></main>;
  }
}
