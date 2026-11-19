import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
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
  const person:unknown=await me.json();
  const result:unknown=await permissions.json();
  if(!result||typeof result!=="object"||!("actions" in result)||
    !Array.isArray(result.actions))throw Error("Invalid role");
  if(!person||typeof person!=="object"||!("displayName" in person)||
    !("roleName" in person)||typeof person.displayName!=="string"||
    typeof person.roleName!=="string")throw Error("Current account unavailable");
  const allowed=new Set<string>(result.actions.flatMap((a:unknown)=>
   a&&typeof a==="object"&&"key" in a&&typeof a.key==="string"?[a.key]:[]));
  const canReview=allowed.has("approvals.review")&&
    allowed.has("health.providers.verify");
  const canPublish=allowed.has("health.centers.publish");
  if(!canReview&&!canPublish)
   return <AccessDeniedView reason="Your current Foundation role cannot inspect private center permissions." accountHref="/admin/health-network"/>;
  return <HealthcareAdminShell active="healthNetwork"
   actor={{displayName:person.displayName,roleName:person.roleName}}
   actions={allowed}>
    <div className="cg-health-review-layout">
     <div className="cg-health-route-intro">
      <h1>Healthcare Capability Reviews</h1>
      <p>Review the original center access requests and current approval state.</p>
     </div>
     <CenterErpGrantReviews canReview={canReview} canPublish={canPublish}/>
    </div>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
     e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Current permission unavailable</h1>
   <p>This review stays private until your role and session can be checked.</p>
   <Link href="/admin">Return to account</Link></main>;
 }
}
