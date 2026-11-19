import type {ReactNode} from "react";
import Link from "next/link";
import {FoundationAdminNav, type FoundationAdminNavProps} from "./foundation-admin-nav";

/**
 * Presentation-only wrapper for existing authorized healthcare admin pages.
 * The owning route must verify the session, role and operation permission before
 * rendering this shell. No protected data or permission checks live here.
 */
export function HealthcareAdminShell({
 actor, actions, active, children
}:{
 actor:{displayName:string;roleName:string};
 actions:ReadonlySet<string>;
 active:FoundationAdminNavProps["active"];
 children:ReactNode;
}){
 const has=(key:string)=>actions.has(key);
 return <div className="shell">
  <FoundationAdminNav active={active}
   displayName={actor.displayName} roleName={actor.roleName}
   canViewRoles={has("roles.view")}
   canViewAccounts={has("accounts.view")||
    (has("accounts.create")&&has("roles.assign"))}
   canViewHealthNetwork={has("health.providers.view")}
   canViewCenterPortal={has("health.centers.draft.edit")}
   canViewDoctors={has("health.doctors.view")}
   canViewSchedules={has("health.schedules.view")}
   canViewPatientIntake={has("health.patients.intake")}
   canViewVisitQueue={has("health.visits.manage")}
   canViewPatientAdmin={has("health.patients.admin.view")}
   canViewFoundation={has("foundation.profile.view")}
   canViewBranches={has("foundation.branches.view")}
   canViewCms={has("cms.content.view")}
   canViewFinance={has("finance.accounts.view")}
   canViewVouchers={has("finance.vouchers.view")}
   canViewApprovals={has("approvals.view")||has("approvals.propose")}
   canViewSupport={has("support.cases.view")||has("support.faq.manage")}
   canManageSecurityPolicy={has("identity.security-policy.manage")}
   canViewSettings={has("platform.settings.view")}
   canViewAudit={has("platform.audit.view")}
   canViewRecovery={has("platform.recovery.view")}
   canViewCommunications={has("communications.notifications.view")||
    has("communications.notices.manage")}/>
  <main className="workspace cg-health-admin-workspace">
   <nav className="cg-health-breadcrumb" aria-label="Healthcare page location">
    <Link href="/admin/dashboard">Dashboard</Link>
    <span aria-hidden="true">/</span>
    <span>Healthcare</span>
   </nav>
   {children}
  </main>
 </div>;
}
