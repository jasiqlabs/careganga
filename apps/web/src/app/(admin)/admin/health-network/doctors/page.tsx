import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {DoctorOnboarding} from "../../../../../features/health-network/doctor-onboarding";
export const dynamic="force-dynamic";

export default async function HealthcareDoctorsPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main"><h1>Doctor registrations unavailable</h1>
    <p>Current access could not be verified.</p><Link href="/admin">My account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,effective]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||effective.status===401)redirect("/admin/login");
    if(!me.ok||!effective.ok)throw new Error("Access not confirmed");
    const person:unknown=await me.json(),rights:unknown=await effective.json();
    if(!person||typeof person!=="object"||
      !("displayName" in person)||typeof person.displayName!=="string"||
      !("roleName" in person)||typeof person.roleName!=="string"||
      !rights||typeof rights!=="object"||!("actions" in rights)||
      !Array.isArray(rights.actions))
      throw new Error("Permissions not confirmed");
    const keys=new Set<string>(rights.actions.flatMap((x:unknown)=>
      x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?[x.key]:[]));
    if(!keys.has("health.doctors.view"))
      return <AccessDeniedView reason="Your current role cannot access protected professional registrations." accountHref="/admin"/>;
return <HealthcareAdminShell active="healthDoctors"
    actor={{displayName:person.displayName,roleName:person.roleName}}
    actions={keys}>ce">
        <DoctorOnboarding canManage={keys.has("health.doctors.manage")}
          canVerify={keys.has("health.doctors.verify")}/>
  </HealthcareAdminShell>;iv>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&
      typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
    return <main className="page main"><h1>Doctor registration access cannot be verified</h1>
      <p>Protected professional records remain hidden until current access is confirmed.</p>
      <Link href="/admin">My account</Link></main>;
  }
}
