# CG-11 — Payroll Compensation

**Authority:** [PRD](../../prd.md) FR-034, FR-035, FR-036, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-11-BR01–CG-11-BR11, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C01, C02, C03, C04, C05, C06, C07, C08, C09, C10.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Salary versions, deterministic payroll periods, approved payment batches state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Salary versions, deterministic payroll periods, approved payment batches. **Real prerequisite owners:** CG-10, CG-09, CG-03 and CG-19. CG-01 owns identity and access; CG-03 owns approval cases; CG-09 authoritative money, CG-19 shared document/message, CG-18 publication and CG-21 platform audit. Do not create shadow domain records or write directly to other owners' tables. Future modules must complete their own real integration and selectors when data exists; no fake master rows or false completed feature.

**State and invariant:** Payroll draft/review/approved/payment pending/settled. No duplicate period/source posting; payment initiation ≠ settled money. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-034/A-11:** Payroll Admin configures compensation — Set approved salary components, allowances/deductions, periods, attendance rules, tax/statutory settings, bank instructions, arrears, holds and effective dates
- **FR-035/A-11:** Payroll officer runs period — Produce draft payroll from approved eligible employee/attendance data; calculate, validate, adjust, review and obtain required approvals
- **FR-036/A-11:** Authorized payroll payment occurs — Track reserves/batches/payment outcomes, generate private payslips, record history/audit and reconcile exactly one expense/payment outcome in CG-09

Detailed authoritative clauses:
- **CG-11-BR01:** Configure salary structures and components, allowances, deductions, statutory/tax parameters as approved, payroll period and relevant employee-level adjustments.
- **CG-11-BR02:** Maintain payroll eligibility and employee salary information referenced to approved CG-10 employee records.
- **CG-11-BR03:** Generate payroll for a selected period, calculating salary components and applicable attendance/leave/hold/revision/arrears/overtime rules only where configured.
- **CG-11-BR04:** Review, verify and approve payroll before authorized payment; maintain run and revision history.
- **CG-11-BR05:** Support salary reserve, payment batches, deductions, salary payments and pending approval tracking as **sub-workflows** of payroll (not standalone payroll engines).
- **CG-11-BR06:** Generate payslips and authorized notifications; employee access must be private.
- **CG-11-BR07:** Reconcile approved salary payment with CG-09 finance posting and bank/cash settlement without duplicate expenses.
- **CG-11-BR08:** Maintain payroll audit trail and permitted payroll summaries/reports.
- **CG-11-BR09:** One controlled payroll configuration covers frequency/period, salary components, allowances, deductions, taxes and statutory settings where applicable, bank/payment instructions, overtime, late/leave adjustment, arrears, revisions, bonuses/holds, payslip templates and notifications; every configured rule must have defined eligibility/effective-date and effect on actual calculations.
- **CG-11-BR10:** Payroll processing explicitly separates salary structure, draft run/attendance fetch, calculation and validation, review/adjustment, verification/approval, reserve/payment batch, released salary, payslip issue and history. A dashboard link or a re-generated payslip does not create a second salary obligation.
- **CG-11-BR11:** Employee bank, compensation and salary adjustment requests are recorded as controlled changes to the existing employee/payroll relationship, with authorization and effective date. Sensitive bank and salary details remain restricted.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C01, C02, C03, C04, C05, C06, C07, C08, C09, C10. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.