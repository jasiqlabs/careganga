import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {FinanceAccountsWorkspace} from "../../../../features/finance-accounting/finance-accounts-workspace";
export const dynamic="force-dynamic";

export default async function FinancePage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Finance temporarily unavailable</h1>
  <p>Cannot confirm your finance access. Try again when the Foundation service is available.</p>
  <Link href="/admin">Return to my account</Link></main>;
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
   return <main className="page main"><h1>Finance access restricted</h1>
    <p>Your role does not allow you to view financial accounts. Ask an Administrator if you need access.</p>
    <Link href="/admin">Return to my account</Link></main>;
  return <div className="shell">
   <FoundationAdminNav active="finance" displayName={actor.displayName}
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
    canViewFinance={true}/>
   <main className="workspace"><FinanceAccountsWorkspace
    canManage={actions.includes("finance.accounts.manage")}
    canPost={actions.includes("finance.journals.post")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Cannot verify finance access</h1>
   <p>The finance page is protected until your current role can be checked.</p>
   <Link href="/admin">Return to my account</Link></main>;
 }
}
