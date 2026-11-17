import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {BranchDraftPanel} from "../../../../../features/foundation-structure/branch-draft-panel";
import {OperatingBranchesPanel} from "../../../../../features/foundation-structure/operating-branches-panel";
export const dynamic="force-dynamic";
export default async function BranchRegistrationPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Branch registration unavailable</h1>
    <p>Current permissions cannot be verified.</p><Link href="/admin">My account</Link></main>;
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
      return <main className="page main"><h1>Branch access not permitted</h1>
        <p>Your current role does not permit branch registration.</p>
        <Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav canViewFinance={keys.includes("finance.accounts.view")} active="branches" displayName={person.displayName}
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
      <main className="workspace"><BranchDraftPanel canManage={keys.includes("foundation.branches.manage")}
        canReview={keys.includes("approvals.review")&&keys.includes("foundation.branches.admin")}/>
        <OperatingBranchesPanel canManage={keys.includes("foundation.branches.manage")}
          canAdmin={keys.includes("foundation.branches.admin")}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
      throw error;
    return <main className="page main"><h1>Branch access cannot be verified</h1>
      <p>Private drafts stay unavailable until the session and role are confirmed.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
