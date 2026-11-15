import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { AccountsPanel } from "../../../../features/identity-access/accounts-panel";
export const dynamic="force-dynamic";
export default async function FoundationAccounts(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Access unavailable</h1>
    <p>Staff information remains hidden until the service can verify your access.</p>
    <Link href="/admin">Return to my account</Link></main>;
  try{
    const [me,rights]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      }),
      fetch(new URL("/api/access/effective",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      })
    ]);
    if(me.status===401||rights.status===401)redirect("/admin/login");
    if(!me.ok||!rights.ok)throw new Error("ACCESS_UNAVAILABLE");
    const actor:unknown=await me.json();
    const effective:unknown=await rights.json();
    if(!actor||typeof actor!=="object"||
      !("displayName" in actor)||typeof actor.displayName!=="string"||
      !("roleName" in actor)||typeof actor.roleName!=="string"||
      !effective||typeof effective!=="object"||!("actions" in effective)||
      !Array.isArray(effective.actions))throw new Error("ACCESS_UNAVAILABLE");
    const keys=(effective.actions as unknown[]).filter((x):x is {key:string}=>
      Boolean(x)&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map(x=>x.key);
    const canViewAccounts=keys.includes("accounts.view");
    const canInviteOnly=!canViewAccounts&&keys.includes("accounts.invite")&&keys.includes("roles.assign");
    if(!canViewAccounts&&!canInviteOnly)return <main className="page main">
      <h1>Access denied</h1><p>You cannot view staff accounts.</p>
      <Link href="/admin">Return to my account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="accounts" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={canViewAccounts||canInviteOnly}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}/>
      <main className="workspace"><AccountsPanel inviteOnly={canInviteOnly}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Access cannot be verified</h1>
      <p>Staff information is hidden until your current permissions are confirmed.</p>
      <Link href="/admin">Return to my account</Link></main>;
  }
}
