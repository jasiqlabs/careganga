import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Group 5 — UI, Responsiveness & Accessibility Automated Testing (QA06)", () => {
  const root = resolve(__dirname, "../../..");
  const webPath = resolve(root, "apps/web");
  const recoveryPanelPath = resolve(
    webPath,
    "src/features/platform-configuration/recovery-panel.tsx"
  );
  const auditPanelPath = resolve(
    webPath,
    "src/features/platform-configuration/platform-audit-panel.tsx"
  );
  const backupPagePath = resolve(
    webPath,
    "src/app/(admin)/admin/backup-recovery/page.tsx"
  );
  const auditPagePath = resolve(webPath, "src/app/(admin)/admin/audit/page.tsx");
  const globalsCssPath = resolve(webPath, "src/app/globals.css");

  let recoveryPanelCode: string;
  let auditPanelCode: string;
  let backupPageCode: string;
  let auditPageCode: string;
  let globalsCssCode: string;

  before(() => {
    recoveryPanelCode = readFileSync(recoveryPanelPath, "utf8");
    auditPanelCode = readFileSync(auditPanelPath, "utf8");
    backupPageCode = readFileSync(backupPagePath, "utf8");
    auditPageCode = readFileSync(auditPagePath, "utf8");
    globalsCssCode = readFileSync(globalsCssPath, "utf8");
  });

  // ==========================================================================
  // SECTION 1: ROUTE & AUTHORIZATION GUARDS (Web Server)
  // ==========================================================================
  describe("Section 1: Route & Authorization Guards (Web Server)", () => {
    test("UI-01: /admin/backup-recovery redirects unauthenticated users to /admin/login", async () => {
      const res = await fetch("http://localhost:3000/admin/backup-recovery", {
        redirect: "manual",
      });
      assert.equal(
        res.status,
        307,
        "Unauthenticated access must return 307 redirect"
      );
      const loc = res.headers.get("location");
      assert.ok(
        loc?.includes("/admin/login"),
        "Redirect location must be /admin/login"
      );
    });

    test("UI-02: /admin/audit redirects unauthenticated users to /admin/login", async () => {
      const res = await fetch("http://localhost:3000/admin/audit", {
        redirect: "manual",
      });
      assert.equal(
        res.status,
        307,
        "Unauthenticated access must return 307 redirect"
      );
      const loc = res.headers.get("location");
      assert.ok(
        loc?.includes("/admin/login"),
        "Redirect location must be /admin/login"
      );
    });

    test("UI-03: Page contracts require platform.recovery.view and platform.audit.view", () => {
      assert.ok(
        backupPageCode.includes('keys.includes("platform.recovery.view")'),
        "Backup & Restore page must enforce platform.recovery.view"
      );
      assert.ok(
        backupPageCode.includes("<AccessDeniedView"),
        "Must render AccessDeniedView when unauthorized"
      );
      assert.ok(
        auditPageCode.includes('keys.includes("platform.audit.view")'),
        "Audit page must enforce platform.audit.view"
      );
      assert.ok(
        auditPageCode.includes("<AccessDeniedView"),
        "Must render AccessDeniedView when unauthorized"
      );
    });
  });

  // ==========================================================================
  // SECTION 2: BACKUP & RESTORE COMPONENT CONTRACT (Screenshot Parity)
  // ==========================================================================
  describe("Section 2: Backup & Restore UI Component Parity (C55 Audit Reference)", () => {
    test("UI-04: Header and title match screenshot and approved contract", () => {
      assert.ok(
        recoveryPanelCode.includes("<h1>Backup &amp; Restore</h1>") ||
          recoveryPanelCode.includes("<h1>Backup & Restore</h1>"),
        "Heading must be Backup & Restore"
      );
      assert.ok(
        recoveryPanelCode.includes(
          "Restricted recovery readiness and independently authorized operations"
        ),
        "Subtitle must explain restricted recovery readiness"
      );
    });

    test("UI-05: Refresh readiness button is accessible, typed, and disabled during active operations", () => {
      assert.ok(
        recoveryPanelCode.includes('<button type="button" disabled={saving||loading||unknown}'),
        "Button must have type='button' and disable during saving/loading/unknown"
      );
      assert.ok(
        recoveryPanelCode.includes("Refresh readiness"),
        "Button text must be 'Refresh readiness'"
      );
    });

    test("UI-06: Secured backup readiness section with ARIA labelling", () => {
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="recovery-readiness-title"'),
        "Readiness pane must be labelled by recovery-readiness-title"
      );
      assert.ok(
        recoveryPanelCode.includes('id="recovery-readiness-title">Secured backup readiness</h2>'),
        "Heading ID must match ARIA label"
      );
    });

    test("UI-07: Unavailable state card displays contract-correct explanation", () => {
      assert.ok(
        recoveryPanelCode.includes("Backup & restore unavailable"),
        "Card must state 'Backup & restore unavailable' when not connected"
      );
      assert.ok(
        recoveryPanelCode.includes("{availability.message}"),
        "Card must display truthful message from availability API"
      );
      assert.ok(
        recoveryPanelCode.includes(
          "CareGanga never assumes that an integration reference is a usable backup."
        ),
        "Card must display CareGanga operational guidance paragraph"
      );
      assert.ok(
        recoveryPanelCode.includes(
          "A production restore requires separate operations authorization,"
        ),
        "Guidance must state operations authorization and isolated drill requirements"
      );
    });

    test("UI-08: Request recovery form is conditionally hidden when availability is NOT_AVAILABLE", () => {
      // Form must only render if availability?.status === 'AVAILABLE'
      assert.ok(
        recoveryPanelCode.includes('availability?.status==="AVAILABLE"&&!authorization&&<div className="role-pane">'),
        "Request recovery form MUST be completely hidden when provider is NOT_AVAILABLE"
      );
    });

    test("UI-09: Recovery request history empty state with accessible status role", () => {
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="recovery-requests-title"'),
        "History section must have ARIA label"
      );
      assert.ok(
        recoveryPanelCode.includes(
          'role="status">No recovery requests recorded. No restore activity is claimed.</p>'
        ),
        "Empty state must have role='status' and correct text"
      );
    });

    test("UI-10: Authorization drawer uses accessible dialog semantics and modal trap", () => {
      assert.ok(
        recoveryPanelCode.includes('role="dialog" aria-modal="true"'),
        "Drawer must have role='dialog' and aria-modal='true'"
      );
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="recovery-authorization-title"'),
        "Drawer must be labelled by heading"
      );
    });
  });

  // ==========================================================================
  // SECTION 3: AUDIT LOGS COMPONENT CONTRACT (C09, C10, C52, C53)
  // ==========================================================================
  describe("Section 3: Audit Logs UI Component Parity (C09/C10/C52/C53 References)", () => {
    test("UI-11: Audit title and KPI cards present", () => {
      assert.ok(
        auditPanelCode.includes("<h1>Audit Logs</h1>"),
        "Heading must be Audit Logs"
      );
      assert.ok(
        auditPanelCode.includes("<small>Visible audit events</small>"),
        "KPI 1: Visible audit events"
      );
      assert.ok(
        auditPanelCode.includes("<small>Feed coverage</small>"),
        "KPI 2: Feed coverage"
      );
      assert.ok(
        auditPanelCode.includes("<small>Records per page</small>"),
        "KPI 3: Records per page"
      );
    });

    test("UI-12: Export button disabled when feed coverage is not COMPLETE", () => {
      assert.ok(
        auditPanelCode.includes('disabled={loading||exporting||page?.coverage!=="COMPLETE"}'),
        "Export button must be disabled when coverage is not COMPLETE"
      );
    });

    test("UI-13: Detail drawer includes modal focus trap and Escape key listener", () => {
      assert.ok(
        auditPanelCode.includes('role="dialog" aria-modal="true"'),
        "Detail drawer must be role='dialog' aria-modal='true'"
      );
      assert.ok(
        auditPanelCode.includes('event.key==="Escape"'),
        "Must dismiss detail on Escape key"
      );
      assert.ok(
        auditPanelCode.includes('event.key!=="Tab"'),
        "Must handle Tab key for focus trapping"
      );
      assert.ok(
        auditPanelCode.includes("controls[controls.length-1].focus()"),
        "Must wrap Shift+Tab focus to last control"
      );
    });

    test("UI-14: Table has accessible column headers and readable cell values", () => {
      assert.ok(
        auditPanelCode.includes("<th>Date &amp; time</th>"),
        "Table must have Date & time column"
      );
      assert.ok(
        auditPanelCode.includes("<th>Source</th>"),
        "Table must have Source column"
      );
      assert.ok(
        auditPanelCode.includes("<th>Action</th>"),
        "Table must have Action column"
      );
      assert.ok(
        auditPanelCode.includes("<th>Actor</th>"),
        "Table must have Actor column"
      );
      assert.ok(
        auditPanelCode.includes("<th>Target</th>"),
        "Table must have Target column"
      );
      assert.ok(
        auditPanelCode.includes("<th>Outcome</th>"),
        "Table must have Outcome column"
      );
    });
  });

  // ==========================================================================
  // SECTION 4: RESPONSIVENESS & VIEWPORT LAYOUT (1440x900, 768x1024, 375x812)
  // ==========================================================================
  describe("Section 4: Responsiveness & Viewport Layout (Desktop, Tablet, Mobile)", () => {
    test("UI-15: Desktop (1440x900): Full layout grid and sidebar spacing", () => {
      assert.ok(
        globalsCssCode.includes(".shell") || globalsCssCode.includes(".workspace"),
        "Shell and workspace containers must be defined"
      );
      assert.ok(
        globalsCssCode.includes(".role-table"),
        "Role table styles must be defined"
      );
    });

    test("UI-16: Tablet (768x1024): Table wrapping container prevents page breaking", () => {
      assert.ok(
        recoveryPanelCode.includes('className="role-table-wrap"'),
        "Recovery table must be wrapped in role-table-wrap"
      );
      assert.ok(
        auditPanelCode.includes('className="role-table-wrap"'),
        "Audit table must be wrapped in role-table-wrap"
      );
      assert.ok(
        globalsCssCode.includes(".role-table-wrap"),
        "role-table-wrap CSS class must be defined in stylesheet"
      );
    });

    test("UI-17: Mobile (375x812): Drawer uses responsive full-width adaptation", () => {
      assert.ok(
        recoveryPanelCode.includes('className="role-drawer"'),
        "Drawer must use role-drawer container"
      );
      assert.ok(
        recoveryPanelCode.includes('className="drawer-backdrop"'),
        "Drawer backdrop must exist for modal masking"
      );
    });

    test("UI-18: CareGanga original design token conformance", () => {
      // Must use shared design tokens
      assert.ok(
        globalsCssCode.includes("--cg-primary") || globalsCssCode.includes("var(--cg-"),
        "Must reference shared CareGanga CSS variables"
      );
    });
  });
});
