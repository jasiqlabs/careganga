import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {MonthlyProviderSettlementWorkspace}
 from "../../../../../features/healthcare-assistance/monthly-provider-settlement-workspace";
export const dynamic="force-dynamic";
export default async function FoundationHealthcareSettlementsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Healthcare settlements unavailable"
  description="Current Foundation permissions cannot be checked." linkLabel="Return to account"/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{
    headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||access.status===401)redirect("/admin/login");
  if(!identity.ok||!access.ok)throw Error("Original Foundation role unavailable");
  const actor:unknown=await identity.json(),permitted:unknown=await access.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
    typeof actor.displayName!=="string"||!("roleName" in actor)||
    typeof actor.roleName!=="string"||!permitted||typeof permitted!=="object"||
    !("actions" in permitted)||!Array.isArray(permitted.actions))
   throw Error("Original staff permission source unavailable");
  const actions=new Set<string>(permitted.actions.flatMap((x:unknown)=>
   x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?[x.key]:[]));
  if(!actions.has("healthcare.assistance.settlements.view"))
   return <AccessDeniedView reason="Your current Foundation role cannot view provider settlements."
    accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthSettlements" actions={actions}
   actor={{displayName:actor.displayName,roleName:actor.roleName}}>
   <MonthlyProviderSettlementWorkspace
    canPropose={actions.has("healthcare.assistance.settlements.manage")&&
     actions.has("health.providers.finance.view")}
    canReview={actions.has("healthcare.assistance.settlements.review")&&
     actions.has("approvals.review")&&actions.has("health.providers.finance.view")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
   typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Foundation settlement records unavailable"
   description="Protected provider obligations remain hidden until access is verified."
   linkLabel="Return to account"/>;
 }
}
