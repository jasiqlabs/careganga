import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {RecoveryPanel} from "../../../../features/platform-configuration/recovery-panel";
export const dynamic="force-dynamic";
export default async function ProtectedPlatformPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Unavailable</h1>
    <p>Protected Foundation information cannot be verified.</p>
    <Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [identity,effective,resource]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/platform-configuration-audit/recovery/availability",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(identity.status===401||effective.status===401||resource.status===401)
      redirect("/admin/login");
    if(effective.status===403||resource.status===403)
      return <main className="page main"><h1>Access denied</h1>
        <p>Only authorized Foundation administrators may view Backup & Restore.</p>
        <Link href="/admin">My account</Link></main>;
    if(!identity.ok||!effective.ok||!resource.ok)throw Error("Unverified access");
    const person:unknown=await identity.json(),permissions:unknown=await effective.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||!("roleName" in person)||
      typeof person.roleName!=="string"||!permissions||typeof permissions!=="object"||
      !("actions" in permissions)||!Array.isArray(permissions.actions))
      throw Error("Unverified permissions");
    const keys=(permissions.actions as unknown[]).filter((entry):entry is {key:string}=>
      !!entry&&typeof entry==="object"&&"key" in entry&&
      typeof entry.key==="string").map(entry=>entry.key);
    if(!keys.includes("platform.recovery.view"))return <main className="page main">
      <h1>Access denied</h1><Link href="/admin">My account</Link></main>;
    return <div className="shell">
      <FoundationAdminNav active="recovery" displayName={person.displayName}
        roleName={person.roleName} canViewRoles={keys.includes("roles.view")}
        canViewAccounts={keys.includes("accounts.view")}
        canManageSecurityPolicy={keys.includes("identity.security-policy.manage")}
        canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")&&keys.includes("documents.files.manage")&&(keys.includes("approvals.view")||keys.includes("approvals.propose"))}
        canViewCommunications={keys.includes("communications.notifications.view")||
          keys.includes("communications.notices.manage")||
          keys.includes("communications.delivery.view")}
        canViewSupport={keys.includes("support.cases.view")||keys.includes("support.faq.manage")}/>
      <main className="workspace"><RecoveryPanel/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Backup & Restore unavailable</h1>
      <p>We could not verify your current protected session.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
