import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {CsrPartnersWorkspace} from "../../../../features/csr/csr-partners-workspace";
import {CsrReviewWorkspace} from "../../../../features/csr/csr-review-workspace";
import {CsrFundingWorkspace} from "../../../../features/csr/csr-funding-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"CSR & Partnerships | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function CsrPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 try{
  if(!process.env.BACKEND_URL)throw Error("CSR service not configured");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",process.env.BACKEND_URL),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",process.env.BACKEND_URL),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error();
  const actor:unknown=await me.json(),grant:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||typeof actor.displayName!=="string"||
   !("roleName" in actor)||typeof actor.roleName!=="string"||!grant||typeof grant!=="object"||
   !("actions" in grant)||!Array.isArray(grant.actions))throw Error();
  const actions=(grant.actions as unknown[]).filter((x):x is {key:string}=>!!x&&typeof x==="object"&&"key" in x&&typeof x.key==="string").map(x=>x.key);
  const canReview=actions.includes("csr.partners.review")&&actions.includes("approvals.review");
  if(!actions.includes("csr.partners.view")&&!canReview)
   return <UnavailablePage title="CSR access unavailable" description="Your current role cannot view CSR partner records." linkLabel="Return to dashboard"/>;
  return <div className="shell"><FoundationAdminNav active="csr" initialActions={actions}
   displayName={actor.displayName} roleName={actor.roleName}
   canViewRoles={actions.includes("roles.view")} canViewAccounts={actions.includes("accounts.view")}
   canViewBranches={actions.includes("foundation.branches.view")} canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace" style={{display:"grid",gap:22}}>{actions.includes("csr.partners.view")&&<CsrPartnersWorkspace canManage={actions.includes("csr.partners.manage")}
    canReadAgreement={actions.includes("documents.files.view")}
    canUploadAgreement={actions.includes("documents.files.manage")&&actions.includes("documents.files.view")}
    canManagePublic={actions.includes("cms.content.manage")&&actions.includes("csr.partners.manage")&&actions.includes("documents.files.view")}/>}
   {actions.includes("csr.partners.view")&&<CsrFundingWorkspace canManage={actions.includes("csr.partners.manage")}/>}
   {canReview&&<CsrReviewWorkspace canConfigure={actions.includes("approvals.process.manage")}/>}
   </main></div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="CSR service unavailable" description="Your current CSR access could not be verified." linkLabel="Return to dashboard"/>;
 }
}
