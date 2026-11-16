import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {PrivateCaseEvidencePanel} from "../../../../features/documents/private-case-evidence-panel";
export const dynamic="force-dynamic";
export default async function PrivateDocumentsPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Private documents unavailable</h1>
    <p>Your current Foundation permissions could not be verified.</p>
    <Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,access,eligibility]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/registration-approvals/cases?limit=1",backend),
        {headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if([me,access,eligibility].some(x=>x.status===401))redirect("/admin/login");
    if([me,access,eligibility].some(x=>x.status===403))
      return <main className="page main"><h1>Access denied</h1>
        <p>Private files require current case and document permission.</p>
        <Link href="/admin">My account</Link></main>;
    if(!me.ok||!access.ok||!eligibility.ok)
      throw Error("Protected access could not be verified");
    const person:unknown=await me.json(),permissions:unknown=await access.json();
    if(!person||typeof person!=="object"||
      !("displayName" in person)||typeof person.displayName!=="string"||
      !("roleName" in person)||typeof person.roleName!=="string"||
      !permissions||typeof permissions!=="object"||
      !("actions" in permissions)||!Array.isArray(permissions.actions))
      throw Error("Access response missing");
    const keys=(permissions.actions as unknown[]).filter((x):x is {key:string}=>
      !!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string")
      .map(x=>x.key);
    if(!keys.includes("documents.files.view")||
      !keys.includes("documents.files.manage")||
      (!keys.includes("approvals.view")&&!keys.includes("approvals.propose")))
      return <main className="page main"><h1>Access denied</h1>
        <p>Private documents are available only to authorized case operators.</p>
        <Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="documents" displayName={person.displayName}
        roleName={person.roleName}
        canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocumentscanViewCommunications={keys.includes("communications.notifications.view")||
          keys.includes("communications.notices.manage")||
          keys.includes("communications.delivery.view")}
        />
      <main className="workspace"><PrivateCaseEvidencePanel
        canIssue={keys.includes("documents.letters.issue")}
        canRevoke={keys.includes("documents.letters.revoke")}/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
      throw error;
    return <main className="page main"><h1>Private documents unavailable</h1>
      <p>The protected session could not be verified.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
