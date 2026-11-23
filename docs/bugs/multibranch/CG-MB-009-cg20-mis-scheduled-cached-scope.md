# CG-MB-009 — cg20 mis scheduled cached scope

**Priority:** P0 · **Owner:** CG-20 MIS · **Status:** VERIFICATION_GAP · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

MisDashboardService explicitly avoids Foundation-wide aggregate for an ordinary branch-restricted manager and uses source finance/center options. Saved schedules, run artifacts, recipient reauthorization and all source intersections require independent two-branch proof.

## Required business behavior

Branch A staff cannot save/run/download scheduled cross-A+B report or receive stale B artifact after role/branch changes; root and provider center scopes must remain separate.

## Reproduce and record

Create A/B/Center X/Center Y; schedule A report, revoke A before due and attempt direct report download; vary saved definition and report filters; compare CG-09/19 owner totals.

## Expected closure fix, cross-owner dependencies

Review MisSavedReportService, MisReportRunService, MisReportScheduleService, CG-19 artifact/notice against live owner facade, then fix gaps and run work-queue concurrency.

**Receiving modules:** CG-20,CG-19,CG-01,CG-02,CG-14. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23 November — authorized manager combined report source fixes (SOURCE_FIX_AUTHORED_REVIEW_PENDING)

**New behavior:** Region/District manager with actual CG-02 AREA grant or A+B explicit BRANCH grants, and existing `finance.reports.view` + MIS action, can select A, select B, or select **All assigned branches**. CG-20 `MisDashboardService` sends the union request only to original CG-09 `FinanceReportsService.assignedMisSummary/assignedMisMonthlyTrend` when no single branch is chosen. CG-09 checks current CG-01 finance action and original CG-02 current allowed `branchRefs`, excludes `branch_id IS NULL` for limited users, and derives from POSTED journal lines only. Protected Foundation admins retain full Foundation + branches behavior. Web and native Internal Android selector labels distinguish the modes. Existing single-branch CG-09 reports/exports and scheduled-worker authorization are not broadened. `cg20-multibranch-manager-contract.test.ts` authored, NOT_RUN.

**Manual QA, original CG-20 US001, US002 and CG-09 US006:** Seed actual posted A ₹100, B ₹200 and Foundation ₹300 (minor units), plus unrelated C ₹400. A-only manager: can view A=100; forged B 403/404; cannot see Foundation or A+B. A+B manager: A=100, B=200, All assigned=300, not 600 or 700; district manager assigned A/B same; after revoked B grant aggregate becomes A=100 and old B active sessions invalid. Protected root: Foundation+all posted A+B+C+ROOT=1000, and each branch separately. Assert 6-month POSTED monthly trend agrees, typed finance report selected B denies A manager, no leakage in cross-branch export/CG-19 artifact/due job. Two concurrent revocation/report races and snapshots remain **NOT_RUN**; do not mark RUNTIME_PASS.
