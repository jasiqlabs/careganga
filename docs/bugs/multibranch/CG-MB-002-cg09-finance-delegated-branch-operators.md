# CG-MB-002 — cg09 finance delegated branch operators

**Priority:** P0 · **Owner:** CG-09 finance + CG-02 · **Status:** CONFIRMED_SOURCE_DEPENDENCY · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-02 requireFinanceActorBranch, financeReportScope and financeBranches limit branch access to manager_account_ref or root admin; CG-09 accounts/reports and CG-07 finance depend on them.

## Required business behavior

Branch A accountant/cashier with approved action must work only A; a separately granted multi-branch accountant sees A+B but not C; no one gains Foundation root merely from finance.reports.view.

## Reproduce and record

Direct GET/POST finance account/voucher/report/journal/statement on A/B/C using true accountant role and rejected role; compare backend with Admin Web/Internal Android. Present source cannot evidence a specific delegated assignment unless CG-MB-001 is resolved.

## Expected closure fix, cross-owner dependencies

Resolve CG-MB-001 in owner, then trace every CG-09 list/selector/post/approve/export/CSV/PDF/worker and CG-07 payout through it. Check journals original branch lines and historic closed-branch visibility.

**Receiving modules:** CG-01,CG-02,CG-09,CG-07,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
