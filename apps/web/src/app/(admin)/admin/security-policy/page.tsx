import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {SecurityPolicyPanel} from "../../../../features/identity-access/security-policy-panel";
import {AccessDeniedView} from "../../../../shared/access-denied-view";
export const dynamic="force-dynamic";
export default async function AdminSecurityPolicy(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Access unavailable</h1>
    <p>Protected policy remains hidden.</p></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [profile,access,policy]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/identity/security-policy",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(profile.status===401||access.status===401||policy.status===401)redirect("/admin/login");
    if(access.status===403||policy.status===403)
      return <AccessDeniedView reason="Security Policy is restricted to the Foundation Super Admin." />;
    if(!profile.ok||!access.ok||!policy.ok)throw Error("Cannot verify protected authority");
    const person:unknown=await profile.json(),effective:unknown=await access.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||!("roleName" in person)||
      typeof person.roleName!=="string"||!effective||typeof effective!=="object"||
      !("actions" in effective)||!Array.isArray(effective.actions))throw Error("Unverified");
    const keys=(effective.actions as unknown[]).filter((x):x is {key:string}=>
      !!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map(x=>x.key);
    if(!keys.includes("identity.security-policy.manage")||
      !keys.includes("identity.security-policy.view"))
      return <AccessDeniedView reason="Security Policy is restricted to the Foundation Super Admin." />;
    return <div className="shell">
      <FoundationAdminNav initialActions={Array.from(keys)} canViewFinance={keys.includes("finance.accounts.view")} canViewVouchers={keys.includes("finance.vouchers.view")} active="policy" displayName={person.displayName} roleName={person.roleName}
        canViewRoles={keys.includes("roles.view")} canViewAccounts={keys.includes("accounts.view")||
          (keys.includes("accounts.create")&&keys.includes("roles.assign"))}
        canManageSecurityPolicy canViewSettings={keys.includes("platform.settings.view")}
        canViewAudit={keys.includes("platform.audit.view")}
        canViewRecovery={keys.includes("platform.recovery.view")}
        canViewApprovals={keys.includes("approvals.view")||keys.includes("approvals.propose")}
        canViewDocuments={keys.includes("documents.files.view")&&keys.includes("documents.files.manage")&&(keys.includes("approvals.view")||keys.includes("approvals.propose"))}
        canViewCommunications={keys.includes("communications.notifications.view")||
          keys.includes("communications.notices.manage")||
          keys.includes("communications.delivery.view")}
        canViewSupport={keys.includes("support.cases.view")||keys.includes("support.faq.manage")}/>
      <main className="workspace"><SecurityPolicyPanel/></main>
    </div>;
  }catch(error){
    if(error&&typeof error==="object"&&"digest" in error&&
      typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))throw error;
    return <main className="page main"><h1>Security policy unavailable</h1>
      <p>We could not verify your current protected session.</p><Link href="/admin">My account</Link></main>;
  }
}
