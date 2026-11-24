import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {BeneficiariesWorkspace} from "../../../../features/beneficiaries/beneficiaries-workspace";
export const dynamic="force-dynamic";
export default async function BeneficiariesPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const backend=process.env.BACKEND_URL;
 try{
  if(!backend)throw Error("Unavailable");
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",backend),{headers,cache:"no-store",signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor=await me.json(),access=await rights.json();
  if(typeof actor?.displayName!=="string"||typeof actor?.roleName!=="string"||!Array.isArray(access?.actions))
   throw Error("Access unavailable");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>
   !!v&&typeof v==="object"&&"key" in v&&typeof v.key==="string").map((v:{key:string})=>v.key);
  if(!actions.includes("beneficiaries.view"))
   return <UnavailablePage title="Beneficiary access restricted"
    description="Your current role cannot open private beneficiary records." linkLabel="Return to dashboard"/>;
  return <div className="shell">
   <FoundationAdminNav active="beneficiaries" initialActions={actions}
    displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")}
    canViewAccounts={actions.includes("accounts.view")}
    canViewBranches={actions.includes("foundation.branches.view")}
    canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace">
    <BeneficiariesWorkspace canManage={actions.includes("beneficiaries.manage")}
     canLinkProjects={actions.includes("beneficiaries.projects.manage")&&actions.includes("projects.view")}
     canManageLifecycle={actions.includes("beneficiaries.lifecycle.manage")}
     canRevoke={actions.includes("beneficiaries.consent.revoke")}
     canReadEvidence={actions.includes("documents.files.view")} canUploadEvidence={actions.includes("documents.files.view")&&actions.includes("documents.files.manage")}
     canViewAssistance={actions.includes("beneficiaries.assistance.view")}
     canManageAssistance={actions.includes("beneficiaries.assistance.manage")}
     canReviewAssistance={actions.includes("beneficiaries.assistance.review")&&actions.includes("approvals.review")}
     canDeliverAssistance={actions.includes("beneficiaries.assistance.deliver")}
     canIssueStock={actions.includes("inventory.stock.issue")&&actions.includes("inventory.stock.view")}
     canPreparePayment={actions.includes("finance.vouchers.manage")&&actions.includes("finance.vouchers.view")}
     canExportReports={actions.includes("beneficiaries.reports.export")}
     canSubmitVerification={actions.includes("beneficiaries.manage")}
     canReviewVerification={actions.includes("beneficiaries.verification.review")&&actions.includes("approvals.review")}/>
   </main>
  </div>;
 }catch(e){
  if(e&&typeof e==="object"&&"digest" in e&&typeof e.digest==="string"&&e.digest.startsWith("NEXT_REDIRECT"))throw e;
  return <UnavailablePage title="Beneficiaries unavailable"
   description="We cannot verify your access to beneficiary records." linkLabel="Return to dashboard"/>;
 }
}
