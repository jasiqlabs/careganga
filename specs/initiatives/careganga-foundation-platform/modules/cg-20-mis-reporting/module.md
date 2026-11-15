# CG-20 — Mis Reporting

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-20-BR01–CG-20-BR07, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01, C44, C45, C46, C47, C49.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: SCHEMA
database_reason: New source-owned Dashboards, standard/custom/saved reports, scheduled exports state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Dashboards, standard/custom/saved reports, scheduled exports. **Delivery-critical, already-delivered owners:** CG-01 scoped query permissions and at least one existing real owner read projection (CG-02/09/05 or healthcare). **Later integration owners, not blockers for the first self-contained feature:** Each new source module contributes only filtered read projections and its own integration QA; absent sources remain honestly unavailable/empty and never become mock dashboard totals. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Report draft/running/completed/failed; schedule active/disabled. No cross-scope report, shadow accounting or unbounded scheduled polling. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-073/A-20:** Manager examines business — Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records
- **FR-074/A-20:** Authorized user produces reports — Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope

Detailed authoritative clauses:
- **CG-20-BR01:** Super Admin dashboard aggregates members, volunteers, projects, beneficiaries, fundraising, healthcare and financial statistics with recent activities and action navigation.
- **CG-20-BR02:** Each major owner module can present relevant lists, statistics, trends and workflow-status summaries without creating a competing stored record.
- **CG-20-BR03:** Provide standard financial, project, employee, volunteer, membership, health-provider, patient, donation and operations reports with organization/branch/center and date filters.
- **CG-20-BR04:** Provide authorized custom report building (choose data source/module, filter, group, sort, tabular/chart/summary/pivot where supported).
- **CG-20-BR05:** Save filters/reports, schedule reports with frequency/time, export PDF/Excel or applicable supported formats and share via authorized channels.
- **CG-20-BR06:** Honor data-scope restrictions and sensitive-information masking consistently in dashboard, export and scheduled delivery.
- **CG-20-BR07:** Standard report packages include donor and tax-receipt ledgers, finance/audit statements, volunteer roster/activity, beneficiary demographic/assistance reports, CSR contribution, project budget/utilization, healthcare center/doctor/appointment and employee/payroll reports. These are authorized views of module-owned records rather than separately maintained statements.

## CG-20 receiving-owner source-backed project/task/activity/visit MIS from CG-05 (narrow)

**Not full CG-20 expert review/approval.** Original CG-20 US-001/002 owns cross-module authorized MIS, saved reports and bounded exports; original CG-05 US-005 already owns operational A01/A02/A09/A10/U31 project/task/activity/visit counts and permitted scoped report without CG-20. **CG-20 US-001/002** consumes only actual CG-05 authenticated, scope-safe read projections (real project/branch/status/priority/category/date/current task due/activity state/visit review & consent) and original CG-09 approved budget/committed/utilized paid money where presented, **not manually reproduced project charts or CG-05-written MIS ledger**. Real CG-05 absence yields honest no-source rather than invented stats, while CG-20 can already report other owners. Follow original Admin audit C44–C49 project report and MIS controls for safe filters, export and role-hidden actions; precise GPS, protected photos, comments, beneficiary identity and staff financials excluded without separately eligible owner grants. Project-source revocation/current branch transfer immediately changes report visibility; pinned historical time windows remain auditable without resurrecting old private access. No CG-20 task/visit business master, no independent webhook/polling needed.


## First usable vertical contract and regression

**Concrete acceptance:** Compute an actual permission-scoped financial/operations dashboard from implemented records, revoke access to report and scheduled recipient, and ensure no cross-branch exports, idle jobs or fabricated data. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U01, C44, C45, C46, C47, C49. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.