import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { AccountsPanel } from "../../../../features/identity-access/accounts-panel";
import { AccessDeniedView } from "../../../../shared/access-denied-view";
import { AccessVerificationView } from "../../../../shared/access-verification-view";
export const dynamic="force-dynamic";
export default async function FoundationAccounts(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <AccessVerificationView mode="unverified-access" title="Access unavailable" description="Staff information remains hidden until the service can verify your access." />;
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
      x!==null&&typeof x==="object"&&"key" in x&&typeof (x as {key:unknown}).key==="string").map(x=>x.key);
    const canViewAccounts=keys.includes("accounts.view");
    const canCreateOnly=!canViewAccounts&&keys.includes("accounts.create")&&keys.includes("roles.assign");
    if(!canViewAccounts&&!canCreateOnly)
      return <AccessDeniedView reason="You cannot view staff accounts." />;
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="accounts" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={canViewAccounts||canCreateOnly}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")&&keys.includes("documents.files.manage")&&(keys.includes("approvals.view")||keys.includes("approvals.propose"))}
        canViewCommunications={keys.includes("communications.notifications.view")||
          keys.includes("communications.notices.manage")||
          keys.includes("communications.delivery.view")}
        canViewSupport={keys.includes("support.cases.view")||keys.includes("support.faq.manage")}/>
      <main className="workspace"><AccountsPanel createOnly={canCreateOnly}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <AccessVerificationView mode="unverified-access" />;
  }
}
