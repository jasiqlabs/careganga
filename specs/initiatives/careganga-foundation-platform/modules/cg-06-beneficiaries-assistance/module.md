# CG-06 — Beneficiaries Assistance

**Authority:** [PRD](../../prd.md) FR-015, FR-016, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-06-BR01–CG-06-BR05, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) A07, A08.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Restricted beneficiary and project-linked assistance events state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Restricted beneficiary and project-linked assistance events. **Delivery-critical, already-delivered owners:** CG-01 permissions, CG-02 geography, CG-05 real project, CG-12 stock and CG-09 financial posting for corresponding aid types. **Later owned integrations, not prerequisites for this module's core path:** CG-20 publishes only aggregate de-identified impact; CG-18 public projections never expose beneficiary identity. Only real validated records may populate selectors; later owner supplies cross-module implementation and its own QA. No shadow master or fake operational status.

**State and invariant:** Beneficiary new/verified; aid requested/approved/issued/reversed. Material and cash aid require genuine owner movement, no duplicate stock/expense. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-015/A-06:** Staff registers beneficiary — Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history
- **FR-016/A-06:** Approved aid is delivered — Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy

Detailed authoritative clauses:
- **CG-06-BR01:** Register beneficiary profile/contact/geographic details and associate with one or more permitted projects.
- **CG-06-BR02:** Record each assistance action with type/category, item or financial support, quantities, applicable monetary value, date, activity/project link and responsible staff.
- **CG-06-BR03:** Preserve the beneficiary's support/distribution history so repeat assistance and project utilization are traceable.
- **CG-06-BR04:** Reference inventory issue or financial expense/payment when the assistance consumes stock or money; do not maintain disconnected shadow balances.
- **CG-06-BR05:** Provide access-controlled beneficiary search, dashboard and impact reports; personal beneficiary details remain private unless an expressly authorized publication use case exists.

## Independent vertical delivery and acceptance

This module must complete actual create/read/update/review and permissioned Web/Android routes using the above delivered contracts before any source QA may be marked complete. **Concrete acceptance:** Create one consented beneficiary and record project aid; for goods validate one stock issue, for money one recognized financial effect, while protecting private demographics and removing effect on reversal. Inaccessible future features display truthful unavailable states and are verified when their owner ships; do not mark them satisfied today.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: A07, A08. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.