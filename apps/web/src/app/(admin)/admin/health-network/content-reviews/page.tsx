import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {CenterContentReviewInbox} from "../../../../../features/health-network/center-content-review-inbox";
import {CenterContentPublisherQueue} from "../../../../../features/health-network/center-content-publisher-queue";
export const dynamic="force-dynamic";
export default async function CenterContentReviewPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Reviews unavailable</h1>
  <p>Current Foundation permission could not be verified.</p>
  <Link href="/admin">Return to account</Link></main>;
 try{
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers:{Authorization:"Bearer "+token},
    cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers:{Authorization:"Bearer "+token},
    cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error("Permission unavailable");
  const person:unknown=await me.json();
  const rights:unknown=await access.json();
  if(!rights||typeof rights!=="object"||!("actions" in rights)||
    !Array.isArray(rights.actions))throw Error("Invalid permissions");
  if(!person||typeof person!=="object"||!("displayName" in person)||
    !("roleName" in person)||typeof person.displayName!=="string"||
    typeof person.roleName!=="string")throw Error("Current account unavailable");
  const allowed=new Set<string>(rights.actions.flatMap((v:unknown)=>
   v&&typeof v==="object"&&"key" in v&&typeof v.key==="string"?[v.key]:[]));
  const canReview=allowed.has("approvals.review")&&allowed.has("health.providers.verify");
  const canPublish=allowed.has("health.centers.publish");
  if(!canReview&&!canPublish)
   return <AccessDeniedView reason="Your current role cannot independently review center content." accountHref="/admin/health-network"/>;
  return <HealthcareAdminShell active="healthNetwork"
    actor={{displayName:person.displayName,roleName:person.roleName}}
    actions={allowed}>
     <div className="cg-health-review-layout">
      <div className="cg-health-route-intro">
       <h1>Healthcare Content Reviews</h1>
       <p>Review and publish verified center content within your current permissions.</p>
      </div>
      {canReview&&<CenterContentReviewInbox canPublish={canPublish}/>}
      {canPublish&&<CenterContentPublisherQueue/>}
     </div>
   </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Review access unavailable</h1>
   <p>Current Foundation permission could not be confirmed.</p>
   <Link href="/admin">Return to account</Link></main>;
 }
}
