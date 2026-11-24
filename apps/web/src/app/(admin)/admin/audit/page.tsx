import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {PlatformAuditPanel} from "../../../../features/platform-configuration/platform-audit-panel";
import {AccessDeniedView} from "../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../shared/unavailable-page";
export const dynamic="force-dynamic";
export default async function ProtectedPlatformPage({searchParams}:{searchParams:Promise<{category?:string}>}){
  const initialPayroll=(await searchParams).category==="PAYROLL";
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <UnavailablePage title="Unavailable" description="Protected Foundation information cannot be verified." />;
  try{
    const headers={Authorization:"Bearer "+token};
    const [identity,effective,resource]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/platform-configuration-audit/audit?limit=1",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(identity.status===401||effective.status===401||resource.status===401)
      redirect("/admin/login");
    if(effective.status===403||resource.status===403)
      return <AccessDeniedView reason="Only authorized Foundation administrators may view Audit Logs." />;
    if(!identity.ok||!effective.ok||!resource.ok)throw Error("Unverified access");
    const person:unknown=await identity.json(),permissions:unknown=await effective.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||!("roleName" in person)||
      typeof person.roleName!=="string"||!permissions||typeof permissions!=="object"||
      !("actions" in permissions)||!Array.isArray(permissions.actions))
      throw Error("Unverified permissions");
    const keys=(permissions.actions as unknown[]).filter((entry):entry is {key:string}=>
      !!entry&&typeof entry==="object"&&"key" in entry&&
      typeof entry.key==="string").map(entry=>entry.key);
    if(!keys.includes("platform.audit.view"))
      return <AccessDeniedView reason="Only authorized Foundation administrators may view Audit Logs." />;
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="audit" displayName={person.displayName}
        roleName={person.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")||
          (keys.includes("accounts.create")&&keys.includes("roles.assign"))}
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
      <main className="workspace"><PlatformAuditPanel initialPayroll={initialPayroll} canManageSettings={keys.includes("platform.settings.manage")}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <UnavailablePage title="Audit Logs temporarily unavailable" description="We could not connect to Foundation services. Please check your connection or try again shortly." linkHref="/admin" linkLabel="Return to dashboard" mode="service-unavailable" />;
  }
}
