# CG-12 — Inventory Suppliers

**Authority:** [PRD](../../prd.md) FR-037, FR-038, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-12-BR01–CG-12-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Admin global shell; no separate verified capture.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Item/supplier catalog, stock movement ledger, material requests/fulfilment state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Item/supplier catalog, stock movement ledger, material requests/fulfilment. **Delivery-critical, already-delivered owners:** CG-01 secured actor/role, CG-02 actual store/branch geography and CG-03 approval case when required. **Later owned integrations, never required to fake this module's first working path:** CG-09 adds accounting cost/payments, CG-06 uses issue for aid, CG-13 uses physical reward fulfillment; later consumer implements true integration. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

**State and invariant:** Request draft/approved/rejected/fulfilled; receipt/issue/reversal. Atomic stock, no duplicate issues or unauthorized negative balance. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-037/A-12:** Inventory officer manages stock — Maintain item/supplier master, receipts, issuance, authorized adjustment, availability, low-stock alerts and transaction history
- **FR-038/A-12:** Staff requests material — Submit and track request through approval/rejection and fulfilled quantity, with project, beneficiary and reward consumption linked to one stock inventory

Detailed authoritative clauses:
- **CG-12-BR01:** Maintain item catalog with category, details and available stock.
- **CG-12-BR02:** Maintain supplier/vendor directory used by inventory and linked finance.
- **CG-12-BR03:** Record stock receipts, issues and permitted adjustments with quantity changes and transaction history.
- **CG-12-BR04:** Submit material requests, review/approve/reject them and track request/fulfilment status.
- **CG-12-BR05:** Record inventory distributions, low-stock alerts and stock reports.
- **CG-12-BR06:** Link relevant stock consumption to projects/beneficiary distribution/reward fulfillment without maintaining duplicate counters.

## Independently deliverable vertical flow

**Concrete acceptance:** Create real supplier/item, receive stock, request/reserve/issue/return and reject simultaneous competing last-quantity issues; every movement has real source, stock never goes negative or silently changes another branch. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Admin global shell; no separate verified capture. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.