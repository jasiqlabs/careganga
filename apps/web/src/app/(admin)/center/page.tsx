import {AccessDeniedView} from "../../../shared/access-denied-view";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {CenterDraftPortal} from "../../../features/health-network/center-draft-portal";
import {HealthcareAdminShell} from "../../../shared/healthcare-admin-shell";
import {UnavailablePage} from "../../../shared/unavailable-page";
export const dynamic="force-dynamic";

export default async function CenterHome(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <UnavailablePage title="Center portal unavailable" description="Current access could not be verified." />;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,access]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{
        headers,cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||access.status===401)redirect("/admin/login");
    if(!me.ok||!access.ok)throw Error("Session unavailable");
    const person:unknown=await me.json(),rights:unknown=await access.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||
      !("roleName" in person)||typeof person.roleName!=="string"||
      !rights||typeof rights!=="object"||!("actions" in rights)||
      !Array.isArray(rights.actions))throw Error("Invalid access response");
    const allowed=new Set<string>(rights.actions.flatMap((x:unknown)=>
      x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?
      [x.key]:[]));
    if(!allowed.has("health.centers.draft.edit"))
      return <AccessDeniedView reason="Only a currently authorized representative may open their assigned center." accountHref="/admin"/>;
    return <HealthcareAdminShell active="healthCenter"
      actor={{displayName:person.displayName,roleName:person.roleName}}
      actions={allowed}>
      <CenterDraftPortal
       canViewLabPricing={allowed.has("diagnostics.pricing.view")}
       canManageLabPricing={allowed.has("diagnostics.pricing.manage")}
       canViewLabEquipment={allowed.has("lab.equipment.view")}
       canManageLabEquipment={allowed.has("lab.equipment.manage")}
       canUploadLabQuality={allowed.has("lab.quality.record")}
       labERPEnabled={process.env.CAREGANGA_ERP_LAB_ENABLED==="true"}/>
    </HealthcareAdminShell>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&
      typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
    return <UnavailablePage title="Center access cannot be verified" description="Your private center data remains unavailable until the session can be verified." />;
  }
}
