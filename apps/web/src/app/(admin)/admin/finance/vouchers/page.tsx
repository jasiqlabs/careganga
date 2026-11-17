import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {FinanceVoucherDraftWorkspace} from "../../../../../features/finance-accounting/finance-voucher-draft-workspace";
export const dynamic="force-dynamic";

export default async function VoucherDraftsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Finance vouchers temporarily unavailable</h1>
  <p>Cannot confirm your access to Finance vouchers. Retry when the Foundation service is available.</p>
  <Link href="/admin">Return to my account</Link></main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [actorRes,accessRes]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(actorRes.status===401||accessRes.status===401)redirect("/admin/login");
  if(!actorRes.ok||!accessRes.ok)throw Error("Cannot verify current access");
  const profile:unknown=await actorRes.json(),effective:unknown=await accessRes.json();
  if(!profile||typeof profile!=="object"||!("displayName" in profile)||
    !("roleName" in profile)||typeof profile.displayName!=="string"||
    typeof profile.roleName!=="string"||!effective||typeof effective!=="object"||
    !("actions" in effective)||!Array.isArray(effective.actions))
   throw Error("Access not confirmed");
  const actions=effective.actions.filter((x:unknown):x is {key:string}=>
    Boolean(x)&&typeof x==="object"&&x!==null&&"key" in x&&
    typeof (x as {key:unknown}).key==="string").map(x=>x.key);
  if(!actions.includes("finance.vouchers.view"))
   return <main className="page main"><h1>Voucher access restricted</h1>
    <p>Your current role cannot view Finance voucher drafts. Ask an Administrator for voucher access if needed.</p>
    <Link href="/admin">Return to my account</Link></main>;
  const options=await fetch(new URL("/api/finance-accounting/vouchers/options",backend),{
   headers,cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!options.ok)throw Error("Voucher options unavailable");
  const data:unknown=await options.json();
  if(!data||typeof data!=="object"||!("years" in data)||!("branches" in data)||
    !Array.isArray(data.years)||!Array.isArray(data.branches))
   throw Error("Voucher options could not be verified");
  return <div className="shell">
   <FoundationAdminNav active="financeVouchers" displayName={profile.displayName}
    roleName={profile.roleName} canViewRoles={actions.includes("roles.view")}
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
    canViewVouchers={true}/>
   <main className="workspace">
    <FinanceVoucherDraftWorkspace years={data.years} branches={data.branches}
      canManage={actions.includes("finance.vouchers.manage")}/>
   </main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Cannot verify voucher access</h1>
   <p>Voucher records are protected until your current role and permitted financial years can be checked.</p>
   <Link href="/admin">Return to my account</Link></main>;
 }
}
