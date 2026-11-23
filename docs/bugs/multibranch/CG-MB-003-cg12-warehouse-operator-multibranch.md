# CG-MB-003 — cg12 warehouse operator multibranch

**Priority:** P1 · **Owner:** CG-12 inventory · **Status:** SOURCE_INTEGRATION_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

InventoryCatalogService.requireScope checks b.manager_account_ref/root admin; InventoryOperationSource.guard checks two transfer locations but uses the same source store authorization.

## Required business behavior

Authorized storekeeper may operate explicitly assigned store(s) in branch A/B without being the branch manager or managing all Foundation stores.

## Reproduce and record

Try create/receive/issue/transfer/return/adjust/review/export from store A to B with ordinary stockkeeper; inspect both source and destination access, refund/hold balance, and concurrent transfers.

## Expected closure fix, cross-owner dependencies

Implement only after CG-MB-001 approved genuine branch grant; both destination+source current checks, historical immutable movement, signed proof and no negative stock.

**Receiving modules:** CG-01,CG-02,CG-12,CG-06,CG-13. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.

## Source integration update — 23 November

CG-12 `InventoryCatalogService.requireScope` now checks original current CG-02 grants; Foundation-null store remains protected. `InventoryCatalogService.options` currently filters branch/store lists, locations and warehouse KPI counts by the same delegated scope. `InventoryOperationSource.guard` continues to demand both actual source and target stores. `InventorySourceModule` imports current CG02 owner. **Still open:** independent reviewer, actual last-unit/concurrent transfer, direct API, private supplier, counts, unsafe stale A/B selection, PostgreSQL and Internal Android source/runtime QA. Existing CG-MB-014 transfer race remains separate.

### 23-Nov-2026 — final source-owner review disposition

**Source evidence:** CG12 InventoryCatalogService, InventoryOperationSource and InventorySourceModule use CG02 real current branch; Foundation warehouse still root-only.

**Remaining evidence gate:** A/B warehouse catalog, auth, direct private supplier, UI and PostgreSQL runtime NOT_RUN.

**Tracking:** Owner/source stage is not RUNTIME_PASS, no CI/GitHub Actions, no main merge. Evidence and approved original QA IDs must be reconciled with `docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md` and `docs/qa/CAREGANGA-CG07-MULTIBRANCH-LOCAL-DEVELOPER-HANDOFF-20261123.md`.
