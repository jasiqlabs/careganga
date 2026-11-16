import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { RolesPanel } from "../../../../features/identity-access/roles-panel";
export const dynamic="force-dynamic";

export default async function AdminRoles(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Access cannot be verified</h1>
    <p>Foundation administration is temporarily unavailable.</p><Link href="/admin">Return to my account</Link></main>;
  try {
    const [profile,access]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      }),
      fetch(new URL("/api/access/effective",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      })
    ]);
    if(profile.status===401||access.status===401)redirect("/admin/login");
    if(profile.status===403||access.status===403)return <main className="page main">
      <h1>Access denied</h1><p>Your current account does not have permission to view roles.</p>
      <Link href="/admin">Return to my account</Link></main>;
    if(!profile.ok||!access.ok)throw new Error("ACCESS_UNAVAILABLE");
    const actor:unknown=await profile.json();
    const effective:unknown=await access.json();
    if(!actor||typeof actor!=="object"||
      !("displayName" in actor)||typeof actor.displayName!=="string"||
      !("roleName" in actor)||typeof actor.roleName!=="string"||
      !effective||typeof effective!=="object"||!("actions" in effective)||
      !Array.isArray(effective.actions))throw new Error("UNVERIFIED");
    const allowed=effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"
      &&"key" in a&&a.key==="roles.view");
    if(!allowed)return <main className="page main"><h1>Access denied</h1>
      <p>Your current account does not have permission to view roles.</p>
      <Link href="/admin">Return to my account</Link></main>;
    const canViewAccounts=effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key==="accounts.view");
    return <div className="shell">
      <FoundationAdminNav active="roles" displayName={actor.displayName}
        roleName={actor.roleName} canViewRoles={allowed} canViewAccounts={canViewAccounts}
        canManageSecurityPolicy={effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key==="identity.security-policy.manage")}
        canViewSettings={effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key==="platform.settings.view")}
        canViewAudit={effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key==="platform.audit.view")}
        canViewRecovery={effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key==="platform.recovery.view")}
        canViewApprovals={effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&(a.key==="approvals.view"||a.key==="approvals.propose"))}
        canViewDocuments={["documents.files.view","documents.files.manage"].every(key=>
          effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&a.key===key))&&
          effective.actions.some((a:unknown)=>Boolean(a)&&typeof a==="object"&&"key" in a&&(a.key==="approvals.view"||a.key==="approvals.propose"))}
        canViewCommunications={effective.actions.some((a:unknown)=>
          Boolean(a)&&typeof a==="object"&&"key" in a&&
          ["communications.notifications.view","communications.notices.manage",
            "communications.delivery.view"].includes(String(a.key)))}canViewSupport={effective.actions.some((a:unknown)=>!!a&&typeof a==="object"&&"key" in a&&["support.cases.view","support.faq.manage"].includes(String(a.key)))}/>
      <main className="workspace"><RolesPanel/></main>
    </div>;
  }catch(error){
    // Next.js redirects throw a framework control-flow exception. Re-throw it.
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Access cannot be verified</h1>
      <p>Restricted role information stays hidden until your session is confirmed.</p>
      <Link href="/admin">Return to my account</Link></main>;
  }
}
