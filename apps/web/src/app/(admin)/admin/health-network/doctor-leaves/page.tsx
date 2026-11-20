import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {DoctorLeaveReviewWorkspace}
 from "../../../../../features/appointments/doctor-leave-review-workspace";
export const dynamic="force-dynamic";
export default async function DoctorLeaveAdminPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Review unavailable</h1>
  <p>Current Foundation access could not be verified.</p></main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    cache:"no-store",signal:AbortSignal.timeout(7000),headers}),
   fetch(new URL("/api/access/effective",backend),{
    cache:"no-store",signal:AbortSignal.timeout(7000),headers})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Access unavailable");
  const person:unknown=await me.json();
  const result:unknown=await access.json();
  if(!person||typeof person!=="object"||!("displayName" in person)||
   !("roleName" in person)||typeof person.displayName!=="string"||
   typeof person.roleName!=="string"||!result||typeof result!=="object"||
   !("actions" in result)||!Array.isArray(result.actions))
   throw Error("Invalid current account or access");
  const a=new Set<string>(result.actions.flatMap((item:unknown)=>
   item&&typeof item==="object"&&"key" in item&&typeof item.key==="string"?
     [item.key]:[]));
  const canReview=a.has("approvals.review")&&a.has("health.schedules.view"),
    canManage=a.has("health.schedules.manage");
  if(!canReview&&!canManage)return <AccessDeniedView reason="Your role does not include the current reviewer or schedule management permission." accountHref="/admin/health-network"/>;
  return <HealthcareAdminShell active="healthSchedules" pageLabel="Doctor leave reviews"
   actor={{displayName:person.displayName,roleName:person.roleName}}
   actions={a}>
   <DoctorLeaveReviewWorkspace canReview={canReview} canManage={canManage}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Current permissions unavailable</h1>
   <p>Doctor leave reviews stay protected until permissions can be verified.</p>
  </main>;
 }
}
