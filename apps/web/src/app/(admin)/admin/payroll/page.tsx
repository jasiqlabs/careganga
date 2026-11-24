import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {OwnPay} from "../../../../features/payroll/own-pay";
import {PayrollWorkspace} from "../../../../features/payroll/payroll-workspace";
export const dynamic="force-dynamic";
export default async function PayrollPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)redirect("/admin/login");
 try{
  const base=process.env.BACKEND_URL;if(!base)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([fetch(new URL("/api/identity/me",base),{headers,cache:"no-store"}),fetch(new URL("/api/access/effective",base),{headers,cache:"no-store"})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Access unavailable");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>!!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string").map((v:{key:string})=>v.key);
  const admin=actions.includes("payroll.compensation.view");
  return <div className="shell"><FoundationAdminNav active="payroll" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/><main className="workspace">{admin?<PayrollWorkspace canExport={actions.includes("mis.reports.export")} canAudit={actions.includes("platform.audit.view")} canViewRuns={actions.includes("payroll.runs.view")} canManageRuns={actions.includes("payroll.runs.manage")&&actions.includes("payroll.runs.view")} canFinanceBank={actions.includes("finance.accounts.view")} canManageFinanceBank={actions.includes("finance.accounts.manage")&&actions.includes("finance.accounts.view")} canBank={actions.includes("payroll.bank.edit")} canPolicy={actions.includes("payroll.policy.manage")} canEdit={actions.includes("payroll.compensation.edit")} canReview={actions.includes("payroll.sensitive.approve")&&actions.includes("approvals.review")}/>:<OwnPay/>}</main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;return <UnavailablePage title="Payroll unavailable" description="Current access could not be verified." linkLabel="Return to dashboard"/>;}
}
