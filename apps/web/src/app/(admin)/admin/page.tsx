import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "../../../features/identity-access/signout-button";
import { AdminProfileWorkspace } from "../../../features/identity-access/admin-profile-workspace";
import { FoundationAdminNav } from "../../../shared/foundation-admin-nav";
import { AuthWelcomeListener } from "../../../shared/auth-notification";
import { ClinicianAccountAcceptance } from "../../../features/health-network/clinician-account-link";
export const dynamic="force-dynamic";
export default async function AdminHome() {
  const token=(await cookies()).get("cg_staff_session")?.value;
  if (!token) redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  let current:{displayName:string;roleName:string;scope:string}|null=null;
  let invalidSession=false;
  let canViewRoles=false;
  let canViewAccounts=false;
  let canManageSecurityPolicy=false;
  let canViewSettings=false;
  let canViewAudit=false;
  let canViewRecovery=false;
  let canViewApprovals=false;
  let canViewDocuments=false;
  let canViewCommunications=false;
  let canViewSupport=false;
  let canViewFinance=false;
  let canViewVouchers=false;
  let canViewHealthcare=false;
  let canEditOwnCenter=false;
  let canIntakePatients=false;
  let canManageVisits=false;
  if (backend) {
    try {
      const response=await fetch(new URL("/api/identity/me",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      });
      if (response.status===401) invalidSession=true;
      if(response.ok) {
        const permissions=await fetch(new URL("/api/access/effective",backend),{
          headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
        });
        if(permissions.status===401) invalidSession=true;
        if(permissions.ok){
          const effective=await permissions.json() as {actions?:{key?:string}[]};
          canViewRoles=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="roles.view");
          canViewHealthcare=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="health.providers.view");
          canEditOwnCenter=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="health.centers.draft.edit");
          canIntakePatients=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="health.patients.intake");
          canManageVisits=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="health.visits.manage");
          canViewFinance=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="finance.accounts.view");
          canViewVouchers=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="finance.vouchers.view");
          canViewAccounts=Array.isArray(effective.actions)&&
            (effective.actions.some(x=>x.key==="accounts.view")||
              (effective.actions.some(x=>x.key==="accounts.create")&&
                effective.actions.some(x=>x.key==="roles.assign")));
          canManageSecurityPolicy=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="identity.security-policy.manage");
          canViewSettings=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="platform.settings.view");
          canViewAudit=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="platform.audit.view");
          canViewRecovery=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="platform.recovery.view");
          canViewApprovals=Array.isArray(effective.actions)&&effective.actions.some(x=>x.key==="approvals.view"||x.key==="approvals.propose");
          canViewDocuments=Array.isArray(effective.actions)&&
            ["documents.files.view","documents.files.manage"].every(key=>
              effective.actions!.some(x=>x.key===key))&&canViewApprovals;
          canViewSupport=Array.isArray(effective.actions)&&effective.actions.some(x=>
            x.key==="support.cases.view"||x.key==="support.faq.manage");
          canViewCommunications=Array.isArray(effective.actions)&&
            effective.actions.some(x=>[
              "communications.notifications.view","communications.notices.manage",
              "communications.delivery.view"
            ].includes(x.key??""));
        }
        const data:unknown=await response.json();
        if(data&&typeof data==="object"&&"displayName" in data&&"roleName" in data&&"scope" in data
          &&typeof data.displayName==="string"&&typeof data.roleName==="string"&&typeof data.scope==="string")
          current={displayName:data.displayName,roleName:data.roleName,scope:data.scope};
      }
    }catch { /* Offline is not permission to show protected data. */ }
  }
  if (invalidSession) redirect("/admin/login");
  if (!current) return <main className="page main"><h1>Cannot confirm your access</h1><p>Protected information is unavailable until your session can be verified.</p><Link href="/admin/login">Sign in</Link></main>;
  return <div className="shell">
    <AuthWelcomeListener displayName={current.displayName} roleName={current.roleName} />
    <FoundationAdminNav active="account" displayName={current.displayName} roleName={current.roleName} canViewRoles={canViewRoles} canViewAccounts={canViewAccounts} canManageSecurityPolicy={canManageSecurityPolicy}
      canViewSettings={canViewSettings} canViewAudit={canViewAudit}
      canViewRecovery={canViewRecovery} canViewApprovals={canViewApprovals}
      canViewDocuments={canViewDocuments} canViewCommunications={canViewCommunications} canViewSupport={canViewSupport} canViewFinance={canViewFinance} canViewVouchers={canViewVouchers}
      canViewHealthNetwork={canViewHealthcare} canViewPatientIntake={canIntakePatients}
      canViewVisitQueue={canManageVisits}/>
    <main className="workspace">
      <AdminProfileWorkspace
        displayName={current.displayName}
        roleName={current.roleName}
        scope={current.scope}
        canViewSettings={canViewSettings}
      />
      {canViewHealthcare&&<p><Link href="/admin/health-network">Healthcare provider registrations</Link></p>}
      {canEditOwnCenter&&<p><Link href="/center">My healthcare center</Link></p>}
      {canIntakePatients&&<p><Link href="/admin/health-network/patient-intake">Register a provisional patient</Link></p>}
      {canManageVisits&&<p><Link href="/admin/health-network/queue">My consultation queue</Link></p>}
      <ClinicianAccountAcceptance/>
    </main>
  </div>;
}
