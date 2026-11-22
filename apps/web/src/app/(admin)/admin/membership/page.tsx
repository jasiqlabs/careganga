import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {MembershipWorkspace} from "../../../../features/membership/membership-workspace";
import {MemberRoster} from "../../../../features/membership/member-roster";
export const dynamic="force-dynamic";
export default async function MembershipPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)redirect("/admin/login");
 const base=process.env.BACKEND_URL;
 try{
  if(!base)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([fetch(new URL("/api/identity/me",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),fetch(new URL("/api/access/effective",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Access unavailable");
  const actions=access.actions.filter((x:unknown):x is {key:string}=>!!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map((x:{key:string})=>x.key);
  const canTiers=actions.includes("membership.tier.manage"),canMembers=actions.includes("membership.members.view"),canExport=actions.includes("membership.members.export");
  const canReview=["membership.applications.review","approvals.review","documents.files.view"].every(k=>actions.includes(k));
  if(!canTiers&&!canMembers&&!canReview)return <UnavailablePage title="Membership access unavailable" description="Your current role cannot access membership plans or members." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="membership" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName} canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/><main className="workspace">{canTiers?<MembershipWorkspace canViewMembers={canMembers} canExportMembers={canMembers&&canExport} canReviewMembers={canReview}/>:<div className="cg04-admin">{canReview&&<p><a href="/admin/membership/reviews">Review protected membership applications</a></p>}{canMembers&&<MemberRoster canExport={canExport}/>}</div>}</main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;return <UnavailablePage title="Membership unavailable" description="We cannot confirm your membership access." linkLabel="Return to dashboard"/>;}
}
