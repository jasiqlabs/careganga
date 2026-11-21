import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {MisDashboardPanel} from "../../../../features/mis-reporting/mis-dashboard-panel";
import {MisReportsWorkspace} from "../../../../features/mis-reporting/mis-reports-workspace";
import {UnavailablePage} from "../../../../shared/unavailable-page";

export const dynamic="force-dynamic";
/** CG-20 U01/C44/C46/C47/C49 — dedicated, accessible, strictly private MIS
 * workspace. Web and Internal Android expose the same source-backed workflows.
 */
export default async function FoundationMisPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Reports temporarily unavailable"
  description="Foundation access cannot be verified. Please try again."
  linkLabel="Return to my account"/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,right]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||right.status===401)redirect("/admin/login");
  if(!me.ok||!right.ok)throw Error("Current access unavailable");
  const actor:unknown=await me.json(),access:unknown=await right.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
     !("roleName" in actor)||typeof actor.displayName!=="string"||
     typeof actor.roleName!=="string"||!access||typeof access!=="object"||
     !("actions" in access)||!Array.isArray(access.actions))
   throw Error("Current role cannot be verified");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>Boolean(v)&&
   typeof v==="object"&&v!==null&&"key" in v&&
   typeof (v as {key:unknown}).key==="string").map(v=>v.key);
  const dashboard=actions.includes("mis.dashboard.view");
  const reports=actions.includes("mis.reports.view");
  if(!dashboard&&!reports)return <UnavailablePage
   title="Reports access restricted"
   description="Your current role cannot view Foundation MIS. Ask an administrator for permission."
   linkLabel="Return to my account"/>;
  return <div className="shell">
   <FoundationAdminNav active="mis" initialActions={actions}
    displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")}
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
    canViewFinanceReports={actions.includes("finance.reports.view")}/>
   <main className="workspace">
    <nav aria-label="Reports breadcrumb" style={{marginBottom:"1rem"}}>
     <Link href="/admin/dashboard">Dashboard</Link> / Reports &amp; MIS
    </nav>
    <header style={{marginBottom:"1.2rem"}}>
     <h1 style={{color:"var(--cg-text)"}}>Foundation Reports &amp; MIS</h1>
     <p style={{color:"var(--cg-muted)"}}>
      Actual Foundation records, authorized report filters, private saved
      definitions and verified document exports.
     </p>
    </header>
    {dashboard&&<MisDashboardPanel/>}
    {reports&&<MisReportsWorkspace/>}
   </main>
  </div>;
 }catch(error){
  if(error&&typeof error==="object"&&"digest" in error&&
    typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
   throw error;
  return <UnavailablePage title="Reports access could not be verified"
   description="Protected reports remain unavailable until current Foundation permissions can be checked."
   linkLabel="Return to my account"/>;
 }
}
