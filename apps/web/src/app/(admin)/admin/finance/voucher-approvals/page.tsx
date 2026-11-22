import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {FinanceVoucherReviewerWorkspace} from "../../../../../features/finance-accounting/finance-voucher-reviewer-workspace";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
export const dynamic="force-dynamic";
export default async function VoucherApprovalsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Finance reviews unavailable" description="The Foundation reviewer authority cannot be verified at present." linkLabel="Return to my account" />;
 try{
  const headers={Authorization:"Bearer "+token};
  const [actorResult,rolesResult]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(actorResult.status===401||rolesResult.status===401)redirect("/admin/login");
  if(!actorResult.ok||!rolesResult.ok)throw Error("Access unavailable");
  const actor:unknown=await actorResult.json(),info:unknown=await rolesResult.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||!("roleName" in actor)||
    typeof actor.displayName!=="string"||typeof actor.roleName!=="string"||
    !info||typeof info!=="object"||!("actions" in info)||!Array.isArray(info.actions))
   throw Error("Access not verified");
  const rights=info.actions.filter((v:unknown):v is {key:string}=>
    v!==null&&typeof v==="object"&&"key" in v&&typeof (v as {key:unknown}).key==="string")
    .map(v=>v.key);
  if(!rights.includes("approvals.review")||!rights.includes("finance.vouchers.view")||
     !rights.includes("documents.files.view"))
   return <AccessDeniedView reason="Your current role cannot review Finance vouchers." />;
  return <div className="shell">
   <FoundationAdminNav initialActions={Array.from(rights)} active="financeReviews" displayName={actor.displayName}
    roleName={actor.roleName}
    canViewRoles={rights.includes("roles.view")}
    canViewAccounts={rights.includes("accounts.view")}
    canManageSecurityPolicy={rights.includes("identity.security-policy.manage")}
    canViewSettings={rights.includes("platform.settings.view")}
    canViewAudit={rights.includes("platform.audit.view")}
    canViewRecovery={rights.includes("platform.recovery.view")}
    canViewApprovals={rights.includes("approvals.view")||rights.includes("approvals.propose")}
    canViewDocuments={rights.includes("documents.files.view")&&rights.includes("documents.files.manage")}
    canViewCommunications={rights.includes("communications.notifications.view")}
    canViewSupport={rights.includes("support.cases.view")}
    canViewFoundation={rights.includes("foundation.profile.view")}
    canViewBranches={rights.includes("foundation.branches.view")}
    canViewFinance={rights.includes("finance.accounts.view")}
    canViewVouchers={rights.includes("finance.vouchers.view")}
    canReviewFinance={true}/>
   <main className="workspace">
    <FinanceVoucherReviewerWorkspace canInitialize={rights.includes("approvals.process.manage")&&
      rights.includes("finance.vouchers.manage")}/>
   </main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Cannot verify Finance reviewer access" description="Protected reviewer cases remain unavailable until your current role can be verified." linkLabel="Return to my account" />;
 }
}
