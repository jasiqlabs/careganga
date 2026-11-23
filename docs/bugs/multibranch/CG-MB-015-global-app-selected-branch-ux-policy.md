# CG-MB-015 — global app selected branch ux policy

**Priority:** P2 · **Owner:** Shared Web/Internal Android shell · **Status:** SCOPE_DECISION_REQUIRED · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-02 and current owners provide module-specific scoped branch selectors. No single persisted global current-branch switching contract was evidenced in shared Foundation Admin navigation/shell.

## Required business behavior

The UI must always clearly identify the source branch for each form, money row and report, never silently assume a different hidden active branch after navigation or background refresh.

## Reproduce and record

Switch A→B in Admin Web and Internal Android while drafts, reports and uploads open. Verify current header/filter/state, role revoke, old response ignored. If global switcher is requested, obtain product/UX contract approval.

## Expected closure fix, cross-owner dependencies

Do not invent global storage, implicit per-module automatic switching or override server permission; treat a shared switcher as explicit product decision, not security control.

**Receiving modules:** CG-01,CG-02,CG-05,CG-07,CG-09,CG-10,CG-12,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed source / ownership:** Do not implement an unapproved synchronized application-wide branch switcher. CG02, Finance, MIS Web/Internal Android already have role/scoped original selectors; source permission never trusts UI selected branch.

**Remaining:** Keep future product-wide UX approval gate; this is not a current mandatory code defect and must not block verified CG07 scope functionality.

**Gate:** Future decisions are not current source defects, and static source review is not executable QA PASS.
