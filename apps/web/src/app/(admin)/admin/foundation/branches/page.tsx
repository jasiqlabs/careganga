import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {OperatingBranchesPanel} from "../../../../../features/foundation-structure/operating-branches-panel";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
export const dynamic="force-dynamic";
export default async function BranchRegistrationPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <UnavailablePage title="Branch registration unavailable" description="Current permissions cannot be verified." />;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,access]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||access.status===401)redirect("/admin/login");
    if(!me.ok||!access.ok)throw Error("Unverified access");
    const person:unknown=await me.json(),permissions:unknown=await access.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||!("roleName" in person)||
      typeof person.roleName!=="string"||!permissions||typeof permissions!=="object"||
      !("actions" in permissions)||!Array.isArray(permissions.actions))
      throw Error("Access response incomplete");
    const keys=(permissions.actions as unknown[]).filter((x):x is {key:string}=>
      !!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map(x=>x.key);
    if(!keys.includes("foundation.branches.view"))
      return <AccessDeniedView reason="Your current role does not permit branch registration." />;
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="branches" displayName={person.displayName}
        roleName={person.roleName}
        canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")}
        canViewFoundation={keys.some(x=>["foundation.profile.view","foundation.geography.view","foundation.departments.view"].includes(x))}
        canViewBranches/>
      <main className="workspace">
        <OperatingBranchesPanel canManage={keys.includes("foundation.branches.manage")}
          canAdmin={keys.includes("foundation.branches.admin")}/>
      </main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
      throw error;
    return <UnavailablePage title="Branch access cannot be verified" description="Private drafts stay unavailable until the session and role are confirmed." />;
  }
}
