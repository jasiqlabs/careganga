import {cookies} from "next/headers";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {redirect} from "next/navigation";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {HealthcarePolicyWorkspace} from
 "../../../../../features/healthcare-assistance/healthcare-policy-workspace";
export const dynamic="force-dynamic";
export default async function AssistancePoliciesPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Healthcare support unavailable"
  description="Current staff permissions cannot be verified." linkLabel="Return to account"/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,access]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||access.status===401)redirect("/admin/login");
  if(!identity.ok||!access.ok)throw Error("Current role unavailable");
  const actor:unknown=await identity.json(),role:unknown=await access.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
    typeof actor.displayName!=="string"||
    !("roleName" in actor)||typeof actor.roleName!=="string"||
    !role||typeof role!=="object"||
    !("actions" in role)||!Array.isArray(role.actions))
   throw Error("Original account permissions unavailable");
  const actions=new Set<string>(role.actions.flatMap((r:unknown)=>
   r&&typeof r==="object"&&"key" in r&&typeof r.key==="string"?[r.key]:[]));
  const canReview=actions.has("healthcare.assistance.policies.review")&&
    actions.has("approvals.review");
  if(!actions.has("healthcare.assistance.policies.view")&&!canReview)
   return <AccessDeniedView reason="Your current account is not allowed to view Foundation healthcare assistance policies." accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthAssistancePolicies"
   actor={{displayName:actor.displayName,roleName:actor.roleName}} actions={actions}>
   <HealthcarePolicyWorkspace
    canView={actions.has("healthcare.assistance.policies.view")}
    canManage={actions.has("healthcare.assistance.policies.manage")}
    canReview={canReview}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&
    typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Healthcare assistance access unavailable"
   description="Private policy data remains hidden until role permissions are confirmed."
   linkLabel="Return to account"/>;
 }
}
