import {AccessDeniedView} from "../../../../shared/access-denied-view";
import {cookies} from "next/headers";
import Link from "next/link";
import {redirect} from "next/navigation";
import {HealthcareAdminShell} from "../../../../shared/healthcare-admin-shell";
import {ProviderOnboarding} from "../../../../features/health-network/provider-onboarding";
import {FoundationLabOfferOverview} from "../../../../features/diagnostics/foundation-lab-offer-overview";
import {FoundationLabEquipmentOverview} from "../../../../features/diagnostics/foundation-lab-equipment-overview";
export const dynamic="force-dynamic";

export default async function HealthNetworkPage(){
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)redirect("/admin/login");
  const backend=process.env.BACKEND_URL;
  if(!backend)return <main className="page main">
    <h1>Healthcare registration unavailable</h1>
    <p>Current permissions could not be verified.</p>
    <Link href="/admin">Return to account</Link></main>;
  try{
    const headers={Authorization:"Bearer "+token};
    const [me,effective]=await Promise.all([
      fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)}),
      fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",
        signal:AbortSignal.timeout(7000)})
    ]);
    if(me.status===401||effective.status===401)redirect("/admin/login");
    if(!me.ok||!effective.ok)throw Error("Access unavailable");
    const person:unknown=await me.json(),rights:unknown=await effective.json();
    if(!person||typeof person!=="object"||!("displayName" in person)||
      typeof person.displayName!=="string"||!("roleName" in person)||
      typeof person.roleName!=="string"||
      !rights||typeof rights!=="object"||!("actions" in rights)||
      !Array.isArray(rights.actions))throw Error("Current role unavailable");
    const actions=new Set<string>(rights.actions.flatMap((x:unknown)=>
      x&&typeof x==="object"&&"key" in x&&typeof x.key==="string"?[x.key]:[]));
    if(!actions.has("health.providers.view")&&
      !(actions.has("approvals.review")&&actions.has("health.providers.verify")))
      return <AccessDeniedView reason="Your current role cannot read healthcare provider registrations." accountHref="/admin"/>;
    return <HealthcareAdminShell active="healthNetwork"
    actor={{displayName:person.displayName,roleName:person.roleName}}
    actions={actions}>
      {!actions.has("health.providers.view")&&
       <div className="cg-health-route-intro">
        <h1>Healthcare reviews</h1>
        <p>Select an authorized review task below.</p>
       </div>}
      {actions.has("approvals.review")&&
       (actions.has("health.providers.verify")||actions.has("health.doctors.verify"))&&
       <p><Link href="/admin/health-network/reviews">Review healthcare registrations</Link></p>}

      {actions.has("health.schedules.view")&&
        <p><Link href="/admin/health-network/schedules">
         Doctor Schedule & Availability</Link></p>}
      {(actions.has("health.schedules.manage")||
        actions.has("approvals.review")&&actions.has("health.schedules.view"))&&
        <p><Link href="/admin/health-network/doctor-leaves">
         Doctor Leave & Schedule Approvals</Link></p>}
      {(actions.has("health.centers.publish")||
        actions.has("approvals.review")&&actions.has("health.providers.verify"))&&
        <p><Link href="/admin/health-network/content-reviews">
          Review or publish approved center content</Link></p>}
      {(actions.has("health.centers.publish")||
        actions.has("approvals.review")&&actions.has("health.providers.verify"))&&
        <p><Link href="/admin/health-network/erp-grants">
         Optional center capability approvals</Link></p>}
        {actions.has("health.providers.view")&&actions.has("diagnostics.catalog.view")&&
        <FoundationLabOfferOverview/>}
      {process.env.CAREGANGA_ERP_LAB_ENABLED==="true"&&
       actions.has("health.providers.view")&&actions.has("lab.equipment.view")&&
       <FoundationLabEquipmentOverview token={token}/>} 
      {actions.has("health.providers.view")&&<ProviderOnboarding
        canManage={actions.has("health.providers.manage")}
        canSelectAccounts={actions.has("health.providers.manage")}
        canViewFinance={actions.has("health.providers.finance.view")}
        canManageFinance={actions.has("health.providers.finance.manage")}
        canVerify={actions.has("health.providers.verify")}
        canActivate={actions.has("health.centers.activate")}
        canPublish={actions.has("health.centers.publish")}/>}
  </HealthcareAdminShell>;
  }catch(e){
    if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
      e.digest.startsWith("NEXT_REDIRECT"))throw e;
    return <main className="page main"><h1>Healthcare access cannot be verified</h1>
      <p>Protected healthcare records stay hidden until permissions can be confirmed.</p>
      <Link href="/admin">Return to account</Link></main>;
  }
}
