# CG-11 — Payroll Compensation

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

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

**Owns:** Salary versions, deterministic payroll periods, approved payment batches. **Delivery-critical, already-delivered owners:** CG-10 existing employee/attendance, CG-03 approval case, CG-09 real posting/payable and CG-19 secure payslip generation. **Later owned integrations, never required to fake this module's first working path:** No subsequent module is needed for payroll's primary calculation/payment path; CG-20 may only read redacted aggregate projections. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

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

## CG-11 receiving owner: HR change proposals, attendance revisions and exit dues (CG-10 FR-031/BR14, CG-11 BR02/09/11)

**This is a narrowed owning-module insertion, NOT a full CG-11 approval.** CG-10 US-003 owns only a protected proposed salary/date/role/branch and genuine HR transfer/promotion/exit decision; it **does not** set an accepted payroll salary structure, recalculate an approved payroll run or mark any payout. **CG-11 US-001** independently owns the authorized effective-dated employee salary structure and compensation/bank adjustment, using an eligible actual approved CG-10 employee. When an actual CG-10 US-003 authorized promotion/change exists, CG-11 US-001 introduces a version-pinned read of the proposal+CG-03 final decision and independently applies its financial structure revision after CG-11's own permitted payroll approval. No CG-10 proposed amount is automatically payable; original CG-11 salary setup also works with no promotion request. Source-money outcomes remain CG-09.

**CG-11 US-002** consumes actual immutable CG-10 approved attendance/leave/policy version for a pay period. If an authorized late correction is committed after CG-11 freezes a payroll run, CG-11 **introduces** a source-revision change/arrears review and trace within its own payroll calculation; never silently rewrite the original approved run, payslip or paid ledger. If CG-10 source status/permission is missing, calculation blocks or honestly excludes ineligible staff—not assumed present.

**CG-11 US-003** alone owns actual final salary-due payroll source, private payslip and verified batch settlement through original CG-09 linked payment. An HR exit clearance from CG-10 is NOT proof of money paid; CG-11 later introduces the real verified payroll-dues projection back to CG-10 status when both source owners exist. Distinguish PENDING_DUES/APPROVED_RUN/PAYMENT_REQUESTED/PAID_VERIFIED and a truly closed exit; a provider bank ACK alone is not payout. Do not import CG-10 role/branch assignment ownership or create a second accounting payable. Receiving-owner cases live in these CG-11 own stories, and may not be marked complete merely because CG-10 documented an interface. Global CG-11 DLD/UIUX/tasks source must later be independently reviewed before CG-11 approval.


## Independently deliverable vertical flow

**Concrete acceptance:** Freeze versioned pay rules, calculate net salary for one real period, get authentic approval, send one payment instruction and post once on verified result; same period retry cannot pay twice, while draft/approved/paid states stay distinct. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C01, C02, C03, C04, C05, C06, C07, C08, C09, C10. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.