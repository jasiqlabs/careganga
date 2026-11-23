import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {ReferralRewardsWorkspace} from "../../../../features/referrals/referral-rewards-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Referrals & Rewards | CareGanga Foundation",
 robots:{index:false,follow:false}};
export default async function ReferralsAdminPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  const backend=process.env.BACKEND_URL;
  if(!backend)throw Error("Source unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,effective]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||effective.status===401)redirect("/admin/login");
  if(!me.ok||!effective.ok)throw Error("Session verification unavailable");
  const actor=await me.json() as {displayName?:string;roleName?:string};
  const grant=await effective.json() as {actions?:{key:string}[]};
  const actions=Array.isArray(grant.actions)?
   grant.actions.flatMap(v=>typeof v?.key==="string"?[v.key]:[]):[];
  if(typeof actor.displayName!=="string"||typeof actor.roleName!=="string")throw Error();
  if(!actions.includes("referrals.programmes.view")&&!actions.includes("rewards.catalog.view"))
   return <UnavailablePage title="Referral access restricted"
    description="Your current Foundation role cannot access the protected programme or reward catalogue."
    linkLabel="Return to dashboard"/>;
  return <div className="shell">
   <FoundationAdminNav active="referrals" initialActions={actions}
    displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")}
    canViewAccounts={actions.includes("accounts.view")}
    canViewBranches={actions.includes("foundation.branches.view")}
    canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace"><ReferralRewardsWorkspace
    canViewPolicy={actions.includes("referrals.programmes.view")}
    canViewRewards={actions.includes("rewards.catalog.view")}
    canManagePolicy={actions.includes("referrals.programmes.manage")}
    canManageRewards={actions.includes("rewards.catalog.manage")}/></main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
   e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Referral source unavailable"
   description="Current protected Foundation access could not be verified."
   linkLabel="Return to dashboard"/>;
 }
}
