# CG-MB-001 — cg01 cg02 staff branch assignments

**Priority:** P0 · **Owner:** CG-01 + CG-02 · **Status:** CONFIRMED_SOURCE_SCOPE_GAP · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-02 BranchSourceFacade.projectBranchScope/financeReportScope and InventoryCatalogService.requireScope authorize a root/protected branch administrator or the single branch.manager_account_ref. CG-01 role assignment is root-scoped; no general active staff-to-many-branches authorization projection was found.

## Required business behavior

Ordinary authorized accountant/cashier/storekeeper/coordinator can be delegated to one or several real active branches without being a branch manager and without receiving root authority.

## Reproduce and record

Create A/B managers; grant an ordinary finance/stock role; attempt to select an explicitly assigned branch through existing APIs. Source appears to reject a non-manager regardless of capability. Test with real current grants before claiming a runtime failure.

## Expected closure fix, cross-owner dependencies

Define least-privilege current CG-01/CG-02 branch assignment owner and validity/revocation; no shadow grants in CG-07. Require proof, effective dates, version/permission invalidation, currently active branch and audit. Every downstream owner must use the genuine facade. Manual/client policy approval may be required before expanding role semantics.

**Receiving modules:** CG-01,CG-02,CG-04,CG-05,CG-09,CG-10,CG-12,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
