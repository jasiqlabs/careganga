import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {FoundationSupportWorkspace} from "../../../../features/support/foundation-support-workspace";
export const dynamic="force-dynamic";
export default async function FoundationSupportPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Helpdesk unavailable</h1>
    <p>Foundation authorization is not available.</p></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,rights]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),
        {headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),
        {headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||rights.status===401)redirect("/admin/login");
    if(!me.ok||!rights.ok)throw Error("Current access unavailable");
    const person:unknown=await me.json(),effective:unknown=await rights.json();
    if(!person||typeof person!=="object"||
      !("displayName" in person)||typeof person.displayName!=="string"||
      !("roleName" in person)||typeof person.roleName!=="string"||
      !effective||typeof effective!=="object"||!("actions" in effective)||
      !Array.isArray(effective.actions))
      throw Error("Current access unavailable");
    const keys=(effective.actions as unknown[]).filter((x):x is {key:string}=>
      !!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string")
      .map(x=>x.key);
    const view=keys.includes("support.cases.view"),
      faq=keys.includes("support.faq.manage");
    if(!view&&!faq)return <main className="page main">
      <h1>Access denied</h1><p>Your role does not permit Foundation support.</p>
      <Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="support" displayName={person.displayName}
        roleName={person.roleName}
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
        canViewCommunications={keys.some(k=>k.startsWith("communications."))}
        canViewSupport/>
      <main className="workspace">
        <FoundationSupportWorkspace mayView={view}
          mayManage={keys.includes("support.cases.manage")}
          mayReply={keys.includes("support.cases.reply")}
          mayEditFaq={faq} mayChooseAccounts={keys.includes("accounts.select")}/>
      </main>
    </div>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&
      typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))
      throw e;
    return <main className="page main"><h1>Helpdesk unavailable</h1>
      <p>Your current access could not be verified.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
