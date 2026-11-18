# CG-20 — Reports, MIS, Dashboards & Authorized Exports

### 2026-11-18 original client public reporting and impact evidence handoff

**Binding screenshots/accepted routes:** [47-screenshot full original public website contract](../../../../../docs/research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-FULL-PAGE-PARITY-20261118.md). This is a **design/QA receiving-owner requirement**, not new CG-20 reports or runtime-pass evidence.

**Original screenshots requiring actual source:** `/our-impact` shows impact growth by year, geographic reach (India/States/Districts), category impact distribution, success stories, Key Impact Areas and Latest Updates. `/ngo-information/annual-reports`, `/ngo-information/financial-reports`, `/publications` show real authorized annual and financial PDF/report lists, year/type/category filters, publication dates, downloads/exports and honest empty states. Blank/zero original screenshots do not establish real counts.

**Admin/ownership:** Existing CG-20 report owner creates/reviews versioned public-safe reports from authorized CG-05 project, CG-09 ledger, CG-04 activity and other verified sources; CG-19 stores approved/rights-cleared exported files; CG-18 owns original page layout, source dates and editorial text. Foundation Admin can choose which exact signed-off report/version/metrics to publish; finance/medical/donor/payroll/confidential data must not leak into public chart, CSV or file.

**QA delta on existing US:** exact screenshot-style chart/map/category/year/source dates, original report year/type filtering and safe export, pagination, revocation or corrected-source publish, empty states, verified public PDF version, root/branch access, CSV injection/unsafe filenames, performance, narrow Web/native and original screenshot pixel comparison. No fake metrics and no invented tax/regulatory certification. Actual data, builds, independent qualified review and runtime QA **NOT_RUN**; original task counts and story scope preserved until case reconciliation.


**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-073, FR-074, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-20-BR01–CG-20-BR07, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01, C44, C45, C46, C47, C49.  
**Stage:** Harness Planning / GREENFIELD · **State:** EXPERT_SOURCE_DESIGN_REVIEWED for owner-delegated SHA-bound approval (see current initiative ledger). Previous PRD/HLD hashes independently verified against the current files; authenticated local Harness resolver, independent finance/privacy/database review, real Web/Android/device/runtime QA and performance measurements remain NOT_RUN. This design decision does not certify code delivery.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: Versioned report definitions/runs/schedules and protected artifacts can expose financial, payroll, patient, beneficiary and donor data; enforce same-root scope, query-level row/column authorization, current-recipient download authorization, concurrency and tested restore.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Cross-owner authorized dashboards, stable standard report catalog, allowlisted custom/grouped/pivot/chart query definitions, saved filter/report versions, on-demand export request/run metadata, due schedules and authorized delivery/run history. **Original business source owners retain their own operational lists and source reports** (for example CG-05 project/task/field visit, CG-09 posted financial accounts, CG-11 payroll, CG-15 patient bookings). CG-20 reads their permissioned typed projections only; it must never create a second finance ledger, clinical record, audit event store, donation/stock/employee master or a copy of private source rows. **Real prerequisites:** CG-01 current actor/effective role/resource scope and one genuinely implemented source read facade. P7 scheduling assumes the earlier CG-19 original file/communications owner when protected PDF/XLSX/CSV delivery is enabled. No future CG-22/23/24 optional ERP record is required for first source-backed dashboards and reports; disabled optional ERP sources appear UNAVAILABLE, not zero or synthetic trends. CG-21 retains its original audit-log master and protected audit reader; CG-20 may present only a currently authorized source projection, not duplicate audit storage. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Dashboard source LOADING / AVAILABLE including valid zero / NO_DATA / SOURCE_NOT_AVAILABLE / FAILED or PARTIAL; report DRAFT / QUEUED / RUNNING / READY / EMPTY / FAILED / EXPIRED / REVOKED; schedule ACTIVE / PAUSED / DISABLED; delivery QUEUED / SUPPRESSED / SENT_PENDING / CONFIRMED / FAILED. One authoritative per-source date/currency/status definition and explicit source as-of/cutoff; missing source, stale cache and partial failures are never silently presented as zero or complete. All protected list, aggregate, source picker, custom field, chart, report preview, run, artifact download, schedule recipient, external delivery and archive operations enforce actual **current CG-01 action + row, branch, center, patient-purpose and field-level eligibility** server-side. No unbounded owner scans, insecure stored result rows or frontend-only masking.

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

## Original UI references and functional ownership

Actual screenshots from the verified 167-screen Admin source were re-opened in the CareGanga reference pack for **U01, C44, C45, C46, C47, C48 and C49**. U01 provides the Home dashboard KPI/trend/drilldown shell; C44/C45 are one Reports & System Audit Logs package listing (not a second reporting service); C46 presents MIS period/area filters and frequency/category tiles; C47 presents Analytics & Charts with KPI rows, trends and distributions; C49 contains the three-step custom builder, safe filters/grouping/table/chart/summary/pivot controls, saved filters and schedule/history; **C48 is only an inaccessible Data Export placeholder**, not proof of functioning exports. Preserve original blue selected sidebar, Admin header/menus, cards, filters, table layout, right panels and status/motion treatment. Screenshot demo totals, success badges and example source categories are not real business records. Shared source-derived tokens are CG-01 bootstrap-owned; no alternate UI identity. Full pixel/motion device QA is NOT_RUN.

**Delivery sequence (five independently testable owner stories):**
1. **US-001 / FR-073:** real source-scoped dashboards with safe KPI/time/geo cutoffs, individual owner drilldowns, unavailable/failure distinctions, Foundation Admin Web and permission-equivalent native Internal Android.
2. **US-002 / FR-074:** standard source-authoritative reports and safe allowlisted ad-hoc filter/group/chart/pivot **run** on actual owner projections. Start with one genuine supported owner; only reveal each additional report pack when its owner exists and its read contract works.
3. **US-003 / FR-074:** authenticated custom report creation/edit/copy/retire and saved filter/report revisions; only approved source catalog fields, never SQL or unrestricted cross-module joins.
4. **US-004 / FR-074:** on-demand authorized preview/run and finite PDF/Excel (XLSX)/source-safe CSV export to CG-19 protected artifacts; current permission/scope/expiry revalidated before every download, CSV/Excel formula neutralization, accurate run/empty/failure/revoked states.
5. **US-005 / FR-074:** schedule real saved reports with bounded due-only work, delivery through original CG-19 channels when actually ready, current recipient permission/consent/source checks at generation, send and download, revocation/failure/replay handling, and one original report run history.

**Channel boundary:** Foundation Admin Web delivers U01/C44–C49 reporting work; native Internal Android supplies equivalent **authorized** dashboard/report/filter/saved/run/schedule actions with task-first native navigation when those operations are offered to the same authorized staff. Center Portal Web receives only scoped own-center metrics if original CG-14/15/17 source grants permit; **no separate Center Android package**. Public Website and Public Android **do not expose CG-20 private MIS**: CG-18 may independently publish specifically approved, privacy-safe dated impact summaries from its original editorial/source controls (CG-18 ownership), never reuse a private CG-20 report URL or patient/financial export.

**Source contracts and financial correctness:** CG-05 retains its independent A01/A02/A09/A10/U31 project/task/visit activity report before CG-20; CG-09 alone computes posted GL/expense/bank/budget amounts with correct status, currency and financial year; CG-07 provides verified donation status and CG-19 genuine receipt; CG-04 members/volunteers, CG-06 beneficiaries, CG-08 CSR, CG-10/11 HR/payroll, CG-14/15/17 healthcare provide their own *currently delivered* allowed read projections. CG-21 keeps immutable security/operations audit. Financial and health data never join by guessed person/email or sample screenshot counts. CG-20 can be used without optional partner ERP modules and without unbuilt source packs.

## CG-20 receiving-owner source-backed project/task/activity/visit MIS from CG-05 (narrow)

**Full CG-20 source-design review included this established CG-05 integration.** CG-20 US-001/002 consumes cross-module authorized MIS, while US-003/004/005 own saved definitions, bounded exports and schedules; original CG-05 US-005 already owns operational A01/A02/A09/A10/U31 project/task/activity/visit counts and permitted scoped report without CG-20. **CG-20 US-001/002** consumes only actual CG-05 authenticated, scope-safe read projections (real project/branch/status/priority/category/date/current task due/activity state/visit review & consent) and original CG-09 approved budget/committed/utilized paid money where presented, **not manually reproduced project charts or CG-05-written MIS ledger**. Real CG-05 absence yields honest no-source rather than invented stats, while CG-20 can already report other owners. Follow original Admin audit C44–C49 project report and MIS controls for safe filters, export and role-hidden actions; precise GPS, protected photos, comments, beneficiary identity and staff financials excluded without separately eligible owner grants. Project-source revocation/current branch transfer immediately changes report visibility; pinned historical time windows remain auditable without resurrecting old private access. No CG-20 task/visit business master, no independent webhook/polling needed.


## First usable vertical contract and regression

**Concrete acceptance:** Starting with a real CG-01 authorized actor and one real prior-owner projection, render verified counts with date/scope/source labels; run a standard and restricted custom report with auditable source cutoff; save an allowlisted configuration; export one authorized protected document from real rows; recheck recipient permissions at schedule and artifact retrieval; prohibit cross-branch, patient, salary and donor leaks, idle scans and fabricated data. A schedule with no enabled channels stays honestly pending/unavailable, never 'sent'. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: U01, C44, C45, C46, C47, C49. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) with five cross-stack, source-owned stories and individual source QA; no duplicate stories or CI. Design approval is SHA-bound in the initiative ledger. Formal local Harness resolver, independent CRITICAL database/privacy/financial review, actual SQL migration, payment/owner runtime checks, Android/Play/AAB and rendered original-pixel/motion comparison remain NOT_RUN.