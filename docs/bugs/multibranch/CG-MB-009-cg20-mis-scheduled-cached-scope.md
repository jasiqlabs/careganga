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
