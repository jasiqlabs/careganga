import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {CommunicationsWorkspace} from "../../../../features/communications/communications-workspace";
export const dynamic="force-dynamic";
export default async function FoundationCommunicationsPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Communications unavailable</h1>
    <p>Current Foundation authorization could not be verified.</p>
    <Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,rights]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||rights.status===401)redirect("/admin/login");
    if(!me.ok||!rights.ok)throw Error("Current access is unavailable");
    const actor:unknown=await me.json(),effective:unknown=await rights.json();
    if(!actor||typeof actor!=="object"||
      !("displayName" in actor)||typeof actor.displayName!=="string"||
      !("roleName" in actor)||typeof actor.roleName!=="string"||
      !effective||typeof effective!=="object"||
      !("actions" in effective)||!Array.isArray(effective.actions))
      throw Error("Current access cannot be verified");
    const keys=(effective.actions as unknown[]).filter((v):v is {key:string}=>
      !!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string")
      .map(v=>v.key);
    const read=keys.includes("communications.notifications.view"),
      manage=keys.includes("communications.notices.manage"),
      approve=keys.includes("communications.notices.approve"),
      process=keys.includes("communications.delivery.process"),
      delivery=keys.includes("communications.delivery.view");
    if(!read&&!manage&&!delivery&&!approve&&!process)
      return <main className="page main"><h1>Access denied</h1>
        <p>Notices are restricted to your current Foundation role.</p>
        <Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="communications"
        displayName={actor.displayName} roleName={actor.roleName}
        canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")||
          (keys.includes("accounts.create")&&keys.includes("roles.assign"))}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")&&
          keys.includes("documents.files.manage")}
        canViewCommunications={read||manage||delivery||approve||process}
        canViewSupport={keys.includes("support.cases.view")||keys.includes("support.faq.manage")}/>
      <main className="workspace">
        <CommunicationsWorkspace mayManage={manage} mayApprove={approve}
          mayProcess={process} mayRead={read} mayViewDelivery={delivery}
          mayChooseAccounts={keys.includes("accounts.select")}
          mayChooseRoles={keys.includes("roles.select")}/>
      </main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
      throw error;
    return <main className="page main"><h1>Communications unavailable</h1>
      <p>Current role access could not be verified.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
