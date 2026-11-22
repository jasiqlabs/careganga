import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {FinanceAccountsWorkspace} from "../../../../features/finance-accounting/finance-accounts-workspace";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../shared/access-denied-view";
export const dynamic="force-dynamic";

export default async function FinancePage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Finance temporarily unavailable" description="Cannot confirm your finance access. Try again when the Foundation service is available." linkLabel="Return to my account" />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access not verified");
  const actor:unknown=await me.json(),privileges:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
    !("roleName" in actor)||typeof actor.displayName!=="string"||
    typeof actor.roleName!=="string"||!privileges||typeof privileges!=="object"||
    !("actions" in privileges)||!Array.isArray(privileges.actions))throw Error("Access not verified");
  const actions=privileges.actions.filter((a:unknown):a is {key:string}=>
    Boolean(a)&&typeof a==="object"&&a!==null&&"key" in a&&
    typeof (a as {key:unknown}).key==="string").map(a=>a.key);
  if(!actions.includes("finance.accounts.view"))
   return <AccessDeniedView reason="Your role does not allow you to view financial accounts. Ask an Administrator if you need access." />;
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(actions)} active="finance" displayName={actor.displayName}
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
    canViewFinance={true} canViewVouchers={actions.includes("finance.vouchers.view")}/>
   <main className="workspace"><FinanceAccountsWorkspace
    canManage={actions.includes("finance.accounts.manage")}
    canPost={actions.includes("finance.journals.post")}
    canReverse={actions.includes("finance.journals.post")&&actions.includes("approvals.review")}
    canViewVouchers={actions.includes("finance.vouchers.view")}
    canManageVouchers={actions.includes("finance.vouchers.manage")}
    canViewEvidence={actions.includes("documents.files.view")}
    canUploadEvidence={actions.includes("documents.files.view")&&actions.includes("documents.files.manage")}
    canVerifyPayment={actions.includes("approvals.review")&&actions.includes("documents.files.view")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Cannot verify finance access" description="The finance page is protected until your current role can be checked." linkLabel="Return to my account" />;
 }
}
