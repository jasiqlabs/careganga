import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
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
  const response=await fetch(new URL("/api/access/effective",backend),{
   cache:"no-store",signal:AbortSignal.timeout(7000),
   headers:{Authorization:"Bearer "+token}});
  if(response.status===401)redirect("/admin/login");
  if(!response.ok)throw Error("Access unavailable");
  const result:unknown=await response.json();
  if(!result||typeof result!=="object"||!("actions" in result)||
    !Array.isArray(result.actions))throw Error("Invalid current access");
  const a=new Set<string>(result.actions.flatMap((item:unknown)=>
   item&&typeof item==="object"&&"key" in item&&typeof item.key==="string"?
     [item.key]:[]));
  const canReview=a.has("approvals.review")&&a.has("health.schedules.view"),
    canManage=a.has("health.schedules.manage");
  if(!canReview&&!canManage)return <main className="page main">
   <h1>Doctor leave review restricted</h1>
   <p>Your role does not include the current reviewer or schedule management permission.</p>
   <Link href="/admin/health-network">Back to healthcare management</Link>
  </main>;
  return <main className="page main">
   <p><Link href="/admin/health-network">Back to healthcare management</Link></p>
   <DoctorLeaveReviewWorkspace canReview={canReview} canManage={canManage}/>
  </main>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Current permissions unavailable</h1>
   <p>Doctor leave reviews stay protected until permissions can be verified.</p>
  </main>;
 }
}
