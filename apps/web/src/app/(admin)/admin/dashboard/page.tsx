import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FoundationAdminNav } from "../../../../shared/foundation-admin-nav";
import { AuthWelcomeListener } from "../../../../shared/auth-notification";
import { AccessVerificationView } from "../../../../shared/access-verification-view";
import { MisDashboardPanel } from "../../../../features/mis-reporting/mis-dashboard-panel";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const token = (await cookies()).get("cg_staff_session")?.value;
  if (!token) redirect("/admin/login");

  const backend = process.env.BACKEND_URL;
  let current: { displayName: string; roleName: string; scope: string } | null = null;
  let invalidSession = false;
  let canViewRoles = false;
  let canViewAccounts = false;
  let canManageSecurityPolicy = false;
  let canViewSettings = false;
  let canViewAudit = false;
  let canViewRecovery = false;
  let canViewApprovals = false;
  let canViewDocuments = false;
  let canViewCommunications = false;
  let canViewSupport = false;
  let canViewFinance = false;
  let canViewVouchers = false;
  let canViewFoundation = false;
  let canViewBranches = false;
  // Already verified by the backend for this request; avoids temporary missing
  // healthcare/CMS/finance navigation before the shared sidebar rechecks access.
  let verifiedActions: string[] | undefined;

  if (backend) {
    try {
      const response = await fetch(new URL("/api/identity/me", backend), {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        signal: AbortSignal.timeout(7000)
      });
      if (response.status === 401) invalidSession = true;
      if (response.ok) {
        const permissions = await fetch(new URL("/api/access/effective", backend), {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
          signal: AbortSignal.timeout(7000)
        });
        if (permissions.status === 401) invalidSession = true;
        if (permissions.ok) {
          const effective = (await permissions.json()) as { actions?: { key?: string }[] };
          const keys = Array.isArray(effective.actions)
            ? effective.actions.flatMap(x => typeof x?.key === "string" ? [x.key] : [])
            : [];
          verifiedActions = keys;
          canViewRoles = keys.includes("roles.view");
          canViewFinance = keys.includes("finance.accounts.view");
          canViewVouchers = keys.includes("finance.vouchers.view");
          canViewAccounts =
            keys.includes("accounts.view") ||
            (keys.includes("accounts.create") && keys.includes("roles.assign"));
          canManageSecurityPolicy = keys.includes("identity.security-policy.manage");
          canViewSettings = keys.includes("platform.settings.view");
          canViewAudit = keys.includes("platform.audit.view");
          canViewRecovery = keys.includes("platform.recovery.view");
          canViewApprovals = keys.includes("approvals.view") || keys.includes("approvals.propose");
          canViewDocuments =
            ["documents.files.view", "documents.files.manage"].every(key => keys.includes(key)) &&
            canViewApprovals;
          canViewSupport = keys.includes("support.cases.view") || keys.includes("support.faq.manage");
          canViewCommunications = keys.some(x =>
            [
              "communications.notifications.view",
              "communications.notices.manage",
              "communications.delivery.view"
            ].includes(x)
          );
          canViewFoundation = ["foundation.profile.view", "foundation.geography.view", "foundation.departments.view"].some(k => keys.includes(k));
          canViewBranches = keys.includes("foundation.branches.view");
        }
        const data: unknown = await response.json();
        if (
          data &&
          typeof data === "object" &&
          "displayName" in data &&
          "roleName" in data &&
          "scope" in data &&
          typeof data.displayName === "string" &&
          typeof data.roleName === "string" &&
          typeof data.scope === "string"
        ) {
          current = { displayName: data.displayName, roleName: data.roleName, scope: data.scope };
        }
      }
    } catch {
      /* Offline is not permission to show protected data. */
    }
  }

  if (invalidSession) redirect("/admin/login");
  if (!current) {
    return <AccessVerificationView mode="unconfirmed-session" />;
  }

  return (
    <div className="shell">
      <AuthWelcomeListener displayName={current.displayName} roleName={current.roleName} />
      <FoundationAdminNav
        initialActions={verifiedActions}
        active="dashboard"
        displayName={current.displayName}
        roleName={current.roleName}
        canViewRoles={canViewRoles}
        canViewAccounts={canViewAccounts}
        canManageSecurityPolicy={canManageSecurityPolicy}
        canViewSettings={canViewSettings}
        canViewAudit={canViewAudit}
        canViewRecovery={canViewRecovery}
        canViewApprovals={canViewApprovals}
        canViewDocuments={canViewDocuments}
        canViewCommunications={canViewCommunications}
        canViewSupport={canViewSupport}
        canViewFinance={canViewFinance}
        canViewVouchers={canViewVouchers}
        canViewFoundation={canViewFoundation}
        canViewBranches={canViewBranches}
      />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Foundation Dashboard</h1>
            <p>CareGanga Foundation Management &amp; Central Operations</p>
          </div>
          <Link href="/">View site</Link>
        </header>

        {/* Operational Overview Cards */}
        <section aria-labelledby="foundation-overview-heading" style={{ marginBottom: "2rem" }}>
          <h2 id="foundation-overview-heading" style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "var(--cg-text)" }}>
            Operations Overview
          </h2>
          <div className="kpi-grid">
            <div className="kpi">
              <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>Current Role</span>
              <strong>{current.roleName}</strong>
              <small style={{ color: "var(--cg-muted)", fontSize: "0.78rem" }}>Assigned System Authority</small>
            </div>
            <div className="kpi">
              <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>Operational Scope</span>
              <strong>{current.scope}</strong>
              <small style={{ color: "var(--cg-muted)", fontSize: "0.78rem" }}>Foundation Organization</small>
            </div>
            <div className="kpi">
              <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>Session Status</span>
              <strong style={{ color: "var(--cg-success, #167a45)" }}>Active &amp; Verified</strong>
              <small style={{ color: "var(--cg-muted)", fontSize: "0.78rem" }}>Authenticated Access</small>
            </div>
          </div>
        </section>

        {/* CG-20 source-backed MIS is visible only when its own capability is granted. */}
        {verifiedActions?.includes("mis.dashboard.view") && <MisDashboardPanel />}

        {/* Quick Access to Authorized Modules */}
        <section aria-labelledby="foundation-quick-access-heading">
          <h2 id="foundation-quick-access-heading" style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "var(--cg-text)" }}>
            Authorized Foundation Modules
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))", gap: "1rem" }}>
            {canViewAccounts && (
              <div className="kpi">
                <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>User &amp; Access</span>
                <strong style={{ fontSize: "1.1rem" }}>Users Management</strong>
                <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.82rem", color: "var(--cg-muted)" }}>
                  Manage Foundation staff accounts, assignments and status.
                </p>
                <Link
                  href="/admin/accounts"
                  className="sidebar-link"
                  style={{
                    background: "var(--cg-accent)",
                    color: "#fff",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRadius: "0.35rem",
                    padding: "0.5rem"
                  }}
                >
                  Open Users Management
                </Link>
              </div>
            )}
            {canViewRoles && (
              <div className="kpi">
                <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>User &amp; Access</span>
                <strong style={{ fontSize: "1.1rem" }}>Roles &amp; Permissions</strong>
                <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.82rem", color: "var(--cg-muted)" }}>
                  Inspect system roles, permission matrices and action mappings.
                </p>
                <Link
                  href="/admin/roles"
                  className="sidebar-link"
                  style={{
                    background: "var(--cg-accent)",
                    color: "#fff",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRadius: "0.35rem",
                    padding: "0.5rem"
                  }}
                >
                  Open Roles &amp; Permissions
                </Link>
              </div>
            )}
            {canViewApprovals && (
              <div className="kpi">
                <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>Workflow &amp; Approvals</span>
                <strong style={{ fontSize: "1.1rem" }}>Registration &amp; Approval</strong>
                <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.82rem", color: "var(--cg-muted)" }}>
                  Review pending organizational proposals and status submissions.
                </p>
                <Link
                  href="/admin/approvals"
                  className="sidebar-link"
                  style={{
                    background: "var(--cg-accent)",
                    color: "#fff",
                    textAlign: "center",
                    textDecoration: "none",
                    borderRadius: "0.35rem",
                    padding: "0.5rem"
                  }}
                >
                  Open Approvals Inbox
                </Link>
              </div>
            )}
            <div className="kpi">
              <span style={{ fontSize: "0.82rem", color: "var(--cg-muted)" }}>Account &amp; Security</span>
              <strong style={{ fontSize: "1.1rem" }}>My Account</strong>
              <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.82rem", color: "var(--cg-muted)" }}>
                View personal access details and manage account credentials.
              </p>
              <Link
                href="/admin"
                className="sidebar-link"
                style={{
                  background: "var(--cg-accent)",
                  color: "#fff",
                  textAlign: "center",
                  textDecoration: "none",
                  borderRadius: "0.35rem",
                  padding: "0.5rem"
                }}
              >
                View My Account
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
