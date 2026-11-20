import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {PlatformSettingsPanel} from "../../../../features/platform-configuration/platform-settings-panel";
import {SafeErrorMessagesEditor} from "../../../../features/platform-configuration/safe-error-messages-editor";
import {AccessDeniedView} from "../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../shared/unavailable-page";
export const dynamic="force-dynamic";

export default async function FoundationSettings(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <UnavailablePage title="Platform settings unavailable" description="Protected settings remain hidden until the service can verify access." />;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,rights,settings]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/platform-configuration-audit/settings",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||rights.status===401||settings.status===401)redirect("/admin/login");
    if(rights.status===403||settings.status===403)
      return <AccessDeniedView reason="Foundation platform configuration requires privileged access." />;
    if(!me.ok||!rights.ok||!settings.ok)throw Error("Cannot verify platform settings");
    const actor:unknown=await me.json();
    const access:unknown=await rights.json();
    if(!actor||typeof actor!=="object"||!("displayName" in actor)||
      typeof actor.displayName!=="string"||!("roleName" in actor)||
      typeof actor.roleName!=="string"||!access||typeof access!=="object"||
      !("actions" in access)||!Array.isArray(access.actions))
      throw Error("Access unavailable");
    const keys=(access.actions as unknown[]).filter((x):x is {key:string}=>
      x!==null&&typeof x==="object"&&"key" in x&&typeof (x as {key:unknown}).key==="string").map(x=>x.key);
    if(!keys.includes("platform.settings.view")||
      !keys.includes("platform.integrations.view"))
      return <AccessDeniedView reason="Foundation platform configuration requires privileged access." />;
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="settings" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")||
          (keys.includes("accounts.create")&&keys.includes("roles.assign"))}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")&&keys.includes("documents.files.manage")&&(keys.includes("approvals.view")||keys.includes("approvals.propose"))}
        canViewCommunications={keys.includes("communications.notifications.view")||
          keys.includes("communications.notices.manage")||
          keys.includes("communications.delivery.view")}
        canViewSupport={keys.includes("support.cases.view")||keys.includes("support.faq.manage")}/>
      <main className="workspace"><PlatformSettingsPanel canEdit={keys.includes("platform.settings.manage")}/><SafeErrorMessagesEditor canEdit={keys.includes("platform.settings.manage")}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <UnavailablePage title="Cannot confirm platform settings access" description="Protected configuration is hidden until your session and permissions are verified." />;
  }
}
