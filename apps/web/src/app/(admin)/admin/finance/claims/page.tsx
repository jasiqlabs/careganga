import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {FinanceExpenseClaimWorkspace} from "../../../../../features/finance-accounting/finance-expense-claim-workspace";
import {FinanceClaimManagementWorkspace} from "../../../../../features/finance-accounting/finance-claim-management-workspace";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
export const dynamic="force-dynamic";

/** Dedicated U41 expense intake for existing CG-01 Foundation users.
 * No employee/volunteer future-module selector is required. */
export default async function FinanceExpenseClaimsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Expense claims temporarily unavailable" description="Foundation access cannot be verified. Try again when the service is available." linkLabel="Return to my account" />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,right]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||right.status===401)redirect("/admin/login");
  if(!me.ok||!right.ok)throw Error("Current role unavailable");
  const actor:unknown=await me.json(),access:unknown=await right.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
     !("roleName" in actor)||typeof actor.displayName!=="string"||
     typeof actor.roleName!=="string"||!access||typeof access!=="object"||
     !("actions" in access)||!Array.isArray(access.actions))
    throw Error("Current role could not be verified");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>Boolean(v)&&
    typeof v==="object"&&v!==null&&"key" in v&&
    typeof (v as {key:unknown}).key==="string").map(v=>v.key);
  const canCreate=actions.includes("finance.claims.create");
  const canView=actions.includes("finance.claims.view");
  const canManage=actions.includes("finance.claims.manage");
  if(!canCreate&&!canView&&!canManage)return <AccessDeniedView reason="Your role cannot create or view Foundation expense claims. Ask an Administrator for access." />;
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(actions)} active="financeClaims" displayName={actor.displayName}
    roleName={actor.roleName} canViewRoles={actions.includes("roles.view")}
    canViewAccounts={actions.includes("accounts.view")}
    canManageSecurityPolicy={actions.includes("identity.security-policy.manage")}
    canViewSettings={actions.includes("platform.settings.view")}
    canViewAudit={actions.includes("platform.audit.view")}
    canViewRecovery={actions.includes("platform.recovery.view")}
    canViewApprovals={actions.includes("approvals.view")||actions.includes("approvals.propose")}
    canViewDocuments={actions.includes("documents.files.view")&&actions.includes("documents.files.manage")}
    canViewCommunications={actions.includes("communications.notifications.view")}
    canViewSupport={actions.includes("support.cases.view")}
    canViewFoundation={actions.includes("foundation.profile.view")}
    canViewBranches={actions.includes("foundation.branches.view")}
    canViewFinance={actions.includes("finance.accounts.view")}
    canViewVouchers={actions.includes("finance.vouchers.view")}
    canViewClaims={true}/>
   <main className="workspace">
    {(canCreate||canView)&&<FinanceExpenseClaimWorkspace canCreate={canCreate} canView={canView}/>}
    {canManage&&<FinanceClaimManagementWorkspace/>}
   </main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Cannot verify expense claim access" description="The claim page remains protected until the current Foundation role can be checked." linkLabel="Return to my account" />;
 }
}
