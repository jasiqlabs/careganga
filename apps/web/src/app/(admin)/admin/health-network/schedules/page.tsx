import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {DoctorScheduleWorkspace}
 from "../../../../../features/appointments/doctor-schedule-workspace";
export const dynamic="force-dynamic";

export default async function DoctorScheduleAdminPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main">
  <h1>Doctor schedules unavailable</h1>
  <p>Foundation permissions could not be confirmed.</p>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    cache:"no-store",signal:AbortSignal.timeout(7000),headers}),
   fetch(new URL("/api/access/effective",backend),{
    cache:"no-store",signal:AbortSignal.timeout(7000),headers})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Unable to verify current access");
  const person:unknown=await me.json();
  const response:unknown=await access.json();
  if(!person||typeof person!=="object"||!("displayName" in person)||
    !("roleName" in person)||typeof person.displayName!=="string"||
    typeof person.roleName!=="string"||
    !response||typeof response!=="object"||!("actions" in response)||
    !Array.isArray(response.actions))throw Error("Invalid current account or access");
  const allowed=new Set<string>(response.actions.flatMap((item:unknown)=>
   item&&typeof item==="object"&&"key" in item&&
    typeof item.key==="string"?[item.key]:[]));
  if(!allowed.has("health.schedules.view"))
   return <main className="page main"><h1>Schedules restricted</h1>
    <p>Your current Foundation role cannot view private doctor schedules.</p>
    <Link href="/admin/health-network">Back to healthcare management</Link>
   </main>;
  return <HealthcareAdminShell active="healthSchedules"
   actor={{displayName:person.displayName,roleName:person.roleName}}
   actions={allowed}>
    <DoctorScheduleWorkspace channel="foundation"
     canManage={allowed.has("health.schedules.manage")}/>
   </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Schedules unavailable</h1>
   <p>Your current permission could not be confirmed. Try again shortly.</p>
   <Link href="/admin/health-network">Back to healthcare management</Link>
  </main>;
 }
}
