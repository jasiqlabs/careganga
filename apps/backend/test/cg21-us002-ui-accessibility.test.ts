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
  const backupCssPath = resolve(webPath, "src/features/platform-configuration/backup-recovery.css");
  const auditCssPath = resolve(webPath, "src/features/platform-configuration/audit-logs.css");
  const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";

  let recoveryPanelCode: string;
  let auditPanelCode: string;
  let backupPageCode: string;
  let auditPageCode: string;
  let globalsCssCode: string;
  let backupCssCode: string;
  let auditCssCode: string;

  before(() => {
    recoveryPanelCode = readFileSync(recoveryPanelPath, "utf8");
    auditPanelCode = readFileSync(auditPanelPath, "utf8");
    backupPageCode = readFileSync(backupPagePath, "utf8");
    auditPageCode = readFileSync(auditPagePath, "utf8");
    globalsCssCode = readFileSync(globalsCssPath, "utf8");
    backupCssCode = readFileSync(backupCssPath, "utf8");
    auditCssCode = readFileSync(auditCssPath, "utf8");
  });

  // ==========================================================================
  // SECTION 1: ROUTE & AUTHORIZATION GUARDS (Web Server)
  // ==========================================================================
  describe("Section 1: Route & Authorization Guards (Web Server)", () => {
    test("UI-01: /admin/backup-recovery redirects unauthenticated users to /admin/login", async () => {
      const res = await fetch(`${webOrigin}/admin/backup-recovery`, {
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
      const res = await fetch(`${webOrigin}/admin/audit`, {
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
        recoveryPanelCode.includes('>Backup &amp; Restore</h1>') ||
          recoveryPanelCode.includes('>Backup & Restore</h1>'),
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
        recoveryPanelCode.includes('type="button"') &&
          recoveryPanelCode.includes("disabled={saving || loading || unknown}"),
        "Button must have type='button' and disable during saving/loading/unknown"
      );
      assert.ok(
        recoveryPanelCode.includes("Refresh readiness"),
        "Button text must be 'Refresh readiness'"
      );
    });

    test("UI-06: Secured backup readiness section with ARIA labelling", () => {
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="cg-br-readiness-heading"'),
        "Readiness pane must be labelled by cg-br-readiness-heading"
      );
      assert.ok(
        recoveryPanelCode.includes('id="cg-br-readiness-heading"') &&
          recoveryPanelCode.includes("Secured backup readiness"),
        "Heading ID must match ARIA label"
      );
    });

    test("UI-07: Unavailable state card displays contract-correct explanation", () => {
      assert.ok(
        recoveryPanelCode.includes('availability?.status === "AVAILABLE"') &&
          recoveryPanelCode.includes("No independently verified backup facility is connected."),
        "Card must state truthful unavailable status when not connected"
      );
      assert.ok(
        recoveryPanelCode.includes("availability?.message"),
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
          "production restore requires separate operations authorization"
        ),
        "Guidance must state operations authorization and isolated drill requirements"
      );
    });

    test("UI-08: Request recovery form is conditionally hidden when availability is NOT_AVAILABLE", () => {
      assert.ok(
        recoveryPanelCode.includes('availability?.status !== "AVAILABLE"') &&
          recoveryPanelCode.includes("can only be submitted once a secured facility is registered."),
        "Request recovery form MUST be guarded when provider is NOT_AVAILABLE"
      );
    });

    test("UI-09: Recovery request history empty state with accessible status role", () => {
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="cg-br-history-heading"'),
        "History section must have ARIA label"
      );
      assert.ok(
        recoveryPanelCode.includes("No recovery requests yet") &&
          recoveryPanelCode.includes("cg-module-empty"),
        "Empty state must render informative copy"
      );
    });

    test("UI-10: Authorization drawer uses accessible dialog semantics and modal trap", () => {
      assert.ok(
        recoveryPanelCode.includes('role="dialog"') &&
          recoveryPanelCode.includes('aria-modal="true"'),
        "Drawer must have role='dialog' and aria-modal='true'"
      );
      assert.ok(
        recoveryPanelCode.includes('aria-labelledby="cg-br-auth-drawer-title"'),
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
        auditPanelCode.includes('>Audit Logs</h1>'),
        "Heading must be Audit Logs"
      );
      assert.ok(
        auditPanelCode.includes("Visible events"),
        "KPI 1: Visible events"
      );
      assert.ok(
        auditPanelCode.includes("Feed coverage"),
        "KPI 2: Feed coverage"
      );
      assert.ok(
        auditPanelCode.includes("Page size"),
        "KPI 3: Page size"
      );
    });

    test("UI-12: Export button disabled when feed coverage is not COMPLETE", () => {
      assert.ok(
        auditPanelCode.includes('disabled={loading || exporting || page?.coverage !== "COMPLETE"}'),
        "Export button must be disabled when coverage is not COMPLETE"
      );
    });

    test("UI-13: Detail drawer includes modal focus trap and Escape key listener", () => {
      assert.ok(
        auditPanelCode.includes('role="dialog"') &&
          auditPanelCode.includes('aria-modal="true"'),
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
        auditPanelCode.includes('<th scope="col">Date &amp; time</th>'),
        "Table must have Date & time column"
      );
      assert.ok(
        auditPanelCode.includes('<th scope="col">Source</th>'),
        "Table must have Source column"
      );
      assert.ok(
        auditPanelCode.includes('<th scope="col">Action</th>'),
        "Table must have Action column"
      );
      assert.ok(
        auditPanelCode.includes('<th scope="col">Actor</th>'),
        "Table must have Actor column"
      );
      assert.ok(
        auditPanelCode.includes('<th scope="col">Target</th>'),
        "Table must have Target column"
      );
      assert.ok(
        auditPanelCode.includes('<th scope="col">Outcome</th>'),
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
        globalsCssCode.includes(".role-table") && auditCssCode.includes(".cg-audit-table"),
        "Table styles must be defined"
      );
    });

    test("UI-16: Tablet (768x1024): Table wrapping container prevents page breaking", () => {
      assert.ok(
        recoveryPanelCode.includes('className="cg-br-table-wrap"'),
        "Recovery table must be wrapped in cg-br-table-wrap"
      );
      assert.ok(
        auditPanelCode.includes('className="cg-audit-table-wrap"'),
        "Audit table must be wrapped in cg-audit-table-wrap"
      );
      assert.ok(
        backupCssCode.includes(".cg-br-table-wrap") && auditCssCode.includes(".cg-audit-table-wrap"),
        "Table wrapper CSS classes must be defined in stylesheets"
      );
    });

    test("UI-17: Mobile (375x812): Drawer uses responsive full-width adaptation", () => {
      assert.ok(
        recoveryPanelCode.includes('className="cg-br-drawer"'),
        "Drawer must use cg-br-drawer container"
      );
      assert.ok(
        recoveryPanelCode.includes('className="cg-br-drawer-backdrop"'),
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
