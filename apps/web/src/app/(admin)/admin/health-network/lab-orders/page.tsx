import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {ClinicalLabOrderWorkspace}
 from "../../../../../features/diagnostics/clinical-lab-order-workspace";
export const dynamic="force-dynamic";
export default async function LabOrdersPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Clinical lab unavailable</h1>
  <p>Current lab access cannot be verified.</p><Link href="/admin">Return to account</Link>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||rights.status===401)redirect("/admin/login");
  if(!identity.ok||!rights.ok)throw Error("Current role unavailable");
  const user:unknown=await identity.json(),effective:unknown=await rights.json();
  if(!user||typeof user!=="object"||
    !("displayName" in user)||typeof user.displayName!=="string"||
    !("roleName" in user)||typeof user.roleName!=="string"||
    !effective||typeof effective!=="object"||
    !("actions" in effective)||!Array.isArray(effective.actions))
   throw Error("Current role unavailable");
  const actions=new Set<string>(effective.actions.flatMap((r:unknown)=>
   r&&typeof r==="object"&&"key" in r&&typeof r.key==="string"?[r.key]:[]));
  if(!actions.has("lab.orders.view")&&!actions.has("lab.orders.create"))
   return <AccessDeniedView accountHref="/admin"
    reason="Your account is not currently authorized for clinical laboratory orders."/>;
  return <HealthcareAdminShell active="healthLabOrders"
   actor={{displayName:user.displayName,roleName:user.roleName}} actions={actions}>
   <ClinicalLabOrderWorkspace canCreate={actions.has("lab.orders.create")}
    canView={actions.has("lab.orders.view")}
    canManageSamples={actions.has("lab.orders.view")&&actions.has("lab.samples.manage")}
    canRecordResults={actions.has("lab.orders.view")&&actions.has("lab.results.record")}
    canReview={actions.has("lab.orders.view")&&actions.has("lab.report.review")}
    canRelease={actions.has("lab.orders.view")&&actions.has("lab.report.release")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
    e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Clinical lab access unavailable</h1>
   <p>Patient records remain private until your role can be confirmed.</p>
   <Link href="/admin">Return to account</Link></main>;
 }
}
