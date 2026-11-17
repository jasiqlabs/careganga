import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {FinanceReportsWorkspace} from "../../../../../features/finance-accounting/finance-reports-workspace";
export const dynamic="force-dynamic";

/** Original U35-U38 Foundation-only posted finance ledger and reconciliation. */
export default async function FinanceReportsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Reports temporarily unavailable</h1>
  <p>Foundation access cannot be verified. Try again when the service is available.</p>
  <Link href="/admin">Return to my account</Link></main>;
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
  const canCreate=actions.includes("finance.reconciliation.manage");
  const canView=actions.includes("finance.reports.view");
  const canManage=canCreate;
  if(!canView)return <main className="page main">
   <h1>Reports access restricted</h1>
   <p>Your role cannot open Foundation financial statements. Ask an Administrator for access.</p>
   <Link href="/admin">Return to my account</Link></main>;
  return <div className="shell">
   <FoundationAdminNav active="financeReports" displayName={actor.displayName}
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
    canViewClaims={actions.includes("finance.claims.view")}
    canViewFinanceReports={true}/>
   <main className="workspace"><FinanceReportsWorkspace
     canReconcile={actions.includes("finance.reconciliation.manage")&&actions.includes("documents.files.manage")}
     canUploadStatement={actions.includes("finance.reconciliation.manage")&&actions.includes("documents.files.manage")}
     canVerify={actions.includes("finance.reconciliation.review")&&actions.includes("approvals.review")&&actions.includes("documents.files.view")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Cannot verify reports access</h1>
   <p>Financial statements remain inaccessible until the current Foundation role can be verified.</p>
   <Link href="/admin">Return to my account</Link></main>;
 }
}
