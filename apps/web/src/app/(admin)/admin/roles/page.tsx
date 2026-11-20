import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { RolesPanel } from "../../../../features/identity-access/roles-panel";
import { AccessDeniedView } from "../../../../shared/access-denied-view";
export const dynamic="force-dynamic";

export default async function AdminRoles(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Access cannot be verified</h1>
    <p>Foundation administration is temporarily unavailable.</p><Link href="/admin">Return to my account</Link></main>;
  try {
    const [profile,access]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      }),
      fetch(new URL("/api/access/effective",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      })
    ]);
    if(profile.status===401||access.status===401)redirect("/admin/login");
    if(profile.status===403||access.status===403)
      return <AccessDeniedView reason="Your current account does not have permission to view roles." />;
    if(!profile.ok||!access.ok)throw new Error("ACCESS_UNAVAILABLE");
    const actor:unknown=await profile.json();
    const effective:unknown=await access.json();
    if(!actor||typeof actor!=="object"||
      !("displayName" in actor)||typeof actor.displayName!=="string"||
      !("roleName" in actor)||typeof actor.roleName!=="string"||
      !effective||typeof effective!=="object"||!("actions" in effective)||
      !Array.isArray(effective.actions))throw new Error("UNVERIFIED");
    const keys=(effective.actions as unknown[]).filter((a):a is {key:string}=>
      a!==null&&typeof a==="object"&&"key" in a&&typeof (a as {key:unknown}).key==="string").map(a=>a.key);
    const allowed=keys.includes("roles.view");
    if(!allowed)
      return <AccessDeniedView reason="Your current account does not have permission to view roles." />;
    const canViewAccounts=keys.includes("accounts.view")||
      (keys.includes("accounts.create")&&keys.includes("roles.assign"));
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="roles" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={allowed} canViewAccounts={canViewAccounts}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={["documents.files.view","documents.files.manage"].every(key=>keys.includes(key))&&
          (keys.includes("approvals.view")||keys.includes("approvals.propose"))}
        canViewCommunications={["communications.notifications.view","communications.notices.manage",
          "communications.delivery.view"].some(k=>keys.includes(k))} canViewSupport={["support.cases.view","support.faq.manage"].some(k=>keys.includes(k))}/>
      <main className="workspace"><RolesPanel/></main>
    </div>;
  }catch(error){
    // Next.js redirects throw a framework control-flow exception. Re-throw it.
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Access cannot be verified</h1>
      <p>Restricted role information stays hidden until your session is confirmed.</p>
      <Link href="/admin">Return to my account</Link></main>;
  }
}
