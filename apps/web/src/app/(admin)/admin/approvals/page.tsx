import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {ProposalWorkspace} from "../../../../features/registration-approvals/proposal-workspace";
export const dynamic="force-dynamic";

export default async function ApprovalsPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Approvals unavailable</h1>
    <p>Foundation access cannot be verified.</p><Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,effective,list]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/registration-approvals/cases?limit=1",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if([me,effective,list].some(x=>x.status===401))redirect("/admin/login");
    if([me,effective,list].some(x=>x.status===403))
      return <main className="page main"><h1>Access denied</h1>
        <p>Protected approval records require permission.</p>
        <Link href="/admin">My account</Link></main>;
    if(!me.ok||!effective.ok||!list.ok)throw Error("Cannot verify access");
    const actor:unknown=await me.json(),rights:unknown=await effective.json();
    if(!actor||typeof actor!=="object"||!("displayName" in actor)||
      typeof actor.displayName!=="string"||!("roleName" in actor)||
      typeof actor.roleName!=="string"||!rights||typeof rights!=="object"||
      !("actions" in rights)||!Array.isArray(rights.actions))
      throw Error("No verified permission evidence");
    const keys=(rights.actions as unknown[]).filter((x):x is {key:string}=>
      !!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map(x=>x.key);
    if(!keys.includes("approvals.view"))
      return <main className="page main"><h1>Access denied</h1>
        <Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="approvals" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals/>
      <main className="workspace"><ProposalWorkspace
        mayConfigure={keys.includes("approvals.process.manage")}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Cannot verify approvals</h1>
      <p>Protected approval data remains hidden until your session is verified.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
