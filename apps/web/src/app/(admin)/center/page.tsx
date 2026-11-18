import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {CenterDraftPortal} from "../../../features/health-network/center-draft-portal";
import {SignOutButton} from "../../../features/identity-access/signout-button";
export const dynamic="force-dynamic";

export default async function CenterHome(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Center portal unavailable</h1>
    <p>Current access could not be verified.</p><Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,access]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||access.status===401)redirect("/admin/login");
    if(!me.ok||!access.ok)throw Error("Session unavailable");
    const person:unknown=await me.json(),rights:unknown=await access.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||
      !rights||typeof rights!=="object"||!("actions" in rights)||
      !Array.isArray(rights.actions))throw Error("Invalid access response");
    const allowed=rights.actions.some((x:unknown)=>
      x&&typeof x==="object"&&"key" in x&&
      x.key==="health.centers.draft.edit");
    if(!allowed)return <main className="page main"><h1>Center access restricted</h1>
      <p>Only a currently authorized representative may open their assigned pending center.</p>
      <Link href="/admin">My account</Link></main>;
    return <div className="page main">
      <header className="topbar"><div><h1>CareGanga Center Portal</h1>
        <p>Signed in as {person.displayName}</p></div>
        <div className="toolbar">
          <Link href="/admin/password">Change password</Link>
          <Link href="/admin">My account</Link><SignOutButton/>
        </div>
      </header>
      <CenterDraftPortal/>
    </div>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&
      typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
    return <main className="page main"><h1>Center access cannot be verified</h1>
      <p>Your private center data remains unavailable until the session can be verified.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
