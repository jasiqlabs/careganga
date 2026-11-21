import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {PartnerApplicationInbox} from "../../../../../features/health-network/partner-application-inbox";
export const dynamic="force-dynamic";
export default async function HealthcarePartnerApplicationsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <UnavailablePage title="Healthcare partner applications unavailable"
  description="The original registration source could not be verified."/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error();
  const profile:unknown=await me.json(),allowed:unknown=await rights.json();
  if(!profile||typeof profile!=="object"||
   !("displayName" in profile)||typeof profile.displayName!=="string"||
   !("roleName" in profile)||typeof profile.roleName!=="string"||
   !allowed||typeof allowed!=="object"||!("actions" in allowed)||
   !Array.isArray(allowed.actions))throw Error();
  const actions=new Set<string>(allowed.actions.flatMap((item:unknown)=>
   item&&typeof item==="object"&&"key" in item&&typeof item.key==="string"?
    [item.key]:[]));
  if(!actions.has("health.providers.view"))
   return <AccessDeniedView reason="Your current role cannot view healthcare partner applications."
    accountHref="/admin"/>;
  return <HealthcareAdminShell active="healthNetwork"
    actor={{displayName:profile.displayName,roleName:profile.roleName}}
    actions={actions}>
    <PartnerApplicationInbox canManage={actions.has("health.providers.manage")}/>
   </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Partner application access unavailable"
   description="Protected partner applications remain unavailable until permissions can be verified."/>;
 }
}
