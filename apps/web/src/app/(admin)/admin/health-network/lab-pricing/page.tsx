import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {MyLabPricingWorkspace} from "../../../../../features/diagnostics/my-lab-pricing-workspace";
export const dynamic="force-dynamic";
export default async function MyLabPricingPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main"><h1>Lab pricing unavailable</h1>
  <p>Current access could not be confirmed.</p>
  <Link href="/admin">Return to account</Link></main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Current access unavailable");
  const person:unknown=await me.json(),effective:unknown=await rights.json();
  if(!person||typeof person!=="object"||
   !("displayName" in person)||typeof person.displayName!=="string"||
   !("roleName" in person)||typeof person.roleName!=="string"||
   !effective||typeof effective!=="object"||
   !("actions" in effective)||!Array.isArray(effective.actions))
   throw Error("Current access unavailable");
  const actions=new Set<string>(effective.actions.flatMap((r:unknown)=>
   r&&typeof r==="object"&&"key" in r&&typeof r.key==="string"?[r.key]:[]));
  if(!actions.has("diagnostics.pricing.view"))
   return <AccessDeniedView accountHref="/admin"
    reason="Your current role cannot view assigned lab pricing."/>;
  return <HealthcareAdminShell active="healthLabPricing"
   actor={{displayName:person.displayName,roleName:person.roleName}}
   actions={actions}>
   <MyLabPricingWorkspace canManage={actions.has("diagnostics.pricing.manage")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main"><h1>Lab pricing access unavailable</h1>
   <p>Protected lab records remain hidden until your role can be confirmed.</p>
   <Link href="/admin">Return to account</Link></main>;
 }
}
