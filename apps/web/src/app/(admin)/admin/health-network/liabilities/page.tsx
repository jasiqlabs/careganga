import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {CompletedConsultationLiabilityWorkspace}
 from "../../../../../features/healthcare-assistance/completed-consultation-liability-workspace";
export const dynamic="force-dynamic";
/** CG17 US005 Foundation-only obligations; original CG01 session source.
 * A verified patient consultation or an online payment is NOT a payable.
 */
export default async function FoundationHealthcareLiabilitiesPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Foundation obligations unavailable"
  description="Current Foundation access cannot be verified." linkLabel="Return to account"/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||access.status===401)redirect("/admin/login");
  if(!identity.ok||!access.ok)throw Error("Current Foundation role unavailable");
  const person:unknown=await identity.json(),rights:unknown=await access.json();
  if(!person||typeof person!=="object"||!("displayName" in person)||
    typeof person.displayName!=="string"||!("roleName" in person)||
    typeof person.roleName!=="string"||!rights||typeof rights!=="object"||
    !("actions" in rights)||!Array.isArray(rights.actions))
   throw Error("Original Foundation access could not be verified");
  const actions=new Set<string>(rights.actions.flatMap((v:unknown)=>
   v&&typeof v==="object"&&"key" in v&&typeof v.key==="string"?[v.key]:[]));
  if(!actions.has("healthcare.assistance.liabilities.view"))
   return <AccessDeniedView reason="Your current Foundation role cannot review healthcare obligations."
    accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthLiabilities" actions={actions}
   actor={{displayName:person.displayName,roleName:person.roleName}}>
   <CompletedConsultationLiabilityWorkspace
    canManage={actions.has("healthcare.assistance.liabilities.manage")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
     typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Healthcare obligations unavailable"
   description="Private Foundation records remain hidden until original staff access is verified."
   linkLabel="Return to account"/>;
 }
}
