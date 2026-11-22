import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {DonationAdminWorkspace} from "../../../../features/campaigns/donation-admin-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Donations | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function DonationsPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  if(!process.env.BACKEND_URL)throw Error();
  const headers={Authorization:"Bearer "+token};
  const [me,access]=await Promise.all([
   fetch(new URL("/api/identity/me",process.env.BACKEND_URL),{
    headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",process.env.BACKEND_URL),{
    headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||access.status===401)redirect("/admin/login");
  if(!me.ok||!access.ok)throw Error();
  const actor:unknown=await me.json(),grant:unknown=await access.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||
   !("roleName" in actor)||typeof actor.displayName!=="string"||typeof actor.roleName!=="string"||
   !grant||typeof grant!=="object"||!("actions" in grant)||!Array.isArray(grant.actions))
   throw Error();
  const actions=(grant.actions as unknown[]).filter((v):v is {key:string}=>Boolean(v)&&
   typeof v==="object"&&"key" in v&&typeof v.key==="string").map(v=>v.key);
  const canView=actions.includes("finance.reports.view");
  const canRecord=actions.includes("finance.journals.post");
  if(!canView&&!canRecord)return <UnavailablePage title="Donations unavailable"
   description="Your Foundation role cannot access protected donations." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="campaigns" initialActions={actions}
   displayName={actor.displayName} roleName={actor.roleName}
   canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")}
   canViewBranches={actions.includes("foundation.branches.view")}
   canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace">
    <p><Link href="/admin/campaigns">Campaign management</Link></p>
    <DonationAdminWorkspace canView={canView} canRecord={canRecord}
     canReview={canRecord&&actions.includes("approvals.review")}
     canIssue={canRecord&&actions.includes("documents.files.manage")}/>
   </main></div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&
    e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Donations unavailable"
   description="Current Foundation donation permissions cannot be verified." linkLabel="Return to dashboard"/>;
 }
}
