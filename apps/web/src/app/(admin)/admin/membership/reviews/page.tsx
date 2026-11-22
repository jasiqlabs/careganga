import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../../shared/unavailable-page";
import {MemberReviewPanel} from "../../../../../features/membership/member-review-panel";
export const dynamic="force-dynamic";
export const metadata={title:"Membership Applications | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function MembershipReviewsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  const base=process.env.BACKEND_URL;if(!base)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([fetch(new URL("/api/identity/me",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
    fetch(new URL("/api/access/effective",base),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))throw Error("Access unavailable");
  const actions=(access.actions as unknown[]).filter((v):v is {key:string}=>!!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string").map(v=>v.key);
  const allowed=["membership.applications.review","approvals.review","documents.files.view"].every(v=>actions.includes(v));
  if(!allowed)return <UnavailablePage title="Membership review access unavailable" description="Your current role cannot review protected member applications." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="membership" initialActions={actions} displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")} canViewBranches={actions.includes("foundation.branches.view")}
    canViewFoundation={actions.includes("foundation.profile.view")}/>
    <main className="workspace"><MemberReviewPanel canConfigure={actions.includes("approvals.process.manage")}/></main></div>;
 }catch(e){if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Membership reviews unavailable" description="We cannot confirm your current protected reviewer permissions." linkLabel="Return to dashboard"/>;}
}
