import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {CampaignDraftsWorkspace} from "../../../../features/campaigns/campaign-drafts-workspace";
import {CampaignReviewWorkspace} from "../../../../features/campaigns/campaign-review-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Campaigns | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function CampaignsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  if(!process.env.BACKEND_URL)throw Error("Campaign service unavailable");
  const h={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",process.env.BACKEND_URL),{headers:h,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",process.env.BACKEND_URL),{headers:h,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error();
  const actor=await me.json(),grant=await access.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(grant?.actions))throw Error();
  const actions=(grant.actions as unknown[]).filter((v):v is {key:string}=>!!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string").map(v=>v.key);
  const canReview=actions.includes("approvals.review")&&actions.includes("campaigns.review");
  if(!actions.includes("campaigns.view")&&!canReview)return <UnavailablePage title="Campaigns unavailable" description="Your current role cannot access Foundation campaigns." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="campaigns" initialActions={actions}
   displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")}
   canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")}
   canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace" style={{display:"grid",gap:22}}>
   {actions.includes("campaigns.view")&&<CampaignDraftsWorkspace canManage={actions.includes("campaigns.manage")}/>}
   {canReview&&<CampaignReviewWorkspace canConfigure={actions.includes("approvals.process.manage")}/>}
   </main></div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Campaigns unavailable" description="Current Foundation campaign permissions cannot be verified." linkLabel="Return to dashboard"/>;
 }
}
