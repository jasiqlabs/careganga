import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {LabTestMasterWorkspace} from "../../../../../features/diagnostics/lab-test-master-workspace";
export const dynamic="force-dynamic";

export default async function DiagnosticsAdminPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main">
  <h1>Diagnostic test master unavailable</h1>
  <p>Current access could not be confirmed.</p>
  <Link href="/admin">Return to account</Link>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||rights.status===401)redirect("/admin/login");
  if(!identity.ok||!rights.ok)throw Error("Current access is unavailable");
  const person:unknown=await identity.json();
  const effective:unknown=await rights.json();
  if(!person||typeof person!=="object"||
   !("displayName" in person)||typeof person.displayName!=="string"||
   !("roleName" in person)||typeof person.roleName!=="string"||
   !effective||typeof effective!=="object"||
   !("actions" in effective)||!Array.isArray(effective.actions))
   throw Error("Current access could not be confirmed");
  const actions=new Set<string>(effective.actions.flatMap((entry:unknown)=>
   entry&&typeof entry==="object"&&"key" in entry&&
    typeof entry.key==="string"?[entry.key]:[]));
  if(!actions.has("diagnostics.catalog.view"))
   return <AccessDeniedView accountHref="/admin"
    reason="Your current role cannot view the Foundation lab test master."/>;
  return <HealthcareAdminShell active="healthDiagnostics"
   actor={{displayName:person.displayName,roleName:person.roleName}}
   actions={actions}>
   <LabTestMasterWorkspace
    canManage={actions.has("diagnostics.catalog.manage")}
    canViewPricing={actions.has("diagnostics.pricing.view")}
    canManagePricing={actions.has("diagnostics.pricing.manage")}
    canApprovePricing={actions.has("diagnostics.pricing.approve")&&
     actions.has("approvals.review")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main">
   <h1>Diagnostic access cannot be verified</h1>
   <p>Private records remain hidden until your current role can be confirmed.</p>
   <Link href="/admin">Return to account</Link>
  </main>;
 }
}
