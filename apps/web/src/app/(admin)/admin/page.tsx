import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "../../../features/identity-access/signout-button";
export const dynamic="force-dynamic";
export default async function AdminHome() {
  const token=(await cookies()).get("cg_staff_session")?.value;
  if (!token) redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  let current:{displayName:string;roleName:string;scope:string}|null=null;
  let invalidSession=false;
  if (backend) {
    try {
      const response=await fetch(new URL("/api/identity/me",backend),{
        headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(7000)
      });
      if (response.status===401) invalidSession=true;
      if(response.ok) {
        const data:unknown=await response.json();
        if(data&&typeof data==="object"&&"displayName" in data&&"roleName" in data&&"scope" in data
          &&typeof data.displayName==="string"&&typeof data.roleName==="string"&&typeof data.scope==="string")
          current={displayName:data.displayName,roleName:data.roleName,scope:data.scope};
      }
    }catch { /* Offline is not permission to show protected data. */ }
  }
  if (invalidSession) redirect("/admin/login");
  if (!current) return <main className="page main"><h1>Cannot confirm your access</h1><p>Protected information is unavailable until your session can be verified.</p><Link href="/admin/login">Sign in</Link></main>;
  return <div className="shell">
    <nav className="sidebar" aria-label="Foundation navigation"><strong>CareGanga Foundation</strong><p>Foundation administration</p><div className="selected" aria-current="page">My account</div></nav>
    <main className="workspace"><header className="topbar"><div><h1>My account</h1><p>Verified Foundation access</p></div><Link href="/">View site</Link></header>
    <section><h2>Signed in</h2><p>{current.displayName}</p><p>Role: {current.roleName}</p><p>Access: {current.scope}</p><SignOutButton/></section>
    </main>
  </div>;
}
