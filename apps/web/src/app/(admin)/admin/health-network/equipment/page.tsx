import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {AccessDeniedView} from "../../../../../shared/access-denied-view";
import {HealthcareAdminShell} from "../../../../../shared/healthcare-admin-shell";
import {LabEquipmentWorkspace} from "../../../../../features/diagnostics/lab-equipment-workspace";
export const dynamic="force-dynamic";
export default async function LabEquipmentPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 if(!backend)return <main className="page main">
  <h1>Laboratory equipment unavailable</h1>
  <p>The current verified laboratory cannot be checked.</p>
  <Link href="/admin">Return to account</Link>
 </main>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [identity,grants]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
    signal:AbortSignal.timeout(7000)})
  ]);
  if(identity.status===401||grants.status===401)redirect("/admin/login");
  if(!identity.ok||!grants.ok)throw Error("Current lab role unavailable");
  const user:unknown=await identity.json(),scope:unknown=await grants.json();
  if(!user||typeof user!=="object"||
    !("displayName" in user)||typeof user.displayName!=="string"||
    !("roleName" in user)||typeof user.roleName!=="string"||
    !scope||typeof scope!=="object"||
    !("actions" in scope)||!Array.isArray(scope.actions))
   throw Error("Current role unavailable");
  const actions=new Set<string>(scope.actions.flatMap((a:unknown)=>
   a&&typeof a==="object"&&"key" in a&&typeof a.key==="string"?[a.key]:[]));
  if(!actions.has("lab.equipment.view"))
   return <AccessDeniedView accountHref="/admin"
    reason="Your current role is not authorized to view laboratory equipment."/>;
  return <HealthcareAdminShell active="healthLabEquipment"
   actor={{displayName:user.displayName,roleName:user.roleName}} actions={actions}>
   <LabEquipmentWorkspace canView
    canManage={actions.has("lab.equipment.manage")}
    canUpload={actions.has("lab.quality.record")}/>
  </HealthcareAdminShell>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <main className="page main">
   <h1>Laboratory equipment access unavailable</h1>
   <p>Current permissions cannot be verified. No private quality documents are shown.</p>
   <Link href="/admin">Return to account</Link>
  </main>;
 }
}
