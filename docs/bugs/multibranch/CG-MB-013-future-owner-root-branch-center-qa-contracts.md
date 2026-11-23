# CG-MB-013 — future owner root branch center qa contracts

**Priority:** P1 · **Owner:** CG-06/08/13/22/23/24 planned owners · **Status:** FUTURE_IMPLEMENTATION_GATE · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

Merged main has no modules for CG-06/08/11/13/22/23/24, while their original module/tasks include root, branch, source-project, center and protected ERP conditions. Planned modules are not runtime-certified by shared CG-01/02 source.

## Required business behavior

Each future story declares exactly ROOT, Foundation BRANCH, healthcare CENTER and PATIENT_OWN scope per record/field and action before code; tests include cross-branch/center, wrong-root, stale source and Android parity.

## Reproduce and record

At first development US and each QA row use two active branches, two unrelated centers, one Foundation root record; deny outsider list/export/approval/stock transfer and verify original owner state.

## Expected closure fix, cross-owner dependencies

Preserve approved original QA IDs/stories; design+implement in receiving owner only, with source facade, composite FK, conditional ERP, no replicated masters. Mark NOT_IMPLEMENTED until real artifacts exist.

**Receiving modules:** CG-06,CG-08,CG-11,CG-13,CG-22,CG-23,CG-24. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed source / ownership:** Existing 24-module original tasks QA overlays and JASIQ-dev guidance distinguish protected ROOT, CG02 BRANCH/AREA/ALL_BRANCHES, CG14 verified healthcare CENTER and patient own consent. No new shadow grants.

**Remaining:** CG06/08/13/22/23/24 authorized original stories must implement and test source permissions; future requirements cannot be claimed source complete now.

**Gate:** Future decisions are not current source defects, and static source review is not executable QA PASS.
