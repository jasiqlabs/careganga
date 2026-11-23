# CG-MB-014 — cg12 cross warehouse transfer both sides

**Priority:** P1 · **Owner:** CG-12 stock transfer · **Status:** SOURCE_OWNER_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

InventoryOperationSource.guard iterates the real source and destination locations and checks store rights. Simultaneous dual-store close, order and inventory balance safety are not runtime certified.

## Required business behavior

Transfer A→B requires current authority at both stores, locks before movement, invariant quantity, one shared movement source and no duplicate on retry; a B-only user cannot initiate from A.

## Reproduce and record

Two operators transfer last item A→B while either branch closes and an action is retried; verify active store/source, stock_balance and immutable stock_event.

## Expected closure fix, cross-owner dependencies

Run native/backend/disposable DB race, test rollback and reauthorization; fix only confirmed path. Do not create another inventory ledger.

**Receiving modules:** CG-12,CG-02,CG-06,CG-13. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed source / ownership:** CG12 InventoryOperationSource.guard iterates both source and destination stores sorted and calls original InventoryCatalogService.store with CG02 live permission; InventoryOperationService.confirm writes one original event with opposite signed deltas and InventoryStockCommand orders balance locks and checks nonnegative available stock.

**Remaining:** Two concurrent last-unit transactions, A-only actor B deny, B closed, undo and stock ledger reconciliation executable QA NOT_RUN.

**Gate:** Future decisions are not current source defects, and static source review is not executable QA PASS.
