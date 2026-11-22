import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {FinanceClaimReviewWorkspace} from "../../../../../features/finance-accounting/finance-claim-review-workspace";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
export const dynamic="force-dynamic";

export default async function FinanceClaimReviewsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Claim review unavailable" description="Cannot confirm Foundation review access. Try again when the service is available." linkLabel="Return to my account" />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access not verified");
  const actor:unknown=await me.json(),access:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
   !("roleName" in actor)||typeof actor.displayName!=="string"||
   typeof actor.roleName!=="string"||
   !access||typeof access!=="object"||!("actions" in access)||
   !Array.isArray(access.actions))throw Error("Access not verified");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>
   v!==null&&typeof v==="object"&&"key" in (v as object)&&typeof (v as {key:unknown}).key==="string")
   .map(v=>v.key);
  const ready=["approvals.review","finance.claims.review","documents.files.view"]
   .every(k=>actions.includes(k));
  if(!ready)return <AccessDeniedView reason="Only a separate protected Foundation reviewer may open reimbursement cases." />;
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(actions)} active="financeClaimReviews" displayName={actor.displayName}
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
    canViewClaims={actions.includes("finance.claims.view")||actions.includes("finance.claims.create")}
    canReviewClaims={true}/>
   <main className="workspace"><FinanceClaimReviewWorkspace
    canConfigure={actions.includes("approvals.process.manage")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
    e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Cannot verify reviewer access" description="Protected review screens remain inaccessible until your current role can be confirmed." linkLabel="Return to my account" />;
 }
}
