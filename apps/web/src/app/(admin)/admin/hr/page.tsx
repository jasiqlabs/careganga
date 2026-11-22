import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FoundationAdminNav} from "../../../../shared/foundation-admin-nav";
import {UnavailablePage} from "../../../../shared/unavailable-page";
import {HrEnrollmentWorkspace} from "../../../../features/human-resources/hr-enrollment-workspace";
import {HrAttendance} from "../../../../features/human-resources/hr-attendance";
import {HrEmploymentChanges} from "../../../../features/human-resources/hr-employment-changes";
import {HrAppraisalWorkspace,HrMyAppraisals} from "../../../../features/human-resources/hr-appraisals";
import {HrMyProfile} from "../../../../features/human-resources/hr-my-profile";
import {HrEnrollmentReviews} from "../../../../features/human-resources/hr-enrollment-reviews";
export const dynamic="force-dynamic";

/** Original CareGanga private HR home — no public employee master. */
export default async function FoundationHrPage(){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)redirect("/admin/login");
 const endpoint=process.env.BACKEND_URL;
 if(!endpoint)return <UnavailablePage title="Employee records unavailable"
  description="We cannot verify current staff permissions." linkLabel="Return to dashboard"/>;
 try{
  const headers={Authorization:"Bearer "+token};
  const [me,rights]=await Promise.all([
   fetch(new URL("/api/identity/me",endpoint),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)}),
   fetch(new URL("/api/access/effective",endpoint),{headers,cache:"no-store",
    signal:AbortSignal.timeout(8000)})
  ]);
  if(me.status===401||rights.status===401)redirect("/admin/login");
  if(!me.ok||!rights.ok)throw Error("Access unavailable");
  const actor:unknown=await me.json(),access:unknown=await rights.json();
  if(!actor||typeof actor!=="object"||!("displayName" in actor)||!("roleName" in actor)||
   typeof actor.displayName!=="string"||typeof actor.roleName!=="string"||
   !access||typeof access!=="object"||!("actions" in access)||!Array.isArray(access.actions))
   throw Error("Permissions unavailable");
  const actions=access.actions.filter((v:unknown):v is {key:string}=>Boolean(v)&&
   typeof v==="object"&&v!==null&&"key" in v&&
   typeof (v as {key:unknown}).key==="string").map(v=>v.key);
  // Every authenticated staff user can read ONLY their own employment status.
  // Protected HR application directory remains behind separate server RBAC.
  return <div className="shell">
   <FoundationAdminNav active="hr" initialActions={actions}
    displayName={actor.displayName} roleName={actor.roleName}
    canViewRoles={actions.includes("roles.view")}
    canViewAccounts={actions.includes("accounts.view")}
    canViewBranches={actions.includes("foundation.branches.view")}
    canViewFoundation={actions.includes("foundation.profile.view")}/>
   <main className="workspace">
    <nav aria-label="Breadcrumb" style={{marginBottom:"1rem"}}>
     <Link href="/admin/dashboard">Dashboard</Link> / Human Resources
    </nav>
    <header style={{marginBottom:18}}>
     <h1>Human Resources</h1>
     <p style={{color:"var(--cg-muted)"}}>
      Your current Foundation employment status and, if permitted, employee applications.
     </p>
    </header>
    <HrMyProfile/>
    <HrMyAppraisals/>
    <HrEmploymentChanges mode="own"/>
    {actions.includes("hr.changes.manage")&&<HrEmploymentChanges mode="manage" canSelectRoles={actions.includes("roles.select")}/>}
    {actions.includes("hr.changes.review")&&actions.includes("approvals.review")&&<HrEmploymentChanges mode="review"/>}
    {actions.includes("hr.appraisals.manage")&&<HrAppraisalWorkspace/>}
    <HrAttendance canViewStaff={actions.includes("hr.attendance.view")} canCorrect={actions.includes("hr.attendance.correct")} canReviewCorrection={actions.includes("hr.attendance.review")&&actions.includes("approvals.review")} canReviewLeave={actions.includes("hr.leave.view")} canManageLeave={actions.includes("hr.leave.policies.manage")} canConfigure={actions.includes("hr.shifts.manage")&&
      actions.includes("hr.attendance.view")&&actions.includes("hr.employees.view")}/>
    {(actions.includes("hr.applications.view")||actions.includes("hr.employees.view"))&&
     <HrEnrollmentWorkspace canViewApps={actions.includes("hr.applications.view")} canManage={actions.includes("hr.applications.manage")}
       canViewEmployees={actions.includes("hr.employees.view")}
       canSelectAccounts={actions.includes("accounts.select")}
       canSelectRoles={actions.includes("roles.select")}
       canViewPrivate={actions.includes("hr.employees.private.view")}
       canManagePrivate={actions.includes("hr.employees.private.manage")}/> }
    {actions.includes("hr.employees.review")&&actions.includes("approvals.review")&&
      <HrEnrollmentReviews canConfigure={actions.includes("approvals.process.manage")}/>}
   </main>
  </div>;
 }catch(error){
  if(error&&typeof error==="object"&&"digest" in error&&
   typeof error.digest==="string"&&error.digest.startsWith("NEXT_REDIRECT"))
   throw error;
  return <UnavailablePage title="Employee access cannot be verified"
   description="Protected employee information remains hidden until access can be checked."
   linkLabel="Return to my account"/>;
 }
}
