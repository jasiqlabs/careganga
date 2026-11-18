import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {CenterErpGrantReviews} from "../../../../../features/health-network/center-erp-grant-reviews";
export const dynamic="force-dynamic";
export default async function HealthcareErpGrantsPage(){
 const bearer=(await cookies()).get("cg_staff_session")?.value;
 if(!bearer)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Capability review unavailable</h1>
  <p>Protected Foundation access cannot be verified.</p></main>;
 try{
  const [me,permissions]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{cache:"no-store",
    headers:{Authorization:"Bearer "+bearer},signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{cache:"no-store",
    headers:{Authorization:"Bearer "+bearer},signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||permissions.status===401)redirect("/admin/login");
  if(!me.ok||!permissions.ok)throw Error("Unauthorized");
  const result:unknown=await permissions.json();
  if(!result||typeof result!=="object"||!("actions" in result)||
    !Array.isArray(result.actions))throw Error("Invalid role");
  const allowed=new Set<string>(result.actions.flatMap((a:unknown)=>
   a&&typeof a==="object"&&"key" in a&&typeof a.key==="string"?[a.key]:[]));
  if(!allowed.has("health.providers.verify"))
   return <main className="page main"><h1>Review restricted</h1>
    <p>Your current Foundation role cannot inspect private center permissions.</p>
    <Link href="/admin/health-network">Return to healthcare</Link></main>;
  return <main className="page main">
   <p><Link href="/admin/health-network">Back to healthcare management</Link></p>
   <CenterErpGrantReviews
    canReview={allowed.has("approvals.review")}
    canPublish={allowed.has("health.centers.publish")}/>
  </main>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
     e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Current permission unavailable</h1>
   <p>This review stays private until your role and session can be checked.</p>
   <Link href="/admin">Return to account</Link></main>;
 }
}
